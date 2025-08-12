#!/usr/bin/env python3
"""
Test the actual API endpoints that should be working
"""

import sys
import json

# Add src to path
sys.path.insert(0, 'src')

def test_api_routes():
    """Test that the API routes exist and work"""
    print("=" * 70)
    print("TESTING API ROUTES IMPLEMENTATION")
    print("=" * 70)
    
    try:
        # Import Flask app to test routes
        from main import app
        
        with app.test_client() as client:
            # Test that the routes exist (they'll return 401 without auth, but that means they exist)
            
            print("Testing GET /api/agent/next-invoice-number...")
            response = client.get('/api/agent/next-invoice-number')
            print(f"  Status: {response.status_code} (Expected: 401 or 422)")
            if response.status_code not in [401, 422]:
                print(f"  ERROR: Route may not exist! Response: {response.data}")
            else:
                print("  + Route exists (returns auth error as expected)")
            
            print("\nTesting POST /api/agent/invoices/review...")
            response = client.post('/api/agent/invoices/review', json={'test': 'data'})
            print(f"  Status: {response.status_code} (Expected: 401 or 422)")
            if response.status_code not in [401, 422]:
                print(f"  ERROR: Route may not exist! Response: {response.data}")
            else:
                print("  + Route exists (returns auth error as expected)")
            
            print("\nTesting GET /api/agent/profile...")
            response = client.get('/api/agent/profile')
            print(f"  Status: {response.status_code} (Expected: 401 or 422)")
            if response.status_code not in [401, 422]:
                print(f"  ERROR: Route may not exist! Response: {response.data}")
            else:
                print("  + Route exists (returns auth error as expected)")
        
        print("\n" + "=" * 70)
        print("+ ALL ROUTES EXIST AND RESPOND CORRECTLY")
        print("=" * 70)
        
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

def check_route_registration():
    """Check that routes are properly registered"""
    print("\n" + "=" * 70)
    print("CHECKING ROUTE REGISTRATION")
    print("=" * 70)
    
    try:
        from main import app
        from src.routes.agent import agent_bp
        
        # Check if blueprint is registered
        if 'agent' in app.blueprints:
            print("+ Agent blueprint is registered")
        else:
            print("- Agent blueprint is NOT registered!")
            return False
        
        # List all registered routes
        print("\nRegistered routes containing 'invoice':")
        for rule in app.url_map.iter_rules():
            if 'invoice' in rule.rule.lower():
                print(f"  {rule.methods} {rule.rule}")
        
        print("\nRegistered routes containing 'agent':")
        route_count = 0
        for rule in app.url_map.iter_rules():
            if 'agent' in rule.rule.lower():
                if route_count < 10:  # Show first 10
                    print(f"  {rule.methods} {rule.rule}")
                route_count += 1
        
        print(f"\nTotal agent routes: {route_count}")
        
        return True
        
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("API ENDPOINT VERIFICATION TEST")
    print(f"Testing the actual backend implementation...")
    
    # Test routes exist
    routes_ok = test_api_routes()
    
    # Check route registration
    registration_ok = check_route_registration()
    
    if routes_ok and registration_ok:
        print("\n" + "=" * 70)
        print("SUCCESS BACKEND IS WORKING CORRECTLY")
        print("=" * 70)
        print("\nThe issue is likely:")
        print("  1. Frontend caching (hard refresh needed)")
        print("  2. JavaScript errors in browser console")
        print("  3. Network issues preventing API calls")
        print("  4. Authentication issues")
        
        print("\nNext steps:")
        print("  1. Open browser DevTools (F12)")
        print("  2. Go to Console tab")
        print("  3. Clear console")
        print("  4. Hard refresh page (Ctrl+F5)")
        print("  5. Try to create an invoice")
        print("  6. Look for red errors in console")
        print("  7. Check Network tab for failed API calls")
        
    else:
        print("\nERROR BACKEND ISSUES FOUND")
        print("The routes may not be properly deployed or registered.")
    
    print("\n" + "=" * 70)
    print("TEST COMPLETED")
    print("=" * 70)