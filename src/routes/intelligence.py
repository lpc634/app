# CREATE FILE: src/routes/intelligence.py

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import db, User
from datetime import datetime
import logging

# Create blueprint
intelligence_bp = Blueprint('intelligence', __name__)

# Set up logging
logger = logging.getLogger(__name__)

# Temporary in-memory storage for sightings (you might want to add a proper database model later)
sightings = []

@intelligence_bp.route('/intelligence/sightings', methods=['POST'])
@jwt_required()
def submit_sighting():
    """Submit a new vehicle sighting"""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(int(current_user_id))
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Validate required fields
        if not data.get('registration_plate'):
            return jsonify({'error': 'Registration plate is required'}), 400
            
        if not data.get('location'):
            return jsonify({'error': 'Location is required'}), 400
        
        # Create sighting object
        sighting = {
            'id': len(sightings) + 1,  # Simple ID generation
            'registration_plate': data.get('registration_plate', '').upper().strip(),
            'location': data.get('location', '').strip(),
            'notes': data.get('notes', '').strip(),
            'is_dangerous': data.get('is_dangerous', False),
            'agent_id': user.id,
            'agent_name': f"{user.first_name} {user.last_name}",
            'timestamp': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow().isoformat()
        }
        
        # Add to storage
        sightings.append(sighting)
        
        logger.info(f"Sighting submitted by user {user.id}: {sighting['registration_plate']} at {sighting['location']}")
        
        return jsonify({
            'message': 'Sighting submitted successfully',
            'sighting': sighting
        }), 201
        
    except Exception as e:
        logger.error(f"Error submitting sighting: {str(e)}")
        return jsonify({'error': 'An internal server error occurred. Please try again.'}), 500

@intelligence_bp.route('/intelligence/sightings', methods=['GET'])
@jwt_required()
def get_sightings():
    """Get all sightings (for search functionality)"""
    try:
        # Optional: filter by registration plate
        reg_plate = request.args.get('registration_plate', '').upper().strip()
        
        filtered_sightings = sightings
        
        if reg_plate:
            filtered_sightings = [s for s in sightings if reg_plate in s['registration_plate']]
        
        return jsonify({
            'sightings': filtered_sightings,
            'total': len(filtered_sightings)
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching sightings: {str(e)}")
        return jsonify({'error': 'Failed to fetch sightings'}), 500

@intelligence_bp.route('/intelligence/search/<registration_plate>', methods=['GET'])
@jwt_required()
def search_vehicle(registration_plate):
    """Search for a specific vehicle by registration plate"""
    try:
        reg_plate = registration_plate.upper().strip()
        
        # Find sightings for this vehicle
        vehicle_sightings = [s for s in sightings if s['registration_plate'] == reg_plate]
        
        if not vehicle_sightings:
            return jsonify({
                'found': False,
                'message': f'No sightings found for {reg_plate}',
                'sightings': []
            }), 404
        
        # Sort by most recent first
        vehicle_sightings.sort(key=lambda x: x['timestamp'], reverse=True)
        
        return jsonify({
            'found': True,
            'registration_plate': reg_plate,
            'sightings': vehicle_sightings,
            'total_sightings': len(vehicle_sightings),
            'last_seen': vehicle_sightings[0] if vehicle_sightings else None
        }), 200
        
    except Exception as e:
        logger.error(f"Error searching for vehicle {registration_plate}: {str(e)}")
        return jsonify({'error': 'Search failed'}), 500

@intelligence_bp.route('/intelligence/health', methods=['GET'])
def intelligence_health():
    """Health check for intelligence module"""
    return jsonify({
        'status': 'healthy',
        'module': 'Vehicle Intelligence',
        'total_sightings': len(sightings)
    }), 200