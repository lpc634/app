"""
Check and create missing CRM tables
"""
import os
from sqlalchemy import create_engine, text

# Get database URL from environment
database_url = os.environ.get('DATABASE_URL')
if not database_url:
    print("ERROR: DATABASE_URL not found in environment")
    exit(1)

# Fix postgres:// to postgresql:// if needed
if database_url.startswith('postgres://'):
    database_url = database_url.replace('postgres://', 'postgresql://', 1)

print(f"Connecting to database...")
engine = create_engine(database_url)

try:
    with engine.connect() as conn:
        # Check which CRM tables exist
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema='public' AND table_name LIKE 'crm%'
            ORDER BY table_name
        """))

        existing_tables = [row[0] for row in result.fetchall()]
        print(f"\nExisting CRM tables: {existing_tables}")

        # Check if crm_tasks table exists
        if 'crm_tasks' not in existing_tables:
            print("\n❌ crm_tasks table is missing! Creating it now...")

            # Create crm_tasks table
            conn.execute(text("""
                CREATE TABLE crm_tasks (
                    id SERIAL PRIMARY KEY,
                    crm_user_id INTEGER NOT NULL REFERENCES crm_users(id) ON DELETE CASCADE,
                    contact_id INTEGER NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE,
                    task_type VARCHAR(50) NOT NULL,
                    title VARCHAR(255) NOT NULL,
                    due_date TIMESTAMP NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    completed_at TIMESTAMP,
                    notes TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """))
            conn.commit()
            print("✅ crm_tasks table created successfully!")
        else:
            print("\n✅ crm_tasks table exists")

            # Show table structure
            result = conn.execute(text("""
                SELECT column_name, data_type
                FROM information_schema.columns
                WHERE table_name = 'crm_tasks'
                ORDER BY ordinal_position
            """))
            columns = result.fetchall()
            print(f"   Columns ({len(columns)}):")
            for col_name, col_type in columns:
                print(f"   - {col_name}: {col_type}")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    exit(1)

print("\n✅ Script completed successfully!")
