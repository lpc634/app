"""Ensure invoices.supplier_id and vat_rate exist (post-deploy guard)

Revision ID: post_deploy_invoices_cols_20250903
Revises: supplier_invoicing_20250903
Create Date: 2025-09-03
"""

from alembic import op
import sqlalchemy as sa

revision = 'post_deploy_invoices_cols_20250903'
down_revision = 'invoice_sequences_20250903'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        # Add columns if missing; Postgres-safe DO $$ blocks
        op.execute(
            """
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='invoices' AND column_name='supplier_id'
                ) THEN
                    ALTER TABLE invoices ADD COLUMN supplier_id INTEGER;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name='invoices' AND column_name='vat_rate'
                ) THEN
                    ALTER TABLE invoices ADD COLUMN vat_rate NUMERIC(5,4);
                END IF;
            END$$;
            """
        )

        # Add FK if supplier_profiles exists and FK not present
        op.execute(
            """
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='supplier_profiles')
                   AND NOT EXISTS (
                     SELECT 1 FROM information_schema.table_constraints
                     WHERE table_name='invoices' AND constraint_type='FOREIGN KEY' AND constraint_name='fk_invoices_supplier_id'
                   )
                THEN
                  ALTER TABLE invoices
                    ADD CONSTRAINT fk_invoices_supplier_id
                    FOREIGN KEY (supplier_id) REFERENCES supplier_profiles(id) ON DELETE SET NULL;
                END IF;
            END$$;
            """
        )
    else:
        # Generic/SQLite-safe path: inspect and add missing columns, skip FK
        inspector = sa.inspect(bind)
        inv_cols = [c['name'] for c in inspector.get_columns('invoices')]
        with op.batch_alter_table('invoices') as batch:
            if 'supplier_id' not in inv_cols:
                batch.add_column(sa.Column('supplier_id', sa.Integer(), nullable=True))
            if 'vat_rate' not in inv_cols:
                batch.add_column(sa.Column('vat_rate', sa.Numeric(precision=5, scale=4), nullable=True))


def downgrade():
    # Do nothing; columns may be in use
    pass


