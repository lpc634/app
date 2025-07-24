import os
import requests
import json
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from dateutil.parser import parse
import what3words
from functools import wraps
import logging

# --- Corrected Imports ---
from src.models.user import User, Job, JobAssignment, AgentAvailability, AgentWeeklyAvailability, Notification, Invoice, InvoiceJob, db
from src.routes.notifications import trigger_push_notification_for_users

jobs_bp = Blueprint('jobs', __name__)

# --- Configuration ---
W3W_API_KEY = '8PARM791' 
geocoder = what3words.Geocoder(W3W_API_KEY)
GEOCODING_URL = "https://nominatim.openstreetmap.org/search"

# Weather API Configuration - You'll need to sign up at openweathermap.org for a free API key
WEATHER_API_KEY = os.environ.get('OPENWEATHER_API_KEY', 'YOUR_API_KEY_HERE')
WEATHER_API_URL = "https://api.openweathermap.org/data/2.5/forecast"

# Set up logging
logger = logging.getLogger(__name__)

# --- Helper Functions ---
def require_admin():
    """Ensure user is an admin."""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return None
    return user

def require_agent_or_admin():
    """Ensure user is an agent or admin."""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    return user

def validate_json_fields(required_fields):
    """Decorator to validate required JSON fields."""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            data = request.get_json()
            if not data:
                return jsonify({'error': 'No JSON data provided'}), 400
            
            missing_fields = [field for field in required_fields if field not in data or data[field] is None]
            if missing_fields:
                return jsonify({'error': f'Missing required fields: {", ".join(missing_fields)}'}), 400
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def get_weather_forecast(lat, lon, arrival_time):
    """Get weather forecast for a specific location and time."""
    try:
        # OpenWeatherMap API call
        params = {
            'lat': lat,
            'lon': lon,
            'appid': WEATHER_API_KEY,
            'units': 'metric',  # For Celsius
            'cnt': 40  # Get 5 days of forecast (8 forecasts per day)
        }
        
        response = requests.get(WEATHER_API_URL, params=params, timeout=5)
        response.raise_for_status()
        
        data = response.json()
        
        # Find the forecast closest to arrival time
        arrival_timestamp = arrival_time.timestamp()
        closest_forecast = None
        min_time_diff = float('inf')
        
        for forecast in data['list']:
            forecast_timestamp = forecast['dt']
            time_diff = abs(forecast_timestamp - arrival_timestamp)
            
            if time_diff < min_time_diff:
                min_time_diff = time_diff
                closest_forecast = forecast
        
        if closest_forecast:
            temp = closest_forecast['main']['temp']
            description = closest_forecast['weather'][0]['description']
            
            # Generate clothing recommendation based on temperature
            if temp < 5:
                clothing = "Heavy winter coat, gloves, and warm layers recommended."
            elif temp < 10:
                clothing = "Warm jacket and layers recommended."
            elif temp < 15:
                clothing = "Light jacket or sweater recommended."
            elif temp < 20:
                clothing = "Light jacket optional, comfortable work clothes."
            else:
                clothing = "Light, breathable work clothes recommended."
            
            return {
                'forecast': f"{description.capitalize()}, {temp}°C",
                'clothing': clothing
            }
        
    except requests.exceptions.RequestException as e:
        logger.error(f"Weather API error: {str(e)}")
    except Exception as e:
        logger.error(f"Error getting weather forecast: {str(e)}")
    
    # Fallback if weather API fails
    return {
        'forecast': 'Weather information unavailable',
        'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
    }

# --- Geocoding Routes ---
@jobs_bp.route('/jobs/convert-address', methods=['POST'])
@jwt_required()
@validate_json_fields(['address'])
def convert_address_to_coords():
    """Converts a postal address to latitude/longitude."""
    data = request.get_json()
    address = data.get('address')
    
    try:
        headers = {'User-Agent': 'V3ServicesApp/1.0'}
        params = {'q': address, 'format': 'json', 'countrycodes': 'gb', 'limit': 1}
        response = requests.get(GEOCODING_URL, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        results = response.json()
        
        if not results:
            return jsonify({'error': 'Could not find coordinates for that address.'}), 404
            
        location = results[0]
        return jsonify({
            'coordinates': {
                'lat': float(location['lat']), 
                'lon': float(location['lon'])
            }
        }), 200
        
    except requests.exceptions.Timeout:
        return jsonify({'error': 'Geocoding service timeout. Please try again.'}), 504
    except requests.exceptions.RequestException as e:
        return jsonify({'error': 'Geocoding service error.', 'details': str(e)}), 503
    except Exception as e:
        logger.error(f"Geocoding error: {str(e)}")
        return jsonify({'error': 'An unexpected error occurred during geocoding.'}), 500

@jobs_bp.route('/jobs/convert-coords-to-w3w', methods=['POST'])
@jwt_required()
@validate_json_fields(['lat', 'lon'])
def convert_coords_to_what3words():
    """Converts latitude/longitude to a what3words address."""
    data = request.get_json()
    lat = float(data.get('lat'))
    lon = float(data.get('lon'))
    
    # Validate coordinate ranges
    if not (-90 <= lat <= 90) or not (-180 <= lon <= 180):
        return jsonify({'error': 'Invalid coordinates. Lat must be between -90 and 90, lon between -180 and 180.'}), 400
    
    try:
        res = geocoder.convert_to_3wa(what3words.Coordinates(lat, lon))
        if 'words' in res:
            return jsonify({'w3w_address': res['words']}), 200
        else:
            return jsonify({'error': 'Could not convert coordinates.'}), 404
            
    except Exception as e:
        logger.error(f"What3words API error: {str(e)}")
        return jsonify({'error': 'An error occurred with the what3words service.'}), 503

# --- Job Routes ---

# [PASTE THIS CODE OVER THE OLD create_job FUNCTION]

@jobs_bp.route('/jobs', methods=['POST'])
@jwt_required()
@validate_json_fields(['title', 'job_type', 'address', 'arrival_time', 'agents_required'])
def create_job():
    """Admin creates a new job, and the system assigns it to available agents."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403

        data = request.get_json()

        # Create the job first
        new_job = Job(
            title=data['title'],
            job_type=data['job_type'],
            address=data['address'],
            postcode=data.get('postcode'),
            arrival_time=parse(data['arrival_time']),
            agents_required=int(data['agents_required']),
            hourly_rate=float(data.get('hourly_rate', 0)),
            lead_agent_name=data.get('lead_agent_name'),
            instructions=data.get('instructions'),
            urgency_level=data.get('urgency_level', 'Standard'),
            status='open',
            created_by=current_user.id
        )
        db.session.add(new_job)
        db.session.flush()  # Get the job ID without committing

        # Find available agents for the job date
        job_date = new_job.arrival_time.date()
        
        # Find agents who are:
        # 1. Verified
        # 2. Have availability set to True for that date
        # 3. Are not away on that date
        available_agents = db.session.query(User).join(AgentAvailability).filter(
            User.role == 'agent',
            User.verification_status == 'verified',  # Make sure they're verified
            AgentAvailability.date == job_date,
            AgentAvailability.is_available == True,
            AgentAvailability.is_away == False
        ).all()
        
        if not available_agents:
            db.session.commit()
            return jsonify({
                'message': 'Job created, but no available agents found for that date.',
                'job': new_job.to_dict(),
                'available_agents': 0
            }), 201

        # Create job assignments for available agents
        assigned_agent_ids = []
        for agent in available_agents:
            # Check if assignment already exists (just in case)
            existing_assignment = JobAssignment.query.filter_by(
                job_id=new_job.id, 
                agent_id=agent.id
            ).first()
            
            if not existing_assignment:
                assignment = JobAssignment(
                    job_id=new_job.id, 
                    agent_id=agent.id, 
                    status='pending'
                )
                db.session.add(assignment)
                assigned_agent_ids.append(agent.id)

        # Send notifications to assigned agents
        if assigned_agent_ids:
            notification_title = "New Job Available"
            notification_message = f"A new job, '{new_job.title}', is available for your response."
            # Add your notification function here if you have one
            # trigger_push_notification_for_users(assigned_agent_ids, notification_title, notification_message)

        db.session.commit()

        return jsonify({
            'message': f'Job created successfully and assigned to {len(assigned_agent_ids)} available agents.',
            'job': new_job.to_dict(),
            'assigned_agents': len(assigned_agent_ids),
            'available_agents': len(available_agents)
        }), 201

    except ValueError as ve:
        db.session.rollback()
        return jsonify({'error': f'Invalid data format: {ve}'}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating job: {str(e)}")
        return jsonify({'error': 'Failed to create job'}), 500


@jobs_bp.route('/jobs/<int:job_id>', methods=['PUT'])
@jwt_required()
def update_job(job_id):
    """Update job (admin only)."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
            
        data = request.get_json()
        
        # Validate specific fields
        if 'agents_required' in data:
            agents_required = int(data['agents_required'])
            if agents_required < 1:
                return jsonify({'error': 'agents_required must be at least 1'}), 400
            data['agents_required'] = agents_required
        
        if 'arrival_time' in data:
            try:
                arrival_time = parse(data['arrival_time'])
                data['arrival_time'] = arrival_time
            except ValueError:
                return jsonify({'error': 'Invalid arrival_time format'}), 400
        
        updatable_fields = [
            'title', 'job_type', 'address', 'postcode', 'arrival_time', 
            'agents_required', 'hourly_rate', 'lead_agent_name', 
            'instructions', 'urgency_level', 'status'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(job, field, data[field])
        
        job.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Job updated successfully', 
            'job': job.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating job: {str(e)}")
        return jsonify({'error': 'Failed to update job'}), 500

@jobs_bp.route('/jobs/<int:job_id>', methods=['DELETE'])
@jwt_required()
def delete_job(job_id):
    """Cancel job (admin only) and notify assigned agents."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
            
        job.status = 'cancelled'
        job.updated_at = datetime.utcnow()
        
        # Notify assigned agents
        assignments = JobAssignment.query.filter_by(job_id=job_id).all()
        for assignment in assignments:
            notification = Notification(
                user_id=assignment.agent_id,
                title=f"Job Cancelled: {job.title}",
                message=f"The job scheduled for {job.arrival_time.strftime('%Y-%m-%d %H:%M')} has been cancelled.",
                type='job_cancelled',
                job_id=job.id
            )
            db.session.add(notification)
        
        db.session.commit()
        
        return jsonify({'message': 'Job cancelled successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error cancelling job: {str(e)}")
        return jsonify({'error': 'Failed to cancel job'}), 500

@jobs_bp.route('/jobs/<int:job_id>/respond', methods=['POST'])
@jwt_required()
def respond_to_job(job_id):
    """Agent accepts a job from the available pool."""
    try:
        current_user = require_agent_or_admin()
        if not current_user or current_user.role != 'agent':
            return jsonify({'error': 'Only agents can respond to jobs'}), 403
        
        # Use database locking to prevent race conditions
        job = Job.query.with_for_update().get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
            
        if job.status != 'open':
            return jsonify({'error': 'This job is no longer open for applications.'}), 409

        # Check if agent already accepted
        existing_assignment = JobAssignment.query.filter_by(
            job_id=job_id, 
            agent_id=current_user.id
        ).first()
        if existing_assignment:
            return jsonify({'error': 'You have already accepted this job.'}), 409
        
        # Check if job is full
        accepted_count = JobAssignment.query.filter_by(
            job_id=job_id, 
            status='accepted'
        ).count()
        if accepted_count >= job.agents_required:
            job.status = 'filled'
            db.session.commit()
            return jsonify({'error': 'Job was filled just before you accepted.'}), 409
        
        # Create assignment
        assignment = JobAssignment(
            job_id=job_id,
            agent_id=current_user.id,
            status='accepted',
            response_time=datetime.utcnow()
        )
        db.session.add(assignment)

        # Update job status if full
        if (accepted_count + 1) >= job.agents_required:
            job.status = 'filled'
        
        # Get weather forecast
        weather_info = {'forecast': 'Weather information unavailable', 'clothing': 'Please dress appropriately for outdoor work.'}
        
        if job.postcode or job.address:
            # Try to get coordinates from address
            try:
                headers = {'User-Agent': 'V3ServicesApp/1.0'}
                params = {
                    'q': job.postcode or job.address, 
                    'format': 'json', 
                    'countrycodes': 'gb', 
                    'limit': 1
                }
                geo_response = requests.get(GEOCODING_URL, params=params, headers=headers, timeout=5)
                if geo_response.status_code == 200:
                    results = geo_response.json()
                    if results:
                        lat = float(results[0]['lat'])
                        lon = float(results[0]['lon'])
                        weather_info = get_weather_forecast(lat, lon, job.arrival_time)
            except Exception as e:
                logger.error(f"Error getting weather for job {job_id}: {str(e)}")
        
        # Create confirmation notification
        lead_agent_info = f"Lead Agent: {job.lead_agent_name or 'To be confirmed'}"
        confirmation_message = (
            f"CONFIRMED: {job.title}.\n"
            f"Location: {job.address}\n"
            f"Arrival: {job.arrival_time.strftime('%Y-%m-%d %H:%M')}\n"
            f"{lead_agent_info}\n\n"
            f"Weather: {weather_info['forecast']}\n"
            f"Clothing: {weather_info['clothing']}\n\n"
            f"Instructions: {job.instructions or 'See job details'}"
        )
        
        notification = Notification(
            user_id=current_user.id, 
            title=f"CONFIRMED: {job.title}", 
            message=confirmation_message, 
            type='job_confirmation', 
            job_id=job.id
        )
        db.session.add(notification)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Job accepted successfully', 
            'assignment': assignment.to_dict(),
            'weather_info': weather_info
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error accepting job: {str(e)}")
        return jsonify({'error': 'Failed to accept job'}), 500

@jobs_bp.route('/assignments/<int:assignment_id>/respond', methods=['POST'])
@jwt_required()
def respond_to_assignment(assignment_id):
    """Agent responds to a job assignment (accept/decline)."""
    try:
        current_user = require_agent_or_admin()
        if not current_user or current_user.role != 'agent':
            return jsonify({'error': 'Only agents can respond to assignments'}), 403
        
        data = request.get_json()
        response = data.get('response')
        
        if response not in ['accept', 'decline', 'accepted', 'declined']:
            return jsonify({'error': 'Response must be "accept" or "decline"'}), 400
        
        # Get the assignment with job details
        assignment = JobAssignment.query.options(db.joinedload(JobAssignment.job)).get(assignment_id)
        if not assignment:
            return jsonify({'error': 'Assignment not found'}), 404
        
        # Security check: agents can only respond to their own assignments
        if assignment.agent_id != current_user.id:
            return jsonify({'error': 'Access denied. You can only respond to your own assignments.'}), 403
        
        # Check if assignment is still pending
        if assignment.status != 'pending':
            return jsonify({'error': 'This assignment has already been responded to.'}), 409
        
        # Update assignment status
        assignment.status = 'accepted' if response in ['accept', 'accepted'] else 'declined'
        assignment.response_time = datetime.utcnow()
        
        # If accepted, check if job is now full and update job status
        if response in ['accept', 'accepted']:
            job = assignment.job
            accepted_count = JobAssignment.query.filter_by(
                job_id=job.id, 
                status='accepted'
            ).count()
            
            if accepted_count >= job.agents_required:
                job.status = 'filled'
        
        db.session.commit()
        
        return jsonify({
            'message': f'Assignment {response}ed successfully',
            'assignment': assignment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error responding to assignment: {str(e)}")
        return jsonify({'error': 'Failed to respond to assignment'}), 500

@jobs_bp.route('/agent/jobs/completed', methods=['GET'])
@jwt_required()
def get_completed_jobs():
    """Get a list of completed jobs for the current agent to file reports."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or user.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403

        # Get completed assignments with pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)
        
        query = db.session.query(Job).join(JobAssignment).filter(
            JobAssignment.agent_id == user.id,
            JobAssignment.status == 'accepted',
            Job.arrival_time < datetime.utcnow()
        ).order_by(Job.arrival_time.desc())
        
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        jobs_with_report_status = []
        for job in paginated.items:
            job_dict = job.to_dict()
            
            job_dict['reportStatus'] = 'pending'
            job_dict['jobType'] = job.job_type
            
            jobs_with_report_status.append(job_dict)

        return jsonify({
            'jobs': jobs_with_report_status,
            'total': paginated.total,
            'page': page,
            'pages': paginated.pages,
            'per_page': per_page
        }), 200

    except Exception as e:
        logger.error(f"Error fetching completed jobs: {str(e)}")
        return jsonify({'error': 'Failed to fetch completed jobs'}), 500
    
@jobs_bp.route('/debug/availability/<int:agent_id>', methods=['GET'])
@jwt_required()
def debug_agent_availability(agent_id):
    """Debug endpoint to check agent availability."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        # Get agent info
        agent = User.query.get(agent_id)
        if not agent:
            return jsonify({'error': 'Agent not found'}), 404
            
        # Get recent availability records
        recent_availability = AgentAvailability.query.filter_by(
            agent_id=agent_id
        ).order_by(AgentAvailability.date.desc()).limit(10).all()
        
        # Get weekly schedule
        weekly_schedule = AgentWeeklyAvailability.query.filter_by(agent_id=agent_id).first()
        
        # Get recent job assignments
        recent_assignments = JobAssignment.query.filter_by(
            agent_id=agent_id
        ).order_by(JobAssignment.created_at.desc()).limit(5).all()
        
        return jsonify({
            'agent': {
                'id': agent.id,
                'name': f"{agent.first_name} {agent.last_name}",
                'email': agent.email,
                'role': agent.role,
                'verification_status': agent.verification_status
            },
            'recent_availability': [
                {
                    'date': avail.date.isoformat(),
                    'is_available': avail.is_available,
                    'is_away': avail.is_away,
                    'notes': avail.notes
                } for avail in recent_availability
            ],
            'weekly_schedule': {
                'monday': weekly_schedule.monday if weekly_schedule else False,
                'tuesday': weekly_schedule.tuesday if weekly_schedule else False,
                'wednesday': weekly_schedule.wednesday if weekly_schedule else False,
                'thursday': weekly_schedule.thursday if weekly_schedule else False,
                'friday': weekly_schedule.friday if weekly_schedule else False,
                'saturday': weekly_schedule.saturday if weekly_schedule else False,
                'sunday': weekly_schedule.sunday if weekly_schedule else False,
            } if weekly_schedule else None,
            'recent_assignments': [
                {
                    'id': assign.id,
                    'job_id': assign.job_id,
                    'status': assign.status,
                    'created_at': assign.created_at.isoformat() if assign.created_at else None
                } for assign in recent_assignments
            ]
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500
