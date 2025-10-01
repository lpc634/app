from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251001_add_v3_job_reports'
down_revision = '20250909_add_police_interactions'
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

    if not _table_exists(conn, TABLE_NAME):
        op.create_table(
            TABLE_NAME,
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('job_id', sa.Integer(), sa.ForeignKey('jobs.id'), nullable=True),
            sa.Column('agent_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
            sa.Column('form_type', sa.String(length=50), nullable=False),
            sa.Column('status', sa.String(length=20), nullable=False, server_default='submitted'),
            sa.Column('report_data', postgresql.JSON(astext_type=sa.Text()), nullable=False),
            sa.Column('photo_urls', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('submitted_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('reviewed_at', sa.DateTime(), nullable=True),
            sa.Column('reviewed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        )
        # Indexes for performance
        try:
            op.create_index('ix_v3_reports_agent_submitted', TABLE_NAME, ['agent_id', 'submitted_at'])
        except Exception:
            pass
        try:
            op.create_index('ix_v3_reports_job_id', TABLE_NAME, ['job_id'])
        except Exception:
            pass
        try:
            op.create_index('ix_v3_reports_status', TABLE_NAME, ['status'])
        except Exception:
            pass
    else:
        # Table exists: ensure required columns are present
        if not _column_exists(conn, TABLE_NAME, 'job_id'):
            op.add_column(TABLE_NAME, sa.Column('job_id', sa.Integer(), nullable=True))
            try:
                op.create_foreign_key(
                    constraint_name='fk_v3_reports_job_id',
                    source_table=TABLE_NAME,
                    referent_table='jobs',
                    local_cols=['job_id'],
                    remote_cols=['id'],
                )
            except Exception:
                pass

        if not _column_exists(conn, TABLE_NAME, 'agent_id'):
            op.add_column(TABLE_NAME, sa.Column('agent_id', sa.Integer(), nullable=False))
            try:
                op.create_foreign_key(
                    constraint_name='fk_v3_reports_agent_id',
                    source_table=TABLE_NAME,
                    referent_table='users',
                    local_cols=['agent_id'],
                    remote_cols=['id'],
                )
            except Exception:
                pass

        if not _column_exists(conn, TABLE_NAME, 'form_type'):
            op.add_column(TABLE_NAME, sa.Column('form_type', sa.String(length=50), nullable=False))

        if not _column_exists(conn, TABLE_NAME, 'status'):
            op.add_column(TABLE_NAME, sa.Column('status', sa.String(length=20), nullable=False, server_default='submitted'))

        if not _column_exists(conn, TABLE_NAME, 'report_data'):
            op.add_column(TABLE_NAME, sa.Column('report_data', postgresql.JSON(astext_type=sa.Text()), nullable=False))

        if not _column_exists(conn, TABLE_NAME, 'photo_urls'):
            op.add_column(TABLE_NAME, sa.Column('photo_urls', postgresql.JSON(astext_type=sa.Text()), nullable=True))

        if not _column_exists(conn, TABLE_NAME, 'submitted_at'):
            op.add_column(TABLE_NAME, sa.Column('submitted_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))

        if not _column_exists(conn, TABLE_NAME, 'reviewed_at'):
            op.add_column(TABLE_NAME, sa.Column('reviewed_at', sa.DateTime(), nullable=True))

        if not _column_exists(conn, TABLE_NAME, 'reviewed_by'):
            op.add_column(TABLE_NAME, sa.Column('reviewed_by', sa.Integer(), nullable=True))
            try:
                op.create_foreign_key(
                    constraint_name='fk_v3_reports_reviewed_by',
                    source_table=TABLE_NAME,
                    referent_table='users',
                    local_cols=['reviewed_by'],
                    remote_cols=['id'],
                )
            except Exception:
                pass

        # Ensure indexes exist
        insp = sa.inspect(conn)
        existing_indexes = {ix['name'] for ix in insp.get_indexes(TABLE_NAME)}

        if 'ix_v3_reports_agent_submitted' not in existing_indexes:
            try:
                op.create_index('ix_v3_reports_agent_submitted', TABLE_NAME, ['agent_id', 'submitted_at'])
            except Exception:
                pass

        if 'ix_v3_reports_job_id' not in existing_indexes:
            try:
                op.create_index('ix_v3_reports_job_id', TABLE_NAME, ['job_id'])
            except Exception:
                pass

        if 'ix_v3_reports_status' not in existing_indexes:
            try:
                op.create_index('ix_v3_reports_status', TABLE_NAME, ['status'])
            except Exception:
                pass


def downgrade():
    conn = op.get_bind()
    if _table_exists(conn, TABLE_NAME):
        op.drop_table(TABLE_NAME)
