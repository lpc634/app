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
    """Lookup vehicle details using DVLA API"""
    try:
        plate_upper = registration_plate.upper().strip()
        
        # DVLA API endpoint
        dvla_url = "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles"
        
        # Get API key from environment
        api_key = os.getenv('DVLA_API_KEY')
        if not api_key:
            current_app.logger.error("DVLA_API_KEY not found in environment variables")
            return jsonify({
                'error': 'API configuration error',
                'message': 'Vehicle lookup service is not configured',
                'dvla_lookup': False
            }), 500
        
        # API headers
        headers = {
            'x-api-key': api_key,
            'Content-Type': 'application/json'
        }
        
        # Request payload
        payload = {
            'registrationNumber': plate_upper
        }
        
        current_app.logger.info(f"[DVLA] Looking up vehicle: {plate_upper}")
        
        # Make API request to DVLA
        response = requests.post(
            dvla_url,
            headers=headers,
            json=payload,
            timeout=10
        )
        
        current_app.logger.info(f"[DVLA] Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            current_app.logger.info(f"[DVLA] Response data keys: {list(data.keys())}")
            
            # Extract vehicle details
            vehicle_details = {
                'registration_plate': plate_upper,
                'make': data.get('make', ''),
                'model': data.get('model', ''), 
                'colour': data.get('colour', ''),
                'year_of_manufacture': data.get('yearOfManufacture', ''),
                'fuel_type': data.get('fuelType', ''),
                'engine_capacity': data.get('engineCapacity', ''),
                'co2_emissions': data.get('co2Emissions', ''),
                'mot_status': data.get('motStatus', ''),
                'tax_status': data.get('taxStatus', ''),
                'dvla_lookup': True,
                'lookup_timestamp': datetime.utcnow().isoformat()
            }
            
            return jsonify(vehicle_details), 200
            
        elif response.status_code == 404:
            current_app.logger.info(f"[DVLA] Vehicle not found: {plate_upper}")
            return jsonify({
                'error': 'Vehicle not found',
                'message': 'No vehicle found with this registration number',
                'registration_plate': plate_upper,
                'dvla_lookup': False
            }), 404
            
        else:
            current_app.logger.error(f"[DVLA] API Error: {response.status_code} - {response.text}")
            return jsonify({
                'error': 'DVLA API error',
                'message': 'Unable to lookup vehicle details at this time',
                'registration_plate': plate_upper,
                'dvla_lookup': False
            }), 500
            
    except requests.exceptions.Timeout:
        current_app.logger.error("[DVLA] API request timed out")
        return jsonify({
            'error': 'Lookup timeout',
            'message': 'Vehicle lookup service is currently slow',
            'registration_plate': plate_upper,
            'dvla_lookup': False
        }), 408
        
    except requests.exceptions.RequestException as e:
        current_app.logger.error(f"[DVLA] Request error: {str(e)}")
        return jsonify({
            'error': 'Network error',
            'message': 'Unable to connect to vehicle lookup service',
            'registration_plate': plate_upper,
            'dvla_lookup': False
        }), 503
        
    except Exception as e:
        current_app.logger.error(f"[DVLA] Unexpected error: {str(e)}")
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