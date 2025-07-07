from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from src.models.user import User, Job, JobAssignment, AgentAvailability, Notification, db
from datetime import datetime, date, timedelta
from sqlalchemy import func, and_

analytics_bp = Blueprint('analytics', __name__)

def require_admin():
    """Ensure user is an admin."""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    if not user or user.role != 'admin':
        return None
    return user

@analytics_bp.route('/analytics/agents', methods=['GET'])
@jwt_required()
def get_agent_metrics():
    """Get agent performance metrics."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get date range from query parameters
        days = request.args.get('days', 30, type=int)
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get all agents
        agents = User.query.filter_by(role='agent').all()
        agent_metrics = []
        
        for agent in agents:
            # Get assignments in date range
            assignments = JobAssignment.query.join(Job).filter(
                JobAssignment.agent_id == agent.id,
                Job.arrival_time >= start_date,
                Job.arrival_time <= end_date
            ).all()
            
            total_assignments = len(assignments)
            accepted_assignments = len([a for a in assignments if a.status == 'accepted'])
            declined_assignments = len([a for a in assignments if a.status == 'declined'])
            pending_assignments = len([a for a in assignments if a.status == 'pending'])
            
            # Calculate response rate
            responded_assignments = accepted_assignments + declined_assignments
            response_rate = (responded_assignments / total_assignments * 100) if total_assignments > 0 else 0
            
            # Calculate acceptance rate
            acceptance_rate = (accepted_assignments / responded_assignments * 100) if responded_assignments > 0 else 0
            
            # Calculate average response time
            response_times = []
            for assignment in assignments:
                if assignment.response_time and assignment.created_at:
                    response_time = (assignment.response_time - assignment.created_at).total_seconds() / 60  # minutes
                    response_times.append(response_time)
            
            avg_response_time = sum(response_times) / len(response_times) if response_times else 0
            
            # Get availability data
            availability_records = AgentAvailability.query.filter(
                AgentAvailability.agent_id == agent.id,
                AgentAvailability.date >= start_date,
                AgentAvailability.date <= end_date
            ).all()
            
            total_days = len(availability_records)
            available_days = len([a for a in availability_records if a.is_available and not a.is_away])
            away_days = len([a for a in availability_records if a.is_away])
            
            # Check if availability is stale (no updates in last 7 days)
            last_availability_update = AgentAvailability.query.filter_by(
                agent_id=agent.id
            ).order_by(AgentAvailability.updated_at.desc()).first()
            
            is_stale = False
            if last_availability_update:
                days_since_update = (datetime.utcnow() - last_availability_update.updated_at).days
                is_stale = days_since_update > 7
            else:
                is_stale = True
            
            agent_metrics.append({
                'agent': agent.to_dict(),
                'metrics': {
                    'total_assignments': total_assignments,
                    'accepted_assignments': accepted_assignments,
                    'declined_assignments': declined_assignments,
                    'pending_assignments': pending_assignments,
                    'response_rate': round(response_rate, 1),
                    'acceptance_rate': round(acceptance_rate, 1),
                    'avg_response_time_minutes': round(avg_response_time, 1),
                    'total_days_tracked': total_days,
                    'available_days': available_days,
                    'away_days': away_days,
                    'availability_stale': is_stale
                }
            })
        
        # Sort by acceptance rate (most reliable first)
        agent_metrics.sort(key=lambda x: x['metrics']['acceptance_rate'], reverse=True)
        
        return jsonify({
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': days
            },
            'agent_metrics': agent_metrics
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/analytics/jobs', methods=['GET'])
@jwt_required()
def get_job_statistics():
    """Get job statistics."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get date range from query parameters
        days = request.args.get('days', 30, type=int)
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get jobs in date range
        jobs = Job.query.filter(
            Job.arrival_time >= start_date,
            Job.arrival_time <= end_date
        ).all()
        
        # Calculate statistics
        total_jobs = len(jobs)
        open_jobs = len([j for j in jobs if j.status == 'open'])
        filled_jobs = len([j for j in jobs if j.status == 'filled'])
        completed_jobs = len([j for j in jobs if j.status == 'completed'])
        cancelled_jobs = len([j for j in jobs if j.status == 'cancelled'])
        
        # Job fill rate
        fill_rate = (filled_jobs / total_jobs * 100) if total_jobs > 0 else 0
        
        # Jobs by urgency level
        urgent_jobs = len([j for j in jobs if j.urgency_level == 'URGENT'])
        standard_jobs = len([j for j in jobs if j.urgency_level == 'Standard'])
        low_jobs = len([j for j in jobs if j.urgency_level == 'Low'])
        
        # Jobs by type
        job_types = {}
        for job in jobs:
            job_type = job.job_type
            job_types[job_type] = job_types.get(job_type, 0) + 1
        
        # Average agents required
        avg_agents_required = sum([j.agents_required for j in jobs]) / total_jobs if total_jobs > 0 else 0
        
        # Jobs created per day
        jobs_per_day = {}
        for job in jobs:
            job_date = job.created_at.date().isoformat()
            jobs_per_day[job_date] = jobs_per_day.get(job_date, 0) + 1
        
        return jsonify({
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': days
            },
            'job_statistics': {
                'total_jobs': total_jobs,
                'open_jobs': open_jobs,
                'filled_jobs': filled_jobs,
                'completed_jobs': completed_jobs,
                'cancelled_jobs': cancelled_jobs,
                'fill_rate': round(fill_rate, 1),
                'avg_agents_required': round(avg_agents_required, 1)
            },
            'urgency_breakdown': {
                'urgent': urgent_jobs,
                'standard': standard_jobs,
                'low': low_jobs
            },
            'job_types': job_types,
            'jobs_per_day': jobs_per_day
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/analytics/response-rates', methods=['GET'])
@jwt_required()
def get_response_rates():
    """Get response rate analytics."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get date range from query parameters
        days = request.args.get('days', 30, type=int)
        end_date = date.today()
        start_date = end_date - timedelta(days=days)
        
        # Get assignments in date range
        assignments = JobAssignment.query.join(Job).filter(
            Job.arrival_time >= start_date,
            Job.arrival_time <= end_date
        ).all()
        
        total_assignments = len(assignments)
        accepted_assignments = len([a for a in assignments if a.status == 'accepted'])
        declined_assignments = len([a for a in assignments if a.status == 'declined'])
        pending_assignments = len([a for a in assignments if a.status == 'pending'])
        
        # Calculate rates
        responded_assignments = accepted_assignments + declined_assignments
        overall_response_rate = (responded_assignments / total_assignments * 100) if total_assignments > 0 else 0
        overall_acceptance_rate = (accepted_assignments / responded_assignments * 100) if responded_assignments > 0 else 0
        
        # Response times
        response_times = []
        for assignment in assignments:
            if assignment.response_time and assignment.created_at:
                response_time = (assignment.response_time - assignment.created_at).total_seconds() / 60  # minutes
                response_times.append(response_time)
        
        avg_response_time = sum(response_times) / len(response_times) if response_times else 0
        
        # Response rates by urgency level
        urgency_rates = {}
        for urgency in ['Low', 'Standard', 'URGENT']:
            urgency_assignments = [a for a in assignments if a.job.urgency_level == urgency]
            urgency_total = len(urgency_assignments)
            urgency_accepted = len([a for a in urgency_assignments if a.status == 'accepted'])
            urgency_responded = len([a for a in urgency_assignments if a.status in ['accepted', 'declined']])
            
            urgency_rates[urgency] = {
                'total_assignments': urgency_total,
                'response_rate': (urgency_responded / urgency_total * 100) if urgency_total > 0 else 0,
                'acceptance_rate': (urgency_accepted / urgency_responded * 100) if urgency_responded > 0 else 0
            }
        
        # Top 5 most reliable agents
        agent_reliability = {}
        for assignment in assignments:
            agent_id = assignment.agent_id
            if agent_id not in agent_reliability:
                agent_reliability[agent_id] = {
                    'total': 0,
                    'accepted': 0,
                    'agent': assignment.agent
                }
            
            agent_reliability[agent_id]['total'] += 1
            if assignment.status == 'accepted':
                agent_reliability[agent_id]['accepted'] += 1
        
        # Calculate acceptance rates and sort
        for agent_id in agent_reliability:
            data = agent_reliability[agent_id]
            data['acceptance_rate'] = (data['accepted'] / data['total'] * 100) if data['total'] > 0 else 0
        
        top_agents = sorted(
            agent_reliability.values(),
            key=lambda x: (x['acceptance_rate'], x['total']),
            reverse=True
        )[:5]
        
        # Agents with stale availability
        stale_agents = []
        all_agents = User.query.filter_by(role='agent').all()
        
        for agent in all_agents:
            last_update = AgentAvailability.query.filter_by(
                agent_id=agent.id
            ).order_by(AgentAvailability.updated_at.desc()).first()
            
            if not last_update:
                stale_agents.append({
                    'agent': agent.to_dict(),
                    'last_update': None,
                    'days_stale': 'Never updated'
                })
            else:
                days_stale = (datetime.utcnow() - last_update.updated_at).days
                if days_stale > 7:
                    stale_agents.append({
                        'agent': agent.to_dict(),
                        'last_update': last_update.updated_at.isoformat(),
                        'days_stale': days_stale
                    })
        
        return jsonify({
            'date_range': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': days
            },
            'overall_metrics': {
                'total_assignments': total_assignments,
                'response_rate': round(overall_response_rate, 1),
                'acceptance_rate': round(overall_acceptance_rate, 1),
                'avg_response_time_minutes': round(avg_response_time, 1)
            },
            'urgency_breakdown': urgency_rates,
            'top_reliable_agents': [
                {
                    'agent': agent['agent'].to_dict(),
                    'acceptance_rate': round(agent['acceptance_rate'], 1),
                    'total_assignments': agent['total']
                }
                for agent in top_agents
            ],
            'stale_availability_agents': stale_agents
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@analytics_bp.route('/analytics/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_summary():
    """Get summary metrics for dashboard."""
    try:
        current_user = require_admin()
        if not current_user:
            return jsonify({'error': 'Access denied'}), 403
        
        today = date.today()
        
        # Today's metrics
        today_jobs = Job.query.filter(
            func.date(Job.arrival_time) == today
        ).all()
        
        today_available_agents = AgentAvailability.query.filter(
            AgentAvailability.date == today,
            AgentAvailability.is_available == True,
            AgentAvailability.is_away == False
        ).count()
        
        # This week's metrics
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        
        week_jobs = Job.query.filter(
            Job.arrival_time >= week_start,
            Job.arrival_time <= week_end
        ).count()
        
        # Pending responses
        pending_responses = JobAssignment.query.filter_by(status='pending').count()
        
        # Open jobs
        open_jobs = Job.query.filter_by(status='open').count()
        
        return jsonify({
            'today': {
                'date': today.isoformat(),
                'jobs_scheduled': len(today_jobs),
                'available_agents': today_available_agents,
                'open_jobs': len([j for j in today_jobs if j.status == 'open']),
                'filled_jobs': len([j for j in today_jobs if j.status == 'filled'])
            },
            'this_week': {
                'start_date': week_start.isoformat(),
                'end_date': week_end.isoformat(),
                'total_jobs': week_jobs
            },
            'pending_actions': {
                'pending_responses': pending_responses,
                'open_jobs': open_jobs
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

