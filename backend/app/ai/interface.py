from abc import ABC, abstractmethod
from typing import Any, Dict, List


class AIInterface(ABC):
    @abstractmethod
    async def extract_requirements(self, job_description: str) -> List[Dict[str, Any]]:
        """Returns [{text, category, weight}]"""
        pass

    @abstractmethod
    async def extract_profile(self, resume_text: str) -> Dict[str, Any]:
        """Returns {name, email, phone, address, skills[], experience[], education[]}"""
        pass

    @abstractmethod
    async def score_resume(self, redacted_text: str, requirements: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Returns {verdicts: [{requirement_text, verdict: 'met'|'not_met'|'partial', quote: str, reasoning: str}]}"""
        pass

    @abstractmethod
    async def generate_job_description(
        self,
        job_title: str,
        seniority: str | None = None,
        key_skills: str | None = None,
    ) -> str:
        """Generate a structured, professional job description from a job title."""
        pass
