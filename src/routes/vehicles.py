from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from src.models.vehicle import VehicleSighting 
from src.models.vehicle_details import VehicleDetails
from src.extensions import db
from sqlalchemy import desc

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