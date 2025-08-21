from flask import Blueprint, request, current_app, jsonify
from flask_jwt_extended import jwt_required, get_current_user
from src.models.user import User, db
from src.integrations.telegram_client import send_message, get_bot_info
import logging
import string
import random

telegram_bp = Blueprint("telegram", __name__, url_prefix="/webhooks/telegram")
telegram_api_bp = Blueprint("telegram_api", __name__, url_prefix="/api/telegram")
agent_telegram_bp = Blueprint("agent_telegram", __name__, url_prefix="/api/agent/telegram")

@telegram_bp.route("/<secret>", methods=["POST"])
def webhook(secret):
    """
    Handle Telegram webhook updates
    
    Args:
        secret: URL path secret for basic webhook validation
    
    Returns:
        JSON response
    """
    # Validate webhook secret
    if secret != current_app.config["TELEGRAM_WEBHOOK_SECRET"]:
        current_app.logger.warning(f"Invalid webhook secret attempt: {secret}")
        return jsonify({"error": "forbidden"}), 403
    
    # Parse update data
    update = request.get_json(silent=True) or {}
    message = update.get("message") or {}
    chat = message.get("chat") or {}
    text = (message.get("text") or "").strip()
    
    chat_id = str(chat.get("id", "")) if chat.get("id") else None
    username = chat.get("username")
    
    if not chat_id:
        current_app.logger.warning("Webhook received without chat_id")
        return jsonify({"ok": True})
    
    current_app.logger.info(f"Telegram webhook: chat_id={chat_id}, username={username}, text='{text}'")
    
    # Handle /start command with linking token
    if text.startswith("/start"):
        parts = text.split()
        token = parts[1] if len(parts) > 1 else None
        
        if token:
            # Find agent by link token
            agent = User.query.filter_by(telegram_link_code=token).first()
            
            if agent:
                # Link the agent's Telegram account
                agent.telegram_chat_id = chat_id
                agent.telegram_username = username
                agent.telegram_link_code = None  # Clear the token
                agent.telegram_opt_in = True
                
                try:
                    db.session.commit()
                    current_app.logger.info(f"Telegram linked for agent {agent.id}: {username}")
                    
                    # Send confirmation message
                    welcome_msg = "✅ Telegram successfully linked! You will now receive job notifications here."
                    send_message(chat_id, welcome_msg)
                    
                except Exception as e:
                    db.session.rollback()
                    current_app.logger.error(f"Database error linking Telegram for agent {agent.id}: {str(e)}")
                    send_message(chat_id, "❌ Sorry, there was an error linking your account. Please try again.")
            else:
                current_app.logger.warning(f"Invalid or expired link token: {token}")
                send_message(chat_id, "⚠️ Link token is invalid or expired. Please get a new link from the app.")
        else:
            # /start without token - check if already linked
            existing_agent = User.query.filter_by(telegram_chat_id=chat_id).first()
            if existing_agent:
                send_message(chat_id, "✅ Your Telegram is already linked to your V3 Services account.")
            else:
                send_message(chat_id, "👋 Welcome! To link your Telegram account, please use the link button in the V3 Services app.")
    
    # Handle /link command
    elif text.startswith("/link"):
        parts = text.split()
        token = parts[1] if len(parts) > 1 else None
        
        if token:
            # Find agent by link token
            agent = User.query.filter_by(telegram_link_code=token).first()
            
            if agent:
                # Link the agent's Telegram account
                agent.telegram_chat_id = chat_id
                agent.telegram_username = username
                agent.telegram_link_code = None  # Clear the token
                agent.telegram_opt_in = True
                
                try:
                    db.session.commit()
                    current_app.logger.info(f"Telegram linked via /link for agent {agent.id}: {username}")
                    
                    # Send confirmation message
                    welcome_msg = "✅ Linked! You will now receive job notifications here."
                    send_message(chat_id, welcome_msg)
                    
                except Exception as e:
                    db.session.rollback()
                    current_app.logger.error(f"Database error linking Telegram via /link for agent {agent.id}: {str(e)}")
                    send_message(chat_id, "❌ Sorry, there was an error linking your account. Please try again.")
            else:
                current_app.logger.warning(f"Invalid or expired link token via /link: {token}")
                send_message(chat_id, "⚠️ Link code is invalid or expired. Please get a new code from the app.")
        else:
            send_message(chat_id, "⚠️ Please provide a link code: /link YOUR_CODE")
    
    # Handle other messages
    elif text:
        # Check if user is linked
        existing_agent = User.query.filter_by(telegram_chat_id=chat_id).first()
        if existing_agent:
            send_message(chat_id, "📱 Your Telegram is linked to V3 Services. Job notifications will appear here automatically.")
        else:
            send_message(chat_id, "🔗 To receive job notifications, please link your Telegram account through the V3 Services app.")
    
    return jsonify({"ok": True})

@telegram_bp.route("/info", methods=["GET"])
def webhook_info():
    """
    Get webhook configuration info for debugging
    
    Returns:
        JSON with webhook status
    """
    if not current_app.config["TELEGRAM_ENABLED"]:
        return jsonify({"status": "disabled"})
    
    try:
        from src.integrations.telegram_client import get_webhook_info, get_bot_info
        
        webhook_info = get_webhook_info()
        bot_info = get_bot_info()
        
        return jsonify({
            "telegram_enabled": current_app.config["TELEGRAM_ENABLED"],
            "webhook_configured": bool(current_app.config["TELEGRAM_WEBHOOK_SECRET"]),
            "bot_token_configured": bool(current_app.config["TELEGRAM_BOT_TOKEN"]),
            "webhook_info": webhook_info,
            "bot_info": bot_info
        })
    
    except Exception as e:
        current_app.logger.error(f"Error getting webhook info: {str(e)}")
        return jsonify({"error": str(e)}), 500


# API endpoints for Telegram integration
@telegram_api_bp.route("/status", methods=["GET"])
@jwt_required()
def get_telegram_status():
    """
    Get Telegram integration status for current user
    
    Returns:
        JSON with enabled, linked, and bot_username status
    """
    current_user = get_current_user()
    
    enabled = current_app.config.get("TELEGRAM_ENABLED", False)
    linked = bool(current_user.telegram_chat_id) if current_user else False
    
    bot_username = None
    if enabled:
        try:
            bot_info = get_bot_info()
            if bot_info.get("ok") and "result" in bot_info:
                bot_username = bot_info["result"].get("username")
        except Exception as e:
            current_app.logger.warning(f"Could not get bot username: {str(e)}")
    
    return jsonify({
        "enabled": enabled,
        "linked": linked,
        "bot_username": bot_username
    })


@telegram_api_bp.route("/link/start", methods=["POST"])
@jwt_required()
def start_telegram_link():
    """
    Generate a one-time code for Telegram linking
    
    Returns:
        JSON with code and instructions
    """
    current_user = get_current_user()
    
    if not current_app.config.get("TELEGRAM_ENABLED", False):
        return jsonify({"error": "Telegram integration is disabled"}), 400
    
    # Generate random 6-8 character code
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    
    # Store code and reset opt-in
    current_user.telegram_link_code = code
    current_user.telegram_opt_in = False
    
    try:
        db.session.commit()
        current_app.logger.info(f"Generated Telegram link code for user {current_user.id}")
        
        # Get bot username from API
        bot_username = "V3JobsBot"  # default fallback
        try:
            bot_info = get_bot_info()
            if bot_info.get("ok") and "result" in bot_info:
                bot_username = bot_info["result"].get("username", "V3JobsBot")
        except Exception as e:
            current_app.logger.warning(f"Could not get bot username for link: {str(e)}")
        
        return jsonify({
            "code": code,
            "bot_username": bot_username
        })
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error generating Telegram link code for user {current_user.id}: {str(e)}")
        return jsonify({"error": "Failed to generate link code"}), 500


@telegram_api_bp.route("/disconnect", methods=["POST"])
@jwt_required()
def disconnect_telegram():
    """
    Disconnect Telegram account from current user
    
    Returns:
        JSON success message
    """
    current_user = get_current_user()
    
    # Clear Telegram data
    current_user.telegram_chat_id = None
    current_user.telegram_username = None
    current_user.telegram_opt_in = False
    current_user.telegram_link_code = None
    
    try:
        db.session.commit()
        current_app.logger.info(f"Disconnected Telegram for user {current_user.id}")
        
        return jsonify({"message": "Telegram account disconnected successfully"})
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error disconnecting Telegram for user {current_user.id}: {str(e)}")
        return jsonify({"error": "Failed to disconnect Telegram account"}), 500


@telegram_api_bp.route("/health", methods=["GET"])
def get_telegram_health():
    """
    Get Telegram integration health status (no secrets exposed)
    
    Returns:
        JSON with health information for debugging
    """
    enabled = current_app.config.get("TELEGRAM_ENABLED", False)
    webhook_secret = current_app.config.get("TELEGRAM_WEBHOOK_SECRET", "")
    public_base_url = current_app.config.get("PUBLIC_BASE_URL", "")
    
    webhook_url = None
    bot_username = None
    
    if enabled and webhook_secret and public_base_url:
        webhook_url = f"{public_base_url}/webhooks/telegram/{webhook_secret}"
    
    if enabled:
        try:
            bot_info = get_bot_info()
            if bot_info.get("ok") and "result" in bot_info:
                bot_username = bot_info["result"].get("username")
        except Exception as e:
            current_app.logger.warning(f"Could not get bot username for health check: {str(e)}")
    
    return jsonify({
        "enabled": enabled,
        "webhook_url": webhook_url,
        "bot_username": bot_username
    })


# Agent-scoped Telegram endpoints (duplicated under /api/agent/telegram for backwards compatibility)
@agent_telegram_bp.route("/status", methods=["GET"])
@jwt_required()
def get_agent_telegram_status():
    """Get Telegram integration status for current user (agent-scoped endpoint)"""
    return get_telegram_status()

@agent_telegram_bp.route("/link/start", methods=["POST"])
@jwt_required()
def start_agent_telegram_link():
    """Generate a one-time code for Telegram linking (agent-scoped endpoint)"""
    return start_telegram_link()

@agent_telegram_bp.route("/disconnect", methods=["POST"])
@jwt_required()
def disconnect_agent_telegram():
    """Disconnect Telegram account from current user (agent-scoped endpoint)"""
    return disconnect_telegram()
