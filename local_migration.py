#!/usr/bin/env python3
"""
Local database migration to add current_invoice_number field
"""

import sys
import sqlite3
import os

# Add src to path
sys.path.insert(0, 'src')

def migrate_local_database():
    """Add the missing columns to local database"""
    print("=" * 60)
    print("LOCAL DATABASE MIGRATION")
    print("=" * 60)
    
    # Find the database file (usually in instance/)
    db_paths = ['database/app.db', 'app.db', 'instance/app.db', 'src/app.db']
    db_path = None
    
    for path in db_paths:
        if os.path.exists(path):
            db_path = path
            break
    
    if not db_path:
        print("ERROR: Could not find local SQLite database file")
        print("Looked for:", db_paths)
        return False
    
    print(f"Found database: {db_path}")
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check what columns already exist
        cursor.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cursor.fetchall()]
        print(f"Current user table columns: {columns}")
        
        # Add current_invoice_number if missing
        if 'current_invoice_number' not in columns:
            print("Adding current_invoice_number column...")
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN current_invoice_number INTEGER DEFAULT 0
            """)
            print("+ current_invoice_number column added")
        else:
            print("+ current_invoice_number already exists")
        
        # Add agent_invoice_next if missing  
        if 'agent_invoice_next' not in columns:
            print("Adding agent_invoice_next column...")
            cursor.execute("""
                ALTER TABLE users 
                ADD COLUMN agent_invoice_next INTEGER DEFAULT 1
            """)
            print("+ agent_invoice_next column added")
        else:
            print("+ agent_invoice_next already exists")
        
        conn.commit()
        
        # Verify the columns were added
        cursor.execute("PRAGMA table_info(users)")
        new_columns = [row[1] for row in cursor.fetchall()]
        print(f"Updated user table columns: {new_columns}")
        
        conn.close()
        
        print("=" * 60)
        print("SUCCESS: Local database migration completed")
        print("=" * 60)
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    migrate_local_database()