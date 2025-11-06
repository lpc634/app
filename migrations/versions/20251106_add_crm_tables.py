"""Add CRM tables for contact management

Revision ID: 20251106_add_crm_tables
Revises: 20251027_add_contact_form_submissions
Create Date: 2025-11-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic
revision = '20251106_add_crm_tables'
down_revision = '20251027_add_contact_form_submissions'
branch_labels = None
depends_on = None


def upgrade():
    """Create CRM tables for admin-only contact management"""

    # Check if tables already exist
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # Early return if CRM tables already exist
    if 'crm_contacts' in existing_tables:
        print(" CRM tables already exist, skipping creation")
        return

    # Create crm_contacts table
    op.create_table('crm_contacts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=120), nullable=False),
        sa.Column('phone', sa.String(length=20), nullable=True),
        sa.Column('company_name', sa.String(length=100), nullable=True),
        sa.Column('contact_type', sa.String(length=20), nullable=False),
        sa.Column('how_found_us', sa.String(length=50), nullable=True),
        sa.Column('referral_partner_name', sa.String(length=100), nullable=True),
        sa.Column('property_address', sa.Text(), nullable=True),
        sa.Column('service_type', sa.String(length=50), nullable=True),
        sa.Column('urgency_level', sa.String(length=20), nullable=True),
        sa.Column('current_stage', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('next_followup_date', sa.Date(), nullable=True),
        sa.Column('potential_value', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('total_revenue', sa.Numeric(precision=10, scale=2), nullable=False, server_default='0.0'),
        sa.Column('total_jobs_referred', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('last_referral_date', sa.Date(), nullable=True),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for crm_contacts (only if they don't exist)
    try:
        op.create_index('ix_crm_contacts_name', 'crm_contacts', ['name'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_contacts_email', 'crm_contacts', ['email'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_contacts_contact_type', 'crm_contacts', ['contact_type'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_contacts_current_stage', 'crm_contacts', ['current_stage'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_contacts_status', 'crm_contacts', ['status'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_contacts_next_followup_date', 'crm_contacts', ['next_followup_date'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_contacts_owner_id', 'crm_contacts', ['owner_id'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_contacts_created_at', 'crm_contacts', ['created_at'])
    except Exception:
        pass

    # Create crm_notes table
    op.create_table('crm_notes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('note_type', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for crm_notes
    try:
        op.create_index('ix_crm_notes_contact_id', 'crm_notes', ['contact_id'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_notes_note_type', 'crm_notes', ['note_type'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_notes_created_at', 'crm_notes', ['created_at'])
    except Exception:
        pass

    # Create crm_files table
    op.create_table('crm_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(length=255), nullable=False),
        sa.Column('file_type', sa.String(length=50), nullable=True),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('s3_url', sa.String(length=500), nullable=False),
        sa.Column('category', sa.String(length=50), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('uploaded_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['uploaded_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for crm_files
    try:
        op.create_index('ix_crm_files_contact_id', 'crm_files', ['contact_id'])
    except Exception:
        pass

    try:
        op.create_index('ix_crm_files_created_at', 'crm_files', ['created_at'])
    except Exception:
        pass

    # Create crm_email_configs table
    op.create_table('crm_email_configs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('admin_id', sa.Integer(), nullable=False),
        sa.Column('email_address', sa.String(length=120), nullable=False),
        sa.Column('imap_server', sa.String(length=100), nullable=False, server_default='nebula.galaxywebsolutions.com'),
        sa.Column('imap_port', sa.Integer(), nullable=False, server_default='993'),
        sa.Column('encrypted_password', sa.Text(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('last_sync', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['admin_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('admin_id')
    )

    # Create index for crm_email_configs
    try:
        op.create_index('ix_crm_email_configs_admin_id', 'crm_email_configs', ['admin_id'])
    except Exception:
        pass

    print(" CRM tables created successfully")


def downgrade():
    """Drop CRM tables"""

    # Check if tables exist before dropping
    from sqlalchemy import inspect
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_tables = inspector.get_table_names()

    # Drop tables in reverse order (respecting foreign keys)
    if 'crm_email_configs' in existing_tables:
        op.drop_table('crm_email_configs')

    if 'crm_files' in existing_tables:
        op.drop_table('crm_files')

    if 'crm_notes' in existing_tables:
        op.drop_table('crm_notes')

    if 'crm_contacts' in existing_tables:
        op.drop_table('crm_contacts')

    print(" CRM tables dropped successfully")
