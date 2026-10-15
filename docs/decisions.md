# Engineering Decisions Log

This document records the architectural, design, and implementation decisions made during the development of the AI-Assisted Resume Screening Platform. It serves as an honest engineering log documenting key trade-offs, scope management decisions, known system gaps, and recommended future iterations.

---

## 1. Architecture Decisions

### 1.1 Backend Framework: FastAPI
- **Choice**: Python 3.11+ with FastAPI, Pydantic v2, and SQLAlchemy (async with asyncpg).
- **Rationale**:
  - Native asynchronous concurrency allows handling background resume parsing and API requests concurrently without thread starvation.
  - Automatic OpenAPI / Swagger interactive documentation (`/api/docs`) accelerates frontend integration and client-side contract verification.
  - Pydantic v2 delivers strict runtime validation and lightning-fast serialization for incoming payloads and model response parsing.
- **Alternatives Considered**:
  - *Django / DRF*: Heavier footprint, synchronous ORM default, and unnecessary overhead for a focused RESTful API microservice.
  - *Flask*: Requires assembling separate validation (Marshmallow), async extensions, and manual OpenAPI generation.

### 1.2 Primary Database: PostgreSQL with JSONB
- **Choice**: PostgreSQL 16 with relational tables (`users`, `job_openings`, `candidates`, `applications`, `application_events`) and JSONB columns for dynamic screening results and requirement definitions.
- **Rationale**:
  - Relational modeling guarantees data integrity, foreign key constraints (e.g., job openings to applications, candidate identity), and atomic transaction isolation for candidate stage transitions.
  - JSONB provides schema flexibility for requirement criteria (IDs, text, kinds, weights) and screening breakdown structures (requirement verdicts, verbatim evidence quotes, reasoning) without requiring complex normalization or EAV tables.
  - PostgreSQL JSONB indexes and query operators allow efficient filtering if requirements evolve over time.
- **Alternatives Considered**:
  - *Pure NoSQL (MongoDB)*: Sacrifices ACID transactional guarantees and relational foreign key integrity across candidates, applications, and audit logs.
  - *Purely Normalized Relational*: Excessive joins on deeply nested requirement verdicts and breakdown items would introduce query complexity for read-heavy candidate detail views.

### 1.3 Frontend Stack: React + TypeScript + Vite + Tailwind CSS
- **Choice**: React 18, TypeScript, Vite build tool, and Tailwind CSS.
- **Rationale**:
  - Vite provides instantaneous hot-module replacement (HMR) and lean production build bundles.
  - TypeScript ensures strict type safety between frontend API models and backend Pydantic schemas, catching integration bugs at compile time.
  - Tailwind CSS enables rapid, consistent UI component styling with zero runtime CSS overhead, making responsive layouts and state styling (badges, side-by-side evidence panes) clean and maintainable.
- **Alternatives Considered**:
  - *Next.js (SSR)*: Added server runtime complexity unnecessary for an authenticated internal enterprise SPA dashboard.
  - *Component UI Libraries (MUI/Chakra)*: Heavy bundle weight and opinionated styling overrides; Tailwind allows tailored, accessible enterprise layouts.

### 1.4 Authentication & Session Security: httpOnly Cookies
- **Choice**: JSON Web Token (JWT) transmitted exclusively via `httpOnly`, `SameSite=Lax`, `Secure` (in production) HTTP cookies.
- **Rationale**:
  - Storing authentication tokens in `localStorage` or `sessionStorage` exposes sessions to exfiltration via Cross-Site Scripting (XSS).
  - Browser-managed `httpOnly` cookies ensure tokens cannot be accessed via JavaScript APIs, mitigating token theft risks.
  - CSRF protection is enforced through `SameSite` cookie policies and custom API request headers.
- **Trade-off**: Requires reverse proxy configuration (or exact CORS credential handling) for local development across differing ports (`localhost:5173` to `localhost:8000`).

### 1.5 Asynchronous Processing: FastAPI BackgroundTasks
- **Choice**: In-process asynchronous `BackgroundTasks` triggered immediately upon resume upload.
- **Rationale**:
  - Resume extraction, PII redaction, and LLM reasoning take between 2 to 5 seconds per document. Blocking the HTTP upload request would cause browser timeouts and poor user experience.
  - Resumes upload and return HTTP `202 Accepted` immediately with application IDs, transitioning status from `Queued` $\to$ `Processing` $\to$ `Done` / `Failed`.
  - Avoids introducing heavy external infrastructure dependencies (e.g., Celery + Redis, RabbitMQ, or GCP Cloud Tasks) during local four-day development while keeping the architecture cleanly decoupled.
- **Trade-off**: In-process background tasks are bound to the backend container process lifecycle; restarts during processing require rescreening endpoints to retry failed jobs.

### 1.6 Abstract AI Interface & Dependency Injection
- **Choice**: Abstract base class (`AIServiceInterface`) with two concrete implementations: `GeminiAIService` (real Google Gemini API) and `FakeAIService` (deterministic synthetic generator for testing and offline development).
- **Rationale**:
  - Automated tests and CI environments run completely offline without network latency, API costs, or flaky external dependencies.
  - Evaluator scripts can switch between mock evaluation and production Gemini model runs via CLI flags (`--fake` vs live).
  - Decouples business logic from specific SDK versions or model providers.

---

## 2. AI Design Decisions

### 2.1 Temperature 0 for Deterministic Scoring
- **Choice**: Model generation parameter configured with `temperature=0.0`.
- **Rationale**:
  - Screening evaluation requires auditability and reproducibility. Running the same resume against the same requirements should yield identical or near-identical verdicts.
  - Eliminates stochastic drift in scoring and ensures consistency within the target delta ($\le 5$ points).

### 2.2 Structured Output Schema (`response_schema`)
- **Choice**: Enforcing strict JSON schema responses using Gemini's native structured generation capabilities (`response_mime_type="application/json"` and Pydantic/JSON schemas).
- **Rationale**:
  - Traditional free-text LLM prompts frequently fail due to formatting variations, markdown code block fences, or omitted JSON keys.
  - Structured schemas enforce exact typing for candidate profiles (extracted skills, experience years, education) and requirement evaluations (verdict: `met`, `partially_met`, `not_met`, or `unknown`; verbatim quote string; reasoning string).

### 2.3 PII Redaction Prior to Scoring
- **Choice**: Redacting candidate identity markers—including full name, personal email, phone numbers, and physical postal addresses—from the extracted resume text before passing it to the requirement evaluation prompt.
- **Rationale**:
  - Mitigates unconscious and algorithmic bias based on gender, ethnicity, age, or location.
  - Enhances privacy and compliance with data minimization standards by ensuring the scoring model evaluates only professional qualifications, technical skills, and project experience.

### 2.4 Code-Level Verification of Evidence Quotes
- **Choice**: An independent programmatic verification step checks every returned evidence quote directly against the source resume text using normalized substring matching.
- **Rationale**:
  - LLMs can hallucinate plausible-sounding quotes that do not appear verbatim in candidate resumes.
  - If a returned quote cannot be found in the actual resume text, the code automatically downgrades the verdict to `unknown`, flags the quote as unverified, and logs the discrepancy.
  - The system never trusts LLM claims blindly; evidence must be genuinely grounded in the document.

### 2.5 Deterministic Score Computation in Code
- **Choice**: The overall screening score (0–100) and missing must-haves list are computed programmatically in application code from requirement verdicts and HR-configured weights, not by asking the LLM to output a subjective number.
- **Rationale**:
  - LLMs are notoriously unreliable at mathematical weighting, consistent scoring scales, and calibrated arithmetic.
  - Programmatic scoring ensures 100% auditable calculations:
    $$\text{Score} = \frac{\sum (\text{weight}_i \times \text{verdict\_multiplier}_i)}{\sum \text{weight}_i} \times 100$$
    Where `met` = 1.0, `partially_met` = 0.5, `not_met` / `unknown` = 0.0.
  - Missing must-have requirements are deterministically detected and prominently surfaced on candidate cards.

---

## 3. What Was Cut (Scope Management)

To ensure the core product was completed with robust functionality, high code quality, and working end-to-end cloud and local deployment within the four-day timeline, the following stretch items were deliberately cut:

| Cut Item | Rationale & Context |
|---|---|
| **English / Marathi Language Toggle** | Building bilingual localization dictionaries and validating Marathi prompt nuances would have distracted from the core requirement extraction and scoring verification pipeline. |
| **Scanned PDF Optical Character Recognition (OCR)** | Digital text extraction (`pypdf` / `python-docx`) handles 95%+ of submitted resumes. Full OCR image pipelines introduce large native binary dependencies (Tesseract) or additional GCP Vision API costs. |
| **Cloud Storage (GCS) File Integration** | Replaced with Docker shared volumes and filesystem storage mounted at `/app/uploads`. Local volume storage completely satisfies the requirement for a single-node deployment and avoids Cloud Storage bucket setup delays. |
| **GitHub Actions Automated CI Pipeline** | All automated tests were configured to run locally and via Docker with a single command (`pytest backend/tests`). Dedicated cloud CI was deferred to post-MVP. |
| **HR Score Manual Override** | HR users retain full authority over the hiring funnel via stage transitions (`Shortlisted`, `Rejected`, `On hold`) with documented reason history. Adding direct score overrides would blur the audit trail between the AI evaluation baseline and HR actions. |

---

## 4. Known Gaps

1. **No Refresh Token Rotation**:
   - The platform currently issues an 8-hour access token in an `httpOnly` cookie. In enterprise production, an access token (15-min life) paired with a rotating refresh token stored in an invalidation table is standard.
2. **Local Volume File Storage**:
   - Resumes reside in a Docker volume or local filesystem path. Scaling horizontally across multiple Cloud Run instances requires mounting Google Cloud Storage (GCS) buckets.
3. **No API Rate Limiting**:
   - Authentication and screening endpoints do not currently enforce rate-limiting headers (e.g., `slowapi` or Redis token-bucket rate limiter), leaving endpoints susceptible to high-volume bursts.
4. **Polling for Status Updates (No WebSockets / SSE)**:
   - The frontend polls `GET /api/v1/jobs/{id}/applications` periodically to track screening progress from `Queued` $\to$ `Processing` $\to$ `Done`. While simple and resilient, WebSockets or Server-Sent Events (SSE) would provide immediate push updates.

---

## 5. What Would Come Next

1. **Google Cloud Storage (GCS) Integration**:
   - Swap the local file storage adapter for signed GCS upload URLs, storing resumes securely in encrypted cloud buckets.
2. **WebSocket / SSE Real-Time Updates**:
   - Implement real-time channel broadcasting for upload progress, queue status, and screening completion notifications.
3. **Google Cloud Tasks / Celery Task Queue**:
   - Transition in-process `BackgroundTasks` to managed Cloud Tasks or Celery with Redis for distributed task retry policies, dead-letter queues, and rate-limiting against external LLM quotas.
4. **User Management Interface**:
   - Administrative UI to invite team members, assign granular roles (Admin, HR Recruiter, Hiring Manager, Read-Only Viewer), and revoke sessions.
5. **Batch Candidate Operations**:
   - Bulk stage movement (e.g., moving all top-scoring candidates to `Shortlisted` with a single action) and bulk email notification triggers.
6. **Screening Report Exporting**:
   - Generating downloadable candidate summary packets (PDF / CSV) with requirement verdicts, quotes, and audit history for hiring committee reviews.
7. **Prompt & Model A/B Testing**:
   - Platform telemetry to run split evaluations comparing different Gemini model versions (e.g., `gemini-2.5-flash` vs `gemini-1.5-pro`) to optimize cost vs extraction accuracy.

---

## 6. AI Tool Usage Reflection

AI coding assistance tools were leveraged during the development of this project for rapid boilerplate scaffolding, synthetic evaluation resume generation, Docker Compose configuration, and test scenario drafting. 

All generated code, schemas, and architecture patterns were rigorously reviewed, refactored, and validated by the engineer. Full comprehension of every pipeline component—from asynchronous database sessions and cookie authentication to LLM prompt structures, evidence quote verification, and deterministic scoring calculations—was maintained throughout development.
