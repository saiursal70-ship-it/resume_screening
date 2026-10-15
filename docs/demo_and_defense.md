# Demonstration Video Script & 60-Minute Oral Defense Guide

This guide prepares the engineering candidate for the mandatory **5-minute video demonstration** and the **60-minute technical defense session** stipulated in Part 3 of the platform architectural suite.

---

## Part 1: 5-Minute Video Demonstration Script

### Timing Breakdown
* **0:00 – 0:45 (Intro & Architecture Invariants)**:
  * Present ScreenAI: Enterprise AI-assisted resume screening platform.
  * State the non-negotiable invariant: **AI never makes automated hiring decisions—humans retain 100% control over pipeline stage movements.**
  * Highlight the 3 core pillars: PII sanitization, in-code evidence quote verification, and deterministic scoring.
* **0:45 – 1:45 (Authentication & Job Opening Setup)**:
  * Log in with pre-seeded HR Manager credentials (`hr@example.com`).
  * Create a new Job Opening (e.g., *Senior Software Engineer*).
  * Demonstrate AI requirement extraction: Gemini drafts structured requirements categorized into *Must-Have* and *Nice-to-Have* with customizable weights.
  * Show requirement editing (adjust weights, add/remove criteria) and click **Confirm & Lock Requirements** (transitions status from `Draft` to `Open`). Show that resume intake is strictly blocked before this step.
* **1:45 – 3:00 (Multi-File Resume Ingestion & Asynchronous Screening)**:
  * Upload candidate resumes (PDF / DOCX formats, including sample resumes from the evaluation pack).
  * Show immediate `HTTP 202 Accepted` response with application tracking IDs.
  * Observe asynchronous processing state transitions: `Queued` $\to$ `Processing` $\to$ `Done`.
  * Explain under-the-hood execution: PyPDF/python-docx extraction $\to$ SHA-256 duplicate checking $\to$ automated PII sanitization $\to$ Gemini evaluation at temperature 0.0.
* **3:00 – 4:00 (Candidate Ranking & Evidence Dossier)**:
  * View the ranked candidate table sorted strictly by descending deterministic score (0–100).
  * Highlight prominent missing must-have alerts on borderline candidates.
  * Open a candidate record to reveal the **side-by-side evidence inspection pane**:
    * Left side: original source resume text.
    * Right side: requirement verdicts, citations, and analytical reasoning.
    * Demonstrate that cited quotes match verbatim in the source text.
* **4:00 – 4:45 (Human-in-the-Loop Stage Transition & Audit Trail)**:
  * Promote a top candidate to `Shortlisted`. Show the mandatory transition modal requiring a human justification reason.
  * Submit the transition and inspect the immutable audit history entry recording actor identity, timestamp, previous stage, and reason.
  * Switch to a Viewer session (`viewer@example.com`) to demonstrate that stage change and mutating buttons are disabled/restricted (`HTTP 403 Forbidden`).
* **4:45 – 5:00 (Benchmark Summary & Conclusion)**:
  * Summarize empirical benchmark results from `docs/eval/report.md` (100% shortlist overlap, 100% quote verification rate, 0.00 score variance).
  * Conclude with clean Docker one-command launch instructions.

---

## Part 2: 60-Minute Oral Technical Defense Preparation

```
┌─────────────────┬───────────────────┬──────────────────────┬────────────────────────┐
│ 10 Min: Live UI │ 20 Min: Trace Req │ 15 Min: Live Code    │ 15 Min: Scaling & Arch │
│ Demonstration   │ Browser ➔ DB ➔ AI │ Live scoring/filters │ 10k resumes, cost, PII │
└─────────────────┴───────────────────┴──────────────────────┴────────────────────────┘
```

### Segment 1: Live System Demonstration (10 Minutes)
* **Goal**: Walk the review panel through the live operational environment.
* **Checklist**:
  1. Demonstrate session authentication (`httpOnly` cookies).
  2. Create job, extract requirements, edit weights, and confirm/lock.
  3. Upload multi-format resumes and observe background queue.
  4. Inspect candidate rankings, missing must-haves, and side-by-side evidence quotes.
  5. Perform stage transition with mandatory reason and verify audit history.
  6. Demonstrate RBAC: show Viewer account blocked with `403 Forbidden` on mutation.

### Segment 2: Architecture Walkthrough (20 Minutes)
* **Goal**: Trace an end-to-end request from client browser through proxy, database, and background AI screening.
* **Tracing Flow**:
  1. **Browser**: Client dispatches `POST /api/v1/jobs/{id}/resumes` containing `multipart/form-data`.
  2. **Proxy / Ingress**: Vite dev proxy (locally) or Cloudflare Pages / Netlify function (cloud) forwards request to FastAPI backend on port 8000, preserving `httpOnly` session cookies.
  3. **FastAPI Auth & RBAC**: Dependency `require_hr` extracts JWT from cookie, validates signature with `SECRET_KEY`, queries `users` table, and verifies `role == 'hr'`.
  4. **Document Ingestion**:
     * Calculates `hashlib.sha256(file_bytes).hexdigest()`. Checks `candidates` table for duplicate hash within opening.
     * Extracts text using `pypdf` (PDF) or `python-docx` (DOCX).
     * Creates `Candidate` record with status `queued` and returns `HTTP 202 Accepted` immediately.
  5. **FastAPI BackgroundTasks**:
     * Enqueues `screen_candidate(candidate_id, db_session_factory)`.
     * Status updates to `processing`.
     * **PII Redaction**: Regular expressions and heuristics strip names, emails, phones, and addresses from resume text.
     * **Gemini LLM Inference**: Sends redacted text and confirmed requirements to Gemini 2.5 Flash at `temperature=0.0` with structured Pydantic JSON schema.
     * **In-Code Quote Verification**: Independent string-containment check verifies every returned quote against the source text. Any missing/altered quote is downgraded to `unknown` with 0 score credit.
     * **Deterministic Scoring**: Python code calculates overall score (0–100) using confirmed weights and verified verdicts.
     * Application updates status to `done`, persisting score, missing must-haves, breakdown, and model metadata.

### Segment 3: Live Code Modification (15 Minutes)
The review panel will request a rapid code modification. Be prepared for the two most common requests:

#### Request A: Update scoring algorithm to award partial credit for nice-to-have requirements
* **File to modify**: `backend/app/services/screening.py` (and `tests/test_scoring.py`).
* **Implementation pattern**:
```python
# In calculate_score():
# Currently: met=1.0, partially_met=0.5, not_met=0.0, unknown=0.0
# To customize partial credit weighting:
multiplier = 1.0 if v == "met" else (0.5 if v == "partially_met" else 0.0)
```

#### Request B: Add dynamic stage filtering or status filtering to candidate API
* **File to modify**: `backend/app/routers/candidates.py`
* **Implementation pattern**:
```python
@router.get("/jobs/{id}/applications")
async def list_candidates(id: int, stage: Optional[str] = None, status: Optional[str] = None):
    stmt = select(Candidate).where(Candidate.job_id == id)
    if stage:
        stmt = stmt.where(Candidate.stage == stage)
    if status:
        stmt = stmt.where(Candidate.status == status)
    ...
```

### Segment 4: Architectural & Scaling Defense (15 Minutes)

#### 1. Scaling to 10,000 Resumes per Day
* **Database**: Introduce connection pooling with PgBouncer. Add composite index on `(job_id, score DESC)` and index on `resume_sha256`. Partition `applications` table by `created_at` or `job_id`.
* **Async Workers**: Replace in-process `BackgroundTasks` with distributed task queues (Google Cloud Tasks or Celery + Redis). Deploy separate auto-scaling worker pools on Cloud Run.
* **Storage**: Transition resume binaries from PostgreSQL/local volumes to Google Cloud Storage (GCS) using signed upload URLs and lifecycle policies.

#### 2. Halving Model Operational Costs
* **Tiered Screening Pipeline**:
  * *Stage 1 (Embedding Filter)*: Use low-cost text embeddings to compute cosine similarity between resume and job description. Filter out bottom 30% unqualified candidates for < $0.0001.
  * *Stage 2 (Small Model)*: Use Gemini Flash-Lite or distilled open-source model (e.g. Gemma 2B) for initial requirement check.
  * *Stage 3 (Precision Model)*: Run Gemini 2.5 Flash only on top-tier candidates.
* **Context Caching**: Use Gemini Context Caching for the job requirements payload when screening hundreds of resumes against the same job opening.

#### 3. Tracking Model Drift & Quality Over Time
* Log prompt versions, model IDs, token counts, and quote verification rates to Cloud Logging / BigQuery.
* Set automated alerts if the quote verification failure rate exceeds 2.0% or if score variance increases across identical evaluation seeds.
* Re-run `python -m eval.evaluate` weekly against benchmark test packs to catch model behavioral changes.

#### 4. International Data Privacy Compliance (GDPR / DPDP)
* **Data Minimization**: Resume files encrypted at rest using Cloud KMS customer-managed encryption keys.
* **Right to be Forgotten**: Implement hard deletion cascading from `candidates` $\to$ `applications` $\to$ `application_events` and purge stored resumes.
* **Auditability**: PII redaction layer guarantees no personal demographics reach external model inference APIs. Stage transition logs guarantee full human accountability for all hiring actions.

