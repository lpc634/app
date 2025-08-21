"""
Telegram notification service for sending job notifications to agents
"""
import logging
from flask import current_app
from src.integrations.telegram_client import send_message


def is_enabled():
    """Check if Telegram notifications are enabled"""
    return current_app.config.get("TELEGRAM_ENABLED", False)


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
        message = f"""
🚨 <b>New Job Assignment</b>

<b>Job:</b> {job.title or job.job_type}
<b>Location:</b> {job.address}
<b>Time:</b> {job.arrival_time.strftime('%d/%m/%Y %H:%M')}
<b>Type:</b> {job.job_type}

Please check the V3 Services app to accept or decline this assignment.
        """.strip()
        
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
        message = f"""
✅ <b>Job Accepted</b>

<b>Job:</b> {job.title or job.job_type}
<b>Location:</b> {job.address}
<b>Time:</b> {job.arrival_time.strftime('%d/%m/%Y %H:%M')}

You have successfully accepted this job assignment.
        """.strip()
        
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