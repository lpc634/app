from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.extensions import db
from src.models.contact_form import ContactFormSubmission
from src.models.user import User
from datetime import datetime

contact_forms_bp = Blueprint('contact_forms', __name__)


@contact_forms_bp.route('/contact-forms', methods=['GET'])
@jwt_required()
def get_contact_forms():
    """Get all contact form submissions (admin only)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or user.role not in ['admin', 'manager']:
        return jsonify({'error': 'Unauthorized'}), 403

    # Get query parameters for filtering
    status = request.args.get('status')
    limit = request.args.get('limit', 100, type=int)
    offset = request.args.get('offset', 0, type=int)

    # Build query
    query = ContactFormSubmission.query

    if status and status != 'all':
        query = query.filter_by(status=status)

    # Order by created_at descending (newest first)
    query = query.order_by(ContactFormSubmission.created_at.desc())

    # Get total count
    total = query.count()

    # Apply pagination
    submissions = query.limit(limit).offset(offset).all()

    return jsonify({
        'submissions': [s.to_dict() for s in submissions],
        'total': total,
        'limit': limit,
        'offset': offset
    }), 200


@contact_forms_bp.route('/contact-forms/<int:submission_id>', methods=['GET'])
@jwt_required()
def get_contact_form(submission_id):
    """Get a single contact form submission"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or user.role not in ['admin', 'manager']:
        return jsonify({'error': 'Unauthorized'}), 403

    submission = ContactFormSubmission.query.get(submission_id)

    if not submission:
        return jsonify({'error': 'Submission not found'}), 404

    return jsonify(submission.to_dict()), 200


@contact_forms_bp.route('/contact-forms/<int:submission_id>', methods=['PATCH'])
@jwt_required()
def update_contact_form(submission_id):
    """Update a contact form submission (status, notes, assigned user)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or user.role not in ['admin', 'manager']:
        return jsonify({'error': 'Unauthorized'}), 403

    submission = ContactFormSubmission.query.get(submission_id)

    if not submission:
        return jsonify({'error': 'Submission not found'}), 404

    data = request.get_json()

    # Update status
    if 'status' in data:
        submission.status = data['status']
        if data['status'] == 'contacted' and not submission.contacted_at:
            submission.contacted_at = datetime.utcnow()
        elif data['status'] == 'resolved' and not submission.resolved_at:
            submission.resolved_at = datetime.utcnow()

    # Update admin notes
    if 'admin_notes' in data:
        submission.admin_notes = data['admin_notes']

    # Update assigned user
    if 'assigned_to_user_id' in data:
        submission.assigned_to_user_id = data['assigned_to_user_id']

    submission.updated_at = datetime.utcnow()

    try:
        db.session.commit()
        return jsonify(submission.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@contact_forms_bp.route('/contact-forms/<int:submission_id>', methods=['DELETE'])
@jwt_required()
def delete_contact_form(submission_id):
    """Delete a contact form submission (admin only)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Unauthorized - Admin only'}), 403

    submission = ContactFormSubmission.query.get(submission_id)

    if not submission:
        return jsonify({'error': 'Submission not found'}), 404

    try:
        db.session.delete(submission)
        db.session.commit()
        return jsonify({'message': 'Submission deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@contact_forms_bp.route('/contact-forms/stats', methods=['GET'])
@jwt_required()
def get_contact_form_stats():
    """Get statistics about contact form submissions"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)

    if not user or user.role not in ['admin', 'manager']:
        return jsonify({'error': 'Unauthorized'}), 403

    total = ContactFormSubmission.query.count()
    pending = ContactFormSubmission.query.filter_by(status='pending').count()
    contacted = ContactFormSubmission.query.filter_by(status='contacted').count()
    resolved = ContactFormSubmission.query.filter_by(status='resolved').count()
    spam = ContactFormSubmission.query.filter_by(status='spam').count()
    callback_requested = ContactFormSubmission.query.filter_by(callback_requested=True).count()

    return jsonify({
        'total': total,
        'pending': pending,
        'contacted': contacted,
        'resolved': resolved,
        'spam': spam,
        'callback_requested': callback_requested
    }), 200
