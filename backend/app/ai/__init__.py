from app.ai.fake import FakeAI
from app.ai.gemini import GeminiAI
from app.ai.interface import AIInterface
from app.config import settings


def get_ai_service() -> AIInterface:
    """Return configured AI service instance (Gemini or Fake fallback)."""
    if settings.USE_FAKE_AI or not settings.GEMINI_API_KEY:
        return FakeAI(model_id="fake-ai-v1", prompt_version="v1.0")
    return GeminiAI(
        api_key=settings.GEMINI_API_KEY,
        model_id=settings.GEMINI_MODEL,
        prompt_version="v1.0",
    )


__all__ = ["AIInterface", "FakeAI", "GeminiAI", "get_ai_service"]
