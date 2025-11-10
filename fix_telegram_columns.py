"""
Script to manually add Telegram columns to crm_users table
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
        # Add columns one by one with IF NOT EXISTS
        columns = [
            ("telegram_chat_id", "VARCHAR(50)"),
            ("telegram_username", "VARCHAR(64)"),
            ("telegram_opt_in", "BOOLEAN DEFAULT TRUE"),
            ("telegram_link_code", "VARCHAR(16)")
        ]

        for col_name, col_type in columns:
            try:
                sql = text(f"ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS {col_name} {col_type}")
                conn.execute(sql)
                conn.commit()
                print(f"✅ Added column: {col_name}")
            except Exception as e:
                print(f"⚠️  Column {col_name}: {str(e)}")

        # Verify columns exist
        print("\nVerifying columns...")
        result = conn.execute(text("""
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'crm_users'
            AND column_name LIKE 'telegram%'
            ORDER BY column_name
        """))

        columns_found = result.fetchall()
        if columns_found:
            print(f"\n✅ Found {len(columns_found)} Telegram columns:")
            for row in columns_found:
                print(f"   - {row[0]}: {row[1]}")
        else:
            print("\n❌ No Telegram columns found in crm_users table!")

except Exception as e:
    print(f"❌ Error: {str(e)}")
    exit(1)

print("\n✅ Script completed successfully!")
