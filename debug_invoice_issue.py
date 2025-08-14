#!/usr/bin/env python3
"""
Debug exactly what's happening with the invoice system
"""

import sys
import json

# Add src to path
sys.path.insert(0, 'src')

def debug_user_invoice_fields():
    """Check what invoice fields users actually have"""
    print("=" * 60)
    print("DEBUG: USER INVOICE FIELDS")
    print("=" * 60)
    
    try:
        from src.models.user import User
        from src.extensions import db
        from main import app
        
        with app.app_context():
            # Get a sample user
            users = User.query.limit(3).all()
            
            print(f"Found {len(users)} users to check:")
            
            for user in users:
                print(f"\nUser ID {user.id} ({user.email}):")
                print(f"  - Has current_invoice_number: {hasattr(user, 'current_invoice_number')}")
                
                if hasattr(user, 'current_invoice_number'):
                    current_val = getattr(user, 'current_invoice_number', 'MISSING')
                    print(f"  - current_invoice_number value: {current_val}")
                else:
                    print(f"  - ERROR: current_invoice_number field does not exist!")
                
                if hasattr(user, 'agent_invoice_next'):
                    legacy_val = getattr(user, 'agent_invoice_next', 'MISSING') 
                    print(f"  - agent_invoice_next value: {legacy_val}")
                
                # Test what the API would return for this user
                current_number = getattr(user, 'current_invoice_number', 0) or 0
                suggested_next = current_number + 1
                print(f"  - API would suggest: {suggested_next}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def debug_route_accessibility():
    """Test if routes are actually accessible"""
    print("\n" + "=" * 60)
    print("DEBUG: ROUTE ACCESSIBILITY")
    print("=" * 60)
    
    try:
        from main import app
        
        with app.test_client() as client:
            # Test next-invoice-number route
            print("Testing /api/agent/next-invoice-number:")
            response = client.get('/api/agent/next-invoice-number')
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.get_json()}")
            
            # Test review route
            print("\nTesting /api/agent/invoices/review:")
            test_data = {
                'items': [{'jobId': 1, 'hours': 8, 'rate': 15}],
                'invoice_number': 100,
                'type': 'job'
            }
            response = client.post('/api/agent/invoices/review', json=test_data)
            print(f"  Status: {response.status_code}")
            print(f"  Response: {response.get_json()}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def debug_database_migration():
    """Check if the database migration actually worked"""
    print("\n" + "=" * 60) 
    print("DEBUG: DATABASE MIGRATION STATUS")
    print("=" * 60)
    
    try:
        from src.extensions import db
        from main import app
        
        with app.app_context():
            # Check if the column exists in the database
            result = db.engine.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND column_name = 'current_invoice_number'
            """)
            
            columns = result.fetchall()
            
            if columns:
                print("+ current_invoice_number column EXISTS in database")
                
                # Check how many users have this field set
                result2 = db.engine.execute("""
                    SELECT COUNT(*) as total,
                           COUNT(current_invoice_number) as with_value,
                           AVG(current_invoice_number) as avg_value
                    FROM users
                """)
                
                stats = result2.fetchone()
                print(f"  - Total users: {stats.total}")
                print(f"  - Users with current_invoice_number set: {stats.with_value}")
                print(f"  - Average current_invoice_number: {stats.avg_value}")
                
            else:
                print("- ERROR: current_invoice_number column DOES NOT EXIST in database!")
                return False
        
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("DEBUGGING THE FUCKING INVOICE ISSUE")
    print("Let's find out what's actually broken...")
    
    # Check user fields
    users_ok = debug_user_invoice_fields()
    
    # Check routes  
    routes_ok = debug_route_accessibility()
    
    # Check database migration
    db_ok = debug_database_migration()
    
    print("\n" + "=" * 60)
    if users_ok and routes_ok and db_ok:
        print("DIAGNOSIS: Everything looks fine - must be frontend issue")
        print("SOLUTION: Frontend cache or JavaScript errors")
    else:
        print("DIAGNOSIS: Found backend/database issues")
        print("SOLUTION: Fix the identified problems above")
    print("=" * 60)