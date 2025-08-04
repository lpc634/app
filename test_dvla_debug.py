#!/usr/bin/env python3
"""
Test script for DVLA Debug API endpoint
Tests the enhanced DVLA integration without requiring authentication
"""

import os
import requests
import json
from pprint import pprint

# Test configuration
BASE_URL = "http://localhost:5001"
TEST_PLATE = "VA18LLE"

def test_dvla_debug_endpoint():
    """Test the DVLA debug endpoint directly"""
    print(f"🔍 Testing DVLA Debug Endpoint for {TEST_PLATE}")
    print("=" * 60)
    
    # First, check if DVLA API key is configured
    api_key = os.getenv('DVLA_API_KEY')
    print(f"DVLA API Key configured: {'✅ Yes' if api_key else '❌ No'}")
    
    if not api_key:
        print("\n❌ DVLA_API_KEY environment variable not set")
        print("Please set the DVLA API key to test the integration:")
        print("export DVLA_API_KEY='your-api-key-here'")
        return False
    
    print(f"API Key (masked): {api_key[:10]}...{api_key[-4:] if len(api_key) > 14 else 'SHORT'}")
    
    # Test the debug endpoint directly (bypasses JWT auth)
    debug_url = f"{BASE_URL}/api/vehicles/debug-lookup/{TEST_PLATE}"
    print(f"\n🌐 Making request to: {debug_url}")
    
    try:
        response = requests.get(debug_url, timeout=15)
        print(f"Response Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print("\n✅ SUCCESS: DVLA Debug Response:")
            print("=" * 40)
            
            # Print key information
            print(f"Registration Plate: {data.get('registration_plate')}")
            print(f"Status Code: {data.get('status_code')}")
            print(f"Field Count: {data.get('field_count', 0)}")
            
            if 'all_available_fields' in data:
                print(f"\n📋 Available DVLA Fields ({len(data['all_available_fields'])}):")
                for i, field in enumerate(data['all_available_fields'], 1):
                    print(f"  {i:2d}. {field}")
            
            if 'raw_response' in data:
                print(f"\n🔍 Raw DVLA Response:")
                pprint(data['raw_response'], width=80, depth=3)
            
            # Check specific fields
            print(f"\n🚗 Vehicle Details:")
            raw_data = data.get('raw_response', {})
            print(f"  Make: {raw_data.get('make', 'Not found')}")
            print(f"  Model: {raw_data.get('model', 'Not found')}")
            print(f"  Colour: {raw_data.get('colour', 'Not found')}")
            print(f"  Year: {raw_data.get('yearOfManufacture', 'Not found')}")
            print(f"  Fuel Type: {raw_data.get('fuelType', 'Not found')}")
            print(f"  Tax Status: {raw_data.get('taxStatus', 'Not found')}")
            print(f"  MOT Status: {raw_data.get('motStatus', 'Not found')}")
            
            # Model field analysis
            model_variations = data.get('model_field_variations', [])
            if model_variations:
                print(f"\n🔎 Model Field Variations Found:")
                for variation in model_variations:
                    print(f"  {variation}")
            else:
                print(f"\n⚠️  No model field variations detected")
            
            return True
            
        else:
            print(f"\n❌ ERROR: Request failed with status {response.status_code}")
            try:
                error_data = response.json()
                print("Error Response:")
                pprint(error_data)
            except:
                print(f"Raw Error Response: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\n❌ ERROR: Cannot connect to Flask server")
        print("Make sure the Flask app is running on http://localhost:5001")
        return False
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        return False

def test_main_lookup_endpoint():
    """Test the main lookup endpoint (requires auth token)"""
    print(f"\n\n🔍 Testing Main DVLA Lookup Endpoint for {TEST_PLATE}")
    print("=" * 60)
    
    # This would require authentication, so we'll skip for now
    print("⚠️  Main lookup endpoint requires JWT authentication")
    print("Use the frontend or create an auth token to test this endpoint")
    return True

if __name__ == "__main__":
    print("🚀 DVLA API Integration Test Suite")
    print("=" * 60)
    
    success = test_dvla_debug_endpoint()
    
    if success:
        test_main_lookup_endpoint()
        print("\n✅ Test completed successfully!")
        print("\nNext steps:")
        print("1. Test the frontend integration")
        print("2. Verify all DVLA fields are captured and displayed")
        print("3. Test with multiple vehicle registrations")
    else:
        print("\n❌ Tests failed - check configuration and try again")
    
    print("\n" + "=" * 60)