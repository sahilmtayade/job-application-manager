"""FastAPI REST API for Job Application Manager"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from jam.db.schema import init_db

from api.routes import applications, stats, companies, config, goals, notes, backup, banned, files, banned_sources, llm, job_search


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    init_db()
    yield


app = FastAPI(
    title="JAM API",
    description="Job Application Manager REST API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routes
app.include_router(applications.router, prefix="/api/applications", tags=["applications"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])
app.include_router(companies.router, prefix="/api/companies", tags=["companies"])
app.include_router(config.router, prefix="/api/config", tags=["config"])
app.include_router(goals.router, prefix="/api/goals", tags=["goals"])
app.include_router(notes.router, prefix="/api", tags=["notes"])
app.include_router(backup.router, prefix="/api/backups", tags=["backups"])
app.include_router(banned.router, prefix="/api/banned", tags=["banned"])
app.include_router(banned_sources.router, prefix="/api/banned-sources", tags=["banned-sources"])
app.include_router(files.router, prefix="/api/applications", tags=["files"])
app.include_router(llm.router, prefix="/api/llm", tags=["llm"])
app.include_router(job_search.router, prefix="/api/job-search", tags=["job-search"])


@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "jam-api"}

