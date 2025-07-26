#!/usr/bin/env python3
"""
Test that the main app components can be imported without errors
"""

import sys
sys.path.insert(0, 'src')

def test_app_imports():
    """Test critical app imports"""
    
    print("=== Testing App Imports ===\n")
    
    try:
        print("1. Testing database models...")
        from src.models.user import User, Job, JobAssignment, AgentAvailability, Invoice
        from src.models.vehicle import VehicleSighting
        print("   SUCCESS: All models imported")
        
        print("\n2. Testing authentication routes...")
        from src.routes.auth import auth_bp
        print("   SUCCESS: Auth routes imported")
        
        print("\n3. Testing admin routes...")
        from src.routes.admin import admin_bp
        print("   SUCCESS: Admin routes imported")
        
        print("\n4. Testing job routes...")
        from src.routes.jobs import jobs_bp
        print("   SUCCESS: Job routes imported")
        
        print("\n5. Testing vehicle routes...")
        from src.routes.vehicles import vehicles_bp
        print("   SUCCESS: Vehicle routes imported")
        
        print("\n6. Testing intelligence routes...")
        from src.routes.intelligence import intelligence_bp
        print("   SUCCESS: Intelligence routes imported")
        
        print("\n=== ALL IMPORTS SUCCESSFUL ===")
        print("App should start without SQLAlchemy relationship errors!")
        
        return True
        
    except Exception as e:
        print(f"\nERROR during import test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_app_imports()
    if success:
        print("\nSUCCESS: All app components import without errors!")
    else:
        print("\nFAILED: Check errors above")
        sys.exit(1)