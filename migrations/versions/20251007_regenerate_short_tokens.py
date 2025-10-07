from alembic import op
import sqlalchemy as sa
import secrets

# revision identifiers, used by Alembic.
revision = '20251007_regenerate_short_tokens'
down_revision = '20251007_add_authority_to_act'
branch_labels = None
depends_on = None


def _table_exists(conn, table_name: str) -> bool:
    insp = sa.inspect(conn)
    return table_name in insp.get_table_names()


def upgrade():
    """Regenerate all existing tokens with shorter format (12 bytes instead of 48)."""
    conn = op.get_bind()

    if not _table_exists(conn, 'authority_to_act_tokens'):
        # Table doesn't exist yet, nothing to do
        return

    # Get all tokens
    result = conn.execute(sa.text("SELECT id FROM authority_to_act_tokens"))
    token_ids = [row[0] for row in result]

    # Regenerate each token with new shorter format
    for token_id in token_ids:
        # Generate new short token
        new_token = secrets.token_urlsafe(12)  # 12 bytes = ~16 characters

        # Ensure uniqueness
        while True:
            check = conn.execute(
                sa.text("SELECT COUNT(*) FROM authority_to_act_tokens WHERE token = :token"),
                {"token": new_token}
            ).scalar()
            if check == 0:
                break
            new_token = secrets.token_urlsafe(12)

        # Update the token
        conn.execute(
            sa.text("UPDATE authority_to_act_tokens SET token = :new_token WHERE id = :id"),
            {"new_token": new_token, "id": token_id}
        )

    conn.commit()


def downgrade():
    # No downgrade needed - tokens are still valid, just shorter
    pass
