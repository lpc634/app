"""Add Telegram integration fields to users table

Revision ID: telegram_integration_restore
Revises: mjtn_20250819a2
Create Date: 2025-01-20 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'telegram_integration_restore'
down_revision = 'mjtn_20250819a2'
branch_labels = None
depends_on = None


def upgrade():
    """Add Telegram integration fields to users table"""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check if columns already exist
    users_columns = [col['name'] for col in inspector.get_columns('users')]
    
    # Add Telegram fields to users table if they don't exist
    if 'telegram_chat_id' not in users_columns:
        op.add_column('users', sa.Column('telegram_chat_id', sa.String(32), nullable=True))
        print("Added telegram_chat_id column")
    else:
        print("telegram_chat_id column already exists")
        
    if 'telegram_username' not in users_columns:
        op.add_column('users', sa.Column('telegram_username', sa.String(64), nullable=True))
        print("Added telegram_username column")
    else:
        print("telegram_username column already exists")
        
    if 'telegram_link_code' not in users_columns:
        op.add_column('users', sa.Column('telegram_link_code', sa.String(16), nullable=True))
        print("Added telegram_link_code column")
    else:
        print("telegram_link_code column already exists")
        
    if 'telegram_opt_in' not in users_columns:
        op.add_column('users', sa.Column('telegram_opt_in', sa.Boolean(), nullable=False, default=False))
        print("Added telegram_opt_in column")
    else:
        print("telegram_opt_in column already exists")
    
    # Create indexes for better performance (check if they exist first)
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('users')]
    
    if 'ix_users_telegram_chat_id' not in existing_indexes:
        op.create_index('ix_users_telegram_chat_id', 'users', ['telegram_chat_id'])
        print("Created ix_users_telegram_chat_id index")
    else:
        print("ix_users_telegram_chat_id index already exists")
        
    if 'ix_users_telegram_link_code' not in existing_indexes:
        op.create_index('ix_users_telegram_link_code', 'users', ['telegram_link_code'], unique=True)
        print("Created ix_users_telegram_link_code index")
    else:
        print("ix_users_telegram_link_code index already exists")


def downgrade():
    """Remove Telegram integration fields from users table"""
    # Drop indexes first
    op.drop_index('ix_users_telegram_link_code', 'users')
    op.drop_index('ix_users_telegram_chat_id', 'users')
    
    # Drop columns
    op.drop_column('users', 'telegram_opt_in')
    op.drop_column('users', 'telegram_link_code')
    op.drop_column('users', 'telegram_username')
    op.drop_column('users', 'telegram_chat_id')