"""
Telegram notification service for sending job notifications to agents
"""
import logging
from flask import current_app
from src.integrations.telegram_client import send_message
from urllib.parse import quote_plus
from datetime import datetime


def is_enabled():
    """Check if Telegram notifications are enabled"""
    return current_app.config.get("TELEGRAM_ENABLED", False)


def _area_label(job) -> str:
    for cand in [getattr(job, "town", None), getattr(job, "city", None)]:
        if cand:
            return str(cand)
    pc = getattr(job, "postcode", None)
    if pc:
        return str(pc).split(" ")[0]
    for cand in [getattr(job, "county", None), getattr(job, "region", None)]:
        if cand:
            return str(cand)
    return "Location revealed after acceptance"

def _format_dt(dt: datetime) -> str:
    try:
        return dt.strftime('%a %d %b %H:%M')
    except Exception:
        return str(dt)

def _build_maps(job) -> str:
    addr = getattr(job, 'address', None) or getattr(job, 'full_address', None)
    if addr:
        return f"https://maps.google.com/?q={quote_plus(addr)}"
    lat = getattr(job, 'location_lat', None) or getattr(job, 'lat', None)
    lng = getattr(job, 'location_lng', None) or getattr(job, 'lng', None)
    if lat and lng:
        return f"https://maps.google.com/?q={lat},{lng}"
    return "Maps link unavailable"

def send_job_assignment_notification(agent, job):
    """
    Send job assignment notification to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id
        job: Job object with job details
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping job assignment notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        logging.info(f"Agent {agent.id} has no Telegram chat_id or opted out, skipping notification")
        return False
    
    try:
        # Pre-accept: no exact location, no maps, no priority
        message = (
            "🆕 <b>New Job Assignment</b>\n\n"
            f"<b>Job:</b> {job.title or job.job_type}\n"
            f"<b>Date/Time:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
            f"<b>Area:</b> {_area_label(job)}\n\n"
            "Please open the V3 Services app → Jobs → Pending to accept or decline."
        )
        
        result = send_message(agent.telegram_chat_id, message)
        
        if result.get("ok"):
            logging.info(f"Job assignment notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send job assignment notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending job assignment notification to agent {agent.id}: {str(e)}")
        return False


def send_job_acceptance_notification(agent, job):
    """
    Send job acceptance confirmation to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id  
        job: Job object with job details
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping job acceptance notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        return False
    
    try:
        # Post-accept: include full address, maps. Weather optional - integrate when service available.
        maps_link = _build_maps(job)
        message = (
            "✅ <b>Job Accepted</b>\n\n"
            "<b>Job Details:</b>\n"
            f"• <b>Type:</b> {job.title or job.job_type}\n"
            f"• <b>Date/Time:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
            f"• <b>Location:</b> {getattr(job,'address',None) or getattr(job,'full_address','Address unavailable')}\n"
            f"• <b>Maps:</b> {maps_link}\n\n"
            "Please check the app for full instructions."
        )
        
        result = send_message(agent.telegram_chat_id, message)
        
        if result.get("ok"):
            logging.info(f"Job acceptance notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send job acceptance notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending job acceptance notification to agent {agent.id}: {str(e)}")
        return False


def send_invoice_notification(agent, invoice):
    """
    Send invoice ready notification to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id
        invoice: Invoice object with invoice details
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping invoice notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        return False
    
    try:
        message = f"""
📄 <b>Invoice Ready</b>

<b>Invoice #:</b> {invoice.invoice_number}
<b>Amount:</b> £{float(invoice.total_amount):.2f}
<b>Due Date:</b> {invoice.due_date.strftime('%d/%m/%Y')}

Your invoice is ready for download in the V3 Services app.
        """.strip()
        
        result = send_message(agent.telegram_chat_id, message)
        
        if result.get("ok"):
            logging.info(f"Invoice notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send invoice notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending invoice notification to agent {agent.id}: {str(e)}")
        return False


def send_generic_notification(agent, title, message):
    """
    Send generic notification to agent via Telegram
    
    Args:
        agent: User object with telegram_chat_id
        title: Notification title
        message: Notification message
    
    Returns:
        bool: True if sent successfully, False otherwise
    """
    if not is_enabled():
        logging.info("Telegram notifications disabled, skipping generic notification")
        return False
    
    if not agent.telegram_chat_id or not agent.telegram_opt_in:
        return False
    
    try:
        formatted_message = f"""
📢 <b>{title}</b>

{message}
        """.strip()
        
        result = send_message(agent.telegram_chat_id, formatted_message)
        
        if result.get("ok"):
            logging.info(f"Generic notification sent to agent {agent.id} via Telegram")
            return True
        else:
            logging.warning(f"Failed to send generic notification to agent {agent.id}: {result}")
            return False
            
    except Exception as e:
        logging.error(f"Error sending generic notification to agent {agent.id}: {str(e)}")
        return False