from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from src.models.vehicle import VehicleSighting 
from src.models.vehicle_details import VehicleDetails
from src.extensions import db
from sqlalchemy import desc
import requests
import os
from datetime import datetime, timedelta

vehicles_bp = Blueprint('vehicles', __name__)

@vehicles_bp.route('/vehicles/<registration_plate>', methods=['GET'])
@jwt_required()
def get_vehicle_sightings(registration_plate):
    plate_upper = registration_plate.upper().strip()
    sightings = VehicleSighting.query.filter_by(registration_plate=plate_upper).order_by(desc(VehicleSighting.sighted_at)).all()
    if not sightings:
        return jsonify({'message': 'No sightings found for this registration plate.'}), 404
    
    # Return just the sightings for backward compatibility
    # Vehicle details will be fetched separately by frontend
    return jsonify([sighting.to_dict() for sighting in sightings]), 200

@vehicles_bp.route('/vehicles/sightings', methods=['POST'])
@jwt_required()
def add_sighting():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    required_fields = ['registration_plate', 'notes', 'is_dangerous', 'address_seen']
    if not all(field in data and data[field] is not None for field in required_fields):
        return jsonify({'error': 'Missing required fields.'}), 400
    if not data['address_seen'].strip():
         return jsonify({'error': 'Address or area seen cannot be empty.'}), 400

    new_sighting = VehicleSighting(
        registration_plate=data['registration_plate'].upper().strip(),
        notes=data['notes'],
        is_dangerous=data['is_dangerous'],
        address_seen=data['address_seen'],
        agent_id=current_user_id
    )
    db.session.add(new_sighting)
    db.session.commit()
    return jsonify(new_sighting.to_dict()), 201

@vehicles_bp.route('/vehicles/<registration_plate>/details', methods=['GET'])
@jwt_required()
def get_vehicle_details(registration_plate):
    """Get vehicle details for a specific registration plate"""
    plate_upper = registration_plate.upper().strip()
    vehicle_details = VehicleDetails.query.filter_by(registration_plate=plate_upper).first()
    
    if not vehicle_details:
        return jsonify({'message': 'No vehicle details found for this registration plate.'}), 404
    
    return jsonify(vehicle_details.to_dict()), 200

@vehicles_bp.route('/vehicles/<registration_plate>/details', methods=['PUT'])
@jwt_required()
def update_vehicle_details(registration_plate):
    """Update or create vehicle details for a specific registration plate"""
    try:
        data = request.get_json()
        plate_upper = registration_plate.upper().strip()
        
        # Validate input data
        if not data:
            return jsonify({'error': 'No data provided.'}), 400
        
        # Get existing vehicle details or create new
        vehicle_details = VehicleDetails.query.filter_by(registration_plate=plate_upper).first()
        
        if vehicle_details:
            # Update existing
            vehicle_details.make = data.get('make', '').strip() or None
            vehicle_details.model = data.get('model', '').strip() or None
            vehicle_details.colour = data.get('colour', '').strip() or None
            vehicle_details.updated_at = db.func.now()
        else:
            # Create new
            vehicle_details = VehicleDetails(
                registration_plate=plate_upper,
                make=data.get('make', '').strip() or None,
                model=data.get('model', '').strip() or None,
                colour=data.get('colour', '').strip() or None
            )
            db.session.add(vehicle_details)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Vehicle details saved successfully',
            'vehicle_details': vehicle_details.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to save vehicle details: {str(e)}'}), 500

@vehicles_bp.route('/vehicles/<registration_plate>/details', methods=['DELETE'])
@jwt_required()
def delete_vehicle_details(registration_plate):
    """Delete vehicle details for a specific registration plate"""
    try:
        plate_upper = registration_plate.upper().strip()
        vehicle_details = VehicleDetails.query.filter_by(registration_plate=plate_upper).first()
        
        if not vehicle_details:
            return jsonify({'message': 'No vehicle details found to delete.'}), 404
        
        db.session.delete(vehicle_details)
        db.session.commit()
        
        return jsonify({'message': 'Vehicle details deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete vehicle details: {str(e)}'}), 500

# DVLA Lookup cache - stores results for 24 hours to avoid repeated API calls
vehicle_lookup_cache = {}

@vehicles_bp.route('/vehicles/lookup/<registration_plate>', methods=['GET'])
@jwt_required()
def lookup_vehicle_dvla(registration_plate):
    """Lookup vehicle details using DVLA API - CORRECTED VERSION"""
    try:
        plate_upper = registration_plate.upper().strip()
        
        # Enhanced input validation
        if len(plate_upper) < 6 or len(plate_upper) > 8:
            current_app.logger.warning(f"[DVLA] Invalid plate format: {plate_upper}")
            return jsonify({
                'error': 'Invalid registration plate format',
                'message': 'Registration plate must be 6-8 characters',
                'registration_plate': plate_upper,
                'dvla_lookup': False
            }), 400
        
        # Get API key from environment with enhanced debugging
        api_key = os.getenv('DVLA_API_KEY')
        if not api_key:
            current_app.logger.error("DVLA_API_KEY not found in environment variables")
            current_app.logger.error(f"Available env vars: {list(os.environ.keys())}")
            return jsonify({
                'error': 'API not configured',
                'message': 'Vehicle lookup service not available',
                'dvla_lookup': False
            }), 503
        
        # Enhanced debugging
        current_app.logger.info(f"[DVLA] Looking up vehicle: {plate_upper}")
        current_app.logger.info(f"[DVLA] Using API key: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else 'SHORT'}")
        
        # DVLA API endpoint and corrected headers
        dvla_url = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"
        
        headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'V3-Services-Vehicle-Lookup/1.0'
        }
        
        # Request payload (DVLA specific format)
        payload = {
            'registrationNumber': plate_upper
        }
        
        current_app.logger.info(f"[DVLA] Request URL: {dvla_url}")
        current_app.logger.info(f"[DVLA] Request headers: {dict(headers)}")
        current_app.logger.info(f"[DVLA] Request payload: {payload}")
        
        # Make API request with enhanced error handling
        try:
            response = requests.post(
                dvla_url,
                headers=headers,
                json=payload,
                timeout=15,
                verify=True  # Ensure SSL verification
            )
            
            current_app.logger.info(f"[DVLA] Response status: {response.status_code}")
            current_app.logger.info(f"[DVLA] Response headers: {dict(response.headers)}")
            
            if response.status_code == 200:
                try:
                    data = response.json()
                    current_app.logger.info(f"[DVLA] Response data: {data}")
                    
                    # Enhanced model field extraction with multiple strategies
                    make_value = str(data.get('make', '')).strip()
                    model_value = None
                    
                    # Enhanced logging for model field debugging
                    current_app.logger.info(f"[DVLA DEBUG] Raw make field: '{data.get('make', 'NOT_FOUND')}'")
                    current_app.logger.info(f"[DVLA DEBUG] Raw model field: '{data.get('model', 'NOT_FOUND')}'")
                    current_app.logger.info(f"[DVLA DEBUG] Model field exists: {'model' in data}")
                    current_app.logger.info(f"[DVLA DEBUG] Model field type: {type(data.get('model', None))}")
                    current_app.logger.info(f"[DVLA DEBUG] Model field is None: {data.get('model') is None}")
                    current_app.logger.info(f"[DVLA DEBUG] Model field is empty string: {data.get('model') == ''}")
                    current_app.logger.info(f"[DVLA DEBUG] All DVLA fields: {list(data.keys())}")
                    
                    # Log raw values for debugging
                    print(f"\n[SIMPLE DEBUG] DVLA Raw Response for {plate_upper}:")
                    print(f"  make: '{data.get('make', 'MISSING')}'")
                    print(f"  model: '{data.get('model', 'MISSING')}'")
                    print(f"  colour: '{data.get('colour', 'MISSING')}'")
                    print(f"  All fields: {list(data.keys())}")
                    print(f"  Full response: {json.dumps(data, indent=2)}\n")
                    
                    # Strategy 1: Direct 'model' field
                    if 'model' in data and data['model'] is not None:
                        model_candidate = str(data['model']).strip()
                        if model_candidate:
                            model_value = model_candidate
                            current_app.logger.info(f"[DVLA] Model extracted from 'model' field: '{model_value}'")
                    
                    # Strategy 2: Check for alternative field names
                    if not model_value:
                        alternative_fields = ['vehicleModel', 'makeModel', 'description', 'bodyType']
                        for field_name in alternative_fields:
                            if field_name in data and data[field_name]:
                                candidate = str(data[field_name]).strip()
                                if candidate:
                                    model_value = candidate
                                    current_app.logger.info(f"[DVLA] Model extracted from '{field_name}' field: '{model_value}'")
                                    break
                    
                    # Strategy 3: Extract from combined make/model field
                    if not model_value and 'makeModel' in data:
                        make_model = str(data['makeModel']).strip()
                        if make_model and make_value and make_model.upper().startswith(make_value.upper()):
                            model_candidate = make_model[len(make_value):].strip()
                            if model_candidate:
                                model_value = model_candidate
                                current_app.logger.info(f"[DVLA] Model extracted from combined field: '{model_value}'")
                    
                    # Final fallback - use empty string (don't default to "Unknown Model")
                    if not model_value:
                        model_value = ""
                        current_app.logger.warning(f"[DVLA] No model field found for {plate_upper}, using empty string")
                    
                    # Extract ALL available DVLA data fields
                    vehicle_details = {
                        # Registration
                        'registration_plate': plate_upper,
                        
                        # Basic Vehicle Information - Enhanced
                        'make': make_value,
                        'model': model_value,  # Use our enhanced model extraction
                        'colour': str(data.get('colour', '')).strip(),
                        'year_of_manufacture': data.get('yearOfManufacture'),
                        
                        # Engine & Fuel
                        'engine_capacity': data.get('engineCapacity'),
                        'fuel_type': data.get('fuelType', '').strip(),
                        'co2_emissions': data.get('co2Emissions'),
                        'euro_status': data.get('euroStatus', '').strip(),
                        'real_driving_emissions': data.get('realDrivingEmissions', '').strip(),
                        
                        # Legal Status
                        'tax_status': data.get('taxStatus', '').strip(),
                        'tax_due_date': data.get('taxDueDate', '').strip(),
                        'mot_status': data.get('motStatus', '').strip(),
                        'mot_expiry_date': data.get('motExpiryDate', '').strip(),
                        
                        # Technical Details
                        'wheelplan': data.get('wheelplan', '').strip(),
                        'type_approval': data.get('typeApproval', '').strip(),
                        'revenue_weight': data.get('revenueWeight'),
                        
                        # Administrative
                        'date_of_last_v5c_issued': data.get('dateOfLastV5CIssued', '').strip(),
                        'marked_for_export': data.get('markedForExport', False),
                        
                        # Metadata
                        'dvla_lookup': True,
                        'lookup_timestamp': datetime.utcnow().isoformat()
                    }
                    
                    current_app.logger.info(f"[DVLA] Processed vehicle details: {vehicle_details}")
                    return jsonify(vehicle_details), 200
                    
                except Exception as json_error:
                    current_app.logger.error(f"[DVLA] JSON decode error: {json_error}")
                    current_app.logger.error(f"[DVLA] Raw response: {response.text}")
                    return jsonify({
                        'error': 'Invalid API response',
                        'message': 'Received invalid data from DVLA',
                        'registration_plate': plate_upper,
                        'dvla_lookup': False
                    }), 502
                    
            elif response.status_code == 404:
                current_app.logger.info(f"[DVLA] Vehicle not found: {plate_upper}")
                return jsonify({
                    'error': 'Vehicle not found',
                    'message': f'No vehicle found with registration {plate_upper}',
                    'registration_plate': plate_upper,
                    'dvla_lookup': False
                }), 404
                
            elif response.status_code == 400:
                current_app.logger.error(f"[DVLA] Bad request: {response.text}")
                return jsonify({
                    'error': 'Invalid request',
                    'message': 'Invalid registration plate format',
                    'registration_plate': plate_upper,
                    'dvla_lookup': False
                }), 400
                
            elif response.status_code == 401:
                current_app.logger.error(f"[DVLA] Unauthorized: {response.text}")
                return jsonify({
                    'error': 'Authentication failed',
                    'message': 'Invalid API key or access denied',
                    'registration_plate': plate_upper,
                    'dvla_lookup': False
                }), 401
                
            elif response.status_code == 429:
                current_app.logger.error(f"[DVLA] Rate limited: {response.text}")
                return jsonify({
                    'error': 'Rate limited',
                    'message': 'Too many requests to DVLA API',
                    'registration_plate': plate_upper,
                    'dvla_lookup': False
                }), 429
                
            else:
                current_app.logger.error(f"[DVLA] API Error {response.status_code}: {response.text}")
                return jsonify({
                    'error': f'DVLA API error {response.status_code}',
                    'message': 'Vehicle lookup service temporarily unavailable',
                    'registration_plate': plate_upper,
                    'dvla_lookup': False
                }), 502
                
        except requests.exceptions.Timeout:
            current_app.logger.error("[DVLA] Request timed out")
            return jsonify({
                'error': 'Request timeout',
                'message': 'Vehicle lookup service is currently slow',
                'registration_plate': plate_upper,
                'dvla_lookup': False
            }), 408
            
        except requests.exceptions.ConnectionError as conn_error:
            current_app.logger.error(f"[DVLA] Connection error: {conn_error}")
            return jsonify({
                'error': 'Connection error',
                'message': 'Unable to connect to DVLA service',
                'registration_plate': plate_upper,
                'dvla_lookup': False
            }), 503
            
        except requests.exceptions.RequestException as req_error:
            current_app.logger.error(f"[DVLA] Request error: {req_error}")
            return jsonify({
                'error': 'Network error',
                'message': 'Unable to connect to vehicle lookup service',
                'registration_plate': plate_upper,
                'dvla_lookup': False
            }), 503
            
    except Exception as e:
        current_app.logger.error(f"[DVLA] Unexpected error: {str(e)}")
        current_app.logger.error(f"[DVLA] Error type: {type(e)}")
        import traceback
        current_app.logger.error(f"[DVLA] Traceback: {traceback.format_exc()}")
        return jsonify({
            'error': 'Lookup failed',
            'message': 'An unexpected error occurred during vehicle lookup',
            'registration_plate': plate_upper,
            'dvla_lookup': False
        }), 500

@vehicles_bp.route('/vehicles/lookup-cached/<registration_plate>', methods=['GET'])
@jwt_required()
def lookup_vehicle_cached(registration_plate):
    """Lookup vehicle with caching to avoid repeated API calls"""
    plate_upper = registration_plate.upper().strip()
    
    # Check cache first (cache for 24 hours)
    if plate_upper in vehicle_lookup_cache:
        cached_data = vehicle_lookup_cache[plate_upper]
        try:
            cache_time = datetime.fromisoformat(cached_data.get('lookup_timestamp', ''))
            
            # If cached data is less than 24 hours old, return it
            if (datetime.utcnow() - cache_time).total_seconds() < 86400:  # 24 hours in seconds
                current_app.logger.info(f"[DVLA] Returning cached data for {plate_upper}")
                return jsonify(cached_data), 200
        except Exception as cache_error:
            current_app.logger.warning(f"[DVLA] Cache error for {plate_upper}: {cache_error}")
            # Continue to fresh lookup if cache is corrupted
    
    # Not in cache or expired, lookup from DVLA
    try:
        response_data, status_code = lookup_vehicle_dvla(plate_upper)
        response_json = response_data.get_json() if hasattr(response_data, 'get_json') else response_data
        
        # Cache successful responses
        if status_code == 200 and response_json.get('dvla_lookup'):
            vehicle_lookup_cache[plate_upper] = response_json
            current_app.logger.info(f"[DVLA] Cached response for {plate_upper}")
        
        return jsonify(response_json), status_code
        
    except Exception as e:
        current_app.logger.error(f"[DVLA] Error in cached lookup: {str(e)}")
        return lookup_vehicle_dvla(plate_upper)

@vehicles_bp.route('/vehicles/debug-response/<registration_plate>', methods=['GET'])
@jwt_required()
def debug_dvla_response(registration_plate):
    """Debug endpoint to see exactly what DVLA returns - Model Field Debugging"""
    try:
        plate_upper = registration_plate.upper().strip()
        api_key = os.getenv('DVLA_API_KEY')
        
        if not api_key:
            return jsonify({'error': 'API key not configured'}), 503
        
        dvla_url = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"
        headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'V3-Services-Vehicle-Lookup/1.0'
        }
        payload = {'registrationNumber': plate_upper}
        
        current_app.logger.info(f"[DVLA Debug] Looking up: {plate_upper}")
        
        response = requests.post(dvla_url, headers=headers, json=payload, timeout=15)
        
        if response.status_code == 200:
            raw_data = response.json()
            
            # Comprehensive model field analysis
            model_analysis = {
                'model_field_value': raw_data.get('model', 'NOT_FOUND'),
                'model_field_exists': 'model' in raw_data,
                'model_field_type': type(raw_data.get('model', None)).__name__,
                'model_field_length': len(str(raw_data.get('model', ''))) if raw_data.get('model') else 0,
                'model_is_empty': not bool(raw_data.get('model', '').strip()) if raw_data.get('model') else True,
                'model_is_none': raw_data.get('model') is None,
                'model_is_string': isinstance(raw_data.get('model'), str)
            }
            
            # Check for alternative model field names
            alternative_fields = {}
            for field_name in ['vehicleModel', 'makeModel', 'description', 'bodyType', 'typeDescription']:
                if field_name in raw_data:
                    alternative_fields[field_name] = raw_data[field_name]
            
            return jsonify({
                'success': True,
                'registration_plate': plate_upper,
                'timestamp': datetime.utcnow().isoformat(),
                'raw_dvla_response': raw_data,
                'all_fields': list(raw_data.keys()),
                'field_count': len(raw_data.keys()),
                
                # Key field analysis
                'make_field_value': raw_data.get('make', 'NOT_FOUND'),
                'model_analysis': model_analysis,
                'colour_field_value': raw_data.get('colour', 'NOT_FOUND'),
                
                # Alternative field search
                'alternative_model_fields': alternative_fields,
                'has_alternative_fields': bool(alternative_fields),
                
                # Debug recommendations
                'debug_recommendations': [
                    f"Model field exists: {'YES' if model_analysis['model_field_exists'] else 'NO'}",
                    f"Model field has value: {'YES' if not model_analysis['model_is_empty'] else 'NO'}",
                    f"Alternative fields found: {list(alternative_fields.keys()) if alternative_fields else 'NONE'}",
                    f"Field count: {len(raw_data.keys())} total fields available"
                ]
            }), 200
        else:
            return jsonify({
                'success': False,
                'registration_plate': plate_upper,
                'status_code': response.status_code,
                'error_response': response.text,
                'error_message': f'DVLA API returned status {response.status_code}'
            }), response.status_code
            
    except Exception as e:
        current_app.logger.error(f"[DVLA Debug] Exception: {str(e)}")
        return jsonify({
            'error': str(e),
            'registration_plate': registration_plate,
            'endpoint': 'debug_dvla_response'
        }), 500

@vehicles_bp.route('/vehicles/raw-dvla/<registration_plate>', methods=['GET'])
@jwt_required()
def raw_dvla_debug(registration_plate):
    """Show exactly what DVLA returns - no processing"""
    try:
        plate_upper = registration_plate.upper().strip()
        api_key = os.getenv('DVLA_API_KEY')
        
        if not api_key:
            return jsonify({'error': 'API key not configured'}), 503
        
        # Direct DVLA API call
        dvla_url = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"
        headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'V3-Services-Vehicle-Lookup/1.0'
        }
        payload = {'registrationNumber': plate_upper}
        
        current_app.logger.info(f"[RAW DVLA DEBUG] Looking up: {plate_upper}")
        
        response = requests.post(dvla_url, headers=headers, json=payload, timeout=15)
        
        if response.status_code == 200:
            raw_data = response.json()
            
            # Return EVERYTHING exactly as DVLA sends it
            return jsonify({
                'plate': plate_upper,
                'dvla_raw_response': raw_data,
                'status': 'success',
                'timestamp': datetime.utcnow().isoformat(),
                
                # Quick field check
                'make_field': raw_data.get('make', 'MISSING'),
                'model_field': raw_data.get('model', 'MISSING'), 
                'colour_field': raw_data.get('colour', 'MISSING'),
                
                # Show ALL field names DVLA returns
                'all_fields_returned': list(raw_data.keys()),
                'field_count': len(raw_data.keys()),
                
                # Field existence check
                'has_make': 'make' in raw_data,
                'has_model': 'model' in raw_data,
                'has_colour': 'colour' in raw_data,
                
                # Check for alternative model fields
                'alternative_model_fields': {
                    field: raw_data.get(field, 'NOT_FOUND') 
                    for field in ['vehicleModel', 'genericDescription', 'bodyType', 'vehicleDescription', 'makeModel']
                    if field in raw_data
                },
                
                # Debug summary
                'debug_summary': {
                    'total_fields': len(raw_data.keys()),
                    'has_standard_fields': all(field in raw_data for field in ['make', 'colour']),
                    'model_field_status': 'FOUND' if 'model' in raw_data and raw_data.get('model') else 'MISSING_OR_EMPTY',
                    'response_size_kb': len(str(raw_data)) / 1024
                }
            }), 200
        else:
            return jsonify({
                'plate': plate_upper,
                'status': 'error',
                'error': f'DVLA returned {response.status_code}',
                'response_text': response.text,
                'timestamp': datetime.utcnow().isoformat()
            }), response.status_code
            
    except Exception as e:
        current_app.logger.error(f"[RAW DVLA DEBUG] Exception: {str(e)}")
        return jsonify({
            'plate': registration_plate,
            'status': 'exception',
            'error': str(e),
            'endpoint': 'raw_dvla_debug'
        }), 500

@vehicles_bp.route('/vehicles/test-dvla', methods=['GET'])
@jwt_required()
def test_dvla_configuration():
    """Test DVLA API configuration and connectivity"""
    try:
        # Check API key availability
        api_key = os.getenv('DVLA_API_KEY')
        if not api_key:
            current_app.logger.error("[DVLA Test] DVLA_API_KEY not found in environment")
            return jsonify({
                'status': 'failed',
                'error': 'API key not configured',
                'message': 'DVLA_API_KEY environment variable not found',
                'test_results': {
                    'api_key_present': False,
                    'connectivity': 'not_tested',
                    'authentication': 'not_tested'
                }
            }), 503
        
        current_app.logger.info(f"[DVLA Test] Testing API configuration with key: {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else 'SHORT'}")
        
        # DVLA API endpoint
        dvla_url = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"
        
        headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'User-Agent': 'V3-Services-Vehicle-Lookup/1.0'
        }
        
        # Test with a known invalid plate to check API connectivity and authentication
        # This should return a 400 or similar but confirm the API is working
        test_payload = {
            'registrationNumber': 'TEST123'  # Invalid format to test API response
        }
        
        current_app.logger.info(f"[DVLA Test] Making test request to: {dvla_url}")
        
        try:
            response = requests.post(
                dvla_url,
                headers=headers,
                json=test_payload,
                timeout=10,
                verify=True
            )
            
            current_app.logger.info(f"[DVLA Test] Response status: {response.status_code}")
            current_app.logger.info(f"[DVLA Test] Response headers: {dict(response.headers)}")
            current_app.logger.info(f"[DVLA Test] Response body: {response.text}")
            
            # Analyze response
            test_results = {
                'api_key_present': True,
                'connectivity': 'success',
                'authentication': 'unknown',
                'api_response_code': response.status_code,
                'api_response_body': response.text,
                'endpoint_url': dvla_url
            }
            
            if response.status_code == 400:
                # Expected response for invalid plate - API is working
                test_results['authentication'] = 'success'
                status_message = 'API configuration valid - endpoint accessible'
            elif response.status_code == 401:
                # Unauthorized - API key issue
                test_results['authentication'] = 'failed'
                status_message = 'API key authentication failed'
            elif response.status_code == 200:
                # Unexpected success for invalid plate
                test_results['authentication'] = 'success'
                status_message = 'API configuration valid - unexpected success response'
            else:
                # Other response codes
                test_results['authentication'] = 'unknown'
                status_message = f'API returned status {response.status_code}'
            
            return jsonify({
                'status': 'completed',
                'message': status_message,
                'test_results': test_results,
                'recommendations': {
                    'api_status': 'API endpoint is accessible' if response.status_code != 401 else 'Check API key validity',
                    'next_steps': 'Test with valid registration plate' if response.status_code == 400 else 'Review API response'
                }
            }), 200
            
        except requests.exceptions.Timeout:
            current_app.logger.error("[DVLA Test] Request timed out")
            return jsonify({
                'status': 'failed',
                'error': 'Request timeout',
                'message': 'DVLA API did not respond within timeout period',
                'test_results': {
                    'api_key_present': True,
                    'connectivity': 'timeout',
                    'authentication': 'not_tested'
                }
            }), 408
            
        except requests.exceptions.ConnectionError as conn_error:
            current_app.logger.error(f"[DVLA Test] Connection error: {conn_error}")
            return jsonify({
                'status': 'failed',
                'error': 'Connection error',
                'message': 'Unable to connect to DVLA API endpoint',
                'test_results': {
                    'api_key_present': True,
                    'connectivity': 'failed',
                    'authentication': 'not_tested',
                    'error_details': str(conn_error)
                }
            }), 503
            
        except requests.exceptions.RequestException as req_error:
            current_app.logger.error(f"[DVLA Test] Request error: {req_error}")
            return jsonify({
                'status': 'failed',
                'error': 'Network error',
                'message': 'Request to DVLA API failed',
                'test_results': {
                    'api_key_present': True,
                    'connectivity': 'error',
                    'authentication': 'not_tested',
                    'error_details': str(req_error)
                }
            }), 503
            
    except Exception as e:
        current_app.logger.error(f"[DVLA Test] Unexpected error: {str(e)}")
        import traceback
        current_app.logger.error(f"[DVLA Test] Traceback: {traceback.format_exc()}")
        return jsonify({
            'status': 'failed',
            'error': 'Test failed',
            'message': 'An unexpected error occurred during API test',
            'test_results': {
                'api_key_present': bool(os.getenv('DVLA_API_KEY')),
                'connectivity': 'error',
                'authentication': 'not_tested',
                'error_details': str(e)
            }
        }), 500