from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.core.database import connect_db, close_db
from app.core.scheduler import start_scheduler, stop_scheduler
from app.api import trackers, settings, notifications, dashboard, prowlarr, transmission, backup


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_db()
    await start_scheduler()
    yield
    await stop_scheduler()
    await close_db()


app = FastAPI(title="RatioGuard API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(trackers.router, prefix="/api/trackers", tags=["trackers"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(prowlarr.router, prefix="/api/prowlarr", tags=["prowlarr"])
app.include_router(transmission.router, prefix="/api/transmission", tags=["transmission"])
app.include_router(backup.router, prefix="/api/backup", tags=["backup"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}
