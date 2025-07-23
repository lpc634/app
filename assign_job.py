import sys
sys.path.insert(0, '.')
from main import app
from src.models.user import db, JobAssignment

with app.app_context():
    # Check if assignment for Job 1 already exists
    existing = JobAssignment.query.filter_by(job_id=1, agent_id=2).first()
    if not existing:
        assignment = JobAssignment(job_id=1, agent_id=2, status='pending')
        db.session.add(assignment)
        db.session.commit()
        print('✓ Job 1 assigned to agent 2')
    else:
        print('Job 1 already assigned to agent 2')
        
    # Show all assignments for agent 2
    all_assignments = JobAssignment.query.filter_by(agent_id=2).all()
    print(f'\nAgent 2 now has {len(all_assignments)} assignments:')
    for assign in all_assignments:
        print(f'  Job {assign.job_id}: {assign.status}')