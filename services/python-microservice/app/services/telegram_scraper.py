import logging
import asyncio
from typing import Optional

from telethon import TelegramClient
from telethon.errors import SessionPasswordNeededError

from app.config import settings

logger = logging.getLogger(__name__)


class TelegramScraper:
    """
    Scraper that uses Telethon (user account) to scrape messages
    from Telegram conversations (e.g., with LEDER DATA bot).

    Requires the user to provide:
    - TELEGRAM_API_ID: from my.telegram.org
    - TELEGRAM_API_HASH: from my.telegram.org
    - TELEGRAM_PHONE: phone number for login
    - TELEGRAM_SESSION: session string (for reconnection)
    """

    def __init__(self):
        self.client: Optional[TelegramClient] = None
        self._session_loaded = False

    async def connect(self) -> bool:
        """Connect to Telegram using stored credentials."""
        api_id = settings.telegram_api_id
        api_hash = settings.telegram_api_hash
        phone = settings.telegram_phone
        session_str = settings.telegram_session

        if not api_id or not api_hash or not phone:
            logger.warning("Telegram scraper: missing API credentials")
            return False

        self.client = TelegramClient(
            session=session_str if session_str else "leder_scraper",
            api_id=int(api_id) if isinstance(api_id, str) else api_id,
            api_hash=api_hash,
        )

        await self.client.connect()

        if not await self.client.is_user_authorized():
            if session_str:
                logger.warning("Session expired, need re-login")
                return False
            try:
                await self.client.send_code_request(phone)
                logger.info(f"Verification code sent to {phone}")
                return False  # Need code
            except Exception as e:
                logger.error(f"Failed to request code: {e}")
                return False

        self._session_loaded = True
        logger.info("Telegram scraper: connected and authorized")
        return True

    async def complete_login(self, code: str, password: Optional[str] = None) -> bool:
        """Complete login with the verification code."""
        if not self.client:
            return False
        try:
            await self.client.sign_in(code=code)
            self._session_loaded = True
            logger.info("Telegram login successful")
            return True
        except SessionPasswordNeededError:
            if password:
                await self.client.sign_in(password=password)
                self._session_loaded = True
                logger.info("Telegram login with 2FA successful")
                return True
            logger.warning("2FA password required")
            return False
        except Exception as e:
            logger.error(f"Login failed: {e}")
            return False

    async def scrape_chat(self, chat_identifier: str, limit: int = 100) -> list[dict]:
        """
        Scrape messages from a specific chat (by username, phone, or ID).

        Args:
            chat_identifier: Chat ID (e.g., "8680870307"), username, or phone
            limit: Max number of messages to fetch

        Returns:
            List of message dicts with text, sender, date
        """
        if not self.client or not self._session_loaded:
            logger.error("Telegram scraper: not connected")
            return []

        try:
            entity = await self.client.get_entity(chat_identifier)
            messages = []
            async for msg in self.client.iter_messages(entity, limit=limit):
                if msg.text:
                    messages.append({
                        "id": msg.id,
                        "date": msg.date.isoformat() if msg.date else None,
                        "sender": msg.sender_id,
                        "text": msg.text,
                    })
            logger.info(f"Scraped {len(messages)} messages from {chat_identifier}")
            return messages
        except Exception as e:
            logger.error(f"Failed to scrape chat {chat_identifier}: {e}")
            return []

    async def scrape_all_recent(self, hours: int = 24) -> dict[str, list[dict]]:
        """
        Scrape all dialogs that had recent messages and return them grouped by chat.

        Returns:
            Dict of chat_identifier -> list of messages
        """
        if not self.client or not self._session_loaded:
            return {}

        result = {}
        try:
            async for dialog in self.client.iter_dialogs():
                chat_id = str(dialog.id)
                messages = []
                async for msg in self.client.iter_messages(dialog.entity, limit=50):
                    if msg.text:
                        messages.append({
                            "id": msg.id,
                            "date": msg.date.isoformat() if msg.date else None,
                            "sender": msg.sender_id,
                            "text": msg.text,
                        })
                if messages:
                    result[chat_id] = messages
                    name = dialog.name or "Unknown"
                    logger.info(f"Dialog '{name}' ({chat_id}): {len(messages)} messages")
            logger.info(f"Scraped {len(result)} dialogs total")
        except Exception as e:
            logger.error(f"Failed to scrape dialogs: {e}")

        return result

    async def disconnect(self):
        if self.client:
            await self.client.disconnect()
            logger.info("Telegram scraper disconnected")


# Singleton
telegram_scraper = TelegramScraper()
