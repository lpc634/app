from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import and_, or_
from datetime import datetime

from src.extensions import db
from src.models.user import User, Job
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


@bp.route('/police-interactions/<int:pid>', methods=['PUT'])
@jwt_required()
def update_interaction(pid):
    user = _current_user()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403

    pi = PoliceInteraction.query.get_or_404(pid)
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

    db.session.commit()
    return jsonify(pi.to_dict())


@bp.route('/police-interactions/<int:pid>', methods=['DELETE'])
@jwt_required()
def delete_interaction(pid):
    user = _current_user()
    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin only'}), 403
    pi = PoliceInteraction.query.get_or_404(pid)
    db.session.delete(pi)
    db.session.commit()
    return jsonify({'deleted': True})


@bp.route('/jobs/open-min', methods=['GET'])
@jwt_required()
def open_jobs_min():
    # Minimal list of open jobs for selector
    jobs = Job.query.with_entities(Job.id, Job.address).filter(Job.status == 'open').order_by(Job.id.desc()).limit(200).all()
    return jsonify([{'id': j.id, 'address': j.address} for j in jobs])


