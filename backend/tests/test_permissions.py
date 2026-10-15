import io
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_unauthenticated_requests_fail(client: AsyncClient):
    response = await client.get("/api/jobs")
    assert response.status_code == 401

    response = await client.post("/api/jobs", json={"title": "Dev", "description": "Desc"})
    assert response.status_code == 401

    response = await client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_viewer_can_read_jobs(viewer_client: AsyncClient, hr_client: AsyncClient):
    # HR creates a job
    create_res = await hr_client.post(
        "/api/jobs",
        json={"title": "Backend Dev", "description": "FastAPI engineer required."},
    )
    assert create_res.status_code == 201
    job_id = create_res.json()["id"]

    # Viewer can read jobs list
    list_res = await viewer_client.get("/api/jobs")
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # Viewer can read job detail
    detail_res = await viewer_client.get(f"/api/jobs/{job_id}")
    assert detail_res.status_code == 200
    assert detail_res.json()["job"]["id"] == job_id

    # Viewer can read candidate list for job
    cands_res = await viewer_client.get(f"/api/jobs/{job_id}/candidates")
    assert cands_res.status_code == 200


@pytest.mark.asyncio
async def test_viewer_cannot_create_job(viewer_client: AsyncClient):
    res = await viewer_client.post(
        "/api/jobs",
        json={"title": "Frontend Dev", "description": "React skills required."},
    )
    assert res.status_code == 403
    assert "HR permissions required" in res.json()["detail"]

    # Viewer also cannot generate descriptions with AI bot
    gen_res = await viewer_client.post(
        "/api/jobs/generate-description",
        json={"title": "Frontend Dev"},
    )
    assert gen_res.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_modify_jobs_or_requirements(
    viewer_client: AsyncClient, hr_client: AsyncClient
):
    # HR creates a job
    create_res = await hr_client.post(
        "/api/jobs",
        json={"title": "DevOps Engineer", "description": "Docker and CI/CD required."},
    )
    job_id = create_res.json()["id"]

    # Viewer tries PATCH job
    patch_res = await viewer_client.patch(
        f"/api/jobs/{job_id}",
        json={"title": "Senior DevOps"},
    )
    assert patch_res.status_code == 403

    # Viewer tries DELETE job
    del_res = await viewer_client.delete(f"/api/jobs/{job_id}")
    assert del_res.status_code == 403

    # Viewer tries PUT requirements
    put_req_res = await viewer_client.put(
        f"/api/jobs/{job_id}/requirements",
        json=[{"text": "Kubernetes", "category": "must_have", "weight": 2.0, "sort_order": 0}],
    )
    assert put_req_res.status_code == 403

    # Viewer tries confirm requirements
    confirm_res = await viewer_client.post(f"/api/jobs/{job_id}/requirements/confirm")
    assert confirm_res.status_code == 403

    # Viewer tries regenerate requirements
    gen_res = await viewer_client.post(f"/api/jobs/{job_id}/requirements/generate")
    assert gen_res.status_code == 403


@pytest.mark.asyncio
async def test_viewer_cannot_upload_or_modify_candidates(
    viewer_client: AsyncClient, hr_client: AsyncClient
):
    # HR creates a job
    create_res = await hr_client.post(
        "/api/jobs",
        json={"title": "QA Engineer", "description": "Automated testing required."},
    )
    job_id = create_res.json()["id"]

    # Viewer tries candidate upload
    fake_file = io.BytesIO(b"Fake PDF content")
    upload_res = await viewer_client.post(
        f"/api/jobs/{job_id}/candidates/upload",
        files={"files": ("resume.pdf", fake_file, "application/pdf")},
    )
    assert upload_res.status_code == 403

    # Viewer tries retry screening
    retry_res = await viewer_client.post("/api/candidates/1/retry")
    assert retry_res.status_code == 403

    # Viewer tries stage change
    stage_res = await viewer_client.post(
        "/api/candidates/1/stage",
        json={"stage": "shortlisted", "reason": "Looks good"},
    )
    assert stage_res.status_code == 403
