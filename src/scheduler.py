from flask_apscheduler import APScheduler
from datetime import datetime, date
from src.models.user import db, User, AgentAvailability, AgentWeeklyAvailability, Notification

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