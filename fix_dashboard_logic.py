import sys
sys.path.insert(0, '.')
from main import app
from src.models.user import db, User, Job, JobAssignment
from datetime import date, datetime

with app.app_context():
    print("=== FIXING DASHBOARD TO SHOW PENDING JOBS ===")
    
    # Test what we should show
    user_id = 2
    pending_assignments = JobAssignment.query.filter_by(
        agent_id=user_id, 
        status='pending'
    ).all()
    
    print(f"Found {len(pending_assignments)} pending assignments")
    
    for assignment in pending_assignments:
        job = Job.query.get(assignment.job_id)
        print(f"  - Assignment {assignment.id}: Job '{job.title}' at {job.address}")
        print(f"    Job Time: {job.arrival_time}")
        print(f"    Job Status: {job.status}")
    
    print("\n✅ These jobs should appear on the dashboard!")