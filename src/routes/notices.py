# src/routes/notices.py
from flask import Blueprint, jsonify, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
import os

notices_bp = Blueprint('notices', __name__)


def require_admin():
    """Helper to check if current user is admin"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.role != 'admin':
        return None
    return user


def require_authenticated():
    """Helper to check if current user is authenticated (admin or agent)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or user.role not in ['admin', 'agent', 'manager']:
        return None
    return user


# Admin route (legacy)
@notices_bp.route('/admin/notices/types', methods=['GET'])
@jwt_required()
def get_notice_types_admin():
    """Get available notice templates (admin)"""
    user = require_admin()
    if not user:
        return jsonify({'error': 'Forbidden'}), 403

    templates = [
        {
            'id': 'rough_sleeper',
            'name': 'Rough Sleeper Notice',
            'description': 'Notice for rough sleepers with charity support information.',
            'download_url': '/admin/notices/templates/rough_sleeper'
        }
    ]

    return jsonify({'templates': templates})


# Agent route
@notices_bp.route('/notices/types', methods=['GET'])
@jwt_required()
def get_notice_types():
    """Get available notice templates (agents and admins)"""
    user = require_authenticated()
    if not user:
        return jsonify({'error': 'Forbidden'}), 403

    templates = [
        {
            'id': 'rough_sleeper',
            'name': 'Rough Sleeper Notice',
            'description': 'Notice for rough sleepers with charity support information.',
            'download_url': '/notices/templates/rough_sleeper'
        }
    ]

    return jsonify({'templates': templates})


# Admin template download (legacy)
@notices_bp.route('/admin/notices/templates/<template_id>', methods=['GET'])
@jwt_required()
def download_template_admin(template_id):
    """Download a Word template for notices (admin)"""
    try:
        user = require_admin()
        if not user:
            return jsonify({'error': 'Forbidden'}), 403

        return _download_template(template_id, user)
    except Exception as e:
        current_app.logger.error(f"Error downloading template: {str(e)}")
        return jsonify({'error': f'Failed to download template: {str(e)}'}), 500


# Agent template download
@notices_bp.route('/notices/templates/<template_id>', methods=['GET'])
@jwt_required()
def download_template(template_id):
    """Download a Word template for notices (agents and admins)"""
    try:
        user = require_authenticated()
        if not user:
            return jsonify({'error': 'Forbidden'}), 403

        return _download_template(template_id, user)
    except Exception as e:
        current_app.logger.error(f"Error downloading template: {str(e)}")
        return jsonify({'error': f'Failed to download template: {str(e)}'}), 500


def _download_template(template_id, user):
    """Internal helper to download template"""
    # Map template IDs to file paths
    templates = {
        'rough_sleeper': {
            'path': os.path.join(os.path.dirname(__file__), '..', 'templates', 'rough_sleeper_template.docx'),
            'filename': 'Rough_Sleeper_Notice_Template.docx'
        }
    }

    if template_id not in templates:
        return jsonify({'error': 'Template not found'}), 404

    template = templates[template_id]
    template_path = template['path']

    if not os.path.exists(template_path):
        current_app.logger.error(f"Template file not found: {template_path}")
        return jsonify({'error': 'Template file not found'}), 404

    current_app.logger.info(f"User {user.email} downloading template: {template_id}")

    return send_file(
        template_path,
        mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        as_attachment=True,
        download_name=template['filename']
    )
