from datetime import datetime
from typing import Any, Dict, List, Optional
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("role IN ('hr', 'viewer')", name="check_user_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="creator")
    stage_changes: Mapped[List["StageHistory"]] = relationship("StageHistory", back_populates="changed_by_user")


class Job(Base):
    __tablename__ = "jobs"
    __table_args__ = (
        CheckConstraint("status IN ('draft', 'open')", name="check_job_status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="draft", server_default="draft"
    )
    requirements_confirmed: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false", nullable=False
    )
    created_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=func.now(),
        nullable=False,
    )

    creator: Mapped[Optional["User"]] = relationship("User", back_populates="jobs")
    requirements: Mapped[List["Requirement"]] = relationship(
        "Requirement",
        back_populates="job",
        cascade="all, delete-orphan",
        order_by="Requirement.sort_order",
    )
    candidates: Mapped[List["Candidate"]] = relationship(
        "Candidate",
        back_populates="job",
        cascade="all, delete-orphan",
    )


class Requirement(Base):
    __tablename__ = "requirements"
    __table_args__ = (
        CheckConstraint(
            "category IN ('must_have', 'nice_to_have')",
            name="check_requirement_category",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    text: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[str] = mapped_column(
        String(20), nullable=False, default="nice_to_have", server_default="nice_to_have"
    )
    weight: Mapped[float] = mapped_column(
        Float, nullable=False, default=1.0, server_default="1.0"
    )
    sort_order: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0, server_default="0"
    )

    job: Mapped["Job"] = relationship("Job", back_populates="requirements")


class Candidate(Base):
    __tablename__ = "candidates"
    __table_args__ = (
        UniqueConstraint("job_id", "file_hash", name="uq_candidates_job_file_hash"),
        CheckConstraint(
            "status IN ('queued', 'processing', 'done', 'failed')",
            name="check_candidate_status",
        ),
        CheckConstraint(
            "stage IN ('new', 'shortlisted', 'rejected', 'on_hold')",
            name="check_candidate_stage",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(1000), nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    resume_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    redacted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="queued", server_default="queued"
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stage: Mapped[str] = mapped_column(
        String(20), nullable=False, default="new", server_default="new"
    )
    profile_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    screening_result: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    model_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    prompt_version: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        server_default=func.now(),
        nullable=False,
    )

    job: Mapped["Job"] = relationship("Job", back_populates="candidates")
    stage_history: Mapped[List["StageHistory"]] = relationship(
        "StageHistory",
        back_populates="candidate",
        cascade="all, delete-orphan",
        order_by="StageHistory.created_at.desc()",
    )


class StageHistory(Base):
    __tablename__ = "stage_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    candidate_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_stage: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    to_stage: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    changed_by: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, server_default=func.now(), nullable=False
    )

    candidate: Mapped["Candidate"] = relationship("Candidate", back_populates="stage_history")
    changed_by_user: Mapped[Optional["User"]] = relationship("User", back_populates="stage_changes")
