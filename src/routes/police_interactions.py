from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_
from datetime import datetime

from src.extensions import db
from src.models.user import User, Job, JobAssignment
from src.models.police_interaction import PoliceInteraction

bp = Blueprint('police_interactions', __name__)


def _current_user():
    uid = get_jwt_identity()
    try:
        return User.query.get(int(uid)) if uid is not None else None
    except Exception:
        return None


@bp.route('/police-interactions', methods=['GET'])
@jwt_required()
def list_interactions():
    user = _current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    q = PoliceInteraction.query

    # Filters
    force = request.args.get('force')
    outcome = request.args.get('outcome')
    job_address = request.args.get('job_address')
    helpfulness = request.args.get('helpfulness')
    start = request.args.get('start')
    end = request.args.get('end')

    if force:
        q = q.filter(PoliceInteraction.force.ilike(f"%{force}%"))
    if outcome:
        q = q.filter(PoliceInteraction.outcome.ilike(f"%{outcome}%"))
    if job_address:
        q = q.filter(PoliceInteraction.job_address.ilike(f"%{job_address}%"))
    if helpfulness:
        try:
            q = q.filter(PoliceInteraction.helpfulness == int(helpfulness))
        except Exception:
            pass
    if start:
        try:
            start_dt = datetime.fromisoformat(start)
            q = q.filter(PoliceInteraction.created_at >= start_dt)
        except Exception:
            pass
    if end:
        try:
            end_dt = datetime.fromisoformat(end)
            q = q.filter(PoliceInteraction.created_at <= end_dt)
        except Exception:
            pass

    # Agent scoping
    scope = (request.args.get('scope') or '').strip().lower()
    if user.role == 'agent' and scope == 'mine':
        assigned_job_ids = [row.job_id for row in JobAssignment.query.with_entities(JobAssignment.job_id).filter(JobAssignment.agent_id == user.id).distinct().all()]
        if assigned_job_ids:
            q = q.filter(PoliceInteraction.job_id.in_(assigned_job_ids))
        else:
            # No assignments: return empty page
            items = q.filter(False).paginate(page=1, per_page=1, error_out=False)
            return jsonify({'items': [], 'page': 1, 'per_page': 1, 'total': 0})

    page = max(int(request.args.get('page', 1)), 1)
    per_page = min(max(int(request.args.get('per_page', 20)), 1), 100)
    items = q.order_by(PoliceInteraction.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'items': [i.to_dict() for i in items.items],
        'page': items.page,
        'per_page': items.per_page,
        'total': items.total,
    })


@bp.route('/police-interactions', methods=['POST'])
@jwt_required()
def create_interaction():
    user = _current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json(silent=True) or {}

    job_address = (data.get('job_address') or '').strip()
    force = (data.get('force') or '').strip()
    officers = data.get('officers') or []
    reason = (data.get('reason') or '').strip()
    outcome = (data.get('outcome') or '').strip()
    helpfulness = data.get('helpfulness')
    notes = data.get('notes')
    job_id = data.get('job_id')

    # Basic validation
    if not job_address or not force or not reason or not outcome:
        return jsonify({'error': 'job_address, force, reason, outcome are required'}), 400
    try:
        helpfulness = int(helpfulness)
        if helpfulness < 1 or helpfulness > 5:
            raise ValueError()
    except Exception:
        return jsonify({'error': 'helpfulness must be an integer 1-5'}), 400
    if not isinstance(officers, list) or len(officers) == 0 or not (officers[0] or {}).get('shoulder_number'):
        return jsonify({'error': 'At least one officer with shoulder_number is required'}), 400

    # If agent, enforce job assignment ownership when job_id provided
    if user.role == 'agent' and job_id is not None:
        try:
            jid = int(job_id)
            has_assignment = JobAssignment.query.filter_by(agent_id=user.id, job_id=jid).first() is not None
        except Exception:
            has_assignment = False
        if not has_assignment:
            return jsonify({'error': 'You are not assigned to this job'}), 403

    pi = PoliceInteraction(
        job_address=job_address,
        job_id=int(job_id) if job_id is not None else None,
        force=force,
        officers=[{'shoulder_number': str(o.get('shoulder_number')), 'name': (o.get('name') or '').strip()} for o in officers],
        reason=reason,
        outcome=outcome,
        helpfulness=helpfulness,
        notes=notes,
        created_by_user_id=user.id,
        created_by_role=user.role,
    )
    db.session.add(pi)
    db.session.commit()
    return jsonify(pi.to_dict()), 201


@bp.route('/police-interactions/<int:pid>', methods=['PUT', 'PATCH'])
@jwt_required()
def update_interaction(pid):
    user = _current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401

    pi = PoliceInteraction.query.get_or_404(pid)

    # Permissions: admin can edit any; agent can edit only their own
    if user.role == 'agent' and pi.created_by_user_id != user.id:
        return jsonify({'error': 'You can only edit records you created'}), 403
    data = request.get_json(silent=True) or {}

    # Allow edits to main fields
    for field in ['job_address', 'force', 'reason', 'outcome', 'notes']:
        if field in data:
            setattr(pi, field, data.get(field))
    if 'helpfulness' in data:
        try:
            hv = int(data.get('helpfulness'))
            if 1 <= hv <= 5:
                pi.helpfulness = hv
        except Exception:
            pass
    if 'officers' in data and isinstance(data['officers'], list):
        pi.officers = [
            {'shoulder_number': str(o.get('shoulder_number')), 'name': (o.get('name') or '').strip()} for o in data['officers']
        ]

    # Optional: update job_id (with agent authorization check)
    if 'job_id' in data:
        try:
            new_job_id = int(data.get('job_id')) if data.get('job_id') is not None else None
        except Exception:
            return jsonify({'error': 'job_id must be an integer or null'}), 400
        if user.role == 'agent' and new_job_id is not None:
            # Agent can only set to a job they are assigned to
            has_assignment = JobAssignment.query.filter_by(agent_id=user.id, job_id=new_job_id).first() is not None
            if not has_assignment:
                return jsonify({'error': 'You are not assigned to the selected job'}), 403
        pi.job_id = new_job_id

    db.session.commit()
    return jsonify(pi.to_dict())


@bp.route('/police-interactions/<int:pid>', methods=['DELETE'])
@jwt_required()
def delete_interaction(pid):
    user = _current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    pi = PoliceInteraction.query.get_or_404(pid)
    # Permissions: admin can delete any; agent can delete only their own
    if user.role == 'agent' and pi.created_by_user_id != user.id:
        return jsonify({'error': 'You can only delete records you created'}), 403
    if user.role not in ('admin', 'agent', 'manager'):
        return jsonify({'error': 'Forbidden'}), 403
    db.session.delete(pi)
    db.session.commit()
    return jsonify({'ok': True})


@bp.route('/jobs/open-min', methods=['GET'])
@jwt_required()
def open_jobs_min():
    # Minimal list of open jobs for selector; agents only see their assigned jobs
    user = _current_user()
    if not user:
        return jsonify({'error': 'Unauthorized'}), 401
    base = Job.query.with_entities(Job.id, Job.address)
    if user.role == 'agent':
        base = base.join(JobAssignment, JobAssignment.job_id == Job.id).filter(JobAssignment.agent_id == user.id)
    else:
        base = base.filter(Job.status == 'open')
    jobs = base.order_by(Job.id.desc()).limit(200).all()
    return jsonify([{'id': j.id, 'address': j.address} for j in jobs])


