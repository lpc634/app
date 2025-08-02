from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from src.models.vehicle import VehicleSighting 
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
        agent_id=current_user_id,
        make=data.get('make', '').strip() or None,
        model=data.get('model', '').strip() or None,
        colour=data.get('colour', '').strip() or None
    )
    db.session.add(new_sighting)
    db.session.commit()
    return jsonify(new_sighting.to_dict()), 201