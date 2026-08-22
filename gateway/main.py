"""
ComfyDesk — FastAPI Gateway
Entry point: registers all routers and mounts the application.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from services.task_store import init_db
from services.studio_store import init_db as init_studio_db
from services import gpu_watchdog

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await init_studio_db()
    watchdog_task = gpu_watchdog.start()
    try:
        yield
    finally:
        watchdog_task.cancel()

from api.generate import router as generate_router
from api.tasks import router as tasks_router
from api.caption import router as caption_router
from api.workflows import router as workflows_router
from api.system import router as system_router
from api.dataset import router as dataset_router
from api.training import router as training_router
from api.images import router as images_router
from api.skills import router as skills_router
from api.artifacts import router as artifacts_router
from api.studio import router as studio_router
from config import settings

app = FastAPI(
    title="ComfyDesk API",
    description="Text-to-image generation & annotation API backed by ComfyUI + JoyCaption",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_router, prefix="/api/v1", tags=["Generate"])
app.include_router(tasks_router,    prefix="/api/v1", tags=["Tasks"])
app.include_router(caption_router,  prefix="/api/v1", tags=["Caption"])
app.include_router(workflows_router, prefix="/api/v1", tags=["Workflows"])
app.include_router(system_router, prefix="/api/v1", tags=["System"])
app.include_router(dataset_router, prefix="/api/v1", tags=["Dataset"])
app.include_router(training_router, prefix="/api/v1", tags=["Training"])
app.include_router(images_router, tags=["Images"])
app.include_router(skills_router, prefix="/api/v1", tags=["Skills"])
app.include_router(artifacts_router, prefix="/api/v1", tags=["Artifacts"])
app.include_router(studio_router, prefix="/api/v1", tags=["Studio"])


@app.get("/api/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "1.0.0"}
