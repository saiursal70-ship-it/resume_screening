import hashlib
import os
from datetime import datetime
from typing import List, Optional
import aiofiles
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import nullslast, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.auth import get_current_user, require_hr
from app.config import settings
from app.database import get_db
import app.database as db_mod
from app.models import Candidate, Job, StageHistory, User
from app.schemas import (
    CandidateDetailOut,
    CandidateListItemOut,
    CandidateRetryOut,
    CandidateStageUpdate,
    CandidateUploadOut,
    StageHistoryOut,
)
from app.services.screening import screen_candidate

router = APIRouter(tags=["candidates"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


@router.post(
    "/jobs/{id}/candidates/upload",
    response_model=List[CandidateUploadOut],
    status_code=status.HTTP_201_CREATED,
)
@router.post(
    "/jobs/{id}/resumes",
    response_model=List[CandidateUploadOut],
    status_code=status.HTTP_202_ACCEPTED,
)
async def upload_candidates(
    id: int,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload resume files (.pdf, .docx, <= 5MB) for a job.
    Rejects duplicates (by SHA-256) and triggers background screening.
    Rejects upload if job requirements have not been confirmed.
    """
    # Verify job exists
    job_stmt = select(Job).where(Job.id == id)
    job = (await db.execute(job_stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if not job.requirements_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requirements must be confirmed before uploading resumes.",
        )

    if not files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No files provided",
        )

    upload_results = []
    seen_hashes_in_batch = set()

    for file in files:
        ext = os.path.splitext(file.filename or "")[1].lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format for {file.filename}. Only .pdf and .docx are supported.",
            )

        content = await file.read()
        if len(content) > settings.MAX_FILE_SIZE_BYTES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File {file.filename} exceeds maximum size of 5MB.",
            )

        file_hash = hashlib.sha256(content).hexdigest()

        # Check duplicate in batch
        if file_hash in seen_hashes_in_batch:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Duplicate file detected in upload batch: {file.filename}",
            )
        seen_hashes_in_batch.add(file_hash)

        # Check duplicate in database for this job
        dup_stmt = select(Candidate).where(
            Candidate.job_id == id,
            Candidate.file_hash == file_hash,
        )
        existing = (await db.execute(dup_stmt)).scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Candidate file '{file.filename}' has already been uploaded for this job.",
            )

        # Save file to disk
        safe_filename = f"{file_hash}_{file.filename}"
        dest_path = settings.upload_path / safe_filename
        async with aiofiles.open(dest_path, "wb") as out_file:
            await out_file.write(content)

        # Create candidate record
        candidate = Candidate(
            job_id=id,
            filename=file.filename or safe_filename,
            file_path=str(dest_path),
            file_hash=file_hash,
            file_size=len(content),
            status="queued",
            stage="new",
        )
        db.add(candidate)
        upload_results.append(candidate)

    await db.commit()

    for candidate in upload_results:
        await db.refresh(candidate)
        # Enqueue background screening task
        background_tasks.add_task(screen_candidate, candidate.id, db_mod.AsyncSessionLocal)

    return [
        CandidateUploadOut(
            id=c.id,
            filename=c.filename,
            status=c.status,
        )
        for c in upload_results
    ]


@router.get("/jobs/{id}/candidates", response_model=List[CandidateListItemOut])
@router.get("/jobs/{id}/applications", response_model=List[CandidateListItemOut])
async def list_candidates_for_job(
    id: int,
    stage: Optional[str] = Query(None),
    sort: Optional[str] = Query("score"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get ranked list of candidates for a job."""
    # Verify job exists
    job_stmt = select(Job).where(Job.id == id)
    job = (await db.execute(job_stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    stmt = select(Candidate).where(Candidate.job_id == id)

    if stage:
        stmt = stmt.where(Candidate.stage == stage)

    if sort in ("score", "-score"):
        stmt = stmt.order_by(nullslast(Candidate.score.desc()))
    elif sort == "created_at":
        stmt = stmt.order_by(Candidate.created_at.desc())
    else:
        stmt = stmt.order_by(nullslast(Candidate.score.desc()))

    result = await db.execute(stmt)
    candidates = result.scalars().all()

    response = []
    for c in candidates:
        missing = []
        if c.screening_result and isinstance(c.screening_result, dict):
            missing = c.screening_result.get("missing_must_haves", [])

        response.append(
            CandidateListItemOut(
                id=c.id,
                filename=c.filename,
                score=c.score,
                stage=c.stage,
                status=c.status,
                missing_must_haves=missing,
                created_at=c.created_at,
            )
        )

    return response


@router.get("/candidates/{id}", response_model=CandidateDetailOut)
@router.get("/applications/{id}", response_model=CandidateDetailOut)
async def get_candidate_detail(
    id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get full details of candidate including screening result, resume text, and verdicts."""
    stmt = select(Candidate).where(Candidate.id == id)
    result = await db.execute(stmt)
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    missing = []
    if candidate.screening_result and isinstance(candidate.screening_result, dict):
        missing = candidate.screening_result.get("missing_must_haves", [])

    data = CandidateDetailOut.model_validate(candidate)
    data.missing_must_haves = missing
    return data


@router.post("/candidates/{id}/retry", response_model=CandidateRetryOut)
@router.post("/applications/{id}/rescreen", response_model=CandidateRetryOut)
async def retry_candidate_screening(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Retry screening for a candidate."""
    stmt = select(Candidate).where(Candidate.id == id)
    result = await db.execute(stmt)
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    candidate.status = "queued"
    candidate.error_message = None
    candidate.updated_at = datetime.utcnow()
    await db.commit()

    background_tasks.add_task(screen_candidate, candidate.id, db_mod.AsyncSessionLocal)

    return CandidateRetryOut(id=candidate.id, status=candidate.status)


@router.post("/jobs/{id}/rescreen-all")
@router.post("/jobs/{id}/candidates/rescreen-all")
async def rescreen_all_candidates(
    id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Re-screen all candidates for a job against the latest criteria (HR only)."""
    job_stmt = select(Job).where(Job.id == id)
    job = (await db.execute(job_stmt)).scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    cand_stmt = select(Candidate).where(Candidate.job_id == id)
    result = await db.execute(cand_stmt)
    candidates = result.scalars().all()

    for candidate in candidates:
        candidate.status = "queued"
        candidate.error_message = None
        candidate.updated_at = datetime.utcnow()
        background_tasks.add_task(screen_candidate, candidate.id, db_mod.AsyncSessionLocal)

    await db.commit()
    return {
        "message": f"Enqueued {len(candidates)} candidates for re-screening.",
        "count": len(candidates),
    }


@router.post("/candidates/{id}/stage", response_model=CandidateDetailOut)
@router.post("/applications/{id}/stage", response_model=CandidateDetailOut)
async def update_candidate_stage(
    id: int,
    stage_update: CandidateStageUpdate,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Update candidate recruitment stage and record history. Requires non-empty reason."""
    if not stage_update.reason or not stage_update.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty explanatory reason is required for stage transitions.",
        )

    stmt = select(Candidate).where(Candidate.id == id)
    result = await db.execute(stmt)
    candidate = result.scalar_one_or_none()

    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    from_stage = candidate.stage
    to_stage = stage_update.stage

    # Record history entry
    history = StageHistory(
        candidate_id=candidate.id,
        from_stage=from_stage,
        to_stage=to_stage,
        reason=stage_update.reason.strip(),
        changed_by=current_user.id,
    )
    db.add(history)

    candidate.stage = to_stage
    candidate.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(candidate)

    missing = []
    if candidate.screening_result and isinstance(candidate.screening_result, dict):
        missing = candidate.screening_result.get("missing_must_haves", [])

    data = CandidateDetailOut.model_validate(candidate)
    data.missing_must_haves = missing
    return data


@router.get("/candidates/{id}/history", response_model=List[StageHistoryOut])
@router.get("/applications/{id}/history", response_model=List[StageHistoryOut])
async def get_candidate_stage_history(
    id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get history of stage changes for a candidate."""
    # Check candidate exists
    cand_stmt = select(Candidate).where(Candidate.id == id)
    candidate = (await db.execute(cand_stmt)).scalar_one_or_none()
    if not candidate:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Candidate not found",
        )

    stmt = (
        select(StageHistory)
        .where(StageHistory.candidate_id == id)
        .options(joinedload(StageHistory.changed_by_user))
        .order_by(StageHistory.created_at.desc())
    )
    result = await db.execute(stmt)
    history_records = result.scalars().all()

    return [
        StageHistoryOut(
            from_stage=record.from_stage,
            to_stage=record.to_stage,
            reason=record.reason,
            changed_by_name=record.changed_by_user.name if record.changed_by_user else None,
            created_at=record.created_at,
        )
        for record in history_records
    ]
