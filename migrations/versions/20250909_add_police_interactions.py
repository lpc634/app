from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250909_add_police_interactions'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'police_interactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('job_address', sa.String(length=255), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=True),
        sa.Column('force', sa.String(length=100), nullable=False),
        sa.Column('officers', sa.JSON(), nullable=False),
        sa.Column('reason', sa.String(length=200), nullable=False),
        sa.Column('outcome', sa.String(length=200), nullable=False),
        sa.Column('helpfulness', sa.Integer(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.Column('created_by_role', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id']),
    )


def downgrade():
    op.drop_table('police_interactions')


