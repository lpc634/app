"""Add Telegram integration to CRM users

Revision ID: 20251108_add_telegram_to_crm_users
Revises: 20251108_add_crm_tasks
Create Date: 2025-11-08 20:00:00
"""
from alembic import op
import sqlalchemy as sa

revision = '20251108_add_telegram_to_crm_users'
down_revision = '20251108_add_crm_tasks'
branch_labels = None
depends_on = None

def upgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    # Check if columns already exist
    columns = [col['name'] for col in inspector.get_columns('crm_users')]

    if 'telegram_chat_id' not in columns:
        op.add_column('crm_users', sa.Column('telegram_chat_id', sa.String(length=50), nullable=True))
        print(" ✅ Added telegram_chat_id column to crm_users")
    else:
        print(" ⏭️  telegram_chat_id column already exists")

    if 'telegram_opt_in' not in columns:
        op.add_column('crm_users', sa.Column('telegram_opt_in', sa.Boolean(), nullable=True, server_default='1'))
        print(" ✅ Added telegram_opt_in column to crm_users")
    else:
        print(" ⏭️  telegram_opt_in column already exists")

def downgrade():
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)

    # Check if columns exist before dropping
    columns = [col['name'] for col in inspector.get_columns('crm_users')]

    if 'telegram_opt_in' in columns:
        op.drop_column('crm_users', 'telegram_opt_in')
        print(" ✅ Dropped telegram_opt_in column from crm_users")
    else:
        print(" ⏭️  telegram_opt_in column doesn't exist, skipping drop")

    if 'telegram_chat_id' in columns:
        op.drop_column('crm_users', 'telegram_chat_id')
        print(" ✅ Dropped telegram_chat_id column from crm_users")
    else:
        print(" ⏭️  telegram_chat_id column doesn't exist, skipping drop")
