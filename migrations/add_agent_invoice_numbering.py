"""
Database migration script to add agent invoice numbering fields

Usage: Run this script from the app directory with: python migrations/add_agent_invoice_numbering.py
"""

import os
import sys

# Add the src directory to the path so we can import our models
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.extensions import db
from src.models.user import User, Invoice, Job
from flask import Flask

def create_app():
    """Create a basic Flask app for migration"""
    app = Flask(__name__)
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///v3services.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    db.init_app(app)
    return app

def run_migration():
    """Run the migration to add agent invoice numbering fields"""
    app = create_app()
    
    with app.app_context():
        try:
            print("Starting agent invoice numbering migration...")
            
            # Add columns to existing tables
            print("Adding agent_invoice_next column to users table...")
            db.engine.execute("""
                ALTER TABLE users 
                ADD COLUMN agent_invoice_next INTEGER DEFAULT 1 NOT NULL
            """)
            
            print("Adding agent_invoice_number column to invoices table...")
            db.engine.execute("""
                ALTER TABLE invoices 
                ADD COLUMN agent_invoice_number INTEGER NULL
            """)
            
            print("Making jobs.title column nullable...")
            # Note: SQLite doesn't support ALTER COLUMN, so for SQLite this would need a table recreation
            # For PostgreSQL/MySQL this should work:
            try:
                db.engine.execute("""
                    ALTER TABLE jobs 
                    ALTER COLUMN title DROP NOT NULL
                """)
            except Exception as e:
                print(f"Could not alter jobs.title column (might be SQLite): {e}")
                print("You may need to manually handle this for SQLite databases")
            
            print("Creating unique index on agent_id + agent_invoice_number...")
            db.engine.execute("""
                CREATE UNIQUE INDEX ix_agent_invoice_unique 
                ON invoices(agent_id, agent_invoice_number) 
                WHERE agent_invoice_number IS NOT NULL
            """)
            
            print("Backfilling agent_invoice_next values for existing agents...")
            # For each agent, set their next number based on their highest agent_invoice_number + 1
            agents = User.query.filter_by(role='agent').all()
            
            for agent in agents:
                # Find the highest agent_invoice_number for this agent
                max_invoice = db.session.query(db.func.max(Invoice.agent_invoice_number)).filter_by(agent_id=agent.id).scalar()
                next_number = (max_invoice + 1) if max_invoice else 1
                
                agent.agent_invoice_next = next_number
                print(f"Set agent {agent.id} ({agent.email}) next invoice number to {next_number}")
            
            print("Setting job titles to address where title is null or empty...")
            # Update jobs where title is null or empty to use the address
            jobs_to_update = Job.query.filter(db.or_(Job.title.is_(None), Job.title == '')).all()
            
            for job in jobs_to_update:
                job.title = job.address or f"Job at {job.postcode}" if job.postcode else "Untitled Job"
                print(f"Updated job {job.id} title to: {job.title}")
            
            # Commit all changes
            db.session.commit()
            print("Migration completed successfully!")
            
        except Exception as e:
            print(f"Migration failed: {e}")
            db.session.rollback()
            raise

if __name__ == '__main__':
    run_migration()