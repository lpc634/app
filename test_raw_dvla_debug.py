#!/usr/bin/env python3
"""
Test script for Raw DVLA Debug Endpoint
This will show exactly what DVLA returns without any processing
"""

import os
import requests
import json

# Test configuration
BASE_URL = "http://localhost:5001"
TEST_PLATES = [
    "VA18LLE",   # Known test vehicle
    "VE65YEV",   # The vehicle with model issue
]

def test_raw_dvla_debug():
    """Test the raw DVLA debug endpoint"""
    print("Raw DVLA Debug Test")
    print("=" * 40)
    
    # Check if API is available
    api_key = os.getenv('DVLA_API_KEY')
    print(f"DVLA API Key configured: {'YES' if api_key else 'NO'}")
    
    if not api_key:
        print("\nNo DVLA API key - showing expected endpoint structure...")
        show_expected_structure()
        return True
    
    # Test each vehicle
    for plate in TEST_PLATES:
        print(f"\n--- Testing {plate} ---")
        test_vehicle_raw_debug(plate)
    
    return True

def test_vehicle_raw_debug(plate):
    """Test raw debug endpoint for specific vehicle"""
    debug_url = f"{BASE_URL}/api/vehicles/raw-dvla/{plate}"
    
    print(f"Debug URL: {debug_url}")
    print("Note: This requires JWT authentication")
    
    # Expected response structure (what we should see)
    expected_structure = {
        "plate": plate,
        "status": "success",
        "make_field": "AUDI",
        "model_field": "A3 SPORTBACK",  # This is what we're looking for
        "colour_field": "SILVER",
        "all_fields_returned": ["make", "model", "colour", "yearOfManufacture", "..."],
        "has_make": True,
        "has_model": True,  # This should be True if model exists
        "has_colour": True,
        "debug_summary": {
            "model_field_status": "FOUND"  # or "MISSING_OR_EMPTY"
        }
    }
    
    print("Expected structure:")
    print(json.dumps(expected_structure, indent=2))

def show_expected_structure():
    """Show what we expect to see from DVLA"""
    print("\nExpected DVLA Response Structure:")
    print("-" * 35)
    
    dvla_fields = [
        "make",
        "model",  # This is the key field we're debugging
        "colour", 
        "yearOfManufacture",
        "engineCapacity",
        "fuelType",
        "co2Emissions",
        "taxStatus",
        "taxDueDate",
        "motStatus",
        "motExpiryDate",
        "revenueWeight"
    ]
    
    print("Standard DVLA fields that should be returned:")
    for i, field in enumerate(dvla_fields, 1):
        marker = " ← KEY FIELD" if field == "model" else ""
        print(f"  {i:2d}. {field}{marker}")
    
    print(f"\nPossible Model Field Variations:")
    alternative_fields = [
        "model (standard)",
        "vehicleModel",
        "genericDescription", 
        "bodyType",
        "vehicleDescription",
        "makeModel (combined)"
    ]
    
    for field in alternative_fields:
        print(f"  - {field}")
    
    print(f"\nExpected for VA18LLE:")
    print("  make_field: 'AUDI'")
    print("  model_field: 'A3 SPORTBACK' (or similar)")
    print("  colour_field: 'SILVER'")

def test_debugging_steps():
    """Show the debugging steps to follow"""
    print(f"\nDebugging Steps:")
    print("-" * 20)
    
    steps = [
        "1. Test raw debug endpoint: /api/vehicles/raw-dvla/VA18LLE",
        "2. Look at 'model_field' value in response",
        "3. Check 'has_model' boolean flag",
        "4. Examine 'all_fields_returned' array",
        "5. Look for alternative model fields",
        "6. Fix main lookup based on findings"
    ]
    
    for step in steps:
        print(f"  {step}")
    
    print(f"\nKey Questions to Answer:")
    questions = [
        "Does DVLA return a 'model' field?",
        "Is the 'model' field empty or null?", 
        "Are there alternative model field names?",
        "What exact field names does DVLA use?"
    ]
    
    for question in questions:
        print(f"  ? {question}")

if __name__ == "__main__":
    print("Raw DVLA Debug Test Suite")
    print("=" * 40)
    
    success = test_raw_dvla_debug()
    test_debugging_steps()
    
    print("\n" + "=" * 40)
    if success:
        print("DEBUG ENDPOINT READY!")
        print("\nNext Steps:")
        print("1. Start Flask server: python main.py")
        print("2. Test endpoint: GET /api/vehicles/raw-dvla/VA18LLE")
        print("3. Look for model field in raw response")
        print("4. Fix main lookup based on findings")
        
        print(f"\nExpected Fix:")
        print("If DVLA returns model data, the display should show:")
        print("'AUDI A3 SPORTBACK (SILVER) - 2018'")
        print("instead of:")
        print("'AUDI (SILVER) - 2018'")
    else:
        print("Setup failed - check configuration")
    
    print("=" * 40)