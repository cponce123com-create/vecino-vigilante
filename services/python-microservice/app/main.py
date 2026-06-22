import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import procesar, fotos
from app.models.schemas import HealthResponse

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vecino Vigilante - NLP Microservice",
    description="Microservicio de NLP para extracción de entidades, relaciones y etiquetas",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(procesar.router, tags=["Procesamiento"])
app.include_router(fotos.router, tags=["Fotos"])


@app.get("/health", response_model=HealthResponse, tags=["Health"])
async def health():
    return HealthResponse(status="ok")


@app.on_event("startup")
async def startup():
    logger.info("Starting Vecino Vigilante NLP Microservice")
    try:
        from app.services.nlp_service import nlp_service
        nlp_service.get_nlp()
    except Exception as e:
        logger.warning(f"Could not load spaCy model on startup: {e}")


@app.on_event("shutdown")
async def shutdown():
    logger.info("Shutting down Vecino Vigilante NLP Microservice")
