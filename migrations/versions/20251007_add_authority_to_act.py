from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20251007_add_authority_to_act'
down_revision = '20251001_add_v3_job_reports'
branch_labels = None
depends_on = None


TABLE_NAME = 'authority_to_act_tokens'


def _table_exists(conn, table_name: str) -> bool:
    insp = sa.inspect(conn)
    return table_name in insp.get_table_names()


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    insp = sa.inspect(conn)
    if not _table_exists(conn, table_name):
        return False
    cols = [c['name'] for c in insp.get_columns(table_name)]
    return column_name in cols


def upgrade():
    conn = op.get_bind()

    if not _table_exists(conn, TABLE_NAME):
        op.create_table(
            TABLE_NAME,
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('token', sa.String(length=64), unique=True, nullable=False, index=True),
            sa.Column('form_type', sa.String(length=100), nullable=True),
            sa.Column('job_id', sa.Integer(), nullable=True),
            sa.Column('created_by', sa.Integer(), nullable=False),
            sa.Column('client_name', sa.String(length=255), nullable=True),
            sa.Column('client_email', sa.String(length=255), nullable=True),
            sa.Column('property_address', sa.String(length=500), nullable=True),
            sa.Column('status', sa.String(length=20), server_default='pending', nullable=False),
            sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('submitted_at', sa.DateTime(), nullable=True),
            sa.Column('submission_data', postgresql.JSON(astext_type=sa.Text()), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.Column('expires_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
            sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        )
        # Indexes for performance
        try:
            op.create_index('ix_authority_to_act_token', TABLE_NAME, ['token'], unique=True)
        except Exception:
            pass
        try:
            op.create_index('ix_authority_to_act_status', TABLE_NAME, ['status'])
        except Exception:
            pass
        try:
            op.create_index('ix_authority_to_act_form_type', TABLE_NAME, ['form_type'])
        except Exception:
            pass
    else:
        # Table exists: ensure required columns are present
        if not _column_exists(conn, TABLE_NAME, 'token'):
            op.add_column(TABLE_NAME, sa.Column('token', sa.String(length=64), unique=True, nullable=False, index=True))
        if not _column_exists(conn, TABLE_NAME, 'form_type'):
            op.add_column(TABLE_NAME, sa.Column('form_type', sa.String(length=100), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'job_id'):
            op.add_column(TABLE_NAME, sa.Column('job_id', sa.Integer(), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'created_by'):
            op.add_column(TABLE_NAME, sa.Column('created_by', sa.Integer(), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'client_name'):
            op.add_column(TABLE_NAME, sa.Column('client_name', sa.String(length=255), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'client_email'):
            op.add_column(TABLE_NAME, sa.Column('client_email', sa.String(length=255), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'property_address'):
            op.add_column(TABLE_NAME, sa.Column('property_address', sa.String(length=500), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'status'):
            op.add_column(TABLE_NAME, sa.Column('status', sa.String(length=20), server_default='pending', nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'is_read'):
            op.add_column(TABLE_NAME, sa.Column('is_read', sa.Boolean(), server_default='false', nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'submitted_at'):
            op.add_column(TABLE_NAME, sa.Column('submitted_at', sa.DateTime(), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'submission_data'):
            op.add_column(TABLE_NAME, sa.Column('submission_data', postgresql.JSON(astext_type=sa.Text()), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'created_at'):
            op.add_column(TABLE_NAME, sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'expires_at'):
            op.add_column(TABLE_NAME, sa.Column('expires_at', sa.DateTime(), nullable=True))

        # Ensure foreign keys exist
        try:
            op.create_foreign_key(
                constraint_name='fk_authority_to_act_job_id',
                source_table=TABLE_NAME,
                referent_table='jobs',
                local_cols=['job_id'],
                remote_cols=['id'],
            )
        except Exception:
            pass
        try:
            op.create_foreign_key(
                constraint_name='fk_authority_to_act_created_by',
                source_table=TABLE_NAME,
                referent_table='users',
                local_cols=['created_by'],
                remote_cols=['id'],
            )
        except Exception:
            pass

        # Ensure indexes exist
        insp = sa.inspect(conn)
        existing_indexes = {ix['name'] for ix in insp.get_indexes(TABLE_NAME)}
        if 'ix_authority_to_act_token' not in existing_indexes:
            try:
                op.create_index('ix_authority_to_act_token', TABLE_NAME, ['token'], unique=True)
            except Exception:
                pass
        if 'ix_authority_to_act_status' not in existing_indexes:
            try:
                op.create_index('ix_authority_to_act_status', TABLE_NAME, ['status'])
            except Exception:
                pass
        if 'ix_authority_to_act_form_type' not in existing_indexes:
            try:
                op.create_index('ix_authority_to_act_form_type', TABLE_NAME, ['form_type'])
            except Exception:
                pass


def downgrade():
    conn = op.get_bind()
    if _table_exists(conn, TABLE_NAME):
        op.drop_table(TABLE_NAME)
