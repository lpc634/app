"""Add contact form submissions table

Revision ID: 20251027_add_contact_form_submissions
Revises: 20251007_regenerate_short_tokens
Create Date: 2025-10-27

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251027_add_contact_form_submissions'
down_revision = '20251007_regenerate_short_tokens'
branch_labels = None
depends_on = None


def upgrade():
    # Check if table already exists
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'contact_form_submissions' in inspector.get_table_names():
        return  # Table already exists, skip creation

    # Create contact_form_submissions table
    op.create_table(
        'contact_form_submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('company_name', sa.String(length=200), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('phone', sa.String(length=50), nullable=False),
        sa.Column('callback_requested', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('comments', sa.Text(), nullable=True),
        sa.Column('gpt_reply', sa.Text(), nullable=True),
        sa.Column('request_id', sa.String(length=100), nullable=True),
        sa.Column('telegram_sent', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('email_sent', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='pending'),
        sa.Column('assigned_to_user_id', sa.Integer(), nullable=True),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('contacted_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['assigned_to_user_id'], ['users.id'], ),
        sa.UniqueConstraint('request_id')
    )

    # Create indexes for common queries
    op.create_index('ix_contact_form_submissions_status', 'contact_form_submissions', ['status'])
    op.create_index('ix_contact_form_submissions_created_at', 'contact_form_submissions', ['created_at'])
    op.create_index('ix_contact_form_submissions_email', 'contact_form_submissions', ['email'])
    op.create_index('ix_contact_form_submissions_callback_requested', 'contact_form_submissions', ['callback_requested'])


def downgrade():
    op.drop_index('ix_contact_form_submissions_callback_requested', table_name='contact_form_submissions')
    op.drop_index('ix_contact_form_submissions_email', table_name='contact_form_submissions')
    op.drop_index('ix_contact_form_submissions_created_at', table_name='contact_form_submissions')
    op.drop_index('ix_contact_form_submissions_status', table_name='contact_form_submissions')
    op.drop_table('contact_form_submissions')
