import os
import sys
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.auth import get_password_hash
from app.config import settings
from app.models import User


def seed_users():
    sync_url = os.getenv("DATABASE_URL_SYNC", settings.DATABASE_URL_SYNC)
    if "postgresql+asyncpg://" in sync_url:
        sync_url = sync_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    elif sync_url.startswith("postgresql://"):
        sync_url = sync_url.replace("postgresql://", "postgresql+psycopg2://", 1)
    print(f"Connecting to sync database at: {sync_url}")
    engine = create_engine(sync_url)

    with Session(engine) as session:
        # Check / create HR user
        hr_stmt = select(User).where(User.email == "hr@example.com")
        hr_user = session.execute(hr_stmt).scalar_one_or_none()
        if not hr_user:
            hr_user = User(
                email="hr@example.com",
                password_hash=get_password_hash("hr-password-123"),
                role="hr",
                name="HR Manager",
            )
            session.add(hr_user)
            print("Created user: hr@example.com (role: hr)")
        else:
            print("User hr@example.com already exists.")

        # Check / create Viewer user
        viewer_stmt = select(User).where(User.email == "viewer@example.com")
        viewer_user = session.execute(viewer_stmt).scalar_one_or_none()
        if not viewer_user:
            viewer_user = User(
                email="viewer@example.com",
                password_hash=get_password_hash("viewer-password-123"),
                role="viewer",
                name="Viewer User",
            )
            session.add(viewer_user)
            print("Created user: viewer@example.com (role: viewer)")
        else:
            print("User viewer@example.com already exists.")

        session.commit()
    print("Database seeding completed.")


if __name__ == "__main__":
    seed_users()
