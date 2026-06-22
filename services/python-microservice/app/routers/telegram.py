import logging
import httpx
from fastapi import APIRouter, HTTPException, Request
from app.config import settings
from app.models.schemas import ProcesarMensajeRequest
from app.services.nlp_service import nlp_service

logger = logging.getLogger(__name__)
router = APIRouter()

NODEJS_API_URL = settings.nodejs_api_url or "http://localhost:3000"


@router.post("/telegram_webhook")
async def telegram_webhook(request: Request):
    """
    Webhook endpoint for Telegram Bot.
    Telegram sends updates here when people send messages to the bot
    or when the bot sees messages in groups where it's added.
    """
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=501, detail="Telegram bot not configured")

    try:
        update = await request.json()
    except Exception as e:
        logger.error(f"Failed to parse Telegram update: {e}")
        raise HTTPException(status_code=400, detail="Invalid Telegram update")

    # Process message from Telegram update
    message = update.get("message") or update.get("channel_post") or {}
    text = message.get("text", "")
    chat_id = message.get("chat", {}).get("id")
    message_id = message.get("message_id")

    if not text:
        return {"ok": True, "processed": False, "reason": "No text in message"}

    logger.info(f"Telegram message from chat {chat_id}: {text[:100]}...")

    # Run NLP processing
    nlp_result = nlp_service.process_message(text)

    # Also forward to Node.js backend if available
    nodejs_result = None
    if NODEJS_API_URL:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.post(
                    f"{NODEJS_API_URL}/api/telegram/procesar",
                    json={"texto": text, "chatId": str(chat_id) if chat_id else None},
                )
                if resp.status_code < 500:
                    nodejs_result = resp.json()
                else:
                    logger.error(f"Node.js returned {resp.status_code}: {resp.text}")
        except Exception as e:
            logger.warning(f"Could not forward to Node.js: {e}")

    return {
        "ok": True,
        "processed": True,
        "entidades_encontradas": len(nlp_result.get("entidades", [])),
        "relaciones_encontradas": len(nlp_result.get("relaciones", [])),
        "nodejs_result": nodejs_result,
    }


@router.get("/telegram/set_webhook")
async def set_telegram_webhook():
    """
    Set the Telegram bot webhook.
    Call this once after deploying to tell Telegram where to send updates.
    Requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_URL env vars.
    """
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=501, detail="TELEGRAM_BOT_TOKEN not configured")
    if not settings.telegram_webhook_url:
        raise HTTPException(status_code=501, detail="TELEGRAM_WEBHOOK_URL not configured")

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/setWebhook"
    webhook_url = f"{settings.telegram_webhook_url}/telegram_webhook"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json={"url": webhook_url})
        data = resp.json()

    return {"ok": data.get("ok"), "description": data.get("description")}


@router.get("/telegram/delete_webhook")
async def delete_telegram_webhook():
    """Delete the Telegram bot webhook."""
    if not settings.telegram_bot_token:
        raise HTTPException(status_code=501, detail="TELEGRAM_BOT_TOKEN not configured")

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/deleteWebhook"

    async with httpx.AsyncClient() as client:
        resp = await client.post(url)
        data = resp.json()

    return {"ok": data.get("ok"), "description": data.get("description")}
