import sys
sys.path.insert(0, '.')
from src.models.user import db, User, AgentAvailability, Job, JobAssignment
from datetime import date, timedelta, datetime

print('=== DEBUGGING DATABASE ===')

# Check users
users = User.query.all()
print(f'Total users: {len(users)}')
for user in users:
    print(f'  {user.id}: {user.email} ({user.role}) - verified: {getattr(user, "verification_status", "unknown")}')

# Check agent 2 specifically
agent = User.query.get(2)
if agent:
    print(f'\nAgent 2: {agent.email}')
    print(f'  Verification: {getattr(agent, "verification_status", "unknown")}')
    
    # Check availability
    today = date.today()
    future_avail = AgentAvailability.query.filter(
        AgentAvailability.agent_id == 2,
        AgentAvailability.date >= today
    ).all()
    print(f'  Future availability records: {len(future_avail)}')
    for avail in future_avail[:5]:  # Show first 5
        print(f'    {avail.date}: available={avail.is_available}, away={avail.is_away}')

# Check jobs
jobs = Job.query.all()
print(f'\nTotal jobs: {len(jobs)}')
for job in jobs:
    print(f'  {job.id}: {job.title} on {job.arrival_time} (status: {job.status})')

# Check assignments for agent 2
assignments = JobAssignment.query.filter_by(agent_id=2).all()
print(f'\nAgent 2 assignments: {len(assignments)}')
for assign in assignments:
    print(f'  Job {assign.job_id}: {assign.status}')

print('\n=== APPLYING FIXES ===')

# Fix 1: Verify agent
if agent:
    agent.verification_status = 'verified'
    print('✓ Agent verified')

# Fix 2: Add availability for next 3 days
for i in range(1, 4):
    future_date = date.today() + timedelta(days=i)
    existing = AgentAvailability.query.filter_by(agent_id=2, date=future_date).first()
    if not existing:
        avail = AgentAvailability(agent_id=2, date=future_date, is_available=True, is_away=False, notes='Auto-added for testing')
        db.session.add(avail)
        print(f'✓ Added availability for {future_date}')

db.session.commit()
print('\n✓ All fixes applied successfully!')