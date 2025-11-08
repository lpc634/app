"""
CRM Task Notification Service
Checks for due tasks and sends Telegram notifications
"""
import logging
from datetime import datetime, timedelta
from src.extensions import db
from src.models.crm_task import CRMTask
from src.models.crm_user import CRMUser
from src.models.crm_contact import CRMContact
from src.services.telegram_notifications import send_crm_task_notification
from flask import current_app

logger = logging.getLogger(__name__)


def check_and_notify_due_tasks():
    """
    Check for tasks that are due soon and send Telegram notifications.
    This function should be called periodically (e.g., every 15 minutes).

    Returns:
        dict: Statistics about notifications sent
    """
    try:
        # Get current time and time window for "due soon" tasks
        now = datetime.utcnow()
        notification_window = now + timedelta(minutes=30)  # Notify 30 minutes before due

        # Find tasks that:
        # 1. Are pending
        # 2. Are due within the next 30 minutes
        # 3. Haven't been notified yet (we'll track this via a flag we'll add later)
        due_tasks = CRMTask.query.filter(
            CRMTask.status == 'pending',
            CRMTask.due_date <= notification_window,
            CRMTask.due_date >= now
        ).all()

        notifications_sent = 0
        notifications_failed = 0

        for task in due_tasks:
            try:
                # Get CRM user and contact
                crm_user = CRMUser.query.get(task.crm_user_id)
                contact = CRMContact.query.get(task.contact_id)

                if not crm_user or not contact:
                    logger.warning(f"Task {task.id}: Missing user or contact")
                    continue

                # Send notification
                success = send_crm_task_notification(crm_user, task, contact)

                if success:
                    notifications_sent += 1
                    logger.info(f"Sent notification for task {task.id} to user {crm_user.id}")
                else:
                    notifications_failed += 1
                    logger.warning(f"Failed to send notification for task {task.id}")

            except Exception as e:
                notifications_failed += 1
                logger.error(f"Error processing task {task.id}: {str(e)}")

        logger.info(f"Task notification check complete: {notifications_sent} sent, {notifications_failed} failed")

        return {
            'success': True,
            'notifications_sent': notifications_sent,
            'notifications_failed': notifications_failed,
            'tasks_checked': len(due_tasks)
        }

    except Exception as e:
        logger.error(f"Error in check_and_notify_due_tasks: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }


def check_overdue_tasks():
    """
    Check for overdue tasks and send daily reminder notifications.
    This function should be called once per day.

    Returns:
        dict: Statistics about notifications sent
    """
    try:
        now = datetime.utcnow()

        # Find overdue pending tasks
        overdue_tasks = CRMTask.query.filter(
            CRMTask.status == 'pending',
            CRMTask.due_date < now
        ).all()

        # Group tasks by user
        tasks_by_user = {}
        for task in overdue_tasks:
            if task.crm_user_id not in tasks_by_user:
                tasks_by_user[task.crm_user_id] = []
            tasks_by_user[task.crm_user_id].append(task)

        notifications_sent = 0

        # Send summary notification to each user
        for user_id, user_tasks in tasks_by_user.items():
            try:
                crm_user = CRMUser.query.get(user_id)
                if not crm_user or not crm_user.telegram_chat_id or not crm_user.telegram_opt_in:
                    continue

                # Create summary message
                from src.integrations.telegram_client import send_message

                message = f"⚠️ <b>Overdue Tasks Reminder</b>\n\n"
                message += f"You have <b>{len(user_tasks)}</b> overdue task(s):\n\n"

                for task in user_tasks[:5]:  # Show first 5 tasks
                    contact = CRMContact.query.get(task.contact_id)
                    contact_name = contact.name if contact else "Unknown"
                    message += f"• {task.title} - {contact_name}\n"

                if len(user_tasks) > 5:
                    message += f"\n...and {len(user_tasks) - 5} more\n"

                message += "\nPlease check the CRM system to review and complete these tasks."

                result = send_message(crm_user.telegram_chat_id, message)

                if result.get("ok"):
                    notifications_sent += 1
                    logger.info(f"Sent overdue tasks summary to user {user_id}")

            except Exception as e:
                logger.error(f"Error sending overdue summary to user {user_id}: {str(e)}")

        logger.info(f"Overdue task check complete: {notifications_sent} summaries sent")

        return {
            'success': True,
            'notifications_sent': notifications_sent,
            'overdue_tasks': len(overdue_tasks),
            'users_notified': len(tasks_by_user)
        }

    except Exception as e:
        logger.error(f"Error in check_overdue_tasks: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
