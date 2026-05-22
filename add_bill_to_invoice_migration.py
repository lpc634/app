"""
Migration: add bill_to column to invoices table
------------------------------------------------
Run once: python add_bill_to_invoice_migration.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from src.extensions import db
from sqlalchemy import text

def run_migration():
    with app.app_context():
        with db.engine.connect() as conn:

            # Check if column already exists using information_schema
            # (safe — never throws a transaction-aborting error)
            result = conn.execute(text("""
                SELECT COUNT(*)
                FROM information_schema.columns
                WHERE table_name = 'invoices'
                  AND column_name = 'bill_to'
            """))
            count = result.scalar()

            if count and int(count) > 0:
                print("Column 'bill_to' already exists — nothing to do.")
                return

            print("Adding 'bill_to' column to invoices table...")
            conn.execute(text(
                "ALTER TABLE invoices ADD COLUMN bill_to VARCHAR(50) NOT NULL DEFAULT 'v3'"
            ))
            conn.commit()
            print("Done. All existing invoices now have bill_to = 'v3'.")

if __name__ == '__main__':
    run_migration()
