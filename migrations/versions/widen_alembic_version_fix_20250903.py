"""Ensure alembic_version.version_num is VARCHAR(64) on Postgres

Revision ID: widen_version_fix_20250903
Revises: invoice_sequences_20250903
Create Date: 2025-09-03
"""

from alembic import op
import sqlalchemy as sa


revision = 'widen_version_fix_20250903'
down_revision = 'invoice_sequences_20250903'
branch_labels = None
depends_on = None


def upgrade():
    try:
        bind = op.get_bind()
        if bind.dialect.name == 'postgresql':
            op.alter_column(
                'alembic_version',
                'version_num',
                type_=sa.String(length=64),
                existing_type=sa.String(length=32)
            )
    except Exception:
        # Best-effort; ignore if already widened or not applicable
        pass


def downgrade():
    try:
        bind = op.get_bind()
        if bind.dialect.name == 'postgresql':
            op.alter_column(
                'alembic_version',
                'version_num',
                type_=sa.String(length=32),
                existing_type=sa.String(length=64)
            )
    except Exception:
        pass


