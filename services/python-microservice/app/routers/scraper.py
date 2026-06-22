import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.services.telegram_scraper import telegram_scraper
from app.services.parser_leder import parse_conversacion
from app.services.nlp_service import nlp_service
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class LoginCodeRequest(BaseModel):
    code: str
    password: str | None = None


@router.post("/scraper/connect")
async def scraper_connect():
    """
    Initiate connection to Telegram via Telethon.
    Requires TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_PHONE
    to be configured in environment variables.
    
    If not authorized, a verification code will be sent to the phone.
    Use /scraper/login to complete authentication.
    """
    if not settings.telegram_api_id or not settings.telegram_api_hash or not settings.telegram_phone:
        raise HTTPException(
            status_code=400,
            detail="Configure TELEGRAM_API_ID, TELEGRAM_API_HASH, and TELEGRAM_PHONE in env vars. "
                   "Get API credentials from https://my.telegram.org/apps"
        )

    try:
        result = await telegram_scraper.connect()
        if result:
            return {"status": "connected", "message": "Already authenticated"}
        else:
            return {
                "status": "code_sent",
                "message": "Verification code sent to your Telegram number. "
                           "Use POST /scraper/login with the code."
            }
    except Exception as e:
        logger.error(f"Connection failed: {e}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")


@router.post("/scraper/login")
async def scraper_login(request: LoginCodeRequest):
    """Complete login with verification code sent to your phone."""
    try:
        result = await telegram_scraper.complete_login(
            code=request.code,
            password=request.password,
        )
        if result:
            return {"status": "logged_in", "message": "Successfully logged in to Telegram"}
        else:
            return {"status": "failed", "message": "Login failed. Check code or provide 2FA password."}
    except Exception as e:
        logger.error(f"Login failed: {e}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@router.post("/scraper/scrape")
async def scraper_scrape(
    chat_id: str = Query(default="8680870307", description="Telegram chat ID to scrape"),
    limit: int = Query(default=100, description="Max messages to fetch"),
    process: bool = Query(default=True, description="Run LEDER parser on scraped messages"),
):
    """
    Scrape messages from a Telegram chat and optionally process them
    through the LEDER DATA parser and NLP pipeline.
    
    Default chat_id is the LEDER DATA bot conversation.
    """
    if not telegram_scraper._session_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated. Call /scraper/connect first")

    try:
        messages = await telegram_scraper.scrape_chat(chat_id, limit=limit)
        if not messages:
            return {"status": "no_messages", "messages": []}

        # Combine all message texts into one conversation dump
        combined_text = "\n\n".join(
            f"[{m['date']}] {m['text']}" for m in messages
        )

        result = {
            "status": "success",
            "total_messages": len(messages),
            "messages": messages,
        }

        if process and combined_text:
            # Run LEDER parser + NLP on the combined text
            parser_result = parse_conversacion(combined_text)
            nlp_result = nlp_service.process_message(combined_text)

            # Merge
            all_entities = list(parser_result["entidades"])
            all_rels = list(parser_result["relaciones"])
            all_labels = list(parser_result["etiquetas"])
            seen_dnis = {e["dni"] for e in all_entities if e.get("dni")}

            for ent in nlp_result.get("entidades", []):
                if ent.get("dni") and ent["dni"] not in seen_dnis:
                    all_entities.append(ent)
                    seen_dnis.add(ent["dni"])

            all_rels.extend(nlp_result.get("relaciones", []))
            nlp_labels = {l["nombre"] for l in all_labels}
            for lbl in nlp_result.get("etiquetas", []):
                if lbl["nombre"] not in nlp_labels:
                    all_labels.append(lbl)
                    nlp_labels.add(lbl["nombre"])

            result["procesado"] = {
                "entidades": all_entities,
                "relaciones": all_rels,
                "etiquetas": all_labels,
                "empresas": parser_result.get("empresas", []),
                "vehiculos": parser_result.get("vehiculos", []),
            }

        return result

    except Exception as e:
        logger.error(f"Scrape failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Scrape failed: {str(e)}")


@router.post("/scraper/scrape_all")
async def scraper_scrape_all(
    process: bool = Query(default=True, description="Run parser on scraped messages"),
):
    """
    Scrape ALL recent dialogs and process their messages.
    Useful for bulk-importing all LEDER DATA conversations.
    """
    if not telegram_scraper._session_loaded:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        dialogs = await telegram_scraper.scrape_all_recent()
        if not dialogs:
            return {"status": "no_dialogs", "total_dialogs": 0}

        results = []
        for chat_id, messages in dialogs.items():
            combined_text = "\n\n".join(m["text"] for m in messages)
            entry = {"chat_id": chat_id, "message_count": len(messages)}

            if process and combined_text:
                parser_result = parse_conversacion(combined_text)
                entry["entidades"] = len(parser_result["entidades"])
                entry["relaciones"] = len(parser_result["relaciones"])
                entry["empresas"] = len(parser_result.get("empresas", []))

            results.append(entry)

        return {"status": "success", "total_dialogs": len(dialogs), "dialogs": results}

    except Exception as e:
        logger.error(f"Scrape all failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scraper/disconnect")
async def scraper_disconnect():
    """Disconnect Telethon client."""
    await telegram_scraper.disconnect()
    return {"status": "disconnected"}
