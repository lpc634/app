from flask import current_app
from src.models.user import User
from src.integrations.telegram_client import send_message


def notify_agent(agent_id: int, title: str, body: str, notification_type: str = "general"):
    """
    Send notification to an agent via Telegram (if connected) and in-app notification
    
    Args:
        agent_id: ID of the agent to notify
        title: Notification title
        body: Notification message body
        notification_type: Type of notification (job_assignment, invoice_generated, etc.)
    
    Returns:
        dict: Status of notification delivery
    """
    try:
        # Get the agent
        agent = User.query.get(agent_id)
        if not agent:
            current_app.logger.warning(f"Agent {agent_id} not found for notification")
            return {"status": "error", "message": "Agent not found"}
        
        results = {"in_app": False, "telegram": False}
        
        # Send in-app notification (create Notification record)
        try:
            from src.models.user import Notification, db
            
            notification = Notification(
                user_id=agent_id,
                title=title,
                message=body,
                type=notification_type
            )
            db.session.add(notification)
            db.session.commit()
            results["in_app"] = True
            
            current_app.logger.info(f"In-app notification sent to agent {agent_id}: {title}")
            
        except Exception as e:
            current_app.logger.error(f"Failed to create in-app notification for agent {agent_id}: {str(e)}")
            db.session.rollback()
        
        # Send Telegram notification if agent is connected and opted in
        if current_app.config.get('TELEGRAM_ENABLED', False):
            if agent.telegram_chat_id and agent.telegram_opt_in:
                try:
                    # Format message for Telegram
                    telegram_message = f"<b>{title}</b>\n\n{body}"
                    
                    result = send_message(agent.telegram_chat_id, telegram_message)
                    
                    if result.get('status') != 'error':
                        results["telegram"] = True
                        current_app.logger.info(f"Telegram notification sent to agent {agent_id}: {title}")
                    else:
                        current_app.logger.error(f"Telegram notification failed for agent {agent_id}: {result.get('message')}")
                        
                except Exception as e:
                    current_app.logger.error(f"Exception sending Telegram notification to agent {agent_id}: {str(e)}")
            else:
                current_app.logger.debug(f"Agent {agent_id} not connected to Telegram or opted out")
        
        return {
            "status": "success",
            "results": results,
            "agent_name": f"{agent.first_name} {agent.last_name}"
        }
        
    except Exception as e:
        current_app.logger.error(f"Error in notify_agent for agent {agent_id}: {str(e)}")
        return {"status": "error", "message": str(e)}


def notify_job_assignment(agent_id: int, job_title: str, job_address: str, arrival_time: str):
    """
    Notify agent about a new job assignment
    
    Args:
        agent_id: ID of the agent
        job_title: Title of the job
        job_address: Job location
        arrival_time: When the job starts
    """
    title = "New Job Assignment"
    body = f"You have been assigned to: {job_title}\n📍 {job_address}\n🕒 {arrival_time}"
    
    return notify_agent(agent_id, title, body, "job_assignment")


def notify_invoice_generated(agent_id: int, invoice_number: str, amount: float):
    """
    Notify agent that their invoice has been generated
    
    Args:
        agent_id: ID of the agent
        invoice_number: Generated invoice number
        amount: Invoice total amount
    """
    title = f"Invoice {invoice_number} Generated"
    body = f"Your invoice {invoice_number} for £{amount:.2f} has been generated and is ready for download."
    
    return notify_agent(agent_id, title, body, "invoice_generated")


def notify_job_update(agent_id: int, job_title: str, update_message: str):
    """
    Notify agent about job updates
    
    Args:
        agent_id: ID of the agent
        job_title: Title of the job
        update_message: Update details
    """
    title = f"Job Update: {job_title}"
    body = update_message
    
    return notify_agent(agent_id, title, body, "job_update")


def send_test_notification(agent_id: int):
    """
    Send a test notification to verify the system is working
    
    Args:
        agent_id: ID of the agent to send test to
    
    Returns:
        dict: Result of the test
    """
    try:
        agent = User.query.get(agent_id)
        if not agent:
            return {"status": "error", "message": "Agent not found"}
        
        title = "Test Notification"
        body = f"Hello {agent.first_name}! This is a test notification to verify your notification settings are working correctly. ✅"
        
        return notify_agent(agent_id, title, body, "test")
        
    except Exception as e:
        current_app.logger.error(f"Error sending test notification to agent {agent_id}: {str(e)}")
        return {"status": "error", "message": str(e)}


def bulk_notify_agents(agent_ids: list, title: str, body: str, notification_type: str = "general"):
    """
    Send notification to multiple agents
    
    Args:
        agent_ids: List of agent IDs
        title: Notification title
        body: Notification message body
        notification_type: Type of notification
    
    Returns:
        dict: Summary of delivery results
    """
    results = {"success": [], "failed": []}
    
    for agent_id in agent_ids:
        try:
            result = notify_agent(agent_id, title, body, notification_type)
            if result["status"] == "success":
                results["success"].append({
                    "agent_id": agent_id,
                    "agent_name": result.get("agent_name"),
                    "delivery": result.get("results")
                })
            else:
                results["failed"].append({
                    "agent_id": agent_id,
                    "error": result.get("message")
                })
        except Exception as e:
            results["failed"].append({
                "agent_id": agent_id,
                "error": str(e)
            })
    
    current_app.logger.info(f"Bulk notification sent: {len(results['success'])} success, {len(results['failed'])} failed")
    
    return {
        "status": "completed",
        "total": len(agent_ids),
        "success_count": len(results["success"]),
        "failed_count": len(results["failed"]),
        "results": results
    }
