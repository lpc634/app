"""Add Telegram integration fields

Revision ID: add_telegram_integration
Revises: 
Create Date: 2025-01-18 19:51:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'atel_20250819a5'
down_revision = 'acin_20250819a4'
branch_labels = None
depends_on = None


def upgrade():
    """Add Telegram integration fields to users table"""
    # Add Telegram fields to users table
    op.add_column('users', sa.Column('telegram_chat_id', sa.String(32), nullable=True))
    op.add_column('users', sa.Column('telegram_username', sa.String(64), nullable=True))
    op.add_column('users', sa.Column('telegram_link_token', sa.String(64), nullable=True))
    op.add_column('users', sa.Column('telegram_opt_in', sa.Boolean(), nullable=False, default=False))
    
    # Create indexes for better performance
    op.create_index('ix_users_telegram_chat_id', 'users', ['telegram_chat_id'])
    op.create_index('ix_users_telegram_link_token', 'users', ['telegram_link_token'], unique=True)


def downgrade():
    """Remove Telegram integration fields from users table"""
    # Drop indexes first
    op.drop_index('ix_users_telegram_link_token', 'users')
    op.drop_index('ix_users_telegram_chat_id', 'users')
    
    # Drop columns
    op.drop_column('users', 'telegram_opt_in')
    op.drop_column('users', 'telegram_link_token')
    op.drop_column('users', 'telegram_username')
    op.drop_column('users', 'telegram_chat_id')
