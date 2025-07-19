from flask import Blueprint, request, jsonify
from src.models.user import User, db
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import check_password_hash
from datetime import timedelta


auth_bp = Blueprint('auth', __name__)

# Store blacklisted tokens (in production, use Redis)
blacklisted_tokens = set()

# List of emails that will be granted the 'admin' role upon registration.
ADMIN_EMAILS = ['lance@v3-services.com', 'tom@v3-services.com', 'info@v3-services.com']

@auth_bp.route('/auth/register', methods=['POST'])
def register():
    """Register a new user, collecting all necessary details."""
    data = request.get_json()
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    required_fields = ['email', 'password', 'first_name', 'last_name', 'phone', 
                       'address_line_1', 'city', 'postcode', 'bank_name', 
                       'bank_account_number', 'bank_sort_code']
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Missing required field: {field}"}), 400

    email = data['email'].lower().strip()

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email address already registered"}), 409

    role = 'admin' if email in ADMIN_EMAILS else 'agent'

    try:
        new_user = User(
            email=email,
            role=role,
            first_name=data['first_name'],
            last_name=data['last_name'],
            phone=data.get('phone'),
            address_line_1=data.get('address_line_1'),
            address_line_2=data.get('address_line_2'),
            city=data.get('city'),
            postcode=data.get('postcode'),
            bank_name=data.get('bank_name'),
            bank_account_number=data.get('bank_account_number'),
            bank_sort_code=data.get('bank_sort_code'),
            utr_number=data.get('utr_number'),
            tax_confirmation=data.get('tax_confirmation'),
            # --- CHANGE: Set default verification status ---
            verification_status='pending'
        )
        new_user.set_password(data['password'])
        
        db.session.add(new_user)
        db.session.commit()

        return jsonify({"message": "User registered successfully. Please log in."}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": "An internal error occurred", "details": str(e)}), 500

@auth_bp.route('/auth/login', methods=['POST'])
def login():
    """User login endpoint."""
    try:
        data = request.get_json()
        
        if not data or not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        email = data['email'].lower().strip()
        password = data['password']
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        access_token = create_access_token(
            identity=str(user.id),
            expires_delta=timedelta(days=7)
        )
        
        return jsonify({
            'access_token': access_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    """User logout endpoint."""
    try:
        jti = get_jwt()['jti']
        blacklisted_tokens.add(jti)
        return jsonify({'message': 'Successfully logged out'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/auth/refresh', methods=['POST'])
@jwt_required()
def refresh():
    """Refresh JWT token."""
    try:
        # --- CHANGE: Convert JWT identity string to an integer ---
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        new_token = create_access_token(
            identity=current_user_id,
            expires_delta=timedelta(days=7)
        )
        
        return jsonify({
            'access_token': new_token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current user information."""
    try:
        # --- CHANGE: Convert JWT identity string to an integer ---
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify({'user': user.to_dict()}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# JWT token blacklist checker
def check_if_token_revoked(jwt_header, jwt_payload):
    jti = jwt_payload['jti']
    return jti in blacklisted_tokens

@auth_bp.route('/auth/create-cron-token', methods=['POST'])
@jwt_required()
def create_cron_token():
    """Create a long-lived token for GitHub Actions cron job (admin only)."""
    # --- CHANGE: Convert JWT identity string to an integer ---
    current_user_id = int(get_jwt_identity())
    user = User.query.get(current_user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403
    
    expires = timedelta(days=365)
    access_token = create_access_token(
        identity=str(user.id),
        expires_delta=expires,
        additional_claims={'purpose': 'cron_job', 'type': 'admin'}
    )
    
    return jsonify({
        'token': access_token,
        'expires_in': '365 days',
        'usage': 'Use this token in GitHub Actions secrets'
    }), 200

@auth_bp.route('/auth/my-token', methods=['GET'])
@jwt_required()
def get_my_token():
    """Get current token - REMOVE IN PRODUCTION"""
    return jsonify({'use_this_token': request.headers.get('Authorization', '').replace('Bearer ', '')}), 200