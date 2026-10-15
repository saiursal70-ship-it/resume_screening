# Project Assignment Specification & Execution Plan

This document details the project assignment brief, functional specifications (F-1 through F-11), architectural blueprints, AI screening pipeline mechanics, implementation timeline, testing matrix, and submission deliverables for the **AI-Assisted Resume Screening Platform**.

---

## (1) Project Assignment Brief & Scope Boundaries

### Primary Objective
To construct an enterprise-grade, human-in-the-loop web application for resume screening that automates requirement extraction and candidate evaluation against structured criteria using Google Gemini, validates cited evidence programmatically against source documents, and produces auditable, deterministic candidate scores.

**Core Invariant:** The AI never makes autonomous hiring decisions. Models generate structured assessments and verbatim evidence dossiers, while human recruiters retain complete control over candidate stage movements (`New`, `Shortlisted`, `Rejected`, `On Hold`).

- **Project Duration:** 4-Day Intensive Full-Stack Sprint.
- **Target Role:** Senior Full-Stack Engineer / AI Application Engineer.

### Scope Boundaries

| Category | Features & Responsibilities |
|---|---|
| **Must-Have (Core MVP)** | • Role-based access control (HR Recruiter vs. Read-Only Viewer) via secure `httpOnly` cookies.<br>• Automated requirement drafting with manual editing, categorization (*Must-Have* vs. *Nice-to-Have*), weighting, and explicit lock/confirmation.<br>• Multi-format resume ingestion (PDF, DOCX, TXT) with asynchronous background processing (`202 Accepted`).<br>• Automated PII redaction (name, email, phone, physical address) prior to model evaluation.<br>• Structured requirement scoring with Gemini (`temperature=0.0`) outputting verbatim evidence quotes and reasoning.<br>• In-code programmatic quote verification downgrading ungrounded claims to `unknown`.<br>• Deterministic 0–100 scoring arithmetic and missing must-haves detection executed strictly in application code.<br>• Candidate ranking table and side-by-side evidence review dossier.<br>• Human-in-the-loop candidate stage transitions (`New`, `Shortlisted`, `Rejected`, `On Hold`) with change-reason audit logs.<br>• Offline test suite (unit, RBAC, API) and automated evaluation benchmark against 12 synthetic candidate resumes. |
| **Should-Have** | • Deduplication of uploaded resumes using SHA-256 content hashing.<br>• Rescreening / retry endpoint for failed resume extractions.<br>• Real-time polling updates for background screening state transitions (`queued` $\to$ `processing` $\to$ `done`). |
| **Stretch Goals** | • Server-Sent Events (SSE) or WebSockets for live progress streaming.<br>• Bulk candidate stage updates (batch shortlisting/rejection).<br>• Exportable candidate evaluation packets (PDF/CSV summaries).<br>• Multi-container Google Cloud deployment (Cloud Run, Cloud SQL, Secret Manager). |
| **Out-of-Scope (Deliberately Cut)** | • English / Marathi bilingual language toggle (deferred to preserve focus on core evaluation quality).<br>• Scanned PDF Optical Character Recognition (OCR with Tesseract / Cloud Vision).<br>• Google Cloud Storage (GCS) direct bucket integration (local/Docker volume mounts used).<br>• Dedicated GitHub Actions CI pipeline (local single-command `pytest` fulfilled the requirement).<br>• Direct HR numerical score override (stage transitions preserve the audit boundary between AI baseline and human decision). |

---

## (2) Functional Requirements Breakdown (F-1 through F-11)

```
 [F-1 Auth & RBAC] ──► [F-2 Job Management] ──► [F-3 Requirement Extraction] ──► [F-4 Editing & Confirmation]
                                                                                        │
 [F-11 Stage Audit] ◄── [F-10 Deterministic Scoring] ◄── [F-9 Quote Verify] ◄── [F-8 AI Screening] ◄── [F-7 PII Redaction] ◄── [F-6 Async Queue] ◄── [F-5 Resume Ingestion]
```

* **F-1: Authentication & Authorization:**
  * Session-based authentication using JWT tokens transmitted exclusively via `httpOnly`, `SameSite=Lax`, `Secure` (in production) cookies.
  * Role-Based Access Control (RBAC): `hr` role (full mutating access) and `viewer` role (read-only access; all data-mutating routes return HTTP `403 Forbidden`).
* **F-2: Job Management:**
  * Recruiters can create, view, update, and manage job openings with titles, descriptions, and statuses (`draft` or `open`).
* **F-3: Requirement Extraction:**
  * AI parses unstructured job descriptions into structured, measurable qualification criteria.
  * Criteria are auto-categorized into `must_have` vs. `nice_to_have` with default weights.
* **F-4: Requirement Editing & Confirmation:**
  * Recruiter can add, edit, reorder, reweight, or delete requirements.
  * Recruiter must explicitly confirm/lock requirements before candidate screening can proceed, moving the job from `draft` to `open`.
* **F-5: Multi-Format Resume Ingestion:**
  * Accepts PDF, DOCX, and TXT files up to 5 MB.
  * Computes SHA-256 file content hash to detect and prevent duplicate submissions.
* **F-6: Asynchronous Screening Pipeline:**
  * Upload returns `202 Accepted` immediately with application tracking IDs.
  * Background worker processes text extraction, redaction, and model evaluation asynchronously without blocking client requests.
* **F-7: PII Redaction Engine:**
  * Automatically detects and redacts personal identifiers (candidate names, emails, phone numbers, postal addresses) from raw resume text before model submission.
* **F-8: Grounded AI Screening & Evidence Extraction:**
  * Evaluates the candidate against confirmed requirements using Gemini at `temperature=0.0`.
  * For each requirement, outputs a strict verdict (`met`, `partially_met`, `not_met`, or `unknown`), a verbatim excerpt quote from the resume, and explicit reasoning.
* **F-9: In-Code Quote Verification:**
  * Programmatic substring verification checks the raw resume text for the exact quoted string.
  * If the quote is missing or hallucinated, application code overrides the verdict to `unknown` and awards 0 score credit.
* **F-10: Deterministic Scoring & Candidate Ranking:**
  * Computes overall candidate scores (0–100) using deterministic mathematical weighting in Python code.
  * Detects missing must-have requirements and ranks applicants with filtering by stage and sorting by score.
* **F-11: Human-in-the-Loop Stage Tracking & Review History:**
  * Side-by-side candidate dossier displaying raw resume text alongside verified evidence quotes and verdicts.
  * Recruiter manually changes candidate stages (`new`, `shortlisted`, `rejected`, `on_hold`) with a mandatory comment, logged in an immutable audit history table.

---

## (3) Technical Architecture & Fixed Stack Choices

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend: React 18 SPA                          │
│     TypeScript • Vite • Tailwind CSS • React Router • Lucide Icons     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ /api reverse proxy (cookie auth)
┌──────────────────────────────────▼─────────────────────────────────────┐
│                       Backend: FastAPI (Python)                        │
│   Pydantic v2 • SQLAlchemy 2.0 (Async) • BackgroundTasks • Bcrypt/JWT  │
└───────┬──────────────────────────┬─────────────────────────────┬───────┘
        │                          │                             │
┌───────▼──────────────┐   ┌───────▼──────────────┐   ┌──────────▼───────┐
│ Database: PostgreSQL │   │ AI Pipeline Adapter  │   │  Local Storage   │
│  PostgreSQL 16+JSONB │   │  Gemini 2.5 Flash /  │   │  /app/uploads    │
│  Alembic Migrations  │   │     Fake AI Mock     │   │  Docker Volume   │
└──────────────────────┘   └──────────────────────┘   └──────────────────┘
```

| Component | Technology | Architectural Rationale |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, Pydantic v2 | High-concurrency async I/O, automatic OpenAPI documentation (`/api/docs`), strict runtime schema validation. |
| **Database** | PostgreSQL 16 (with JSONB) | Relational constraints for applicants, audit trails, and jobs; JSONB for flexible requirement sets and screening results. |
| **ORM / Migrations** | SQLAlchemy 2.0 (`asyncpg` + `psycopg2`), Alembic | Asynchronous queries for API traffic; synchronous driver for schema migrations and database seeding. |
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS | Instant HMR development, compile-time type parity with backend schemas, rapid responsive UI styling. |
| **AI Integration** | Google Gemini 2.5 Flash via `google-genai` SDK | High extraction fidelity, native JSON schema enforcement, low token latency. |
| **Cloud Target** | Google Cloud Platform (Cloud Run, Cloud SQL, Secret Manager) | Stateless container scaling with `--no-cpu-throttling` for background tasks, managed PostgreSQL, and secret isolation. |

### Permitted Simplifications
1. **In-Process BackgroundTasks**: Used instead of an external Celery/Redis queue for local development simplicity.
2. **Local Volume File Storage**: Mounted filesystem storage (`/app/uploads`) used instead of Google Cloud Storage buckets.
3. **Short Polling**: Frontend polls every 3 seconds for active processing jobs instead of WebSockets/SSE.
4. **Offline Mock AI Adapter**: `FakeAIService` allows complete testing, grading, and offline runs without incurring API costs or latency.

---

## (4) AI Pipeline Workflow & Rules

### 1. Text Extraction & Deduplication
* Multi-format parser:
  * PDF files: Text parsed via `pypdf` / `PyPDF2`.
  * DOCX files: Extracted via `python-docx`.
  * Plain text: Decoded via standard UTF-8 stream.
* Computes `hashlib.sha256(file_bytes).hexdigest()` to detect identical duplicate uploads.

### 2. PII Redaction Engine
Prior to sending resume text to Gemini for qualification scoring, sensitive candidate identity markers are stripped using regex patterns and heuristic replacement:
* **Email addresses**: `[\w\.-]+@[\w\.-]+\.\w+` $\to$ `[EMAIL REDACTED]`
* **Phone numbers**: `(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}` $\to$ `[PHONE REDACTED]`
* **Street addresses**: Standard street/city/zip patterns $\to$ `[ADDRESS REDACTED]`
* **Candidate names**: First line / header name tokens replaced with `[CANDIDATE NAME]`

### 3. Prompt Guidelines & Structured Schema Enforcement
* **Model Configuration**: `temperature=0.0`, `response_mime_type="application/json"`.
* **System Prompt Instructions**:
  * Evaluate qualifications strictly on documented evidence.
  * Cite verbatim substrings from the resume for any claim of `met` or `partially_met`.
  * Never invent or extrapolate unstated skills. If evidence is ambiguous, mark as `unknown` or `not_met`.
* **Output Schema**:
```json
{
  "evaluations": [
    {
      "requirement_id": 1,
      "verdict": "met | partially_met | not_met | unknown",
      "quote": "Exact verbatim sentence from resume text",
      "reasoning": "Concise justification referencing the quote"
    }
  ]
}
```

### 4. In-Code Quote Verification Logic
```python
def verify_quote(raw_text: str, quote: str) -> bool:
    if not quote or not quote.strip():
        return False
    norm_text = " ".join(raw_text.lower().split())
    norm_quote = " ".join(quote.lower().split())
    return norm_quote in norm_text
```
* **Enforcement Rule**: If `verify_quote(raw_resume, quote)` returns `False`, the application code overrides `verdict = "unknown"` and appends `[HALLUCINATED QUOTE REJECTED BY SYSTEM]` to the reasoning.

### 5. Deterministic Scoring Formula
Scoring arithmetic is strictly executed in Python code:

$$\text{Candidate Score} = \left( \frac{\sum_{i=1}^{N} \text{Weight}_i \times \text{Multiplier}_i}{\sum_{i=1}^{N} \text{Weight}_i} \right) \times 100$$

$$\text{Multiplier} = \begin{cases} 1.0 & \text{if } \text{verdict} = \text{'met'} \\ 0.5 & \text{if } \text{verdict} = \text{'partially\_met'} \\ 0.0 & \text{if } \text{verdict} \in \{\text{'not\_met'}, \text{'unknown'}\} \end{cases}$$

* **Missing Must-Haves**: A must-have requirement is flagged as missing if its verdict is anything other than `met`.

### 6. Evaluation Benchmark Criteria (Measured against 12 Candidates)
1. **Shortlist Accuracy**: Top 4 ranked candidates must match HR ground truth shortlist labels ($\ge 100\%$).
2. **Evidence Grounding Quality**: $\ge 98.0\%$ of cited quotes must verify verbatim in source documents.
3. **Scoring Consistency**: Multi-run score delta on identical resumes at `temperature=0.0` must be $\le 5.0$ points.
4. **Latency & Unit Economics**: Average processing time $\le 5.0$ s/resume; token cost $\le \$0.05$ per 100 resumes.

---

## (5) Day-by-Day Implementation Schedule & Contingency Plan

```
   Day 1: Foundation          Day 2: Ingestion & PII        Day 3: AI & Verification     Day 4: Audit & Eval
┌───────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐
│ • Docker & PostgreSQL │  │ • Job Requirement UI   │  │ • Gemini Model Adapter │  │ • Stage Audit Logs  │
│ • FastAPI Boilerplate │  │ • Multi-format Upload  │  │ • Quote Verification   │  │ • Benchmark Eval    │
│ • JWT Cookie Auth     │  │ • PII Redaction        │  │ • In-Code Scoring      │  │ • Test Suite (26/26)│
│ • User & Job Schemas  │  │ • Async BackgroundTasks│  │ • Side-by-Side Dossier │  │ • Documentation     │
└───────────────────────┘  └────────────────────────┘  └────────────────────────┘  └─────────────────────┘
```

### Schedule & Milestones
* **Day 1: Data Modeling, Auth & Scaffolding**
  * *Milestone 1*: Docker Compose spins up `db`, `backend`, and `frontend`.
  * *Milestone 2*: Alembic migrations run; default users seeded (`hr@example.com`, `viewer@example.com`).
  * *Milestone 3*: Authentication flow with `httpOnly` cookies and role guard middleware.
* **Day 2: Requirements Workflow & Resume Ingestion**
  * *Milestone 4*: Job creation, AI requirement extraction, and interactive requirement confirmation UI.
  * *Milestone 5*: Upload endpoint supporting PDF, DOCX, and TXT with SHA-256 deduplication.
  * *Milestone 6*: PII redaction engine strips personal identifiers into sanitized text.
* **Day 3: AI Pipeline, Quote Verification & Review Dossier**
  * *Milestone 7*: Structured Gemini evaluation integration with temperature 0.
  * *Milestone 8*: In-code quote verification engine and deterministic mathematical scoring formula.
  * *Milestone 9*: Candidate list with scores, must-have alerts, and side-by-side evidence dossier.
* **Day 4: Human-in-the-Loop Audit, Evaluation Benchmark & Polish**
  * *Milestone 10*: Recruiter stage transition mechanism with mandatory reason audit history.
  * *Milestone 11*: Automated evaluation suite (`eval/evaluate.py`) generating `docs/eval/report.md`.
  * *Milestone 12*: Complete offline pytest suite (26 tests) passing; comprehensive documentation compiled.

### Contingency Plan (Scope Cutting Under Time Pressure)
1. **Level 1 (Cut First)**: Scanned PDF OCR, cloud bucket storage, bilingual localization toggles.
2. **Level 2 (Cut Second)**: Real-time WebSockets/SSE (rely on simple 3-second client polling).
3. **Level 3 (Cut Third)**: Bulk candidate stage actions and PDF report exports.
4. **Non-Negotiable Core (Never Cut)**:
   * Programmatic evidence quote verification.
   * In-code deterministic score calculations.
   * Human-in-the-loop stage controls (AI never auto-transitions candidates).
   * Role-based access control protecting mutating endpoints.

---

## (6) Required Automated Test Suite & Constraints

The test suite runs **100% offline** without network dependencies, external API keys, or database dependencies, completing in under 10 seconds.

```
Total Automated Tests: 26 Passed (100% Pass Rate)
├── tests/test_api.py (2 tests)
│   ├── test_auth_flow (Login, session cookies, /me endpoint, logout)
│   └── test_full_recruitment_flow (Job -> Requirement confirm -> Upload -> Screen -> Stage change)
├── tests/test_evidence.py (7 tests)
│   ├── Exact verbatim quote verification
│   ├── Normalized whitespace & case-insensitive matching
│   ├── Hallucinated quote detection & automatic downgrade to 'unknown'
│   └── Empty / malformed quote handling
├── tests/test_permissions.py (5 tests)
│   ├── Viewer role can read jobs & candidates
│   ├── Viewer receives 403 Forbidden on job creation
│   ├── Viewer receives 403 Forbidden on requirement modification
│   ├── Viewer receives 403 Forbidden on resume upload
│   └── Viewer receives 403 Forbidden on stage transitions
├── tests/test_redaction.py (6 tests)
│   ├── Email address redaction regex
│   ├── Phone number format scrubbing
│   ├── Postal address pattern replacement
│   └── Candidate header name stripping
└── tests/test_scoring.py (6 tests)
    ├── Perfect score calculation (100.0)
    ├── Weighted mixed verdict calculation
    ├── Missing must-have criteria detection
    └── Zero-division protection on empty requirements
```

---

## (7) Submission Deliverables, Rubric & Review Expectations

### Deliverables
1. **Source Code Repository**: Clean, modular, type-safe codebase (FastAPI backend + React/TypeScript frontend).
2. **Container Configuration**: Multi-container `docker-compose.yml` (`db`, `backend`, `frontend`) operational via `docker compose up --build`.
3. **Comprehensive Documentation**:
   * [`README.md`](file:///home/user1/hr-screening/README.md): Architecture overview, quick start, API specification table, and GCP cloud deployment runbook.
   * [`docs/decisions.md`](file:///home/user1/hr-screening/docs/decisions.md): Architecture decision records, trade-offs, scope cuts, and known gaps.
   * [`docs/eval/report.md`](file:///home/user1/hr-screening/docs/eval/report.md): Benchmark results, accuracy metrics, quote verification rate, and edge case analysis.
   * [`docs/assignment_spec.md`](file:///home/user1/hr-screening/docs/assignment_spec.md): This complete specification document.
4. **Evaluation Benchmark Suite**: Runnable evaluation script (`python -m eval.evaluate`) with sample candidate pack.
5. **Automated Test Suite**: Complete passing test suite (`pytest backend/tests`).

### Evaluation Rubric

| Rubric Area | Weight | Core Grading Criteria |
|---|:---:|---|
| **Architecture & Code Quality** | **25%** | Idiomatic FastAPI, React+TypeScript type safety, clean separation of concerns, robust Docker Compose setup. |
| **AI Pipeline & Prompt Quality** | **25%** | Structured extraction, temperature 0 reproducibility, schema enforcement, effective PII redaction. |
| **Evidence Verification & Deterministic Scoring** | **20%** | Programmatic quote checking against raw text, downgrade of hallucinations, auditable formula in code. |
| **Testing & Evaluation Benchmark** | **15%** | Offline test suite (unit, RBAC, API), benchmark suite measuring shortlist overlap and quote verification. |
| **Documentation & Engineering Decisions** | **15%** | Transparent decisions log, clear deployment guide, honest trade-off analysis and gap reflection. |

### Review Session Expectations
* **Live End-to-End Walkthrough**: Creating a job opening, extracting & editing requirements, uploading candidate resumes, inspecting side-by-side evidence dossiers, and executing stage transitions.
* **Code Walkthrough**: Detailed inspection of the programmatic quote verification algorithm and mathematical scoring function.
* **Security & RBAC Verification**: Demonstrating that Viewer sessions receive `403 Forbidden` on mutating endpoints and verifying `httpOnly` cookie isolation.
* **Defense of Architecture Decisions**: Explaining why in-code verification was chosen over pure LLM trust, and why humans retain sole authority over stage transitions.

