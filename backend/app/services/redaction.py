import re
from typing import Any, Dict, Optional

# Match email addresses
EMAIL_REGEX = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b"
)

# Match phone numbers in various common formats (e.g., +1-555-123-4567, (555) 123-4567, 555.123.4567)
PHONE_REGEX = re.compile(
    r"(?:\+?\d{1,3}[-.\s]*)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}\b"
)


def redact_pii(resume_text: str, profile_data: Optional[Dict[str, Any]] = None) -> str:
    """
    Remove personally identifiable information (PII) from resume text before scoring.
    Replaces candidate name, email, phone number, and address with [REDACTED].
    """
    if not resume_text:
        return ""

    redacted = resume_text

    # 1. Redact Emails via Regex
    redacted = EMAIL_REGEX.sub("[REDACTED]", redacted)

    # 2. Redact Phone Numbers via Regex
    redacted = PHONE_REGEX.sub("[REDACTED]", redacted)

    if profile_data:
        # Redact specific email if passed in profile
        email = profile_data.get("email")
        if email and isinstance(email, str) and email.strip():
            redacted = re.sub(re.escape(email.strip()), "[REDACTED]", redacted, flags=re.IGNORECASE)

        # Redact specific phone if passed in profile
        phone = profile_data.get("phone")
        if phone and isinstance(phone, str) and phone.strip():
            digits_only = re.sub(r"\D", "", phone)
            if len(digits_only) >= 7:
                redacted = re.sub(re.escape(phone.strip()), "[REDACTED]", redacted, flags=re.IGNORECASE)

        # 3. Redact Address
        address = profile_data.get("address")
        if address and isinstance(address, str) and len(address.strip()) > 3:
            redacted = re.sub(re.escape(address.strip()), "[REDACTED]", redacted, flags=re.IGNORECASE)
            # Also redact individual address segments if separated by commas
            for segment in address.split(","):
                clean_seg = segment.strip()
                if len(clean_seg) > 5 and not clean_seg.isdigit():
                    redacted = re.sub(re.escape(clean_seg), "[REDACTED]", redacted, flags=re.IGNORECASE)

        # 4. Redact Name and Name parts
        name = profile_data.get("name")
        if name and isinstance(name, str) and name.strip():
            clean_name = name.strip()
            # Replace full name first
            redacted = re.sub(rf"\b{re.escape(clean_name)}\b", "[REDACTED]", redacted, flags=re.IGNORECASE)

            # Replace individual name parts (first, middle, last)
            name_parts = [part for part in clean_name.split() if len(part) >= 2]
            for part in name_parts:
                # Avoid redacting generic single letters or very common short words
                if part.lower() not in {"and", "the", "for", "with", "dr", "mr", "ms", "mrs"}:
                    redacted = re.sub(
                        rf"\b{re.escape(part)}\b",
                        "[REDACTED]",
                        redacted,
                        flags=re.IGNORECASE,
                    )

    return redacted
