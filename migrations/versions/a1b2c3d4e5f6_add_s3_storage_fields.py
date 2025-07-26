"""Add S3 storage fields for document and invoice management

Revision ID: add_s3_storage_fields
Revises: 
Create Date: 2025-01-26 08:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '25573440985f'
depends_on = None


def upgrade():
    """Add S3 storage fields to User and Invoice tables"""
    
    # Add document_files JSON field to users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('document_files', sa.JSON(), nullable=True))
    
    # Add pdf_file_url field to invoices table  
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.add_column(sa.Column('pdf_file_url', sa.String(length=500), nullable=True))


def downgrade():
    """Remove S3 storage fields from User and Invoice tables"""
    
    # Remove pdf_file_url field from invoices table
    with op.batch_alter_table('invoices', schema=None) as batch_op:
        batch_op.drop_column('pdf_file_url')
    
    # Remove document_files field from users table
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('document_files')