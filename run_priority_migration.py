#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Run priority migration directly on Heroku database."""

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

    print("\n1. Checking if priority column already exists...")
    cur.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name='crm_contacts'
        AND column_name='priority';
    """)

    if cur.fetchone():
        print("   ✓ Priority column already exists - migration not needed!")
        cur.close()
        conn.close()
        print("\nNo changes needed. Exiting.")
        exit(0)

    print("   → Priority column doesn't exist, proceeding with migration...")

    print("\n2. Adding priority column to crm_contacts...")
    cur.execute("""
        ALTER TABLE crm_contacts
        ADD COLUMN priority VARCHAR(20) DEFAULT 'none';
    """)
    print("   ✓ Column added successfully")

    print("\n3. Creating index on priority column...")
    cur.execute("""
        CREATE INDEX ix_crm_contacts_priority ON crm_contacts(priority);
    """)
    print("   ✓ Index created successfully")

    print("\n4. Verifying the changes...")
    cur.execute("""
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'crm_contacts'
        AND column_name = 'priority';
    """)

    result = cur.fetchone()
    if result:
        column_name, data_type, default = result
        print(f"   ✓ Column: {column_name}")
        print(f"   ✓ Type: {data_type}")
        print(f"   ✓ Default: {default}")
    else:
        print("   ⚠️  Could not verify column")

    # Commit changes
    conn.commit()
    print("\n✓ Changes committed to database")

    cur.close()
    conn.close()

    print("\n" + "="*60)
    print("Priority migration completed successfully!")
    print("The CRM now has priority field with these options:")
    print("  - urgent: 🔴 Urgent contacts")
    print("  - hot: 🟡 Hot leads")
    print("  - nurture: 🔵 Long-term nurture")
    print("  - routine: ⚪ Routine contacts")
    print("  - none: No priority (default)")
    print("="*60)

except Exception as e:
    print(f"\n❌ Error: {e}")
    if conn:
        conn.rollback()
        print("Changes rolled back")
    exit(1)
