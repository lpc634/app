#!/usr/bin/env python3
"""
Add S3 columns to existing database
"""
import sqlite3
import os

def add_columns():
    print("Adding S3 columns to database...")
    
    # Find the database file
    db_path = os.path.join('database', 'app.db')
    if not os.path.exists(db_path):
        print(f"Database not found at {db_path}")
        return False
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Add document_files column to users table
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN document_files TEXT")
            print("[OK] Added document_files column to users table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("[OK] document_files column already exists in users table")
            else:
                raise e
        
        # Add pdf_file_url column to invoices table
        try:
            cursor.execute("ALTER TABLE invoices ADD COLUMN pdf_file_url VARCHAR(500)")
            print("[OK] Added pdf_file_url column to invoices table")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("[OK] pdf_file_url column already exists in invoices table")  
            else:
                raise e
        
        conn.commit()
        conn.close()
        
        print("\nDatabase migration completed successfully!")
        return True
        
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    success = add_columns()
    if success:
        print("\n[SUCCESS] S3 columns added successfully!")
    else:
        print("\n[FAILED] Failed to add S3 columns")