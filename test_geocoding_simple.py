#!/usr/bin/env python3
"""Test enhanced geocoding functionality."""

import requests
import re

def test_geocoding(address):
    """Test enhanced geocoding with multiple strategies"""
    print(f"\nTesting address: '{address}'")
    print("=" * 50)
    
    # Multiple search strategies
    strategies = [
        address,  # Original
        re.sub(r'([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})', r'\1 \2', address, flags=re.IGNORECASE),  # Fix postcode
        ', '.join(address.split(',')[-2:]).strip(),  # Last two parts
        address.split(',')[-1].strip(),  # Just postcode/area
    ]
    
    # Clean strategies
    clean_strategies = []
    for s in strategies:
        if s and len(s) > 2 and s not in clean_strategies:
            clean_strategies.append(s)
    
    print(f"Testing {len(clean_strategies)} strategies:")
    for i, s in enumerate(clean_strategies, 1):
        print(f"  {i}. '{s}'")
    
    best_result = None
    best_score = 0
    
    for search_addr in clean_strategies:
        print(f"\nTrying: '{search_addr}'")
        
        try:
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                'q': search_addr,
                'format': 'json',
                'limit': 2,
                'countrycodes': 'gb',
                'addressdetails': 1
            }
            
            response = requests.get(url, params=params, timeout=10)
            
            if response.status_code != 200:
                print(f"  HTTP error {response.status_code}")
                continue
                
            data = response.json()
            print(f"  Found {len(data)} results")
            
            if data:
                result = data[0]  # Take first result for simplicity
                score = result.get('importance', 0) * 10
                
                print(f"  Score: {score:.2f}")
                print(f"  Location: {result['display_name']}")
                
                if score > best_score:
                    best_score = score
                    best_result = {
                        'lat': float(result['lat']),
                        'lng': float(result['lon']),
                        'display_name': result['display_name'],
                        'strategy': search_addr
                    }
                
                # If good result, stop
                if score > 3:
                    break
            
        except Exception as e:
            print(f"  Error: {e}")
    
    print(f"\n{'-'*50}")
    if best_result:
        print("SUCCESS!")
        print(f"Coordinates: {best_result['lat']}, {best_result['lng']}")
        print(f"Location: {best_result['display_name']}")
        print(f"Strategy: '{best_result['strategy']}'")
        return True, best_result
    else:
        print("FAILED - No coordinates found")
        return False, None

def main():
    """Test problematic addresses"""
    print("Enhanced Geocoding Test")
    print("Testing previously failing addresses")
    
    test_addresses = [
        "Flying Fields, Daventry Road, Southam, CV471AS",
        "11 BERKSHIRES ROAD CAMBERLEY",
        "Daventry Road, Southam",
        "Camberley"
    ]
    
    results = []
    
    for address in test_addresses:
        success, result = test_geocoding(address)
        results.append((address, success, result))
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    
    successful = [r for r in results if r[1]]
    failed = [r for r in results if not r[1]]
    
    print(f"Successful: {len(successful)}/{len(results)}")
    print(f"Failed: {len(failed)}/{len(results)}")
    
    if successful:
        print(f"\nWorking addresses:")
        for address, success, result in successful:
            print(f"  PASS: '{address}'")
            if result:
                print(f"    -> {result['lat']:.6f}, {result['lng']:.6f}")
    
    if failed:
        print(f"\nFailed addresses:")
        for address, success, result in failed:
            print(f"  FAIL: '{address}'")
    
    print(f"\nEnhanced geocoding should fix map pin issues!")

if __name__ == '__main__':
    main()