import logging
import cloudinary
import cloudinary.uploader
from fastapi import UploadFile

from app.config import settings

logger = logging.getLogger(__name__)


def init_cloudinary():
    if settings.cloudinary_cloud_name:
        cloudinary.config(
            cloud_name=settings.cloudinary_cloud_name,
            api_key=settings.cloudinary_api_key,
            api_secret=settings.cloudinary_api_secret,
            secure=True,
        )
        logger.info("Cloudinary configured successfully")
        return True
    logger.warning("Cloudinary not configured (missing cloud name)")
    return False


async def upload_image(file: UploadFile, dni: str) -> dict:
    if not settings.cloudinary_cloud_name:
        raise RuntimeError("Cloudinary is not configured")

    contents = await file.read()
    public_id = f"personas/{dni}_{file.filename}"

    result = cloudinary.uploader.upload(
        contents,
        public_id=public_id,
        overwrite=True,
        resource_type="image",
    )

    logger.info(f"Image uploaded to Cloudinary: {result['secure_url']}")
    return {
        "url": result["secure_url"],
        "public_id": result["public_id"],
    }
