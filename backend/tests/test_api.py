import io
import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Candidate, Job, Requirement
from app.services.screening import screen_candidate


@pytest.mark.asyncio
async def test_auth_flow(client: AsyncClient, seed_users):
    # Test valid login
    login_res = await client.post(
        "/api/auth/login",
        json={"email": "hr@example.com", "password": "hr-password-123"},
    )
    assert login_res.status_code == 200
    user_data = login_res.json()
    assert user_data["email"] == "hr@example.com"
    assert user_data["role"] == "hr"
    assert "session_token" in login_res.cookies

    # Test GET /api/auth/me with cookie
    me_res = await client.get("/api/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["email"] == "hr@example.com"

    # Test logout
    logout_res = await client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert "Logged out" in logout_res.json()["message"]


@pytest.mark.asyncio
async def test_full_recruitment_flow(
    hr_client: AsyncClient,
    db_session: AsyncSession,
    monkeypatch,
):
    # Mock text extraction to return standard resume content
    sample_resume_text = (
        "Jane Doe\n"
        "jane.doe@example.com\n"
        "+1-555-0144\n"
        "123 Code Street, San Francisco, CA\n"
        "Experienced Backend Developer with 5 years experience in Python and FastAPI.\n"
        "Proficient in PostgreSQL database optimization and Docker container deployments.\n"
    )

    monkeypatch.setattr(
        "app.services.screening.extract_text_from_file",
        lambda filename, content: sample_resume_text,
    )

    # 1. Create a Job
    create_job_res = await hr_client.post(
        "/api/jobs",
        json={
            "title": "Senior Python Engineer",
            "description": (
                "We are seeking a Senior Python Engineer.\n"
                "- Must have 5 years experience in Python\n"
                "- Must have strong knowledge of FastAPI\n"
                "- Experience with PostgreSQL database\n"
                "- Docker experience is nice to have\n"
            ),
        },
    )
    assert create_job_res.status_code == 201
    job_data = create_job_res.json()
    job_id = job_data["id"]
    assert job_data["status"] == "draft"
    assert job_data["requirements_confirmed"] is False

    # 2. Check Job Detail and drafted requirements
    detail_res = await hr_client.get(f"/api/jobs/{job_id}")
    assert detail_res.status_code == 200
    detail_data = detail_res.json()
    assert detail_data["job"]["id"] == job_id
    assert len(detail_data["requirements"]) >= 1

    # 2b. Premature upload must be rejected before confirmation (F-3)
    premature_res = await hr_client.post(
        f"/api/v1/jobs/{job_id}/resumes",
        files=[("files", ("jane_doe_resume.pdf", io.BytesIO(b"%PDF-1.4 Mock content"), "application/pdf"))],
    )
    assert premature_res.status_code == 400
    assert "Requirements must be confirmed" in premature_res.json()["detail"]

    # 3. Confirm requirements -> sets status to 'open'
    confirm_res = await hr_client.post(f"/api/v1/jobs/{job_id}/confirm-requirements")
    assert confirm_res.status_code == 200
    confirmed_job = confirm_res.json()
    assert confirmed_job["status"] == "open"
    assert confirmed_job["requirements_confirmed"] is True

    # 4. Upload candidate resume (PDF)
    fake_pdf_content = b"%PDF-1.4 Mock resume content for Jane Doe"
    upload_res = await hr_client.post(
        f"/api/jobs/{job_id}/candidates/upload",
        files=[("files", ("jane_doe_resume.pdf", io.BytesIO(fake_pdf_content), "application/pdf"))],
    )
    assert upload_res.status_code == 201
    uploaded_candidates = upload_res.json()
    assert len(uploaded_candidates) == 1
    candidate_id = uploaded_candidates[0]["id"]
    assert uploaded_candidates[0]["filename"] == "jane_doe_resume.pdf"

    # 5. Reject duplicate upload for same job
    dup_res = await hr_client.post(
        f"/api/jobs/{job_id}/candidates/upload",
        files=[("files", ("jane_doe_resume.pdf", io.BytesIO(fake_pdf_content), "application/pdf"))],
    )
    assert dup_res.status_code == 400
    assert "already been uploaded" in dup_res.json()["detail"]

    # 6. Reject invalid extension
    invalid_ext_res = await hr_client.post(
        f"/api/jobs/{job_id}/candidates/upload",
        files=[("files", ("resume.txt", io.BytesIO(b"Hello"), "text/plain"))],
    )
    assert invalid_ext_res.status_code == 400

    # 7. Execute screening pipeline on candidate
    # Run screening service with the test db session
    from app.ai.fake import FakeAI

    # Create dummy file path so screen_candidate can open it
    cand_stmt = select(Candidate).where(Candidate.id == candidate_id)
    cand_record = (await db_session.execute(cand_stmt)).scalar_one()

    import os
    os.makedirs(os.path.dirname(cand_record.file_path), exist_ok=True)
    with open(cand_record.file_path, "wb") as f:
        f.write(fake_pdf_content)

    fake_ai = FakeAI()
    await screen_candidate(
        candidate_id=candidate_id,
        session_factory=lambda: db_session,
        ai_service=fake_ai,
    )

    # 8. Fetch ranked candidates list
    ranked_res = await hr_client.get(f"/api/jobs/{job_id}/candidates?sort=score")
    assert ranked_res.status_code == 200
    ranked_list = ranked_res.json()
    assert len(ranked_list) == 1
    cand_summary = ranked_list[0]
    assert cand_summary["id"] == candidate_id
    assert cand_summary["status"] == "done"
    assert cand_summary["score"] is not None
    assert isinstance(cand_summary["missing_must_haves"], list)

    # 9. Fetch candidate full detail
    full_detail_res = await hr_client.get(f"/api/candidates/{candidate_id}")
    assert full_detail_res.status_code == 200
    full_data = full_detail_res.json()
    assert full_data["id"] == candidate_id
    assert full_data["resume_text"] is not None
    assert full_data["redacted_text"] is not None
    assert full_data["profile_data"] is not None
    assert "verdicts" in full_data["screening_result"]

    # 10a. Stage change without reason must be rejected (F-9)
    bad_stage_res = await hr_client.post(
        f"/api/v1/applications/{candidate_id}/stage",
        json={"stage": "shortlisted", "reason": "   "},
    )
    assert bad_stage_res.status_code == 400
    assert "non-empty" in bad_stage_res.json()["detail"].lower()

    # 10b. Update candidate stage with valid reason via /api/v1 route
    stage_res = await hr_client.post(
        f"/api/v1/applications/{candidate_id}/stage",
        json={"stage": "shortlisted", "reason": "Strong FastAPI skills and high score."},
    )
    assert stage_res.status_code == 200
    assert stage_res.json()["stage"] == "shortlisted"

    # 11. Check stage history
    history_res = await hr_client.get(f"/api/candidates/{candidate_id}/history")
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 1
    assert history[0]["from_stage"] == "new"
    assert history[0]["to_stage"] == "shortlisted"
    assert history[0]["reason"] == "Strong FastAPI skills and high score."
    assert history[0]["changed_by_name"] == "HR Manager"

    # 12. Retry screening endpoint
    retry_res = await hr_client.post(f"/api/candidates/{candidate_id}/retry")
    assert retry_res.status_code == 200
    assert retry_res.json()["status"] == "queued"

    # 13. Test AI job description generation endpoint
    gen_desc_res = await hr_client.post(
        "/api/jobs/generate-description",
        json={"title": "Senior Python Backend Developer", "seniority": "Senior"},
    )
    assert gen_desc_res.status_code == 200
    gen_data = gen_desc_res.json()
    assert "Senior Python Backend Developer" in gen_data["title"]
    assert "Key Responsibilities" in gen_data["description"]
    assert "Must-Have Requirements" in gen_data["description"]
