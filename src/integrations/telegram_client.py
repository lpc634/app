import requests
import logging
import os
import time
from flask import current_app

API_BASE = "https://api.telegram.org"

# Cache for bot info (username) - expires after 10 minutes
_bot_info_cache = {"data": None, "expires": 0}

def send_message(chat_id: str, text: str, parse_mode: str = "HTML", message_thread_id: int | None = None) -> dict:
    """
    Send a message to a Telegram chat
    
    Args:
        chat_id: Telegram chat ID
        text: Message text
        parse_mode: Message formatting mode (HTML, Markdown, etc.)
    
    Returns:
        dict: API response or status info
    """
    if not current_app.config["TELEGRAM_ENABLED"]:
        return {"status": "disabled"}
    
    token = current_app.config["TELEGRAM_BOT_TOKEN"]
    if not token:
        current_app.logger.error("TELEGRAM_BOT_TOKEN missing")
        return {"status": "error", "message": "Bot token not configured"}
    
    url = f"{API_BASE}/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": True
    }
    if message_thread_id is not None:
        payload["message_thread_id"] = message_thread_id
    
    try:
        r = requests.post(url, json=payload, timeout=10)
        r.raise_for_status()
        return r.json()
    except requests.RequestException as e:
        current_app.logger.error(f"Telegram send message error: {str(e)}")
        return {"status": "error", "message": str(e)}

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

def set_webhook(webhook_url: str) -> dict:
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
