from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from sqlalchemy import select

from app.auth import get_password_hash
from app.config import settings
from app.database import AsyncSessionLocal, Base, engine
from app.models import User
from app.routers import auth, candidates, jobs


async def auto_init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with AsyncSessionLocal() as session:
            hr_stmt = select(User).where(User.email == "hr@example.com")
            hr_user = (await session.execute(hr_stmt)).scalar_one_or_none()
            if not hr_user:
                hr_user = User(
                    email="hr@example.com",
                    password_hash=get_password_hash("hr-password-123"),
                    role="hr",
                    name="HR Manager",
                )
                session.add(hr_user)

            viewer_stmt = select(User).where(User.email == "viewer@example.com")
            viewer_user = (await session.execute(viewer_stmt)).scalar_one_or_none()
            if not viewer_user:
                viewer_user = User(
                    email="viewer@example.com",
                    password_hash=get_password_hash("viewer-password-123"),
                    role="viewer",
                    name="Viewer User",
                )
                session.add(viewer_user)

            await session.commit()
    except Exception as e:
        print(f"Database auto-init note: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure upload directory exists on startup
    settings.upload_path.mkdir(parents=True, exist_ok=True)
    # Auto-initialize database tables and default users
    await auto_init_db()
    yield


app = FastAPI(
    title="AI-Assisted Resume Screening API",
    description="Backend API for AI-assisted resume screening and candidate evaluation",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$|^https://.*(\.onrender\.com|\.vercel\.app)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers with both /api and /api/v1 prefix as mandated by specification
app.include_router(auth.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(candidates.router, prefix="/api")

app.include_router(auth.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(candidates.router, prefix="/api/v1")


@app.get("/api/health")
@app.get("/api/v1/health")
@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
async def root_index():
    return """<!DOCTYPE html>
<html>
  <head>
    <title>ScreenAI API Server</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; }
      .card { background: #1e293b; padding: 2.5rem; border-radius: 1rem; border: 1px solid #334155; max-width: 460px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
      .badge { display: inline-block; background: #064e3b; color: #34d399; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #059669; }
      h1 { color: #ffffff; margin-top: 0; font-size: 1.6rem; letter-spacing: -0.025em; }
      p { color: #94a3b8; font-size: 0.95rem; line-height: 1.6; margin-bottom: 2rem; }
      .btn { display: block; background: #6366f1; color: white; text-decoration: none; padding: 0.85rem 1.5rem; border-radius: 0.6rem; font-weight: 600; font-size: 0.95rem; margin-bottom: 0.75rem; transition: background 0.2s; box-shadow: 0 4px 6px -1px rgba(99, 102, 241, 0.3); }
      .btn:hover { background: #4f46e5; }
      .btn-secondary { background: #334155; color: #cbd5e1; box-shadow: none; }
      .btn-secondary:hover { background: #475569; color: white; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">● Online & Ready</div>
      <h1>ScreenAI API Server</h1>
      <p>The backend is running smoothly. Click below to launch the web platform in your browser or inspect the API.</p>
      <a href="http://localhost:3000" class="btn">🚀 Open Web Platform (Port 3000)</a>
      <a href="http://127.0.0.1:3000" class="btn btn-secondary">⚡ Open via 127.0.0.1:3000</a>
      <a href="/api/docs" class="btn btn-secondary">📖 API Interactive Docs</a>
    </div>
  </body>
</html>"""
