import asyncio
import json
from typing import Any, Dict, List
from pydantic import BaseModel, Field

from app.ai.interface import AIInterface
from app.config import settings

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None  # type: ignore
    types = None  # type: ignore


# Pydantic models for structured output with Gemini response_schema
class ExtractedRequirementItem(BaseModel):
    text: str = Field(description="The requirement description")
    category: str = Field(description="Either 'must_have' or 'nice_to_have'")
    weight: float = Field(default=1.0, description="Importance weight, e.g. 1.0 or 2.0")


class ExtractedRequirementsResponse(BaseModel):
    requirements: List[ExtractedRequirementItem]


class ExtractedProfileResponse(BaseModel):
    name: str = Field(default="", description="Full name of candidate")
    email: str = Field(default="", description="Email address")
    phone: str = Field(default="", description="Phone number")
    address: str = Field(default="", description="Location or address")
    skills: List[str] = Field(default_factory=list, description="Extracted skills")
    experience: List[str] = Field(default_factory=list, description="Work experience highlights")
    education: List[str] = Field(default_factory=list, description="Education background")


class VerdictResponseItem(BaseModel):
    requirement_text: str = Field(description="Exact requirement text being evaluated")
    verdict: str = Field(description="Verdict: 'met', 'not_met', or 'partial'")
    quote: str = Field(default="", description="Exact quote from resume supporting the verdict")
    reasoning: str = Field(description="Explanation of verdict")


class ResumeScoreResponse(BaseModel):
    verdicts: List[VerdictResponseItem]


class GeminiAI(AIInterface):
    """Gemini API implementation using the google-genai SDK."""

    def __init__(
        self,
        api_key: str | None = None,
        model_id: str | None = None,
        prompt_version: str = "v1.0",
    ):
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_id = model_id or settings.GEMINI_MODEL
        self.prompt_version = prompt_version

        if genai is not None and self.api_key:
            self.client = genai.Client(api_key=self.api_key)
        else:
            self.client = None

    def _ensure_client(self):
        if not self.client:
            raise RuntimeError(
                "Gemini AI client not initialized. Ensure google-genai is installed and GEMINI_API_KEY is configured."
            )

    async def extract_requirements(self, job_description: str) -> List[Dict[str, Any]]:
        self._ensure_client()

        prompt = f"""You are an expert HR recruitment specialist. Analyze the following job description and extract key candidate requirements.
For each requirement, specify:
- text: concise requirement statement
- category: 'must_have' if critical or mandatory, else 'nice_to_have'
- weight: 2.0 for critical must_have, 1.0 for nice_to_have

Job Description:
{job_description}
"""

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExtractedRequirementsResponse,
            temperature=0.2,
        )

        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.models.generate_content(
                model=self.model_id,
                contents=prompt,
                config=config,
            ),
        )

        data = json.loads(response.text)
        requirements = data.get("requirements", [])
        return [
            {
                "text": req.get("text", "").strip(),
                "category": "must_have" if req.get("category", "").lower() == "must_have" else "nice_to_have",
                "weight": float(req.get("weight", 1.0)),
            }
            for req in requirements
            if req.get("text")
        ]

    async def extract_profile(self, resume_text: str) -> Dict[str, Any]:
        self._ensure_client()

        prompt = f"""Extract structured profile information from this resume including personally identifiable information (PII) such as name, email, phone, and address, along with skills, experience, and education.

Resume Text:
{resume_text}
"""

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExtractedProfileResponse,
            temperature=0.1,
        )

        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.models.generate_content(
                model=self.model_id,
                contents=prompt,
                config=config,
            ),
        )

        return json.loads(response.text)

    async def score_resume(
        self, redacted_text: str, requirements: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        self._ensure_client()

        req_list_str = json.dumps(requirements, indent=2)
        prompt = f"""You are evaluating an anonymized candidate resume against specific job requirements.
For EACH requirement, determine if the candidate meets it:
- verdict: 'met' (fully satisfies), 'partial' (partially satisfies), or 'not_met' (does not satisfy or not mentioned).
- quote: an EXACT substring from the resume text proving the verdict. For 'not_met', leave quote empty. Do NOT invent quotes.
- reasoning: concise explanation.

Requirements:
{req_list_str}

Candidate Resume (Redacted):
{redacted_text}
"""

        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ResumeScoreResponse,
            temperature=0.0,
        )

        loop = asyncio.get_running_loop()
        response = await loop.run_in_executor(
            None,
            lambda: self.client.models.generate_content(
                model=self.model_id,
                contents=prompt,
                config=config,
            ),
        )

        return json.loads(response.text)

    async def generate_job_description(
        self,
        job_title: str,
        seniority: str | None = None,
        key_skills: str | None = None,
    ) -> str:
        level_hint = f"Seniority Level: {seniority}\n" if seniority else ""
        skills_hint = f"Key Desired Skills: {key_skills}\n" if key_skills else ""

        prompt = f"""You are an elite HR recruitment strategist and corporate talent acquisition specialist.
Write a comprehensive, compelling, professional job description for the position: '{job_title}'.

{level_hint}{skills_hint}
Please structure the job description cleanly with the following markdown sections:
# {job_title}

### Role Overview
(A clear, inspiring 2-3 paragraph summary of the role, team mission, and impact.)

### Key Responsibilities
(5-7 bullet points of real-world duties, engineering/product practices, and deliverables.)

### Must-Have Requirements
(4-6 core non-negotiable requirements, years of experience, core technologies, and fundamentals.)

### Nice-to-Have Qualifications
(3-4 valuable bonus skills, cloud platforms, domain knowledge, or certifications.)

### Tech Stack & Tools
(Concise bulleted or comma-separated list of modern relevant technologies for this position.)

### Benefits & Work Culture
(Competitive compensation, remote/hybrid flexibility, professional development, and collaborative culture.)
"""

        try:
            self._ensure_client()
            config = types.GenerateContentConfig(
                temperature=0.3,
            )

            loop = asyncio.get_running_loop()
            response = await loop.run_in_executor(
                None,
                lambda: self.client.models.generate_content(
                    model=self.model_id,
                    contents=prompt,
                    config=config,
                ),
            )
            text = (response.text or "").strip()
            if text:
                return text
        except Exception as e:
            print(f"Gemini generate_job_description failed ({e}), falling back to deterministic template.")

        # Fallback to FakeAI
        from app.ai.fake import FakeAI
        fake = FakeAI()
        return await fake.generate_job_description(job_title, seniority, key_skills)
