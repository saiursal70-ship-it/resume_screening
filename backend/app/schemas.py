from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ======================== Auth Schemas ========================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)
    role: Literal["hr", "viewer"] = "hr"


class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    role: str
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

    model_config = ConfigDict(from_attributes=True)


class LogoutResponse(BaseModel):
    message: str


# ======================== Requirement Schemas ========================

class RequirementIn(BaseModel):
    text: str = Field(..., min_length=1)
    category: Literal["must_have", "nice_to_have"] = "nice_to_have"
    weight: float = Field(default=1.0, ge=0.0)
    sort_order: int = Field(default=0, ge=0)


class RequirementOut(BaseModel):
    id: int
    job_id: int
    text: str
    category: str
    weight: float
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


# ======================== Job Schemas ========================

class JobCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: str = Field(..., min_length=1)


class JobDescriptionGenerateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=500)
    seniority: Optional[str] = Field(None, max_length=100)
    key_skills: Optional[str] = Field(None, max_length=500)


class JobDescriptionGenerateResponse(BaseModel):
    title: str
    description: str


class JobUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    description: Optional[str] = Field(None, min_length=1)
    status: Optional[Literal["draft", "open"]] = None


class JobOut(BaseModel):
    id: int
    title: str
    description: str
    status: str
    requirements_confirmed: bool
    created_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class JobListOut(BaseModel):
    id: int
    title: str
    status: str
    requirements_confirmed: bool
    created_at: datetime
    candidate_count: int

    model_config = ConfigDict(from_attributes=True)


class JobDetailOut(BaseModel):
    job: JobOut
    requirements: List[RequirementOut]


# ======================== Candidate Schemas ========================

class CandidateUploadOut(BaseModel):
    id: int
    filename: str
    status: str

    model_config = ConfigDict(from_attributes=True)


class CandidateListItemOut(BaseModel):
    id: int
    filename: str
    score: Optional[float] = None
    stage: str
    status: str
    missing_must_haves: List[str] = Field(default_factory=list)
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CandidateDetailOut(BaseModel):
    id: int
    job_id: int
    filename: str
    file_path: str
    file_hash: str
    file_size: int
    resume_text: Optional[str] = None
    redacted_text: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    score: Optional[float] = None
    stage: str
    profile_data: Optional[Dict[str, Any]] = None
    screening_result: Optional[Dict[str, Any]] = None
    model_id: Optional[str] = None
    prompt_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    missing_must_haves: List[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class CandidateRetryOut(BaseModel):
    id: int
    status: str


class CandidateStageUpdate(BaseModel):
    stage: Literal["new", "shortlisted", "rejected", "on_hold"]
    reason: Optional[str] = None


class StageHistoryOut(BaseModel):
    from_stage: Optional[str] = None
    to_stage: str
    reason: Optional[str] = None
    changed_by_name: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
