from flask import Blueprint, request, current_app, jsonify
from src.models.user import User, db
from src.integrations.telegram_client import send_message
import logging

telegram_bp = Blueprint("telegram", __name__, url_prefix="/webhooks/telegram")

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
