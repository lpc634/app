import requests
import logging
import os
import time
from flask import current_app

API_BASE = "https://api.telegram.org"

# Cache for bot info (username) - expires after 10 minutes
_bot_info_cache = {"data": None, "expires": 0}

def send_message(chat_id: str, text: str, parse_mode: str | None = None, message_thread_id: int | None = None, timeout: int = 4) -> dict:
    """
    Send a message to a Telegram chat
    
    Args:
        chat_id: Telegram chat ID
        text: Message text
        parse_mode: Optional formatting mode (HTML, Markdown, etc.)
    
    Returns:
        dict: { ok: bool, result?: {...}, description?: str }
    """
    if not current_app.config["TELEGRAM_ENABLED"]:
        return {"ok": False, "description": "telegram_disabled"}
    
    token = current_app.config["TELEGRAM_BOT_TOKEN"]
    if not token:
        current_app.logger.error("TELEGRAM_BOT_TOKEN missing")
        return {"ok": False, "description": "bot_token_not_configured"}
    
    url = f"{API_BASE}/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "disable_web_page_preview": True
    }
    if parse_mode:
        payload["parse_mode"] = parse_mode
    if message_thread_id is not None:
        payload["message_thread_id"] = message_thread_id
    
    try:
        r = requests.post(url, json=payload, timeout=timeout)
        if r.ok:
            data = r.json()
            # Normalize to { ok, result }
            return {"ok": True, "result": data.get("result")}
        else:
            # Try to extract Telegram error description
            try:
                data = r.json()
                desc = data.get("description") or r.reason
            except Exception:
                desc = r.reason
            return {"ok": False, "description": f"{r.status_code}: {desc}"}
    except requests.RequestException as e:
        current_app.logger.error(f"Telegram send message error: {str(e)}")
        return {"ok": False, "description": str(e)}

def get_bot_info() -> dict:
    """
    Get bot information from Telegram API with 10-minute caching
    
    Returns:
        dict: Bot info or error info
    """
    if not current_app.config["TELEGRAM_ENABLED"]:
        return {"status": "disabled"}
    
    token = current_app.config["TELEGRAM_BOT_TOKEN"]
    if not token:
        return {"status": "error", "message": "Bot token not configured"}
    
    # Check cache first
    now = time.time()
    if _bot_info_cache["data"] and now < _bot_info_cache["expires"]:
        return _bot_info_cache["data"]
    
    url = f"{API_BASE}/bot{token}/getMe"
    
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        result = r.json()
        
        # Cache result for 10 minutes (600 seconds)
        _bot_info_cache["data"] = result
        _bot_info_cache["expires"] = now + 600
        
        return result
    except requests.RequestException as e:
        current_app.logger.error(f"Telegram get bot info error: {str(e)}")
        return {"status": "error", "message": str(e)}

def set_webhook(webhook_url: str,
                allowed_updates: list[str] | None = None,
                drop_pending_updates: bool = False) -> dict:
    """
    Set webhook URL for the bot
    
    Args:
        webhook_url: Full webhook URL
    
    Returns:
        dict: API response
    """
    if not current_app.config["TELEGRAM_ENABLED"]:
        return {"status": "disabled"}
    
    token = current_app.config["TELEGRAM_BOT_TOKEN"]
    if not token:
        return {"status": "error", "message": "Bot token not configured"}
    
    url = f"{API_BASE}/bot{token}/setWebhook"
    payload = {"url": webhook_url}
    if allowed_updates is not None:
        payload["allowed_updates"] = allowed_updates
    payload["drop_pending_updates"] = bool(drop_pending_updates)
    
    try:
        r = requests.post(url, json=payload, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        current_app.logger.error(f"Telegram set webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}

def get_webhook_info() -> dict:
    """
    Get current webhook information
    
    Returns:
        dict: Webhook info or error info
    """
    if not current_app.config["TELEGRAM_ENABLED"]:
        return {"status": "disabled"}
    
    token = current_app.config["TELEGRAM_BOT_TOKEN"]
    if not token:
        return {"status": "error", "message": "Bot token not configured"}
    
    url = f"{API_BASE}/bot{token}/getWebhookInfo"
    
    try:
        r = requests.get(url, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        current_app.logger.error(f"Telegram get webhook info error: {str(e)}")
        return {"status": "error", "message": str(e)}

def send_telegram_notification(text: str, parse_mode: str | None = None) -> dict:
    """
    Send a notification to the admin Telegram group

    Args:
        text: Message text
        parse_mode: Optional formatting mode (HTML, Markdown, etc.)

    Returns:
        dict: { ok: bool, result?: {...}, description?: str }
    """
    if not current_app.config["TELEGRAM_ENABLED"]:
        return {"ok": False, "description": "telegram_disabled"}

    chat_id = current_app.config.get("TELEGRAM_ADMIN_CHAT_ID")
    thread_id = current_app.config.get("TELEGRAM_ADMIN_THREAD_ID")

    if not chat_id:
        current_app.logger.warning("TELEGRAM_ADMIN_CHAT_ID not configured - cannot send notification")
        return {"ok": False, "description": "admin_chat_not_configured"}

    # Convert thread_id to int if it exists and is not empty
    message_thread_id = None
    if thread_id:
        try:
            message_thread_id = int(thread_id)
        except (ValueError, TypeError):
            current_app.logger.warning(f"Invalid TELEGRAM_ADMIN_THREAD_ID: {thread_id}")

    return send_message(chat_id, text, parse_mode=parse_mode, message_thread_id=message_thread_id)


def ensure_webhook() -> dict:
    """Optionally set the Telegram webhook on startup based on app config.

    Reads TELEGRAM_SET_WEBHOOK_ON_START, PUBLIC_BASE_URL, and TELEGRAM_WEBHOOK_SECRET
    from current_app.config.
    """
    try:
        if not current_app.config.get("TELEGRAM_ENABLED", False):
            return {"status": "skipped", "reason": "disabled"}
        if not str(current_app.config.get("TELEGRAM_SET_WEBHOOK_ON_START", "false")).lower() in ("1", "true", "yes"):
            return {"status": "skipped", "reason": "flag off"}

        public_base_url = current_app.config.get("PUBLIC_BASE_URL") or current_app.config.get("LIVE_APP_URL")
        secret = current_app.config.get("TELEGRAM_WEBHOOK_SECRET")
        if not public_base_url or not secret:
            return {"status": "skipped", "reason": "missing base url or secret"}

        # Prefer the /api/telegram/webhook/<secret> path
        webhook_url = f"{public_base_url}/api/telegram/webhook/{secret}"
        resp = set_webhook(
            webhook_url,
            allowed_updates=["message", "callback_query"],
            drop_pending_updates=False,
        )
        current_app.logger.info(f"Telegram setWebhook attempted: {resp}")
        return resp
    except Exception as e:
        current_app.logger.error(f"ensure_webhook error: {str(e)}")
        return {"status": "error", "message": str(e)}
