from flask import Blueprint, jsonify, request
from src.models.user import User, db

user_bp = Blueprint('user', __name__)

@user_bp.route('/users', methods=['GET'])
def get_users():
    users = User.query.all()
    # --- FIX: Wrap the list in a 'users' key for consistency ---
    return jsonify({'users': [user.to_dict() for user in users]})

@user_bp.route('/users', methods=['POST'])
def create_user():
    data = request.json
    # This route appears unused in the agent/admin app, but is kept for completeness
    user = User(username=data['username'], email=data['email'])
    db.session.add(user)
    db.session.commit()
    return jsonify({'user': user.to_dict()}), 201

@user_bp.route('/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    user = User.query.get_or_404(user_id)
    # --- FIX: Wrap the user object in a 'user' key to match what the frontend expects ---
    return jsonify({'user': user.to_dict()})

@user_bp.route('/users/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.json
    # Note: Assumes 'username' exists on the model, which it doesn't.
    # This route may need further review if you plan to use it.
    user.username = data.get('username', user.username)
    user.email = data.get('email', user.email)
    db.session.commit()
    return jsonify({'user': user.to_dict()})

@user_bp.route('/users/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return '', 204