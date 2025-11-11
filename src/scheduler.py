from flask_apscheduler import APScheduler
from datetime import datetime, date, timedelta
from src.models.user import db, User, AgentAvailability, AgentWeeklyAvailability, Notification
from src.models.crm_task import CRMTask
from src.models.crm_user import CRMUser
from src.models.crm_contact import CRMContact
import requests
import os

# Initialize scheduler
scheduler = APScheduler()

def set_daily_availability():
    """
    A scheduled job to run daily.
    Sets agent's availability for the day based on their weekly preferences.
    """
    with scheduler.app.app_context():
        print(f"SCHEDULER: Running daily availability check at {datetime.now()}...")
        today = date.today()
        day_name = today.strftime("%A").lower()  # e.g., 'monday'

        # Find all agents who have a weekly preference set for today
        preferences_for_today = AgentWeeklyAvailability.query.filter(getattr(AgentWeeklyAvailability, day_name) == True).all()
        
        agent_ids_to_set_available = {pref.agent_id for pref in preferences_for_today}

        # Get all agents to also set unavailable agents correctly
        all_agents = User.query.filter_by(role='agent').all()

        for agent in all_agents:
            # Check if an availability record for today already exists
            todays_availability = AgentAvailability.query.filter_by(agent_id=agent.id, date=today).first()
            
            # Decide if the agent should be available
            should_be_available = agent.id in agent_ids_to_set_available
            
            if todays_availability:
                # If a record exists, update it based on the preference
                todays_availability.is_available = should_be_available
                todays_availability.notes = "Availability set by weekly schedule."
            else:
                # If no record exists, create one
                new_availability = AgentAvailability(
                    agent_id=agent.id,
                    date=today,
                    is_available=should_be_available,
                    notes="Availability set by weekly schedule."
                )
                db.session.add(new_availability)
        
        db.session.commit()
        print(f"SCHEDULER: Daily availability check completed.")


def send_weekly_reminders():
    """
    A scheduled job to run every Sunday at 6 PM.
    Sends a notification to all agents to set their availability.
    """
    with scheduler.app.app_context():
        print(f"SCHEDULER: Sending weekly availability reminders at {datetime.now()}...")
        agents = User.query.filter_by(role='agent').all()

        for agent in agents:
            notification = Notification(
                user_id=agent.id,
                title="Weekly Availability Reminder",
                message="Please set your availability for the upcoming week in your dashboard.",
                type='reminder'
            )
            db.session.add(notification)

        db.session.commit()
        print(f"SCHEDULER: Sent reminders to {len(agents)} agents.")


def check_crm_task_reminders():
    """
    A scheduled job that runs every 10 minutes to check for upcoming CRM tasks.
    Sends Telegram notifications to users who have opted in.
    """
    with scheduler.app.app_context():
        print(f"SCHEDULER: Checking CRM task reminders at {datetime.now()}...")

        # Get the Telegram bot token
        bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
        if not bot_token:
            print("SCHEDULER: No Telegram bot token configured, skipping notifications")
            return

        # Get current time and time window (next 15 minutes)
        now = datetime.now()
        time_window_start = now
        time_window_end = now + timedelta(minutes=15)

        # Find all pending tasks due within the next 15 minutes
        upcoming_tasks = CRMTask.query.filter(
            CRMTask.status == 'pending',
            CRMTask.due_date >= time_window_start,
            CRMTask.due_date <= time_window_end
        ).all()

        print(f"SCHEDULER: Found {len(upcoming_tasks)} upcoming tasks")

        notifications_sent = 0
        for task in upcoming_tasks:
            # Get the CRM user who owns this task
            crm_user = CRMUser.query.get(task.crm_user_id)

            if not crm_user:
                continue

            # Check if user has Telegram enabled and has a chat ID
            if not crm_user.telegram_opt_in or not crm_user.telegram_chat_id:
                print(f"SCHEDULER: User {crm_user.name} hasn't opted in to Telegram or no chat ID")
                continue

            # Get contact info if task is linked to a contact
            contact_info = ""
            if task.contact_id:
                contact = CRMContact.query.get(task.contact_id)
                if contact:
                    contact_info = f"\n📋 Contact: {contact.name}"

            # Format the due time
            due_time = task.due_date.strftime("%H:%M")

            # Create notification message
            message = f"🔔 Task Reminder\n\n"
            message += f"📝 {task.title}\n"
            message += f"⏰ Due: {due_time}"
            message += contact_info
            if task.notes:
                message += f"\n\n📄 Notes: {task.notes}"

            # Send Telegram notification
            try:
                telegram_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                response = requests.post(telegram_url, json={
                    'chat_id': crm_user.telegram_chat_id,
                    'text': message,
                    'parse_mode': 'HTML'
                })

                if response.status_code == 200:
                    notifications_sent += 1
                    print(f"SCHEDULER: Sent notification to {crm_user.name} for task: {task.title}")
                else:
                    print(f"SCHEDULER: Failed to send notification to {crm_user.name}: {response.text}")
            except Exception as e:
                print(f"SCHEDULER: Error sending Telegram notification: {str(e)}")

        print(f"SCHEDULER: Sent {notifications_sent} Telegram notifications")

def init_scheduler(app):
    """Initializes and starts the scheduler, adding the jobs."""
    scheduler.init_app(app)
    
    # Add the scheduled jobs if they don't already exist
    if not scheduler.get_job('daily_availability_setter'):
        scheduler.add_job(
            id='daily_availability_setter', 
            func=set_daily_availability, 
            trigger='cron', 
            hour=0, 
            minute=5 # Runs every day at 12:05 AM
        )
    
    if not scheduler.get_job('weekly_reminder_sender'):
        scheduler.add_job(
            id='weekly_reminder_sender',
            func=send_weekly_reminders,
            trigger='cron',
            day_of_week='sun',
            hour=18, # Runs every Sunday at 6:00 PM
            minute=0
        )

    if not scheduler.get_job('crm_task_reminder_checker'):
        scheduler.add_job(
            id='crm_task_reminder_checker',
            func=check_crm_task_reminders,
            trigger='interval',
            minutes=10 # Runs every 10 minutes to check for upcoming tasks
        )

    scheduler.start()

def get_scheduler_status():
    """Returns the status and list of scheduled jobs."""
    if not scheduler.running:
        return {'status': 'Scheduler not running'}
    
    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            'id': job.id,
            'name': job.name,
            'trigger': str(job.trigger),
            'next_run_time': str(job.next_run_time)
        })
    return {'status': 'running', 'jobs': jobs}