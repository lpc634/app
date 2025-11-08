"""Add CRM tasks table for task/reminder system

Revision ID: 20251108_add_crm_tasks
Revises: 20251107_add_crm_emails
Create Date: 2025-11-08 19:30:00
"""
from alembic import op
import sqlalchemy as sa

revision = '20251108_add_crm_tasks'
down_revision = '20251107_add_crm_emails'
branch_labels = None
depends_on = None

def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'crm_tasks' not in existing_tables:
        op.create_table('crm_tasks',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('crm_user_id', sa.Integer(), nullable=False),
            sa.Column('contact_id', sa.Integer(), nullable=False),
            sa.Column('task_type', sa.String(length=50), nullable=False),
            sa.Column('title', sa.String(length=255), nullable=False),
            sa.Column('due_date', sa.DateTime(), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP'), onupdate=sa.text('CURRENT_TIMESTAMP')),
            sa.ForeignKeyConstraint(['crm_user_id'], ['crm_users.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id')
        )
        op.create_index('idx_crm_tasks_user_id', 'crm_tasks', ['crm_user_id'])
        op.create_index('idx_crm_tasks_contact_id', 'crm_tasks', ['contact_id'])
        op.create_index('idx_crm_tasks_due_date', 'crm_tasks', ['due_date'])
        op.create_index('idx_crm_tasks_status', 'crm_tasks', ['status'])
        print(" ✅ Created crm_tasks table")
    else:
        print(" ⏭️  crm_tasks table already exists")

def downgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'crm_tasks' in existing_tables:
        op.drop_index('idx_crm_tasks_status', table_name='crm_tasks')
        op.drop_index('idx_crm_tasks_due_date', table_name='crm_tasks')
        op.drop_index('idx_crm_tasks_contact_id', table_name='crm_tasks')
        op.drop_index('idx_crm_tasks_user_id', table_name='crm_tasks')
        op.drop_table('crm_tasks')
        print(" ✅ Dropped crm_tasks table")
    else:
        print(" ⏭️  crm_tasks table doesn't exist, skipping drop")
