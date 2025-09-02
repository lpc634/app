import os
import requests
import json
import calendar
from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date, timedelta
from dateutil.parser import parse
from functools import wraps
import logging

# --- Corrected Imports ---
from sqlalchemy import and_, or_, case
from src.models.user import User, Job, JobAssignment, AgentAvailability, AgentWeeklyAvailability, Notification, Invoice, InvoiceJob, JobBilling, db
from src.utils.finance import update_job_hours
from src.routes.notifications import trigger_push_notification_for_users
from src.services.telegram_notifications import send_job_acceptance_notification
from src.services.telegram_notifications import _send_admin_group, _format_dt

jobs_bp = Blueprint('jobs', __name__)

# --- Configuration ---
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

# === Helper: job filled check ===
def _accepted_count(job_id: int) -> int:
    return JobAssignment.query.filter_by(job_id=job_id, status='accepted').count()

def _is_job_filled(job: Job) -> bool:
    try:
        return _accepted_count(job.id) >= int(job.agents_required or 1)
    except Exception:
        return False

# === List assignments for an agent (exclude filled jobs if still pending) ===
@jobs_bp.route('/assignments/agent/<int:agent_id>', methods=['GET'])
@jwt_required()
def list_agent_assignments(agent_id):
    try:
        user = User.query.get(get_jwt_identity())
        if not user:
            return jsonify({'error': 'Unauthorized'}), 401
        if user.role not in ['agent', 'admin'] and user.id != agent_id:
            return jsonify({'error': 'Access denied'}), 403

        status_filter = request.args.get('status')
        q = JobAssignment.query.filter_by(agent_id=agent_id)
        if status_filter:
            q = q.filter(JobAssignment.status == status_filter)
        assignments = q.order_by(JobAssignment.created_at.desc()).all()

        result = []
        for a in assignments:
            job = Job.query.get(a.job_id)
            if not job:
                continue
            if a.status == 'pending' and _is_job_filled(job):
                # hide pending assignment for already filled job
                continue
            item = a.to_dict()
            item['job_details'] = job.to_dict()
            result.append(item)
        return jsonify({'assignments': result}), 200
    except Exception as e:
        logger.error(f"Error listing assignments for agent {agent_id}: {e}")
        return jsonify({'error': 'Failed to load assignments'}), 500

# === Agent respond to a job (accept/decline) ===
@jobs_bp.route('/jobs/<int:job_id>/respond', methods=['POST'])
@jwt_required()
def respond_to_job(job_id):
    try:
        user_id = get_jwt_identity()
        agent = User.query.get(user_id)
        if not agent or agent.role != 'agent':
            return jsonify({'error': 'Agent access required'}), 403
        payload = request.get_json() or {}
        response = (payload.get('response') or '').lower()
        if response not in ['accept', 'decline']:
            return jsonify({'error': 'Invalid response'}), 400

        job = Job.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        assignment = JobAssignment.query.filter_by(job_id=job_id, agent_id=agent.id).first()
        if not assignment:
            return jsonify({'error': 'Assignment not found'}), 404

        if response == 'decline':
            assignment.status = 'declined'
            assignment.response_time = datetime.utcnow()
            db.session.commit()
            return jsonify({'status': 'declined'}), 200

        # accept
        if _is_job_filled(job):
            # Already filled, mark as expired/declined for this agent
            assignment.status = 'declined'
            assignment.response_time = datetime.utcnow()
            db.session.commit()
            return jsonify({'status': 'declined', 'message': 'Positions already filled'}), 409

        assignment.status = 'accepted'
        assignment.response_time = datetime.utcnow()
        db.session.commit()

        # Admin: notify acceptance
        try:
            agent_name = f"{agent.first_name} {agent.last_name}".strip()
            area = _area_label(job) if '_area_label' in globals() else (job.postcode or job.city or job.town or 'Area')
            sent_ok = _send_admin_group(
                (
                    "✅ <b>Agent Accepted</b>\n\n"
                    f"<b>Job:</b> #{job.id} — {job.title or job.job_type}\n"
                    f"<b>When:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
                    f"<b>Area:</b> {area}\n"
                    f"<b>Agent:</b> {agent_name}"
                )
            )
            if sent_ok:
                logger.info(f"Admin acceptance notify sent for job {job.id} to group")
            else:
                logger.warning(f"Admin acceptance notify returned False for job {job.id}")
        except Exception as _e:
            logger.warning(f"Admin acceptance notify failed: {_e}")

        # If filled after this acceptance, mark others expired and job filled
        if _is_job_filled(job):
            job.status = 'filled'
            JobAssignment.query.filter(
                JobAssignment.job_id == job.id,
                JobAssignment.status == 'pending',
                JobAssignment.agent_id != agent.id
            ).update({JobAssignment.status: 'expired'})
            db.session.commit()

            # Admin: notify job filled with agent list
            try:
                accepted = JobAssignment.query.filter_by(job_id=job.id, status='accepted').all()
                # Gather names
                names = []
                for a in accepted:
                    try:
                        u = User.query.get(a.agent_id)
                        if u:
                            names.append(f"{u.first_name} {u.last_name}".strip())
                    except Exception:
                        continue
                agents_list = "\n".join([f"• {n}" for n in names]) if names else "(names unavailable)"
                area = _area_label(job) if '_area_label' in globals() else (job.postcode or job.city or job.town or 'Area')
                sent_ok = _send_admin_group(
                    (
                        "🎉 <b>Job Filled</b>\n\n"
                        f"<b>Job:</b> #{job.id} — {job.title or job.job_type}\n"
                        f"<b>When:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
                        f"<b>Area:</b> {area}\n"
                        f"<b>Agents ({len(names)}):</b>\n{agents_list}"
                    )
                )
                if sent_ok:
                    logger.info(f"Admin filled notify sent for job {job.id} with {len(names)} agents")
                else:
                    logger.warning(f"Admin filled notify returned False for job {job.id}")
            except Exception as _e:
                logger.warning(f"Admin filled notify failed: {_e}")
        # Notify agent acceptance to Telegram
        try:
            send_job_acceptance_notification(agent, job)
        except Exception as _e:
            logger.warning(f"Telegram acceptance notify failed: {_e}")
        return jsonify({'status': 'accepted'}), 200
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error responding to job {job_id}: {e}")
        return jsonify({'error': 'Failed to respond to job'}), 500

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

def geocode_address(address):
    """Convert address to coordinates using OpenStreetMap Nominatim."""
    try:
        headers = {'User-Agent': 'V3ServicesApp/1.0'}
        params = {'q': address, 'format': 'json', 'countrycodes': 'gb', 'limit': 1}
        response = requests.get(GEOCODING_URL, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        results = response.json()
        
        if results:
            location = results[0]
            return float(location['lat']), float(location['lon'])
    except Exception as e:
        logger.error(f"Geocoding error for address '{address}': {str(e)}")
    
    return None, None

def get_weather_forecast(lat, lon, arrival_time):
    """Get weather forecast for a specific location and time."""
    # If no coordinates provided, return fallback
    if not lat or not lon:
        logger.warning(f"Weather forecast: No coordinates provided (lat={lat}, lon={lon})")
        return {
            'forecast': 'Weather information unavailable - no location coordinates',
            'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
        }
    
    # Check API key configuration
    if not WEATHER_API_KEY or WEATHER_API_KEY == 'YOUR_API_KEY_HERE':
        logger.warning(f"Weather API key not configured. Current value: {'NOT_SET' if not WEATHER_API_KEY else 'DEFAULT_PLACEHOLDER'}")
        # Provide location-based guidance instead of weather
        current_month = datetime.utcnow().month
        
        # Seasonal clothing recommendations for UK
        if current_month in [12, 1, 2]:  # Winter
            seasonal_clothing = "Winter clothing recommended: Heavy coat, gloves, and warm layers."
        elif current_month in [3, 4, 5]:  # Spring  
            seasonal_clothing = "Spring clothing recommended: Light jacket or layers for changing weather."
        elif current_month in [6, 7, 8]:  # Summer
            seasonal_clothing = "Summer clothing recommended: Light, breathable work clothes."
        else:  # Autumn
            seasonal_clothing = "Autumn clothing recommended: Warm jacket and layers."
        
        return {
            'forecast': f'Weather API key not configured - Location: {lat:.3f}, {lon:.3f}',
            'clothing': seasonal_clothing
        }
    
    try:
        # OpenWeatherMap API call
        params = {
            'lat': lat,
            'lon': lon,
            'appid': WEATHER_API_KEY,
            'units': 'metric',  # For Celsius
            'cnt': 40  # Get 5 days of forecast (8 forecasts per day)
        }
        
        logger.info(f"Making weather API request to {WEATHER_API_URL} with params: lat={lat}, lon={lon}")
        
        response = requests.get(WEATHER_API_URL, params=params, timeout=10)
        
        # Log detailed response information
        logger.info(f"Weather API response status: {response.status_code}")
        
        if response.status_code == 401:
            logger.error("Weather API: Invalid API key (401 Unauthorized)")
            return {
                'forecast': 'Weather API error - Invalid API key',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        elif response.status_code == 429:
            logger.error("Weather API: Rate limit exceeded (429 Too Many Requests)")
            return {
                'forecast': 'Weather API error - Rate limit exceeded',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        elif response.status_code == 404:
            logger.error(f"Weather API: Location not found (404) for coordinates {lat}, {lon}")
            return {
                'forecast': f'Weather API error - Location not found for {lat:.3f}, {lon:.3f}',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        
        response.raise_for_status()
        
        try:
            data = response.json()
        except ValueError as e:
            logger.error(f"Weather API: Invalid JSON response: {str(e)}")
            logger.error(f"Response content: {response.text[:500]}...")
            return {
                'forecast': 'Weather API error - Invalid response format',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        
        # Check if API returned an error in the JSON
        if 'cod' in data and str(data['cod']) != '200':
            error_msg = data.get('message', 'Unknown API error')
            logger.error(f"Weather API error in response: {data['cod']} - {error_msg}")
            return {
                'forecast': f'Weather API error - {error_msg}',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        
        # Check if we have forecast data
        if 'list' not in data or not data['list']:
            logger.error("Weather API: No forecast data in response")
            logger.error(f"Response data keys: {list(data.keys())}")
            return {
                'forecast': 'Weather API error - No forecast data available',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        
        # Find the forecast closest to arrival time
        arrival_timestamp = arrival_time.timestamp()
        closest_forecast = None
        min_time_diff = float('inf')
        
        logger.info(f"Looking for forecast closest to arrival time: {arrival_time} (timestamp: {arrival_timestamp})")
        
        # Log the available forecast range
        if data['list']:
            first_forecast = datetime.fromtimestamp(data['list'][0]['dt'])
            last_forecast = datetime.fromtimestamp(data['list'][-1]['dt'])
            logger.info(f"Available forecast range: {first_forecast} to {last_forecast}")
            logger.info(f"Total forecast entries: {len(data['list'])}")
        
        # Check if arrival time is within forecast range
        arrival_date = arrival_time.date()
        today = datetime.utcnow().date()
        days_from_now = (arrival_date - today).days
        
        logger.info(f"Job date: {arrival_date}, Today: {today}, Days from now: {days_from_now}")
        
        if days_from_now > 5:
            logger.warning(f"Job is {days_from_now} days away, beyond 5-day forecast limit")
            # Provide seasonal guidance for future jobs
            job_month = arrival_date.month
            job_day_name = calendar.day_name[arrival_date.weekday()]
            
            # UK seasonal clothing recommendations
            if job_month in [12, 1, 2]:  # Winter
                seasonal_clothing = "Winter clothing likely needed: Heavy coat, gloves, and warm layers."
            elif job_month in [3, 4, 5]:  # Spring  
                seasonal_clothing = "Spring clothing likely needed: Light jacket or layers for variable weather."
            elif job_month in [6, 7, 8]:  # Summer
                seasonal_clothing = "Summer clothing likely needed: Light, breathable work clothes."
            else:  # Autumn
                seasonal_clothing = "Autumn clothing likely needed: Warm jacket and layers."
            
            return {
                'forecast': f'Weather forecast unavailable - Job is {days_from_now} days away ({job_day_name} {arrival_date.strftime("%d %b %Y")})',
                'clothing': f'{seasonal_clothing} Check forecast closer to the job date.'
            }
        
        for i, forecast in enumerate(data['list']):
            forecast_timestamp = forecast['dt']
            forecast_datetime = datetime.fromtimestamp(forecast_timestamp)
            time_diff = abs(forecast_timestamp - arrival_timestamp)
            
            # Log first few and closest matches for debugging
            if i < 3 or time_diff < min_time_diff:
                logger.info(f"Forecast {i}: {forecast_datetime} (timestamp: {forecast_timestamp}), diff: {time_diff/3600:.1f} hours")
            
            if time_diff < min_time_diff:
                min_time_diff = time_diff
                closest_forecast = forecast
        
        if closest_forecast:
            forecast_datetime = datetime.fromtimestamp(closest_forecast['dt'])
            temp = closest_forecast['main']['temp']
            description = closest_forecast['weather'][0]['description']
            time_diff_hours = min_time_diff / 3600
            
            logger.info(f"Selected forecast: {forecast_datetime} for job at {arrival_time}")
            logger.info(f"Time difference: {time_diff_hours:.1f} hours")
            logger.info(f"Weather forecast: {description}, {temp}°C")
            
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
            
            # Format the forecast with date info for clarity
            forecast_date_str = forecast_datetime.strftime('%a %d %b')
            if time_diff_hours <= 3:
                date_indicator = f" (for {forecast_date_str})"
            else:
                date_indicator = f" (closest available: {forecast_date_str})"
            
            return {
                'forecast': f"{description.capitalize()}, {temp}°C{date_indicator}",
                'clothing': clothing
            }
        else:
            logger.error("Weather API: No suitable forecast found for the arrival time")
            return {
                'forecast': 'Weather API error - No forecast available for requested time',
                'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
            }
        
    except requests.exceptions.Timeout as e:
        logger.error(f"Weather API timeout error: {str(e)}")
        return {
            'forecast': 'Weather API error - Request timeout',
            'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
        }
    except requests.exceptions.ConnectionError as e:
        logger.error(f"Weather API connection error: {str(e)}")
        return {
            'forecast': 'Weather API error - Connection failed',
            'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
        }
    except requests.exceptions.HTTPError as e:
        logger.error(f"Weather API HTTP error: {str(e)} - Response: {e.response.text if e.response else 'No response'}")
        return {
            'forecast': f'Weather API HTTP error - {e.response.status_code if e.response else "Unknown"}',
            'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
        }
    except requests.exceptions.RequestException as e:
        logger.error(f"Weather API request error: {str(e)}")
        return {
            'forecast': 'Weather API error - Request failed',
            'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
        }
    except Exception as e:
        logger.error(f"Weather API unexpected error: {str(e)}", exc_info=True)
        return {
            'forecast': 'Weather API error - Unexpected error occurred',
            'clothing': 'Please check weather forecast and dress appropriately for outdoor work.'
        }

def get_weather_for_job(job):
    """Get weather forecast for a job, handling both coordinates and address."""
    logger.info(f"get_weather_for_job called for job {job.id}")
    lat, lon = None, None
    
    # Try to use existing coordinates first
    if job.location_lat and job.location_lng:
        try:
            lat, lon = float(job.location_lat), float(job.location_lng)
            logger.info(f"Using existing coordinates: lat={lat}, lon={lon}")
        except (ValueError, TypeError) as e:
            logger.warning(f"Failed to convert existing coordinates: {e}")
            pass
    
    # If no coordinates, try to geocode the address
    if not lat or not lon:
        if job.address:
            logger.info(f"No coordinates available, geocoding address: {job.address}")
            lat, lon = geocode_address(job.address)
            logger.info(f"Geocoded coordinates: lat={lat}, lon={lon}")
        else:
            logger.warning("No address available for geocoding")
    
    # Get weather forecast using coordinates
    logger.info(f"Calling get_weather_forecast with lat={lat}, lon={lon}, arrival_time={job.arrival_time}")
    result = get_weather_forecast(lat, lon, job.arrival_time)
    logger.info(f"get_weather_forecast returned: {result}")
    return result

# --- Weather Testing Routes ---
@jobs_bp.route('/debug/weather-test', methods=['GET'])
@jwt_required()
def debug_weather_test():
    """Debug endpoint to test weather API configuration."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403
        
        # Test coordinates (Camberley, Surrey)
        test_lat = 51.349
        test_lon = -0.727
        
        # Test with both current time and future time
        current_time = datetime.utcnow()
        future_time = current_time + timedelta(days=3)  # 3 days from now
        far_future_time = current_time + timedelta(days=180)  # 6 months from now
        
        test_time = current_time
        
        # Check API key status
        api_key_status = "NOT_SET" if not WEATHER_API_KEY else ("DEFAULT_PLACEHOLDER" if WEATHER_API_KEY == 'YOUR_API_KEY_HERE' else "CONFIGURED")
        api_key_prefix = WEATHER_API_KEY[:8] + "..." if WEATHER_API_KEY and len(WEATHER_API_KEY) > 8 else WEATHER_API_KEY
        
        logger.info(f"Weather API debug test - API Key Status: {api_key_status}")
        logger.info(f"API Key prefix: {api_key_prefix}")
        
        # Test weather function with multiple time scenarios
        current_weather = get_weather_forecast(test_lat, test_lon, current_time)
        future_weather = get_weather_forecast(test_lat, test_lon, future_time)
        far_future_weather = get_weather_forecast(test_lat, test_lon, far_future_time)
        
        # Also test the job flow with current time
        test_job_result = None
        try:
            # Create a mock job object for testing
            class MockJob:
                def __init__(self, arrival_time):
                    self.id = 'test'
                    self.address = '11 Berkshire Road, Camberley, Surrey'
                    self.location_lat = None
                    self.location_lng = None
                    self.arrival_time = arrival_time
            
            mock_job = MockJob(current_time)
            test_job_result = get_weather_for_job(mock_job)
            logger.info(f"Test job weather result: {test_job_result}")
        except Exception as e:
            test_job_result = {'error': str(e)}
            logger.error(f"Test job weather error: {str(e)}")
        
        return jsonify({
            'test_coordinates': {'lat': test_lat, 'lon': test_lon},
            'api_key_status': api_key_status,
            'api_key_prefix': api_key_prefix,
            'api_url': WEATHER_API_URL,
            'weather_tests': {
                'current_time': {
                    'time': current_time.strftime('%Y-%m-%d %H:%M:%S'),
                    'result': current_weather
                },
                'future_3days': {
                    'time': future_time.strftime('%Y-%m-%d %H:%M:%S'),
                    'result': future_weather
                },
                'far_future_6months': {
                    'time': far_future_time.strftime('%Y-%m-%d %H:%M:%S'),
                    'result': far_future_weather
                }
            },
            'job_flow_test': test_job_result,
            'forecast_limits': {
                'openweathermap_limit': '5 days maximum',
                'current_date': current_time.strftime('%Y-%m-%d'),
                'note': 'Jobs beyond 5 days will show seasonal recommendations'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Weather debug test error: {str(e)}")
        return jsonify({'error': f'Debug test failed: {str(e)}'}), 500

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
            'job_type', 'address', 'postcode', 'arrival_time', 
            'agents_required', 'hourly_rate', 'lead_agent_name', 
            'instructions', 'urgency_level', 'status'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(job, field, data[field])
        
        # Sync title with address if address is updated
        if 'address' in data and data['address']:
            job.title = data['address']
        
        # Update billing configuration if provided (admin only)
        if 'billing' in data and data['billing']:
            billing_data = data['billing']
            try:
                # Get or create billing config
                billing = JobBilling.query.filter_by(job_id=job_id).first()
                if not billing:
                    billing = JobBilling(job_id=job_id)
                    db.session.add(billing)
                
                # Update billing fields
                if 'agent_count' in billing_data:
                    billing.agent_count = billing_data['agent_count']
                if 'hourly_rate_net' in billing_data:
                    billing.hourly_rate_net = billing_data['hourly_rate_net']
                if 'first_hour_rate_net' in billing_data:
                    billing.first_hour_rate_net = billing_data['first_hour_rate_net']
                if 'notice_fee_net' in billing_data:
                    billing.notice_fee_net = billing_data['notice_fee_net']
                if 'vat_rate' in billing_data:
                    billing.vat_rate = billing_data['vat_rate']
                if 'billable_hours_override' in billing_data:
                    billing.billable_hours_override = billing_data['billable_hours_override']
                
                logger.info(f"Admin updated billing config for job {job_id}")
            except Exception as e:
                logger.error(f"Error updating job billing: {e}")
                # Don't fail the job update, just log the error
        
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

@jobs_bp.route('/jobs/<int:job_id>/complete', methods=['POST'])
@jwt_required()
def mark_job_complete(job_id):
    """Mark a job as completed."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            logger.warning(f"Access denied for job completion. User: {current_user_id}, Role: {current_user.role if current_user else 'None'}")
            return jsonify({'error': 'Access denied'}), 403
        
        job = Job.query.get(job_id)
        if not job:
            logger.warning(f"Job not found for completion: {job_id}")
            return jsonify({'error': 'Job not found'}), 404
        
        logger.info(f"Marking job {job_id} as complete by admin {current_user_id}")
        
        old_status = job.status
        job.status = 'completed'
        job.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"Job {job_id} status changed from '{old_status}' to 'completed'")
        
        # Return simple response to avoid to_dict() issues
        return jsonify({
            'success': True,
            'message': 'Job marked as complete',
            'job_id': job_id,
            'status': 'completed'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error marking job {job_id} complete: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to mark job as complete: {str(e)}'}), 500

@jobs_bp.route('/jobs/<int:job_id>', methods=['DELETE'])
@jwt_required()
def delete_job(job_id):
    """Delete a job (admin only)."""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(int(current_user_id))
        
        if not current_user or current_user.role != 'admin':
            logger.warning(f"Access denied for job deletion. User: {current_user_id}, Role: {current_user.role if current_user else 'None'}")
            return jsonify({'error': 'Access denied'}), 403
        
        job = Job.query.get(job_id)
        if not job:
            logger.warning(f"Job not found for deletion: {job_id}")
            return jsonify({'error': 'Job not found'}), 404
        
        logger.info(f"Deleting job {job_id} at {job.address} by admin {current_user_id}")
        
        # Delete related assignments first
        assignments_count = JobAssignment.query.filter_by(job_id=job_id).count()
        logger.info(f"Deleting {assignments_count} job assignments for job {job_id}")
        JobAssignment.query.filter_by(job_id=job_id).delete()
        
        # Delete related notifications
        from src.models.user import Notification
        notifications_count = Notification.query.filter_by(job_id=job_id).count()
        if notifications_count > 0:
            logger.info(f"Deleting {notifications_count} notifications for job {job_id}")
            Notification.query.filter_by(job_id=job_id).delete()
        
        # Delete related invoice jobs
        from src.models.user import InvoiceJob
        invoice_jobs_count = InvoiceJob.query.filter_by(job_id=job_id).count()
        if invoice_jobs_count > 0:
            logger.info(f"Deleting {invoice_jobs_count} invoice job entries for job {job_id}")
            InvoiceJob.query.filter_by(job_id=job_id).delete()
        
        # Delete the job
        db.session.delete(job)
        db.session.commit()
        
        logger.info(f"Successfully deleted job {job_id}")
        
        return jsonify({
            'success': True,
            'message': 'Job deleted successfully',
            'job_id': job_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting job {job_id}: {str(e)}", exc_info=True)
        return jsonify({'error': f'Failed to delete job: {str(e)}'}), 500

@jobs_bp.route('/jobs', methods=['POST'])
@jwt_required()
@validate_json_fields(['job_type', 'address', 'arrival_time', 'agents_required'])
def create_job():
    """Admin creates a new job, and the system assigns it to available agents."""
    try:
        print("[DEBUG] create_job function called")
        logger.error("[DEBUG] create_job function called")
        
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied. Admin role required.'}), 403

        data = request.get_json()
        print(f"[DEBUG] Job data received: {data.get('title', 'NO_TITLE')}")
        logger.error(f"[DEBUG] Job data received: {data.get('title', 'NO_TITLE')}")

        # Handle title - use address if title is missing or empty
        title = data.get('title', '').strip()
        if not title:
            title = data['address']

        # Create the job first
        new_job = Job(
            title=title,
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
            created_by=current_user.id,
            # Google Maps location fields
            location_lat=data.get('location_lat'),
            location_lng=data.get('location_lng'),
            maps_link=data.get('maps_link')
        )
        db.session.add(new_job)
        db.session.flush()  # Get the job ID without committing
        # Admin broadcast for job creation
        try:
            from src.services.telegram_notifications import _send_admin_group, _area_label, _format_dt
            _send_admin_group(
                (
                    "📝 <b>Job Created</b>\n\n"
                    f"<b>Job:</b> #{new_job.id} — {new_job.title or new_job.job_type}\n"
                    f"<b>When:</b> {_format_dt(new_job.arrival_time) if getattr(new_job,'arrival_time',None) else 'TBC'}\n"
                    f"<b>Area:</b> {_area_label(new_job)}\n"
                )
            )
        except Exception as _e:
            logger.warning(f"Admin broadcast (job created) failed: {_e}")

        # Find available agents for the job date
        job_date = new_job.arrival_time.date()
        day_of_week = job_date.weekday()  # 0 = Monday, 6 = Sunday
        
        print(f"[DEBUG] Looking for available agents for job date: {job_date} (day_of_week: {day_of_week})")
        logger.error(f"[DEBUG] Looking for available agents for job date: {job_date} (day_of_week: {day_of_week})")

        # Query ALL agents regardless of verification status (as per requirements)
        # This ensures push notifications reach ALL agents for job opportunities
        available_agents = db.session.query(User) \
            .outerjoin(AgentAvailability, and_(AgentAvailability.agent_id == User.id, AgentAvailability.date == job_date)) \
            .outerjoin(AgentWeeklyAvailability, AgentWeeklyAvailability.agent_id == User.id) \
            .filter(
                User.role == 'agent'
                # REMOVED VERIFICATION STATUS FILTER - notifications go to ALL agents
            ).all()
        
        # Filter by availability if we have availability data
        if available_agents:
            filtered_agents = []
            for agent in available_agents:
                # Check if agent has specific availability for this date
                daily_avail = next((avail for avail in agent.availability if avail.date == job_date), None)
                
                if daily_avail:
                    # Use daily availability
                    if daily_avail.is_available and not daily_avail.is_away:
                        filtered_agents.append(agent)
                else:
                    # Fallback to weekly schedule if available
                    if agent.weekly_availability:
                        weekly_avail = agent.weekly_availability
                        day_available = False
                        
                        if day_of_week == 0 and weekly_avail.monday:
                            day_available = True
                        elif day_of_week == 1 and weekly_avail.tuesday:
                            day_available = True
                        elif day_of_week == 2 and weekly_avail.wednesday:
                            day_available = True
                        elif day_of_week == 3 and weekly_avail.thursday:
                            day_available = True
                        elif day_of_week == 4 and weekly_avail.friday:
                            day_available = True
                        elif day_of_week == 5 and weekly_avail.saturday:
                            day_available = True
                        elif day_of_week == 6 and weekly_avail.sunday:
                            day_available = True
                        
                        if day_available:
                            filtered_agents.append(agent)
                    else:
                        # No availability data - include agent for notification
                        filtered_agents.append(agent)
            
            available_agents = filtered_agents

        print(f"[DEBUG] Found {len(available_agents)} available agents: {[agent.id for agent in available_agents]}")
        logger.error(f"[DEBUG] Found {len(available_agents)} available agents: {[agent.id for agent in available_agents]}")

        if not available_agents:
            print("[DEBUG] No available agents found for the job date - returning early without creating notifications")
            logger.error("[DEBUG] No available agents found for the job date - returning early without creating notifications")
            db.session.commit()
            return jsonify({
                'message': 'Job created, but no available agents found for that date.',
                'job': new_job.to_dict(),
                'available_agents': 0
            }), 201

        # Create job assignments for available agents
        assigned_agent_ids = []
        print(f"[DEBUG] Creating job assignments for {len(available_agents)} available agents")
        logger.error(f"[DEBUG] Creating job assignments for {len(available_agents)} available agents")
        
        for agent in available_agents:
            print(f"[DEBUG] Processing agent {agent.id} for job assignment")
            logger.error(f"[DEBUG] Processing agent {agent.id} for job assignment")
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
                print(f"[DEBUG] Created job assignment for agent {agent.id}")
                logger.error(f"[DEBUG] Created job assignment for agent {agent.id}")
            else:
                print(f"[DEBUG] Assignment already exists for agent {agent.id}, skipping")
                logger.error(f"[DEBUG] Assignment already exists for agent {agent.id}, skipping")
        
        print(f"[DEBUG] Total assigned agent IDs: {assigned_agent_ids}")
        logger.error(f"[DEBUG] Total assigned agent IDs: {assigned_agent_ids}")

        # Create daily records for these agents if fallback was used
        if available_agents:
            for agent in available_agents:
                daily_avail = AgentAvailability(
                    agent_id=agent.id,
                    date=job_date,
                    is_available=True,
                    is_away=False
                )
                db.session.add(daily_avail)

        # Create notifications for assigned agents
        if assigned_agent_ids:
            print(f"[DEBUG] Creating notifications for {len(assigned_agent_ids)} assigned agents: {assigned_agent_ids}")
            logger.error(f"[DEBUG] Creating notifications for {len(assigned_agent_ids)} assigned agents: {assigned_agent_ids}")
            notification_title = "New Job Available"
            notification_message = f"A new job at '{new_job.address}' is available for your response."
            
            # Include Google Maps link in notification if available
            if new_job.maps_link:
                notification_message += f"\n\nNavigation: {new_job.maps_link}"
            
            # Create database notification records for each assigned agent
            notifications_created = 0
            for agent_id in assigned_agent_ids:
                try:
                    print(f"[DEBUG] Creating notification for agent {agent_id} for job {new_job.id}")
                    logger.error(f"[DEBUG] Creating notification for agent {agent_id} for job {new_job.id}")
                    notification = Notification(
                        user_id=agent_id,
                        title=notification_title,
                        message=notification_message,
                        type='job_assignment',
                        job_id=new_job.id
                    )
                    db.session.add(notification)
                    notifications_created += 1
                    print(f"[DEBUG] Successfully added notification to session for agent {agent_id}")
                    logger.error(f"[DEBUG] Successfully added notification to session for agent {agent_id}")
                except Exception as e:
                    print(f"[DEBUG] Failed to create notification for agent {agent_id}: {str(e)}")
                    logger.error(f"[DEBUG] Failed to create notification for agent {agent_id}: {str(e)}")
            
            print(f"[DEBUG] Created {notifications_created} notifications, about to commit to database")
            logger.error(f"[DEBUG] Created {notifications_created} notifications, about to commit to database")
            
            # Send push notifications
            try:
                trigger_push_notification_for_users(assigned_agent_ids, notification_title, notification_message)
            except Exception as e:
                logger.warning(f"Failed to send push notifications: {str(e)}")
            
            # Send Telegram notifications to all assigned agents
            try:
                from src.services.notifications import notify_job_assignment
                # Prepare comprehensive job data for notification
                job_notification_data = {
                    'title': new_job.title,
                    'job_type': new_job.job_type,
                    'address': new_job.address,
                    'postcode': new_job.postcode,
                    'arrival_time': new_job.arrival_time.strftime('%Y-%m-%d %H:%M'),
                    'agents_required': new_job.agents_required,
                    'hourly_rate': float(new_job.hourly_rate) if new_job.hourly_rate else None,
                    'instructions': new_job.instructions,
                    'urgency_level': new_job.urgency_level,
                    'lead_agent_name': new_job.lead_agent_name,
                    'number_of_dwellings': new_job.number_of_dwellings,
                    'police_liaison_required': new_job.police_liaison_required,
                    'what3words_address': new_job.what3words_address,
                    'location_lat': new_job.location_lat,
                    'location_lng': new_job.location_lng,
                    'maps_link': new_job.maps_link
                }
                
                for agent_id in assigned_agent_ids:
                    notify_job_assignment(agent_id=agent_id, job_data=job_notification_data)
                    
                logger.info(f"Comprehensive Telegram notifications sent to {len(assigned_agent_ids)} agents for new job")
            except Exception as e:
                logger.warning(f"Failed to send Telegram notifications: {str(e)}")
        else:
            logger.warning("No assigned agent IDs found, skipping notification creation")

        # Create billing configuration if provided (admin only)
        if 'billing' in data and data['billing']:
            billing_data = data['billing']
            try:
                job_billing = JobBilling(
                    job_id=new_job.id,
                    agent_count=billing_data.get('agent_count'),
                    hourly_rate_net=billing_data['hourly_rate_net'],
                    first_hour_rate_net=billing_data.get('first_hour_rate_net'),
                    notice_fee_net=billing_data.get('notice_fee_net'),
                    vat_rate=billing_data.get('vat_rate', 0.20),
                    billable_hours_override=billing_data.get('billable_hours_override')
                )
                db.session.add(job_billing)
                print(f"[DEBUG] Created billing config for job {new_job.id}")
                logger.info(f"Admin created billing config for job {new_job.id}")
            except Exception as e:
                logger.error(f"Error creating job billing: {e}")
                # Don't fail the job creation, just log the error
        
        try:
            print("[DEBUG] Attempting to commit job creation and notifications to database")
            logger.error("[DEBUG] Attempting to commit job creation and notifications to database")
            db.session.commit()
            print("[DEBUG] Successfully committed to database")
            logger.error("[DEBUG] Successfully committed to database")
            
            # Verify notifications were actually saved
            if assigned_agent_ids:
                saved_notifications = Notification.query.filter_by(job_id=new_job.id).count()
                print(f"[DEBUG] Verification: Found {saved_notifications} notifications in database for job {new_job.id}")
                logger.error(f"[DEBUG] Verification: Found {saved_notifications} notifications in database for job {new_job.id}")
        except Exception as e:
            print(f"[DEBUG] Database commit failed: {str(e)}")
            logger.error(f"[DEBUG] Database commit failed: {str(e)}")
            db.session.rollback()
            raise

        # Send Telegram notifications to all assigned agents
        try:
            from src.services.notifications import notify_job_assignment
            # Prepare comprehensive job data for notification
            job_notification_data = {
                'title': new_job.title,
                'job_type': new_job.job_type,
                'address': new_job.address,
                'postcode': new_job.postcode,
                'arrival_time': new_job.arrival_time.strftime('%Y-%m-%d %H:%M'),
                'agents_required': new_job.agents_required,
                'hourly_rate': float(new_job.hourly_rate) if new_job.hourly_rate else None,
                'instructions': new_job.instructions,
                'urgency_level': new_job.urgency_level,
                'lead_agent_name': new_job.lead_agent_name,
                'police_liaison_required': new_job.police_liaison_required,
                'maps_link': new_job.maps_link,
                'location_lat': new_job.location_lat,
                'location_lng': new_job.location_lng
            }
            
            for agent_id in assigned_agent_ids:
                try:
                    notify_job_assignment(agent_id, job_notification_data)
                except Exception as e:
                    logger.warning(f"Failed to send Telegram notification to agent {agent_id}: {str(e)}")
        except Exception as e:
            logger.warning(f"Failed to send Telegram notifications: {str(e)}")

        # Log successful job creation
        logger.info(f"Job at '{new_job.address}' created by admin {current_user.id} and assigned to {len(assigned_agent_ids)} agents")

        return jsonify({
            'message': f'Job created successfully and assigned to {len(assigned_agent_ids)} available agents.',
            'job': new_job.to_dict(),
            'assigned_agents': len(assigned_agent_ids),
            'available_agents': len(available_agents)
        }), 201

    except ValueError as ve:
        db.session.rollback()
        logger.error(f"ValueError creating job: {str(ve)}")
        return jsonify({'error': f'Invalid data format: {ve}'}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating job: {str(e)}")
        return jsonify({'error': 'Failed to create job'}), 500

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
            
            # Admin: notify acceptance
            try:
                agent_name = f"{current_user.first_name} {current_user.last_name}".strip()
                area = _area_label(job) if '_area_label' in globals() else (job.postcode or job.city or job.town or 'Area')
                sent_ok = _send_admin_group(
                    (
                        "✅ <b>Agent Accepted</b>\n\n"
                        f"<b>Job:</b> #{job.id} — {job.title or job.job_type}\n"
                        f"<b>When:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
                        f"<b>Area:</b> {area}\n"
                        f"<b>Agent:</b> {agent_name}"
                    )
                )
                if sent_ok:
                    logger.info(f"Admin acceptance notify sent for job {job.id} to group")
                else:
                    logger.warning(f"Admin acceptance notify returned False for job {job.id}")
            except Exception as _e:
                logger.warning(f"Admin acceptance notify failed: {_e}")

            if accepted_count >= job.agents_required:
                job.status = 'filled'
                # Admin: notify job filled with agent list
                try:
                    accepted = JobAssignment.query.filter_by(job_id=job.id, status='accepted').all()
                    names = []
                    for a in accepted:
                        try:
                            u = User.query.get(a.agent_id)
                            if u:
                                names.append(f"{u.first_name} {u.last_name}".strip())
                        except Exception:
                            continue
                    agents_list = "\n".join([f"• {n}" for n in names]) if names else "(names unavailable)"
                    area = _area_label(job) if '_area_label' in globals() else (job.postcode or job.city or job.town or 'Area')
                    sent_ok = _send_admin_group(
                        (
                            "🎉 <b>Job Filled</b>\n\n"
                            f"<b>Job:</b> #{job.id} — {job.title or job.job_type}\n"
                            f"<b>When:</b> {_format_dt(job.arrival_time) if getattr(job,'arrival_time',None) else 'TBC'}\n"
                            f"<b>Area:</b> {area}\n"
                            f"<b>Agents ({len(names)}):</b>\n{agents_list}"
                        )
                    )
                    if sent_ok:
                        logger.info(f"Admin filled notify sent for job {job.id} with {len(names)} agents")
                    else:
                        logger.warning(f"Admin filled notify returned False for job {job.id}")
                except Exception as _e:
                    logger.warning(f"Admin filled notify failed: {_e}")
            
            # Create draft invoice for the agent
            try:
                # Generate unique invoice number
                from datetime import date
                today = date.today()
                year_month = today.strftime('%Y%m')
                
                # Get the last invoice number for this month
                last_invoice = Invoice.query.filter(
                    Invoice.invoice_number.like(f'INV-{year_month}-%')
                ).order_by(Invoice.invoice_number.desc()).first()
                
                if last_invoice:
                    # Extract the sequence number and increment
                    last_seq = int(last_invoice.invoice_number.split('-')[-1])
                    new_seq = last_seq + 1
                else:
                    new_seq = 1
                
                invoice_number = f'INV-{year_month}-{new_seq:04d}'
                
                # Calculate due date (30 days from today)
                due_date = today + timedelta(days=30)
                
                # Create draft invoice
                draft_invoice = Invoice(
                    agent_id=current_user.id,
                    invoice_number=invoice_number,
                    issue_date=today,
                    due_date=due_date,
                    total_amount=0.0,  # Will be calculated when finalized
                    status='draft'
                )
                
                db.session.add(draft_invoice)
                db.session.flush()  # Get the invoice ID
                
                # Create InvoiceJob record linking the job to this invoice
                invoice_job = InvoiceJob(
                    invoice_id=draft_invoice.id,
                    job_id=job.id,
                    hours_worked=0.0,  # Will be filled when agent completes the job
                    hourly_rate_at_invoice=job.hourly_rate if job.hourly_rate else 0.0
                )
                
                db.session.add(invoice_job)
                
                logger.info(f"Created draft invoice {invoice_number} for agent {current_user.id} and job {job.id}")
                
            except Exception as e:
                logger.error(f"Failed to create draft invoice for agent {current_user.id} and job {job.id}: {str(e)}")
                # Don't fail the job acceptance if invoice creation fails
                pass
            
            # Send job acceptance notification via Telegram
            try:
                from src.services.notifications import notify_job_update
                notify_job_update(
                    current_user.id,
                    job.title or f"{job.job_type} at {job.address}",
                    f"✅ You have successfully accepted the job assignment.\n\nJob Details:\n- Type: {job.job_type}\n- Location: {job.address}\n- Time: {job.arrival_time.strftime('%H:%M on %d/%m/%y')}\n\nThank you for accepting this assignment!"
                )
            except Exception as e:
                logger.warning(f"Failed to send job acceptance notification to agent {current_user.id}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': f'Assignment {response}ed successfully',
            'assignment': assignment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error responding to assignment: {str(e)}")
        return jsonify({'error': 'Failed to respond to assignment'}), 500

@jobs_bp.route('/agent/jobs', methods=['GET'])
@jwt_required()
def get_agent_jobs():
    """Get jobs for the current agent with filtering capabilities."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or user.role != 'agent':
            return jsonify({'error': 'Access denied. Agent role required.'}), 403

        # Get query parameters
        status_filter = request.args.get('status')  # 'completed', 'done', etc.
        invoiced_filter = request.args.get('invoiced')  # 'true' or 'false'
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        per_page = min(per_page, 100)
        
        # Debug logging
        logger.info(f"DEBUG JOBS: Agent {current_user_id} requesting jobs - status: {status_filter}, invoiced: {invoiced_filter}")

        # Base query - jobs assigned to this agent
        base_query = db.session.query(Job).join(JobAssignment).filter(
            JobAssignment.agent_id == user.id,
            JobAssignment.status == 'accepted'
        )
        
        # Debug: log all accepted jobs for this agent
        all_accepted = base_query.all()
        logger.info(f"DEBUG JOBS: Agent {user.id} has {len(all_accepted)} accepted jobs")
        for job in all_accepted:
            logger.info(f"DEBUG JOBS: Job {job.id} - {job.address} - status: {job.status}")
        
        query = base_query

        # Apply status filtering - bypass for invoice creation when looking for uninvoiced jobs
        if not (invoiced_filter and invoiced_filter.lower() == 'false'):
            # Apply normal status filter for all cases except when looking for uninvoiced jobs
            if status_filter:
                if status_filter == 'completed':
                    query = query.filter(or_(Job.status == 'completed', Job.status == 'done'))
                else:
                    query = query.filter(Job.status == status_filter)
        else:
            logger.info(f"DEBUG JOBS: INVOICE MODE - Bypassing status filter for uninvoiced jobs, returning ALL accepted jobs")

        # Apply invoiced filter
        if invoiced_filter is not None:
            if invoiced_filter.lower() == 'false':
                # Jobs that haven't been invoiced yet
                invoiced_job_ids = db.session.query(InvoiceJob.job_id).join(Invoice).filter(
                    Invoice.agent_id == user.id
                ).subquery()
                query = query.filter(~Job.id.in_(db.session.query(invoiced_job_ids)))
            elif invoiced_filter.lower() == 'true':
                # Jobs that have been invoiced
                invoiced_job_ids = db.session.query(InvoiceJob.job_id).join(Invoice).filter(
                    Invoice.agent_id == user.id
                ).subquery()
                query = query.filter(Job.id.in_(db.session.query(invoiced_job_ids)))

        # Order by arrival time (most recent first)
        query = query.order_by(Job.arrival_time.desc())

        # Apply pagination
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Debug logging
        logger.info(f"DEBUG JOBS: Found {len(paginated.items)} jobs after filtering")
        for job in paginated.items:
            logger.info(f"DEBUG JOBS: Job {job.id} - {job.address} - status: {job.status} - arrival: {job.arrival_time}")
        
        jobs_list = []
        for job in paginated.items:
            job_dict = job.to_dict()
            jobs_list.append(job_dict)

        logger.info(f"DEBUG JOBS: Returning {len(jobs_list)} jobs")
        return jsonify(jobs_list), 200

    except Exception as e:
        logger.error(f"Error fetching agent jobs: {str(e)}")
        return jsonify({'error': 'Failed to fetch jobs'}), 500

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
    
@jobs_bp.route('/jobs/<int:id>', methods=['GET'])
@jwt_required()
def get_job_or_assignment(id):
    """Get job details, accepting either job ID or assignment ID."""
    user = require_agent_or_admin()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    # Try as job ID first
    job = Job.query.get(id)
    if job:
        if user.role == 'agent':
            assignment = JobAssignment.query.filter_by(job_id=id, agent_id=user.id).first()
            if not assignment:
                return jsonify({'error': 'Access denied'}), 403
        return jsonify(job.to_dict()), 200

    # Try as assignment ID
    assignment = JobAssignment.query.get(id)
    if not assignment:
        return jsonify({'error': 'Job not found'}), 404

    if user.role == 'agent' and assignment.agent_id != user.id:
        return jsonify({'error': 'Access denied'}), 403

    job = assignment.job
    return jsonify(job.to_dict()), 200

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
