"""Add CRM emails table for email tracking

Revision ID: 20251107_add_crm_emails
Revises: 20251107_add_crm_users_auth
Create Date: 2025-11-07 23:24:42

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251107_add_crm_emails'
down_revision = '20251107_add_crm_users_auth'
branch_labels = None
depends_on = None


def upgrade():
    # Import for table existence checking
    from sqlalchemy import inspect

    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # Create crm_emails table
    if 'crm_emails' not in existing_tables:
        op.create_table('crm_emails',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('contact_id', sa.Integer(), nullable=False),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('email_uid', sa.String(length=255), nullable=False),
            sa.Column('subject', sa.String(length=500), nullable=True),
            sa.Column('sender', sa.String(length=255), nullable=False),
            sa.Column('recipient', sa.String(length=255), nullable=False),
            sa.Column('date', sa.DateTime(), nullable=False),
            sa.Column('body_text', sa.Text(), nullable=True),
            sa.Column('body_html', sa.Text(), nullable=True),
            sa.Column('is_sent', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('synced_at', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
            sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['user_id'], ['crm_users.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('user_id', 'email_uid', name='unique_user_email_uid')
        )

        # Create indexes for faster queries
        op.create_index('idx_crm_emails_contact_id', 'crm_emails', ['contact_id'])
        op.create_index('idx_crm_emails_user_id', 'crm_emails', ['user_id'])
        op.create_index('idx_crm_emails_date', 'crm_emails', ['date'])

        print(" ✅ Created crm_emails table")
    else:
        print(" ⏭️  crm_emails table already exists")


def downgrade():
    # Import for table existence checking
    from sqlalchemy import inspect

    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    if 'crm_emails' in existing_tables:
        op.drop_index('idx_crm_emails_date', table_name='crm_emails')
        op.drop_index('idx_crm_emails_user_id', table_name='crm_emails')
        op.drop_index('idx_crm_emails_contact_id', table_name='crm_emails')
        op.drop_table('crm_emails')
        print(" ✅ Dropped crm_emails table")
    else:
        print(" ⏭️  crm_emails table doesn't exist, skipping drop")
