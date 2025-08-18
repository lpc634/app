#!/usr/bin/env python3
"""
Script to add missing telegram columns to the users table
"""
import os
import psycopg2
from urllib.parse import urlparse

def add_telegram_columns():
    database_url = os.environ.get('DATABASE_URL')
    if not database_url:
        print("ERROR: DATABASE_URL environment variable not found")
        return
    
    # Parse the database URL
    url = urlparse(database_url)
    
    # Connect to the database
    try:
        conn = psycopg2.connect(
            host=url.hostname,
            port=url.port,
            user=url.username,
            password=url.password,
            database=url.path[1:]  # Remove leading slash
        )
        
        cursor = conn.cursor()
        
        # Add telegram columns if they don't exist
        print("Adding telegram_chat_id column...")
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id varchar(32);")
        
        print("Adding telegram_username column...")
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_username varchar(64);")
        
        print("Adding telegram_link_token column...")
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_link_token varchar(64);")
        
        print("Adding telegram_opt_in column...")
        cursor.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_opt_in boolean DEFAULT false NOT NULL;")
        
        # Create indexes
        print("Creating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_telegram_chat_id ON users (telegram_chat_id);")
        cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_telegram_link_token ON users (telegram_link_token);")
        
        # Commit the changes
        conn.commit()
        print("Successfully added telegram columns!")
        
    except Exception as e:
        print(f"Error: {e}")
        if 'conn' in locals():
            conn.rollback()
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    add_telegram_columns()