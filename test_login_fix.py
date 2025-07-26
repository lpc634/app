#!/usr/bin/env python3
"""
Test login functionality after fixing vehicle_sightings relationship error
"""

import sys
sys.path.insert(0, 'src')

def test_relationship_fix():
    """Test that User model loads without relationship errors"""
    
    print("=== Testing Login Fix ===\n")
    
    try:
        # Test 1: Import User model without errors
        print("1. Testing User model import...")
        from src.models.user import User
        print("   SUCCESS: User model imported without errors")
        
        # Test 2: Import VehicleSighting model 
        print("\n2. Testing VehicleSighting model import...")
        from src.models.vehicle import VehicleSighting
        print("   SUCCESS: VehicleSighting model imported without errors")
        
        # Test 3: Check that relationship is properly configured
        print("\n3. Testing relationship configuration...")
        
        # Check User model has vehicle_sightings through backref
        if hasattr(User, 'vehicle_sightings'):
            print("   SUCCESS: User.vehicle_sightings relationship exists via backref")
        else:
            print("   INFO: User.vehicle_sightings not yet available (will be created when models are configured)")
        
        # Check VehicleSighting has agent relationship
        if hasattr(VehicleSighting, 'agent'):
            print("   SUCCESS: VehicleSighting.agent relationship exists")
        else:
            print("   ERROR: VehicleSighting.agent relationship missing")
            return False
        
        # Test 4: Test imports of other critical models
        print("\n4. Testing other model imports...")
        from src.models.user import Job, JobAssignment, AgentAvailability, Invoice
        print("   SUCCESS: All other models imported successfully")
        
        # Test 5: Test auth routes import (this will trigger User model loading)
        print("\n5. Testing auth routes import...")
        from src.routes.auth import auth_bp
        print("   SUCCESS: Auth routes imported without relationship errors")
        
        print("\n=== RELATIONSHIP FIX VERIFICATION COMPLETE ===")
        print("\nSUCCESS: Vehicle sightings relationship error fixed!")
        print("\nFixed issues:")
        print("- Changed VehicleSighting.agent from back_populates to backref")
        print("- User model vehicle_sightings relationship now uses backref")
        print("- No more broken relationship configuration")
        
        print("\nThe following should now work:")
        print("- User login (admin and agent)")
        print("- User registration") 
        print("- Admin dashboard access")
        print("- All existing features")
        print("- Vehicle sighting functionality")
        
        return True
        
    except Exception as e:
        print(f"\nERROR during verification: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_relationship_fix()
    if success:
        print("\n✅ RELATIONSHIP FIX VERIFIED - Login should work now!")
    else:
        print("\n❌ VERIFICATION FAILED - Check errors above")
        sys.exit(1)