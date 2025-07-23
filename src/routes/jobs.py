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

@jobs_bp.route('/jobs', methods=['GET'])
@jwt_required()
def get_jobs():
    """Get list of jobs with pagination. For agents, this is their 'Available Jobs' pool."""
    try:
        current_user = require_agent_or_admin()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Pagination parameters
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)  # Max 100 items per page
        
        if current_user.role == 'agent':
            available_dates_records = AgentAvailability.query.filter_by(
                agent_id=current_user.id, 
                is_available=True, 
                is_away=False
            ).all()
            available_dates = [record.date for record in available_dates_records]

            if not available_dates:
                return jsonify({'jobs': [], 'total': 0, 'page': page, 'pages': 0}), 200

            assigned_job_ids = [assignment.job_id for assignment in current_user.assignments]
            
            query = Job.query.filter(
                Job.status == 'open',
                db.func.date(Job.arrival_time).in_(available_dates),
                ~Job.id.in_(assigned_job_ids)
            ).order_by(Job.arrival_time.asc())
            
        else:  # Admin logic
            status = request.args.get('status')
            start_date = request.args.get('start_date')
            end_date = request.args.get('end_date')
            
            query = Job.query
            
            if status:
                query = query.filter(Job.status == status)
                
            if start_date:
                try:
                    parsed_start = parse(start_date)
                    query = query.filter(Job.arrival_time >= parsed_start)
                except ValueError:
                    return jsonify({'error': 'Invalid start_date format'}), 400
                    
            if end_date:
                try:
                    parsed_end = parse(end_date)
                    query = query.filter(Job.arrival_time <= parsed_end)
                except ValueError:
                    return jsonify({'error': 'Invalid end_date format'}), 400
                    
            query = query.order_by(Job.arrival_time.desc())
        
        # Apply pagination
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'jobs': [job.to_dict() for job in paginated.items],
            'total': paginated.total,
            'page': page,
            'pages': paginated.pages,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching jobs: {str(e)}")
        return jsonify({'error': 'Failed to fetch jobs'}), 500

# <<< THIS IS THE ONLY FUNCTION THAT HAS CHANGED >>>
@jobs_bp.route('/jobs', methods=['POST'])
@jwt_required()
@validate_json_fields(['title', 'address', 'arrival_time'])
def create_job():
    """Create new job (admin only) and send notifications to ALL available agents."""
    current_user = require_admin()
    if not current_user:
        return jsonify({'error': 'Access denied. Admin role required.'}), 403

    data = request.get_json()
    
    try:
        arrival_time = parse(data['arrival_time'])
    except (ValueError, TypeError):
        return jsonify({'error': 'Invalid arrival_time format'}), 400

    try:
        new_job = Job(
            title=data.get('title'),
            job_type=data.get('job_type', 'Traveller Eviction'),
            address=data.get('address'),
            postcode=data.get('postcode'),
            arrival_time=arrival_time,
            agents_required=int(data.get('agents_required', 1)),
            instructions=data.get('instructions'),
            created_by=current_user.id,
            status='open'
        )
        db.session.add(new_job)
        db.session.commit()

        # --- Notification Logic ---
        job_date = new_job.arrival_time.date()
        day_name = job_date.strftime("%A").lower()

        # 1. Find agents available based on their recurring weekly schedule
        weekly_available_q = AgentWeeklyAvailability.query.filter(getattr(AgentWeeklyAvailability, day_name) == True)
        weekly_available_ids = {a.agent_id for a in weekly_available_q.all()}
        
        # 2. Find agents with daily overrides for that specific date
        overrides_q = AgentAvailability.query.filter_by(date=job_date).all()
        available_overrides = {a.agent_id for a in overrides_q if a.is_available}
        unavailable_overrides = {a.agent_id for a in overrides_q if not a.is_available}

        # 3. Calculate the final list of agent IDs to notify
        final_available_ids = (weekly_available_ids | available_overrides) - unavailable_overrides

        notification_status = "No agents available for this date."
        if final_available_ids:
            agent_ids_to_notify = list(final_available_ids)
            title = f"New Job Available: {new_job.title}"
            message = f"A new '{new_job.job_type}' job is available for {job_date.strftime('%d-%b-%Y')}. Tap to view."
            
            try:
                trigger_push_notification_for_users(agent_ids_to_notify, title, message)
                notification_status = f"Notification sent to {len(agent_ids_to_notify)} available agents."
            except Exception as e:
                notification_status = f"Job created but notifications failed: {str(e)}"
                logger.error(f"Notification error: {str(e)}")

        response_data = new_job.to_dict()
        response_data['notification_status'] = notification_status

        return jsonify({
            'message': 'Job created successfully!',
            'job': response_data
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating job: {str(e)}")
        return jsonify({'error': 'Failed to create job', 'details': str(e)}), 500

@jobs_bp.route('/jobs/<int:job_id>/mark-completed', methods=['POST'])
@jwt_required()
def mark_job_completed(job_id):
    """Debug tool to manually mark a job as completed."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403

        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
            
        job.arrival_time = datetime.utcnow() - timedelta(days=1)
        job.status = 'completed'
        db.session.commit()

        return jsonify({
            'message': f'Job {job.id} - "{job.title}" has been marked as completed.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking job as completed: {str(e)}")
        return jsonify({'error': 'Failed to mark job as completed'}), 500

@jobs_bp.route('/jobs/<int:job_id>', methods=['GET'])
@jwt_required()
def get_job(job_id):
    """Get job details."""
    try:
        current_user = require_agent_or_admin()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        if current_user.role == 'agent':
            assignment = JobAssignment.query.filter_by(
                job_id=job_id, 
                agent_id=current_user.id
            ).first()
            if not assignment and job.status != 'open':
                return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({'job': job.to_dict()}), 200
        
    except Exception as e:
        logger.error(f"Error fetching job: {str(e)}")
        return jsonify({'error': 'Failed to fetch job details'}), 500

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

@jobs_bp.route('/assignments/agent/<int:agent_id>', methods=['GET'])
@jwt_required()
def get_agent_assignments(agent_id):
    """Get agent's assignments with pagination."""
    try:
        current_user = require_agent_or_admin()
        if not current_user:
            return jsonify({'error': 'User not found'}), 404
        
        # Security check: agents can only see their own assignments
        if current_user.role == 'agent' and current_user.id != agent_id:
            return jsonify({'error': 'Access denied. You can only view your own assignments.'}), 403
        
        # Pagination
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        per_page = min(per_page, 100)
        
        query = JobAssignment.query.filter_by(agent_id=agent_id)
        paginated = query.order_by(JobAssignment.created_at.desc()).paginate(
            page=page, 
            per_page=per_page, 
            error_out=False
        )
        
        return jsonify({
            'agent_id': agent_id, 
            'assignments': [assignment.to_dict() for assignment in paginated.items],
            'total': paginated.total,
            'page': page,
            'pages': paginated.pages,
            'per_page': per_page
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching assignments: {str(e)}")
        return jsonify({'error': 'Failed to fetch assignments'}), 500

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