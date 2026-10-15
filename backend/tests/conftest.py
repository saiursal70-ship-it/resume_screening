import os
from typing import AsyncGenerator
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

# Force fake AI and test settings
os.environ["USE_FAKE_AI"] = "true"
os.environ["SECRET_KEY"] = "test-secret-key-32-bytes-minimum-here"
os.environ["ENVIRONMENT"] = "testing"

from app.ai.fake import FakeAI
from app.auth import create_access_token, get_password_hash
from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models import User

# Use in-memory SQLite database for testing
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

import app.database as app_db
app_db.AsyncSessionLocal = TestingSessionLocal


@pytest_asyncio.fixture(autouse=True)
async def setup_test_db():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide an isolated database session for a test."""
    async with TestingSessionLocal() as session:
        yield session


@pytest_asyncio.fixture(autouse=True)
def override_db(db_session: AsyncSession):
    """Override FastAPI get_db dependency to use the test database session."""
    async def _get_test_db():
        yield db_session

    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.fixture
def fake_ai():
    """Provide FakeAI instance."""
    return FakeAI(model_id="test-fake-v1", prompt_version="v1.0")


@pytest_asyncio.fixture
async def seed_users(db_session: AsyncSession):
    """Seed HR and Viewer users into the test database."""
    hr_user = User(
        email="hr@example.com",
        password_hash=get_password_hash("hr-password-123"),
        role="hr",
        name="HR Manager",
    )
    viewer_user = User(
        email="viewer@example.com",
        password_hash=get_password_hash("viewer-password-123"),
        role="viewer",
        name="Viewer User",
    )
    db_session.add(hr_user)
    db_session.add(viewer_user)
    await db_session.commit()
    await db_session.refresh(hr_user)
    await db_session.refresh(viewer_user)
    return {"hr": hr_user, "viewer": viewer_user}


@pytest_asyncio.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Anonymous async HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture
async def hr_client(seed_users) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client authenticated as HR Manager."""
    hr_user = seed_users["hr"]
    token = create_access_token(
        data={"sub": str(hr_user.id), "email": hr_user.email, "role": hr_user.role}
    )
    transport = ASGITransport(app=app)
    cookies = {settings.COOKIE_NAME: token}
    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        yield ac


@pytest_asyncio.fixture
async def viewer_client(seed_users) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP client authenticated as Viewer User."""
    viewer_user = seed_users["viewer"]
    token = create_access_token(
        data={"sub": str(viewer_user.id), "email": viewer_user.email, "role": viewer_user.role}
    )
    transport = ASGITransport(app=app)
    cookies = {settings.COOKIE_NAME: token}
    async with AsyncClient(transport=transport, base_url="http://test", cookies=cookies) as ac:
        yield ac
