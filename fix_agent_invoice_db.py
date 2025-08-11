# fix_agent_invoice_db.py  (put this in C:\Dev\app)
import sys
from textwrap import dedent
try:
    import psycopg2
except ImportError:
    print("Run: pip install psycopg2-binary"); sys.exit(1)

# <<< paste your full Heroku Postgres URI between the quotes >>>
DATABASE_URL = "postgres://u6g5lnv1i1ojuo:pffa82d012caaa715df851dcc5052af32c193f4c47fc4b0fd0f7e17176337db2c@cfcojm7sp9tfip.cluster-czz5s0kz4scl.eu-west-1.rds.amazonaws.com:5432/dcu60nqeba2odp"

SQL = [
    "ALTER TABLE users    ADD COLUMN IF NOT EXISTS agent_invoice_next   integer NOT NULL DEFAULT 1;",
    "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS agent_invoice_number integer;",
    dedent("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = 'uq_invoices_agent_agentno'
        ) THEN
            EXECUTE 'CREATE UNIQUE INDEX uq_invoices_agent_agentno
                     ON invoices (agent_id, agent_invoice_number)
                     WHERE agent_invoice_number IS NOT NULL';
        END IF;
    END$$;
    """),
    dedent("""
    WITH mx AS (
      SELECT agent_id, MAX(agent_invoice_number) AS mxno
      FROM invoices
      GROUP BY agent_id
    )
    UPDATE users u
    SET agent_invoice_next = COALESCE(mx.mxno, 0) + 1
    FROM mx
    WHERE u.id = mx.agent_id;
    """),
    "ALTER TABLE users ALTER COLUMN agent_invoice_next DROP DEFAULT;"
]

def main():
    conn = psycopg2.connect(DATABASE_URL, sslmode="require"); conn.autocommit = True
    cur = conn.cursor()
    try:
        for i, stmt in enumerate(SQL, 1):
            print(f"Step {i}..."); cur.execute(stmt)
        print("✅ DB updated.")
    finally:
        cur.close(); conn.close()

if __name__ == "__main__":
    main()
