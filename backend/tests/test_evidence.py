import pytest
from app.services.screening import verify_evidence


def test_verified_evidence_exact_quote():
    resume_text = "Experienced Senior Developer with 6 years building high scale FastAPI services."
    verdict_item = {
        "requirement_text": "FastAPI services",
        "verdict": "met",
        "quote": "building high scale FastAPI services",
        "reasoning": "Direct quote found in resume.",
    }

    result = verify_evidence(verdict_item, resume_text)
    assert result["quote_verified"] is True
    assert result["verdict"] == "met"


def test_verified_evidence_case_insensitive():
    resume_text = "Proficient in Python, POSTGRESQL, and Docker containers."
    verdict_item = {
        "requirement_text": "PostgreSQL database experience",
        "verdict": "met",
        "quote": "postgresql",
        "reasoning": "Found in resume.",
    }

    result = verify_evidence(verdict_item, resume_text)
    assert result["quote_verified"] is True
    assert result["verdict"] == "met"


def test_hallucinated_quote_downgraded_to_unknown():
    resume_text = "Worked with React and Node.js for 3 years."
    verdict_item = {
        "requirement_text": "Kubernetes orchestration",
        "verdict": "met",
        "quote": "Managed Kubernetes clusters in production",
        "reasoning": "Hallucinated citation.",
    }

    result = verify_evidence(verdict_item, resume_text)
    assert result["quote_verified"] is False
    assert result["verdict"] == "unknown"


def test_partial_verdict_with_valid_quote():
    resume_text = "Basic exposure to cloud platforms including AWS S3."
    verdict_item = {
        "requirement_text": "AWS cloud architect experience",
        "verdict": "partial",
        "quote": "AWS S3",
        "reasoning": "Candidate has basic exposure.",
    }

    result = verify_evidence(verdict_item, resume_text)
    assert result["quote_verified"] is True
    assert result["verdict"] == "partial"


def test_partial_verdict_with_invalid_quote_downgraded():
    resume_text = "Basic exposure to local testing tools."
    verdict_item = {
        "requirement_text": "AWS cloud architect experience",
        "verdict": "partial",
        "quote": "Assisted with AWS lambdas",
        "reasoning": "Not in text.",
    }

    result = verify_evidence(verdict_item, resume_text)
    assert result["quote_verified"] is False
    assert result["verdict"] == "unknown"


def test_not_met_without_quote_remains_not_met():
    resume_text = "Backend engineer specializing in Java and Spring Boot."
    verdict_item = {
        "requirement_text": "Python programming",
        "verdict": "not_met",
        "quote": "",
        "reasoning": "Python is not mentioned anywhere.",
    }

    result = verify_evidence(verdict_item, resume_text)
    assert result["quote_verified"] is True
    assert result["verdict"] == "not_met"


def test_met_verdict_with_missing_quote_downgraded():
    resume_text = "Python engineer with strong background."
    verdict_item = {
        "requirement_text": "Python programming",
        "verdict": "met",
        "quote": "",
        "reasoning": "Claims met without quote.",
    }

    result = verify_evidence(verdict_item, resume_text)
    assert result["quote_verified"] is False
    assert result["verdict"] == "unknown"
