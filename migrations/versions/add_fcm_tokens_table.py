"""Add FCM tokens table for multi-device push notifications

Revision ID: fcm_tokens_001
Revises: existing_revision
Create Date: 2025-01-25 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers
revision = 'fcm_tokens_001'
down_revision = 'vtck_20250819a6'
branch_labels = None
depends_on = None

def upgrade():
    """Create FCM tokens table if it doesn't exist."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    
    # Check if table already exists
    if 'fcm_tokens' not in inspector.get_table_names():
        # Create FCM tokens table
        op.create_table('fcm_tokens',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('token', sa.String(length=500), nullable=False),
            sa.Column('device_type', sa.String(length=20), nullable=False),
            sa.Column('device_info', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
            sa.Column('created_at', sa.DateTime(), nullable=True, default=datetime.utcnow),
            sa.Column('last_used', sa.DateTime(), nullable=True, default=datetime.utcnow),
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('token')
        )
        print("Created fcm_tokens table")
    else:
        print("fcm_tokens table already exists, skipping creation")
    
    # Create indexes for better performance (check if they exist first)
    existing_indexes = [idx['name'] for idx in inspector.get_indexes('fcm_tokens')]
    
    if 'idx_fcm_tokens_user_id' not in existing_indexes:
        op.create_index('idx_fcm_tokens_user_id', 'fcm_tokens', ['user_id'])
        print("Created idx_fcm_tokens_user_id index")
    
    if 'idx_fcm_tokens_active' not in existing_indexes:
        op.create_index('idx_fcm_tokens_active', 'fcm_tokens', ['is_active'])
        print("Created idx_fcm_tokens_active index")
        
    if 'idx_fcm_tokens_device_type' not in existing_indexes:
        op.create_index('idx_fcm_tokens_device_type', 'fcm_tokens', ['device_type'])
        print("Created idx_fcm_tokens_device_type index")

def downgrade():
    # Drop indexes
    op.drop_index('idx_fcm_tokens_device_type', table_name='fcm_tokens')
    op.drop_index('idx_fcm_tokens_active', table_name='fcm_tokens')
    op.drop_index('idx_fcm_tokens_user_id', table_name='fcm_tokens')
    
    # Drop table
    op.drop_table('fcm_tokens')