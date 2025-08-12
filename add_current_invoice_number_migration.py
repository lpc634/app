#!/usr/bin/env python3
"""
Production Migration: Add current_invoice_number field
Run this script to add the current_invoice_number field to the production database
"""
import os
import sys
import psycopg2
from urllib.parse import urlparse

def run_migration():
    """Add current_invoice_number field to production database"""
    
    # Get database URL from environment
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not found")
        return False
    
    # Parse database URL
    url = urlparse(database_url)
    
    try:
        # Connect to database
        conn = psycopg2.connect(
            host=url.hostname,
            port=url.port,
            database=url.path[1:],
            user=url.username,
            password=url.password,
            sslmode='require'
        )
        
        cursor = conn.cursor()
        
        print("Connected to production database")
        
        # Check if column already exists
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'current_invoice_number'
        """)
        
        if cursor.fetchone():
            print("✓ current_invoice_number column already exists")
            conn.close()
            return True
        
        print("Adding current_invoice_number column to users table...")
        
        # Add the column
        cursor.execute("""
            ALTER TABLE users 
            ADD COLUMN current_invoice_number INTEGER DEFAULT 0
        """)
        
        print("✓ Column added successfully")
        
        # Backfill data from agent_invoice_next for backward compatibility
        print("Backfilling current_invoice_number from existing agent_invoice_next...")
        
        cursor.execute("""
            UPDATE users 
            SET current_invoice_number = COALESCE(agent_invoice_next - 1, 0)
            WHERE agent_invoice_next IS NOT NULL
        """)
        
        rows_updated = cursor.rowcount
        print(f"✓ Updated {rows_updated} users with existing invoice sequences")
        
        # Set to 0 for users with no previous invoices
        cursor.execute("""
            UPDATE users 
            SET current_invoice_number = 0
            WHERE agent_invoice_next IS NULL OR current_invoice_number IS NULL
        """)
        
        additional_rows = cursor.rowcount
        print(f"✓ Set default value for {additional_rows} users")
        
        # Commit changes
        conn.commit()
        print("✅ Migration completed successfully!")
        
        # Verify the migration
        cursor.execute("SELECT COUNT(*) FROM users WHERE current_invoice_number IS NOT NULL")
        total_users = cursor.fetchone()[0]
        print(f"✓ Verification: {total_users} users now have current_invoice_number field")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if 'conn' in locals():
            conn.rollback()
            conn.close()
        return False

if __name__ == "__main__":
    print("=" * 70)
    print("PRODUCTION DATABASE MIGRATION")
    print("Adding current_invoice_number field for flexible numbering system")
    print("=" * 70)
    
    success = run_migration()
    
    if success:
        print("\n" + "=" * 70)
        print("✅ MIGRATION SUCCESSFUL - FLEXIBLE NUMBERING READY!")
        print("=" * 70)
        print("\nWhat was added:")
        print("• current_invoice_number field in users table")
        print("• Backfilled from existing agent_invoice_next values")
        print("• Default value of 0 for new agents")
        print("\nFlexible numbering system is now active in production!")
    else:
        print("\n" + "=" * 70)
        print("❌ MIGRATION FAILED")
        print("=" * 70)
        sys.exit(1)