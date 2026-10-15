import pytest
from app.services.redaction import redact_pii


def test_redact_emails():
    text = "Contact me at candidate@example.org or backup.email@work.co.uk for inquiries."
    redacted = redact_pii(text)
    assert "candidate@example.org" not in redacted
    assert "backup.email@work.co.uk" not in redacted
    assert "[REDACTED]" in redacted


def test_redact_phone_numbers():
    text = (
        "Call me at +1-555-123-4567 or mobile (555) 987-6543. "
        "Alternative: 555.444.3333."
    )
    redacted = redact_pii(text)
    assert "+1-555-123-4567" not in redacted
    assert "(555) 987-6543" not in redacted
    assert "555.444.3333" not in redacted
    assert "[REDACTED]" in redacted


def test_redact_name_and_name_parts():
    text = "Resume of Alice Johnson. Alice has 7 years of engineering experience. Signed, Johnson."
    profile = {"name": "Alice Johnson"}
    redacted = redact_pii(text, profile)

    assert "Alice Johnson" not in redacted
    assert "Alice" not in redacted
    assert "Johnson" not in redacted
    assert "engineering experience" in redacted


def test_redact_address():
    text = (
        "Alice Johnson lives at 742 Evergreen Terrace, Springfield, OR 97477. "
        "Senior Software Engineer."
    )
    profile = {
        "name": "Alice Johnson",
        "address": "742 Evergreen Terrace, Springfield, OR 97477",
    }
    redacted = redact_pii(text, profile)

    assert "Evergreen Terrace" not in redacted
    assert "Springfield" not in redacted
    assert "Senior Software Engineer" in redacted


def test_preserves_technical_content():
    text = (
        "John Doe worked as Python Developer with FastAPI and PostgreSQL. "
        "Deployed containers to AWS ECS."
    )
    profile = {"name": "John Doe", "email": "john@test.com"}
    redacted = redact_pii(text, profile)

    assert "John Doe" not in redacted
    assert "Python Developer with FastAPI and PostgreSQL" in redacted
    assert "AWS ECS" in redacted


def test_empty_string_redaction():
    assert redact_pii("") == ""
    assert redact_pii(None) == ""
