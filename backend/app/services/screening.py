from datetime import datetime
import os
from typing import Any, Dict, List, Optional, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai import get_ai_service
from app.ai.interface import AIInterface
import app.database as db_mod
from app.models import Candidate, Job, Requirement
from app.services.redaction import redact_pii
from app.services.text_extraction import extract_text_from_file

VERDICT_SCORES = {
    "met": 1.0,
    "partial": 0.5,
    "not_met": 0.0,
    "unknown": 0.0,
}


def verify_evidence(verdict_item: Dict[str, Any], resume_text: str) -> Dict[str, Any]:
    """
    Evidence check: verify the quote exists in resume_text (case-insensitive substring match).
    If not found, downgrade verdict to 'unknown' and mark quote_verified=False.
    """
    quote = verdict_item.get("quote", "").strip()
    verdict = verdict_item.get("verdict", "unknown")

    if verdict in ("met", "partial"):
        if quote and quote.lower() in resume_text.lower():
            quote_verified = True
        else:
            verdict = "unknown"
            quote_verified = False
    elif verdict == "not_met":
        # If AI cited a quote for not_met, verify it; if no quote was provided, it's valid
        if quote:
            if quote.lower() in resume_text.lower():
                quote_verified = True
            else:
                verdict = "unknown"
                quote_verified = False
        else:
            quote_verified = True
    else:
        verdict = "unknown"
        quote_verified = False

    return {
        **verdict_item,
        "verdict": verdict,
        "quote_verified": quote_verified,
    }


def compute_score(
    requirements: List[Dict[str, Any]],
    verdicts: List[Dict[str, Any]],
) -> Tuple[float, List[str]]:
    """
    Compute score: sum(weight * verdict_score for each requirement) / sum(weights) * 100,
    where met=1.0, partial=0.5, not_met=0.0, unknown=0.0.
    List missing must-haves (must_have requirements where verdict is not 'met').
    """
    verdict_map = {v.get("requirement_text"): v for v in verdicts}
    total_weights = 0.0
    weighted_sum = 0.0
    missing_must_haves: List[str] = []

    for req in requirements:
        text = req.get("text", "")
        weight = float(req.get("weight", 1.0))
        category = req.get("category", "nice_to_have")

        v_item = verdict_map.get(text, {})
        v_status = v_item.get("verdict", "unknown")
        verdict_val = VERDICT_SCORES.get(v_status, 0.0)

        weighted_sum += weight * verdict_val
        total_weights += weight

        if category == "must_have" and v_status != "met":
            missing_must_haves.append(text)

    if total_weights > 0:
        score = round((weighted_sum / total_weights) * 100.0, 2)
    else:
        score = 0.0

    return score, missing_must_haves


async def screen_candidate(
    candidate_id: int,
    session_factory=None,
    ai_service: Optional[AIInterface] = None,
) -> None:
    """Core screening pipeline executed in background."""
    if session_factory is None:
        session_factory = db_mod.AsyncSessionLocal
    if ai_service is None:
        ai_service = get_ai_service()

    async with session_factory() as db:
        # Load candidate with job and requirements
        stmt = (
            select(Candidate)
            .where(Candidate.id == candidate_id)
            .options(selectinload(Candidate.job).selectinload(Job.requirements))
        )
        result = await db.execute(stmt)
        candidate = result.scalar_one_or_none()

        if not candidate:
            return

        try:
            # Update status to processing
            candidate.status = "processing"
            candidate.error_message = None
            candidate.updated_at = datetime.utcnow()
            await db.commit()

            # Step 1: Extract text from PDF or DOCX
            if not os.path.exists(candidate.file_path):
                raise FileNotFoundError(f"Resume file not found at {candidate.file_path}")

            with open(candidate.file_path, "rb") as f:
                file_bytes = f.read()

            resume_text = extract_text_from_file(candidate.filename, file_bytes)
            if not resume_text.strip():
                raise ValueError("Could not extract any text from resume file.")

            # Step 2: Extract profile with PII
            profile_data = await ai_service.extract_profile(resume_text)

            # Step 3: Redact PII
            redacted_text = redact_pii(resume_text, profile_data)

            # Step 4: Call ai.score_resume(redacted_text, requirements) at temperature 0
            job_requirements = [
                {
                    "text": req.text,
                    "category": req.category,
                    "weight": req.weight,
                }
                for req in candidate.job.requirements
            ]

            raw_scores = await ai_service.score_resume(redacted_text, job_requirements)
            raw_verdicts = raw_scores.get("verdicts", [])

            # Step 5: Evidence check for each verdict
            verified_verdicts = [
                verify_evidence(v, resume_text) for v in raw_verdicts
            ]

            # Step 6: Compute score and missing must-haves
            score, missing_must_haves = compute_score(job_requirements, verified_verdicts)

            # Step 7: Save result
            model_id = getattr(ai_service, "model_id", "default")
            prompt_version = getattr(ai_service, "prompt_version", "v1.0")

            candidate.resume_text = resume_text
            candidate.redacted_text = redacted_text
            candidate.profile_data = profile_data
            candidate.screening_result = {
                "verdicts": verified_verdicts,
                "score": score,
                "missing_must_haves": missing_must_haves,
            }
            candidate.score = score
            candidate.status = "done"
            candidate.error_message = None
            candidate.model_id = model_id
            candidate.prompt_version = prompt_version
            candidate.updated_at = datetime.utcnow()
            await db.commit()

        except Exception as exc:
            await db.rollback()
            # Fetch again to ensure clean session state
            fetch_stmt = select(Candidate).where(Candidate.id == candidate_id)
            err_candidate = (await db.execute(fetch_stmt)).scalar_one_or_none()
            if err_candidate:
                err_candidate.status = "failed"
                err_candidate.error_message = str(exc)
                err_candidate.updated_at = datetime.utcnow()
                await db.commit()
