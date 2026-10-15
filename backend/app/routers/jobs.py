from datetime import datetime
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai import get_ai_service
from app.auth import get_current_user, require_hr
from app.database import get_db
from app.models import Candidate, Job, Requirement, User
from app.schemas import (
    JobCreate,
    JobDescriptionGenerateRequest,
    JobDescriptionGenerateResponse,
    JobDetailOut,
    JobListOut,
    JobOut,
    JobUpdate,
    RequirementIn,
    RequirementOut,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("/generate-description", response_model=JobDescriptionGenerateResponse)
@router.post("/description/generate", response_model=JobDescriptionGenerateResponse)
async def generate_job_description_endpoint(
    req: JobDescriptionGenerateRequest,
    current_user: User = Depends(require_hr),
):
    """Use AI to draft a comprehensive job description from a job title (HR only)."""
    if not req.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Job title cannot be empty.",
        )
    ai_service = get_ai_service()
    try:
        description = await ai_service.generate_job_description(
            job_title=req.title.strip(),
            seniority=req.seniority,
            key_skills=req.key_skills,
        )
        return JobDescriptionGenerateResponse(title=req.title.strip(), description=description)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate job description: {str(exc)}",
        )


@router.get("", response_model=List[JobListOut])
async def list_jobs(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all jobs with candidate counts."""
    stmt = (
        select(
            Job.id,
            Job.title,
            Job.status,
            Job.requirements_confirmed,
            Job.created_at,
            func.count(Candidate.id).label("candidate_count"),
        )
        .outerjoin(Candidate, Candidate.job_id == Job.id)
        .group_by(Job.id)
        .order_by(Job.created_at.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        JobListOut(
            id=row.id,
            title=row.title,
            status=row.status,
            requirements_confirmed=row.requirements_confirmed,
            created_at=row.created_at,
            candidate_count=row.candidate_count,
        )
        for row in rows
    ]


@router.post("", response_model=JobOut, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Create a new job and trigger AI requirement drafting."""
    job = Job(
        title=job_data.title,
        description=job_data.description,
        status="draft",
        requirements_confirmed=False,
        created_by=current_user.id,
    )
    db.add(job)
    await db.flush()

    # Trigger AI requirement drafting
    ai_service = get_ai_service()
    try:
        drafted_reqs = await ai_service.extract_requirements(job.description)
        for idx, req_data in enumerate(drafted_reqs):
            req = Requirement(
                job_id=job.id,
                text=req_data.get("text", "").strip(),
                category=req_data.get("category", "nice_to_have"),
                weight=float(req_data.get("weight", 1.0)),
                sort_order=idx,
            )
            db.add(req)
    except Exception as exc:
        # If AI drafting fails, create default requirement
        fallback_req = Requirement(
            job_id=job.id,
            text="Relevant professional experience",
            category="must_have",
            weight=1.0,
            sort_order=0,
        )
        db.add(fallback_req)

    await db.commit()
    await db.refresh(job)
    return job


@router.get("/{id}", response_model=JobDetailOut)
async def get_job_detail(
    id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get job detail along with requirements."""
    stmt = (
        select(Job)
        .where(Job.id == id)
        .options(selectinload(Job.requirements))
    )
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    sorted_reqs = sorted(job.requirements, key=lambda r: r.sort_order)
    return JobDetailOut(
        job=JobOut.model_validate(job),
        requirements=[RequirementOut.model_validate(r) for r in sorted_reqs],
    )


@router.patch("/{id}", response_model=JobOut)
async def update_job(
    id: int,
    job_update: JobUpdate,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Update job fields (HR only)."""
    stmt = select(Job).where(Job.id == id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    if job_update.title is not None:
        job.title = job_update.title
    if job_update.description is not None:
        job.description = job_update.description
    if job_update.status is not None:
        job.status = job_update.status

    job.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(job)
    return job


@router.delete("/{id}")
async def delete_job(
    id: int,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Delete a job (HR only)."""
    stmt = select(Job).where(Job.id == id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    await db.delete(job)
    await db.commit()
    return {"message": "Job deleted successfully"}


@router.put("/{id}/requirements", response_model=List[RequirementOut])
async def update_requirements(
    id: int,
    requirements_in: List[RequirementIn],
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Replace all requirements for a job (HR only)."""
    job_stmt = select(Job).where(Job.id == id)
    job = (await db.execute(job_stmt)).scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    # Delete existing requirements
    del_stmt = delete(Requirement).where(Requirement.job_id == id)
    await db.execute(del_stmt)

    new_reqs = []
    for idx, item in enumerate(requirements_in):
        req = Requirement(
            job_id=id,
            text=item.text,
            category=item.category,
            weight=item.weight,
            sort_order=item.sort_order if item.sort_order is not None else idx,
        )
        db.add(req)
        new_reqs.append(req)

    job.updated_at = datetime.utcnow()
    await db.commit()

    for req in new_reqs:
        await db.refresh(req)

    return sorted(new_reqs, key=lambda r: r.sort_order)


@router.post("/{id}/requirements/confirm", response_model=JobOut)
@router.post("/{id}/confirm-requirements", response_model=JobOut)
async def confirm_requirements(
    id: int,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Confirm requirements and open the job (HR only)."""
    stmt = select(Job).where(Job.id == id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    job.requirements_confirmed = True
    job.status = "open"
    job.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(job)
    return job


@router.post("/{id}/requirements/generate", response_model=List[RequirementOut])
@router.post("/{id}/extract-requirements", response_model=List[RequirementOut])
async def regenerate_requirements(
    id: int,
    current_user: User = Depends(require_hr),
    db: AsyncSession = Depends(get_db),
):
    """Re-generate requirements from job description via AI (HR only)."""
    stmt = select(Job).where(Job.id == id)
    result = await db.execute(stmt)
    job = result.scalar_one_or_none()

    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Job not found",
        )

    ai_service = get_ai_service()
    drafted_reqs = await ai_service.extract_requirements(job.description)

    # Replace existing requirements
    del_stmt = delete(Requirement).where(Requirement.job_id == id)
    await db.execute(del_stmt)

    new_reqs = []
    for idx, req_data in enumerate(drafted_reqs):
        req = Requirement(
            job_id=id,
            text=req_data.get("text", "").strip(),
            category=req_data.get("category", "nice_to_have"),
            weight=float(req_data.get("weight", 1.0)),
            sort_order=idx,
        )
        db.add(req)
        new_reqs.append(req)

    job.updated_at = datetime.utcnow()
    await db.commit()

    for req in new_reqs:
        await db.refresh(req)

    return sorted(new_reqs, key=lambda r: r.sort_order)
