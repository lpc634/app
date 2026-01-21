from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20260121_add_submitted_by_override'
down_revision = '20251124_add_site_postcode'
branch_labels = None
depends_on = None


TABLE_NAME = 'v3_job_reports'


def _table_exists(conn, table_name: str) -> bool:
    insp = sa.inspect(conn)
    return table_name in insp.get_table_names()


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    insp = sa.inspect(conn)
    cols = [c['name'] for c in insp.get_columns(table_name)]
    return column_name in cols


def upgrade():
    conn = op.get_bind()

    if _table_exists(conn, TABLE_NAME):
        if not _column_exists(conn, TABLE_NAME, 'submitted_by_override'):
            op.add_column(
                TABLE_NAME,
                sa.Column('submitted_by_override', sa.String(length=100), nullable=True)
            )


def downgrade():
    conn = op.get_bind()
    if _table_exists(conn, TABLE_NAME):
        if _column_exists(conn, TABLE_NAME, 'submitted_by_override'):
            op.drop_column(TABLE_NAME, 'submitted_by_override')
