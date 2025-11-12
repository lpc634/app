#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Fix CRM notes foreign key constraint."""

import os
import sys
import psycopg2

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

# Get database URL from environment or Heroku
DATABASE_URL = os.environ.get('DATABASE_URL')

if not DATABASE_URL:
    # Try to get from Heroku
    import subprocess
    try:
        result = subprocess.run(['heroku', 'config:get', 'DATABASE_URL'],
                              capture_output=True, text=True, check=True)
        DATABASE_URL = result.stdout.strip()
    except:
        print("Could not get DATABASE_URL")
        exit(1)

# Fix postgres:// to postgresql:// for psycopg2
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"Connecting to database...")
print(f"Database: {DATABASE_URL.split('@')[1] if '@' in DATABASE_URL else 'unknown'}")

try:
    # Connect to database
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    print("\n1. Dropping old foreign key constraint...")
    try:
        cur.execute("ALTER TABLE crm_notes DROP CONSTRAINT IF EXISTS crm_notes_created_by_fkey;")
        print("   ✓ Old constraint dropped (or didn't exist)")
    except Exception as e:
        print(f"   Note: {e}")

    print("\n2. Adding new foreign key constraint to crm_users...")
    cur.execute("""
        ALTER TABLE crm_notes
        ADD CONSTRAINT crm_notes_created_by_crm_users_fkey
        FOREIGN KEY (created_by) REFERENCES crm_users(id);
    """)
    print("   ✓ New constraint added successfully")

    print("\n3. Verifying the change...")
    cur.execute("""
        SELECT
            tc.constraint_name,
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name='crm_notes'
        AND kcu.column_name='created_by';
    """)

    result = cur.fetchone()
    if result:
        constraint_name, table_name, column_name, foreign_table, foreign_column = result
        print(f"   ✓ Constraint: {constraint_name}")
        print(f"   ✓ {table_name}.{column_name} -> {foreign_table}.{foreign_column}")

        if foreign_table == 'crm_users':
            print("\n✅ SUCCESS! Foreign key now correctly references crm_users table")
        else:
            print(f"\n⚠️  Warning: Foreign key references {foreign_table}, not crm_users")
    else:
        print("   ⚠️  Could not verify constraint")

    # Commit changes
    conn.commit()
    print("\n✓ Changes committed to database")

    cur.close()
    conn.close()

    print("\n" + "="*60)
    print("Migration completed successfully!")
    print("Please restart your Flask backend for changes to take effect.")
    print("="*60)

except Exception as e:
    print(f"\n❌ Error: {e}")
    if conn:
        conn.rollback()
        print("Changes rolled back")
    exit(1)
