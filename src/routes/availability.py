from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User, AgentAvailability, AgentWeeklyAvailability, Notification
from datetime import datetime, date, timedelta
from dateutil.parser import parse

availability_bp = Blueprint('availability', __name__)

# --- Helper Functions ---
def get_current_agent():
    """Helper to get the current authenticated agent user."""
    user_id = get_jwt_identity()
    return User.query.filter_by(id=user_id, role='agent').first()

def get_next_monday():
    """Get the date of next Monday (or today if it's Monday)."""
    today = datetime.utcnow().date()
    days_until_monday = (7 - today.weekday()) % 7
    if days_until_monday == 0 and today.weekday() != 0:  # If today is not Monday
        days_until_monday = 7
    return today + timedelta(days=days_until_monday)

def get_current_week_dates():
    """Get all dates for the current week (Monday to Sunday)."""
    today = datetime.utcnow().date()
    monday = today - timedelta(days=today.weekday())
    return [monday + timedelta(days=i) for i in range(7)]

def get_next_week_dates():
    """Get all dates for next week (Monday to Sunday)."""
    next_monday = get_next_monday()
    return [next_monday + timedelta(days=i) for i in range(7)]

# [PASTE THIS NEW FUNCTION INTO YOUR FILE]

def update_daily_availability_from_schedule(agent_id, weekly_schedule_dict):
    """
    Populates the AgentAvailability table for the next 60 days based on the
    recurring weekly schedule.
    """
    try:
        today = date.today()
        # Loop through the next 60 days
        for i in range(61):
            current_date = today + timedelta(days=i)
            day_name = current_date.strftime("%A").lower()
            
            is_scheduled_available = weekly_schedule_dict.get(day_name, False)
            
            # Find if a record for this date already exists
            existing_record = AgentAvailability.query.filter_by(
                agent_id=agent_id, 
                date=current_date
            ).first()
            
            if existing_record:
                # Update only if it was sourced from a schedule, preserving manual overrides
                if existing_record.source in [None, 'schedule', '']:
                    existing_record.is_available = is_scheduled_available
            else:
                # Create a new record if one doesn't exist
                new_availability = AgentAvailability(
                    agent_id=agent_id,
                    date=current_date,
                    is_available=is_scheduled_available,
                    source='schedule'
                )
                db.session.add(new_availability)
        
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error in update_daily_availability_from_schedule for agent {agent_id}: {str(e)}")
        raise

# --- Weekly Schedule Routes ---
@availability_bp.route('/availability/weekly/<int:user_id>', methods=['GET'])
@jwt_required()
def get_weekly_schedule(user_id):
    weekly_schedule = AgentWeeklyAvailability.query.filter_by(agent_id=user_id).first()
    if weekly_schedule:
        return jsonify({
            'monday': weekly_schedule.monday, 
            'tuesday': weekly_schedule.tuesday,
            'wednesday': weekly_schedule.wednesday, 
            'thursday': weekly_schedule.thursday,
            'friday': weekly_schedule.friday, 
            'saturday': weekly_schedule.saturday,
            'sunday': weekly_schedule.sunday,
        }), 200
    else:
        return jsonify({
            'monday': False, 'tuesday': False, 'wednesday': False,
            'thursday': False, 'friday': False, 'saturday': False, 'sunday': False
        }), 200

# [REPLACE YOUR OLD set_weekly_schedule FUNCTION WITH THIS ONE]

@availability_bp.route('/availability/weekly/<int:user_id>', methods=['POST'])
@jwt_required()
def set_weekly_schedule(user_id):
    agent = get_current_agent()
    if not agent or agent.id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    weekly_schedule = AgentWeeklyAvailability.query.filter_by(agent_id=user_id).first()
    
    if not weekly_schedule:
        weekly_schedule = AgentWeeklyAvailability(agent_id=user_id)
        db.session.add(weekly_schedule)
    
    schedule_dict = {}
    for day in ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']:
        if day in data:
            is_available = data.get(day, False)
            setattr(weekly_schedule, day, is_available)
            schedule_dict[day] = is_available
            
    db.session.commit()
    
    # This is the new part that fixes the issue
    try:
        update_daily_availability_from_schedule(user_id, schedule_dict)
        return jsonify({'message': 'Weekly schedule updated and future availability populated.'}), 200
    except Exception as e:
        current_app.logger.error(f"Failed to populate daily records for agent {user_id}: {str(e)}")
        return jsonify({'error': 'Weekly schedule was saved, but failed to populate daily records.'}), 500
    
# --- Daily Override Routes ---
@availability_bp.route('/availability/daily/<int:user_id>', methods=['GET'])
@jwt_required()
def get_daily_overrides(user_id):
    # Only get overrides for current and next week
    today = datetime.utcnow().date()
    two_weeks_from_now = today + timedelta(days=14)
    
    overrides = AgentAvailability.query.filter(
        AgentAvailability.agent_id == user_id,
        AgentAvailability.date >= today,
        AgentAvailability.date <= two_weeks_from_now
    ).all()
    
    return jsonify([{
        'date': o.date.isoformat(), 
        'is_available': o.is_available
    } for o in overrides]), 200

@availability_bp.route('/availability/daily/<int:user_id>', methods=['POST'])
@jwt_required()
def set_daily_override(user_id):
    agent = get_current_agent()
    if not agent or agent.id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    data = request.get_json()
    override_date_str = data.get('date')
    is_available = data.get('is_available')
    
    if not override_date_str or not isinstance(is_available, bool):
        return jsonify({'error': 'Date and availability status are required'}), 400
    
    override_date = parse(override_date_str).date()
    
    existing_override = AgentAvailability.query.filter_by(
        agent_id=user_id, 
        date=override_date
    ).first()
    
    if existing_override:
        existing_override.is_available = is_available
        existing_override.is_away = False
        existing_override.notes = "Daily override from availability page."
    else:
        new_override = AgentAvailability(
            agent_id=user_id, 
            date=override_date, 
            is_available=is_available, 
            is_away=False,
            notes="Daily override from availability page."
        )
        db.session.add(new_override)
    
    db.session.commit()
    return jsonify({'message': 'Daily availability updated successfully'}), 200

# --- Weekly Setup for Next Week ---
@availability_bp.route('/availability/setup-next-week/<int:user_id>', methods=['POST'])
@jwt_required()
def setup_next_week_availability(user_id):
    """Set up availability for the next week based on weekly schedule."""
    try:
        agent = get_current_agent()
        if not agent or agent.id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get weekly schedule
        weekly = AgentWeeklyAvailability.query.filter_by(agent_id=user_id).first()
        if not weekly:
            # Create default weekly schedule if none exists
            weekly = AgentWeeklyAvailability(
                agent_id=user_id,
                monday=True,
                tuesday=True,
                wednesday=True,
                thursday=True,
                friday=True,
                saturday=False,
                sunday=False
            )
            db.session.add(weekly)
            db.session.commit()
        
        # Get next week's dates
        next_week_dates = get_next_week_dates()
        created_count = 0
        updated_count = 0
        
        for date in next_week_dates:
            day_name = date.strftime("%A").lower()
            is_available = getattr(weekly, day_name, False)
            
            # Check if record already exists
            existing = AgentAvailability.query.filter_by(
                agent_id=user_id,
                date=date
            ).first()
            
            if existing:
                # Update existing record
                existing.is_available = is_available
                existing.is_away = False
                existing.notes = "Updated from weekly schedule"
                updated_count += 1
            else:
                # Create new record
                availability = AgentAvailability(
                    agent_id=user_id,
                    date=date,
                    is_available=is_available,
                    is_away=False,
                    notes="Generated from weekly schedule"
                )
                db.session.add(availability)
                created_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Next week availability set. Created {created_count} new records, updated {updated_count} existing records.',
            'week_start': next_week_dates[0].isoformat(),
            'week_end': next_week_dates[-1].isoformat()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to setup availability: {str(e)}'}), 500

# --- Get Week View ---
@availability_bp.route('/availability/week-view/<int:user_id>', methods=['GET'])
@jwt_required()
def get_week_view(user_id):
    """Get availability for current and next week in a structured format."""
    try:
        # Get weekly schedule
        weekly = AgentWeeklyAvailability.query.filter_by(agent_id=user_id).first()
        
        # Get current and next week dates
        current_week = get_current_week_dates()
        next_week = get_next_week_dates()
        
        # Get all overrides for both weeks
        all_dates = current_week + next_week
        overrides = AgentAvailability.query.filter(
            AgentAvailability.agent_id == user_id,
            AgentAvailability.date.in_(all_dates)
        ).all()
        
        override_dict = {o.date: o.is_available for o in overrides}
        
        def get_week_data(week_dates):
            week_data = []
            for date in week_dates:
                day_name = date.strftime("%A").lower()
                
                # Check for override first, then fall back to weekly schedule
                if date in override_dict:
                    is_available = override_dict[date]
                    source = 'override'
                elif weekly:
                    is_available = getattr(weekly, day_name, False)
                    source = 'weekly'
                else:
                    is_available = False
                    source = 'default'
                
                week_data.append({
                    'date': date.isoformat(),
                    'day': date.strftime("%A"),
                    'is_available': is_available,
                    'source': source
                })
            
            return week_data
        
        return jsonify({
            'current_week': {
                'start': current_week[0].isoformat(),
                'end': current_week[-1].isoformat(),
                'days': get_week_data(current_week)
            },
            'next_week': {
                'start': next_week[0].isoformat(),
                'end': next_week[-1].isoformat(),
                'days': get_week_data(next_week)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get week view: {str(e)}'}), 500

# --- Send Sunday Reminder ---
@availability_bp.route('/availability/send-sunday-reminder', methods=['POST'])
@jwt_required()
def send_sunday_reminder():
    """Admin endpoint to send Sunday reminders to all agents."""
    try:
        # Verify admin access
        current_user_id = get_jwt_identity()
        admin = User.query.filter_by(id=current_user_id, role='admin').first()
        if not admin:
            return jsonify({'error': 'Admin access required'}), 403
        
        # Get all active agents
        agents = User.query.filter_by(role='agent', is_active=True).all()
        
        # Create notifications
        sent_count = 0
        for agent in agents:
            notification = Notification(
                user_id=agent.id,
                title="Set Your Availability for Next Week",
                message="Please review and confirm your availability for next week. Tap here to set your schedule.",
                type='availability_reminder'
            )
            db.session.add(notification)
            sent_count += 1
        
        db.session.commit()
        
        # If you want to trigger push notifications, uncomment and import the function:
        # from src.routes.notifications import trigger_push_notification_for_users
        # agent_ids = [agent.id for agent in agents]
        # trigger_push_notification_for_users(
        #     agent_ids,
        #     "Weekly Availability Reminder", 
        #     "Please set your availability for next week"
        # )
        
        return jsonify({
            'message': f'Sunday reminders sent to {sent_count} agents',
            'agent_count': sent_count
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to send reminders: {str(e)}'}), 500