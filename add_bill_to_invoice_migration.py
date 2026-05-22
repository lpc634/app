"""
Migration: add bill_to column to invoices table
------------------------------------------------
Adds a 'bill_to' column (VARCHAR 50, default 'v3') so that each invoice
records which client it was addressed to.

All existing invoices are set to 'v3' (the original/only client).

Run once:
    python add_bill_to_invoice_migration.py
"""

import os
import sys

# Make sure we can import the app
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app
from src.extensions import db
from sqlalchemy import text

def run_migration():
    with app.app_context():
        with db.engine.connect() as conn:
            # Check if column already exists (safe to re-run)
            try:
                conn.execute(text("SELECT bill_to FROM invoices LIMIT 1"))
                print("Column 'bill_to' already exists — nothing to do.")
                return
            except Exception:
                pass  # Column doesn't exist yet, proceed

            print("Adding 'bill_to' column to invoices table...")
            conn.execute(text(
                "ALTER TABLE invoices ADD COLUMN bill_to VARCHAR(50) NOT NULL DEFAULT 'v3'"
            ))
            conn.commit()
            print("Done. All existing invoices now have bill_to = 'v3'.")

if __name__ == '__main__':
    run_migration()
