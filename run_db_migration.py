import sys
sys.path.insert(0, '.')
from main import app
from sqlalchemy import text
from src.extensions import db

with app.app_context():
    with db.engine.begin() as conn:
        conn.execute(text("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_to VARCHAR(50) NOT NULL DEFAULT 'v3'"))
    print('SUCCESS: bill_to column added.')
