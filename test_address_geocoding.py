#!/usr/bin/env python3
"""
Test script to verify the enhanced address geocoding functionality.
Tests the specific problematic address from the requirements.
"""

import requests
import json
import re

def test_geocoding_strategies(address):
    """Test multiple geocoding strategies for a given address"""
    print(f"\nTesting address: '{address}'")
    print("=" * 60)
    
    # Multiple search strategies (same as frontend)
    strategies = [
        address,  # Original address
        re.sub(r'([A-Z]{1,2}\d{1,2})(\d[A-Z]{2})', r'\1 \2', address),  # Fix postcode spacing
        ', '.join(address.split(',')[-2:]).strip(),  # Last two parts
        address.split(',')[-1].strip()  # Just the postcode/area
    ]
    
    # Remove duplicates while preserving order
    unique_strategies = []
    for strategy in strategies:
        if strategy and strategy not in unique_strategies:
            unique_strategies.append(strategy)
    
    print(f"📋 Testing {len(unique_strategies)} strategies:")
    for i, strategy in enumerate(unique_strategies, 1):
        print(f"  {i}. '{strategy}'")
    
    print("\n🌐 Results:")
    for i, search_addr in enumerate(unique_strategies, 1):
        try:
            url = f"https://nominatim.openstreetmap.org/search"
            params = {
                'q': search_addr,
                'format': 'json',
                'limit': 1,
                'countrycodes': 'gb'
            }
            
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            if data and len(data) > 0:
                result = data[0]
                lat, lng = float(result['lat']), float(result['lon'])
                display_name = result['display_name']
                
                print(f"  ✅ Strategy {i} SUCCESS:")
                print(f"     📍 Coordinates: {lat:.6f}, {lng:.6f}")
                print(f"     📍 Location: {display_name}")
                print(f"     🔗 Map: https://www.openstreetmap.org/#map=15/{lat:.6f}/{lng:.6f}")
                return True, lat, lng, display_name
            else:
                print(f"  ❌ Strategy {i} failed: No results")
                
        except Exception as e:
            print(f"  ⚠️  Strategy {i} error: {e}")
    
    print(f"\n❌ All strategies failed for: '{address}'")
    return False, None, None, None

def main():
    """Test the specific problematic addresses mentioned in requirements"""
    
    print("🗺️  Address Geocoding Test Suite")
    print("Testing enhanced geocoding for vehicle sighting locations")
    
    # Test cases from the requirements
    test_addresses = [
        "Flying Fields, Daventry Road, Southam, CV471AS",  # Original problematic address
        "Daventry Road, Southam, CV471AS",  # Without building name
        "Southam, CV471AS",  # Area + postcode
        "CV471AS",  # Just postcode (malformed)
        "CV47 1AS",  # Properly formatted postcode
        "Southam",  # Just area name
        "Daventry Road, Southam",  # Street + area
    ]
    
    results = []
    for address in test_addresses:
        success, lat, lng, location = test_geocoding_strategies(address)
        results.append({
            'address': address,
            'success': success,
            'coordinates': (lat, lng) if success else None,
            'location': location if success else None
        })
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 SUMMARY RESULTS")
    print("=" * 60)
    
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    print(f"✅ Successful: {len(successful)}/{len(results)}")
    print(f"❌ Failed: {len(failed)}/{len(results)}")
    
    if successful:
        print(f"\n🎯 Working addresses:")
        for result in successful:
            lat, lng = result['coordinates']
            print(f"  • '{result['address']}'")
            print(f"    → {result['location']}")
            print(f"    → {lat:.6f}, {lng:.6f}")
    
    if failed:
        print(f"\n⚠️  Failed addresses:")
        for result in failed:
            print(f"  • '{result['address']}'")
    
    # Specific test for the problematic address
    print("\n" + "=" * 60)
    print("🎯 SPECIFIC TEST: Original Problematic Address")
    print("=" * 60)
    
    problematic_address = "Flying Fields, Daventry Road, Southam, CV471AS"
    success, lat, lng, location = test_geocoding_strategies(problematic_address)
    
    if success:
        print(f"🎉 SUCCESS! The problematic address can now be geocoded:")
        print(f"   📍 Location: {location}")
        print(f"   📍 Coordinates: {lat:.6f}, {lng:.6f}")
        print(f"   🗺️  View on map: https://www.openstreetmap.org/#map=15/{lat:.6f}/{lng:.6f}")
    else:
        print(f"⚠️  The specific problematic address still cannot be geocoded directly.")
        print(f"   💡 Users will need to use fallback options:")
        print(f"   • Use postcode only: 'CV47 1AS'")
        print(f"   • Use area + postcode: 'Southam, CV47 1AS'")  
        print(f"   • Use current location (GPS)")
        print(f"   • Click on the map to select location manually")

if __name__ == '__main__':
    main()