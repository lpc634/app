from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User
from src.models.v3_report import V3JobReport
from src.models.user import Job
import logging

forms_bp = Blueprint('forms', __name__)
logger = logging.getLogger(__name__)


@forms_bp.route('/start', methods=['POST'])
@jwt_required()
def start_form():
    """Start/create a new form submission. Requires job_id for admin-created forms."""
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json() or {}
        job_id = data.get("job_id")
        template_id = data.get("template_id", "traveller_eviction")  # Default template

        # Validate job_id is required
        if not job_id:
            return jsonify({"error": "job_id is required"}), 400

        # Validate job exists and user has access
        job = Job.query.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404

        # For admin users, allow any job. For agents, they should only create forms for their assigned jobs
        if user.role == 'agent':
            # Check if agent is assigned to this job
            from src.models.user import JobAssignment
            assignment = JobAssignment.query.filter_by(
                job_id=job_id,
                agent_id=user.id,
                status='accepted'
            ).first()
            if not assignment:
                return jsonify({"error": "You are not assigned to this job"}), 403

        # Create the form submission
        form_submission = V3JobReport(
            job_id=job_id,
            agent_id=user.id,  # The user creating the form
            form_type=template_id,
            status="started",  # Or "draft" if forms can be saved as drafts
            report_data={},  # Will be populated when form is submitted
            photo_urls=[]
        )

        from src.extensions import db
        db.session.add(form_submission)
        db.session.commit()

        logger.info(f"Form started: user={user.id}, job={job_id}, form_type={template_id}, submission_id={form_submission.id}")

        return jsonify({
            "id": form_submission.id,
            "job_id": form_submission.job_id,
            "agent_id": form_submission.agent_id,
            "form_type": form_submission.form_type,
            "status": form_submission.status,
            "message": "Form started successfully"
        }), 201

    except Exception as e:
        logger.error(f"Error starting form: {e}")
        from src.extensions import db
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500
