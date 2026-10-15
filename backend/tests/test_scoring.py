import pytest
from app.services.screening import compute_score


def test_perfect_score():
    requirements = [
        {"text": "Python 3 experience", "category": "must_have", "weight": 2.0},
        {"text": "FastAPI knowledge", "category": "must_have", "weight": 1.5},
        {"text": "Docker familiarity", "category": "nice_to_have", "weight": 1.0},
    ]
    verdicts = [
        {"requirement_text": "Python 3 experience", "verdict": "met"},
        {"requirement_text": "FastAPI knowledge", "verdict": "met"},
        {"requirement_text": "Docker familiarity", "verdict": "met"},
    ]

    score, missing = compute_score(requirements, verdicts)
    assert score == 100.0
    assert missing == []


def test_zero_score_and_missing_must_haves():
    requirements = [
        {"text": "Python 3 experience", "category": "must_have", "weight": 2.0},
        {"text": "FastAPI knowledge", "category": "must_have", "weight": 1.0},
        {"text": "Docker familiarity", "category": "nice_to_have", "weight": 1.0},
    ]
    verdicts = [
        {"requirement_text": "Python 3 experience", "verdict": "not_met"},
        {"requirement_text": "FastAPI knowledge", "verdict": "not_met"},
        {"requirement_text": "Docker familiarity", "verdict": "not_met"},
    ]

    score, missing = compute_score(requirements, verdicts)
    assert score == 0.0
    assert "Python 3 experience" in missing
    assert "FastAPI knowledge" in missing
    assert "Docker familiarity" not in missing


def test_weighted_scoring_with_partial():
    requirements = [
        {"text": "5+ years backend", "category": "must_have", "weight": 2.0},
        {"text": "PostgreSQL indexing", "category": "nice_to_have", "weight": 1.0},
        {"text": "Kubernetes orchestration", "category": "must_have", "weight": 1.0},
    ]
    verdicts = [
        {"requirement_text": "5+ years backend", "verdict": "met"},       # 2.0 * 1.0 = 2.0
        {"requirement_text": "PostgreSQL indexing", "verdict": "partial"}, # 1.0 * 0.5 = 0.5
        {"requirement_text": "Kubernetes orchestration", "verdict": "not_met"}, # 1.0 * 0.0 = 0.0
    ]
    # Total weight = 4.0, weighted sum = 2.5 -> (2.5 / 4.0) * 100 = 62.5%

    score, missing = compute_score(requirements, verdicts)
    assert score == 62.5
    assert missing == ["Kubernetes orchestration"]


def test_unknown_verdict_downgrade_scoring():
    requirements = [
        {"text": "AWS cloud certification", "category": "must_have", "weight": 2.0},
        {"text": "CI/CD pipelines", "category": "nice_to_have", "weight": 1.0},
    ]
    verdicts = [
        {"requirement_text": "AWS cloud certification", "verdict": "unknown"}, # 0.0
        {"requirement_text": "CI/CD pipelines", "verdict": "met"},             # 1.0 * 1.0
    ]
    # Total weight = 3.0, weighted sum = 1.0 -> (1.0 / 3.0) * 100 = 33.33%

    score, missing = compute_score(requirements, verdicts)
    assert score == 33.33
    assert "AWS cloud certification" in missing


def test_empty_requirements():
    score, missing = compute_score([], [])
    assert score == 0.0
    assert missing == []


def test_only_nice_to_have_requirements():
    requirements = [
        {"text": "GraphQL APIs", "category": "nice_to_have", "weight": 1.0},
        {"text": "Redis caching", "category": "nice_to_have", "weight": 1.0},
    ]
    verdicts = [
        {"requirement_text": "GraphQL APIs", "verdict": "not_met"},
        {"requirement_text": "Redis caching", "verdict": "partial"},
    ]

    score, missing = compute_score(requirements, verdicts)
    assert score == 25.0
    assert missing == []
