from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250909_add_police_interactions'
down_revision = 'post_deploy_invoices_cols_20250903'
branch_labels = None
depends_on = None


TABLE_NAME = 'police_interactions'


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
            sa.Column('job_address', sa.String(length=255), nullable=False),
            sa.Column('job_id', sa.Integer(), nullable=True),
            sa.Column('force', sa.String(length=100), nullable=False),
            sa.Column('officers', postgresql.JSON(astext_type=sa.Text()), nullable=False),
            sa.Column('reason', sa.String(length=200), nullable=False),
            sa.Column('outcome', sa.String(length=200), nullable=False),
            sa.Column('helpfulness', sa.Integer(), nullable=False),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('created_by_user_id', sa.Integer(), nullable=False),
            sa.Column('created_by_role', sa.String(length=20), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
            sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
        )
        # Indexes for performance
        try:
            op.create_index('ix_police_interactions_job_created_at', TABLE_NAME, ['job_id', 'created_at'])
        except Exception:
            pass
        try:
            op.create_index('ix_police_interactions_created_by', TABLE_NAME, ['created_by_user_id'])
        except Exception:
            pass
    else:
        # Table exists: ensure required columns are present with best-effort types
        if not _column_exists(conn, TABLE_NAME, 'job_address'):
            op.add_column(TABLE_NAME, sa.Column('job_address', sa.String(length=255), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'job_id'):
            op.add_column(TABLE_NAME, sa.Column('job_id', sa.Integer(), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'force'):
            op.add_column(TABLE_NAME, sa.Column('force', sa.String(length=100), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'officers'):
            op.add_column(TABLE_NAME, sa.Column('officers', postgresql.JSON(astext_type=sa.Text()), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'reason'):
            op.add_column(TABLE_NAME, sa.Column('reason', sa.String(length=200), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'outcome'):
            op.add_column(TABLE_NAME, sa.Column('outcome', sa.String(length=200), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'helpfulness'):
            op.add_column(TABLE_NAME, sa.Column('helpfulness', sa.Integer(), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'notes'):
            op.add_column(TABLE_NAME, sa.Column('notes', sa.Text(), nullable=True))
        if not _column_exists(conn, TABLE_NAME, 'created_by_user_id'):
            op.add_column(TABLE_NAME, sa.Column('created_by_user_id', sa.Integer(), nullable=False))
            # Best-effort FK create; ignore if already present
            try:
                op.create_foreign_key(
                    constraint_name='fk_police_interactions_created_by_user',
                    source_table=TABLE_NAME,
                    referent_table='users',
                    local_cols=['created_by_user_id'],
                    remote_cols=['id'],
                )
            except Exception:
                pass
        if not _column_exists(conn, TABLE_NAME, 'created_by_role'):
            op.add_column(TABLE_NAME, sa.Column('created_by_role', sa.String(length=20), nullable=False))
        if not _column_exists(conn, TABLE_NAME, 'created_at'):
            op.add_column(TABLE_NAME, sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False))
        # Ensure indexes exist
        insp = sa.inspect(conn)
        existing_indexes = {ix['name'] for ix in insp.get_indexes(TABLE_NAME)}
        if 'ix_police_interactions_job_created_at' not in existing_indexes:
            try:
                op.create_index('ix_police_interactions_job_created_at', TABLE_NAME, ['job_id', 'created_at'])
            except Exception:
                pass
        if 'ix_police_interactions_created_by' not in existing_indexes:
            try:
                op.create_index('ix_police_interactions_created_by', TABLE_NAME, ['created_by_user_id'])
            except Exception:
                pass


def downgrade():
    conn = op.get_bind()
    if _table_exists(conn, TABLE_NAME):
        op.drop_table(TABLE_NAME)


