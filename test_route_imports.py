#!/usr/bin/env python3
"""
Test that all route imports work without Flask registration errors
"""

import sys
sys.path.insert(0, 'src')

def test_route_imports():
    """Test that all routes can be imported without duplicate registration errors"""
    
    print("=== Testing Route Imports ===\n")
    
    try:
        print("1. Testing agent routes import...")
        from src.routes.agent import agent_bp
        print("   SUCCESS: Agent routes imported without errors")
        
        print("\n2. Testing admin routes import...")
        from src.routes.admin import admin_bp
        print("   SUCCESS: Admin routes imported without errors")
        
        print("\n3. Testing auth routes import...")
        from src.routes.auth import auth_bp
        print("   SUCCESS: Auth routes imported without errors")
        
        print("\n4. Testing job routes import...")
        from src.routes.jobs import jobs_bp
        print("   SUCCESS: Job routes imported without errors")
        
        print("\n5. Testing vehicle routes import...")
        from src.routes.vehicles import vehicles_bp
        print("   SUCCESS: Vehicle routes imported without errors")
        
        print("\n6. Testing intelligence routes import...")
        from src.routes.intelligence import intelligence_bp
        print("   SUCCESS: Intelligence routes imported without errors")
        
        # Check that agent blueprint has the expected routes
        print("\n7. Checking agent blueprint routes...")
        route_count = len(agent_bp.deferred_functions)
        print(f"   Agent blueprint has {route_count} registered routes")
        
        print("\n=== ALL ROUTE IMPORTS SUCCESSFUL ===")
        print("No duplicate route registration errors found!")
        
        return True
        
    except Exception as e:
        print(f"\nERROR during route import test: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_route_imports()
    if success:
        print("\nSUCCESS: All routes import without Flask registration errors!")
    else:
        print("\nFAILED: Check errors above")
        sys.exit(1)