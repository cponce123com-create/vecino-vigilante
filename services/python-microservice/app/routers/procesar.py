import logging
from fastapi import APIRouter, HTTPException

from app.models.schemas import ProcesarMensajeRequest, ProcesarMensajeResponse
from app.services.nlp_service import nlp_service

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/procesar_mensaje", response_model=ProcesarMensajeResponse)
async def procesar_mensaje(request: ProcesarMensajeRequest):
    if not request.texto or not request.texto.strip():
        raise HTTPException(status_code=400, detail="El texto no puede estar vacío")

    try:
        result = nlp_service.process_message(request.texto)
        return ProcesarMensajeResponse(
            entidades=result["entidades"],
            relaciones=result["relaciones"],
            etiquetas=result["etiquetas"],
        )
    except Exception as e:
        logger.error(f"Error processing message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error procesando mensaje: {str(e)}")
