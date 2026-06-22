import logging
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from app.models.schemas import SubirFotoResponse
from app.services.cloudinary_service import upload_image, init_cloudinary

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/subir_foto", response_model=SubirFotoResponse)
async def subir_foto(
    file: UploadFile = File(...),
    dni: str = Form(...),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="El archivo debe ser una imagen")

    try:
        init_cloudinary()
        result = await upload_image(file, dni)
        return SubirFotoResponse(**result)
    except RuntimeError as e:
        logger.error(f"Cloudinary configuration error: {e}")
        raise HTTPException(status_code=500, detail="Cloudinary no está configurado")
    except Exception as e:
        logger.error(f"Error uploading image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error subiendo imagen: {str(e)}")
