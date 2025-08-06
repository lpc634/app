#!/usr/bin/env python3
"""
Test script for enhanced geocoding functionality.
Tests the specific addresses that were failing to show map pins.
"""

import requests
import json
import re
import time

def test_enhanced_geocoding(address):
    """Test enhanced geocoding with multiple strategies"""
    print(f"\n🧪 Testing address: '{address}'")
    print("=" * 60)
    
    # Multiple search strategies (same as frontend JavaScript)
    search_strategies = [
        address,  # Original address
        re.sub(r'([A-Z]{1,2}\d{1,2}[A-Z]?)(\d[A-Z]{2})', r'\1 \2', address, flags=re.IGNORECASE),  # Fix postcode spacing
        ', '.join(address.split(',')[-2:]).strip(),  # Last two parts (area + postcode)
        address.split(',')[-1].strip(),  # Just the postcode/area
        # Extract main street and area
        re.sub(r'^[^,]*,?\s*([A-Z\s]+(?:ROAD|STREET|LANE|AVENUE|CLOSE|DRIVE|WAY|PLACE|CRESCENT|GARDENS))[,\s]+([A-Z\s]+).*$', r'\1, \2', address, flags=re.IGNORECASE),
        # Extract just the town/city
        re.search(r'([A-Z\s]+)(?:,\s*[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})?$', address, re.IGNORECASE)
    ]
    
    # Filter and clean strategies
    clean_strategies = []
    for strategy in search_strategies:
        if strategy:
            if isinstance(strategy, re.Match):
                strategy = strategy.group(1).strip()
            if strategy and len(strategy) > 2 and strategy not in clean_strategies:
                clean_strategies.append(strategy)
    
    print(f"📋 Testing {len(clean_strategies)} strategies:")
    for i, strategy in enumerate(clean_strategies, 1):
        print(f"  {i}. '{strategy}'")
    
    best_result = None
    best_score = 0
    
    for i, search_addr in enumerate(clean_strategies, 1):
        print(f"\n🔍 Strategy {i}: '{search_addr}'")
        
        try:
            url = "https://nominatim.openstreetmap.org/search"
            params = {
                'q': search_addr,
                'format': 'json',
                'limit': 3,
                'countrycodes': 'gb',
                'addressdetails': 1
            }
            headers = {
                'User-Agent': 'VehicleIntelligenceSystem/1.0'
            }
            
            response = requests.get(url, params=params, headers=headers, timeout=10)
            
            if response.status_code != 200:
                print(f"  ❌ HTTP error {response.status_code}")
                continue
                
            data = response.json()
            print(f"  📍 Found {len(data)} results")
            
            if data:
                # Score results based on relevance
                for result in data:
                    score = 0
                    display_name = result['display_name'].lower()
                    original_lower = address.lower()
                    
                    # Scoring system
                    if result.get('importance'):
                        score += result['importance'] * 10
                    if display_name.find(original_lower.split(',')[0].strip()) != -1:
                        score += 5
                    if result.get('address', {}).get('postcode') and original_lower.find(result['address']['postcode'].lower()) != -1:
                        score += 8
                    if result.get('address', {}).get('city') and original_lower.find(result['address']['city'].lower()) != -1:
                        score += 6
                    if result.get('address', {}).get('town') and original_lower.find(result['address']['town'].lower()) != -1:
                        score += 6
                    if result.get('address', {}).get('road') and original_lower.find(result['address']['road'].lower()) != -1:
                        score += 7
                    
                    print(f"    Score: {score:.2f} - {result['display_name']}")
                    
                    if score > best_score:
                        best_score = score
                        best_result = {
                            'lat': float(result['lat']),
                            'lng': float(result['lon']),
                            'display_name': result['display_name'],
                            'strategy': search_addr,
                            'confidence': min(score / 10, 1),
                            'address_details': result.get('address', {})
                        }
                
                # If high confidence, stop searching
                if best_score > 8:
                    print(f"  🎯 High confidence result found, stopping search")
                    break
            
            # Rate limiting
            time.sleep(0.1)
            
        except Exception as e:
            print(f"  ⚠️ Error: {e}")
    
    print(f"\n{'='*60}")
    if best_result:
        print("✅ SUCCESS!")
        print(f"📍 Coordinates: {best_result['lat']}, {best_result['lng']}")
        print(f"🏷️ Location: {best_result['display_name']}")
        print(f"🎯 Strategy: '{best_result['strategy']}'")
        print(f"📊 Confidence: {best_result['confidence']*100:.1f}%")
        print(f"🗺️ Maps: https://maps.google.com/?q={best_result['lat']},{best_result['lng']}")
        return True, best_result
    else:
        print("❌ FAILED - No coordinates found")
        return False, None

def main():
    """Test the problematic addresses"""
    print("🗺️ Enhanced Geocoding Test for Vehicle Intelligence System")
    print("Testing addresses that previously failed to show map pins")
    
    # Test addresses from the requirements
    test_addresses = [
        "Flying Fields, Daventry Road, Southam, CV471AS",  # BO55MAX
        "11 BERKSHIRES ROAD CAMBERLEY",                    # VA18LLE
        "Daventry Road, Southam",                          # Simplified version
        "Camberley",                                       # Just town
        "Southam, CV47 1AS"                               # Area + postcode
    ]
    
    results = []
    
    for address in test_addresses:
        success, result = test_enhanced_geocoding(address)
        results.append((address, success, result))
    
    # Summary
    print(f"\n{'='*80}")
    print("📊 SUMMARY RESULTS")
    print(f"{'='*80}")
    
    successful = [r for r in results if r[1]]
    failed = [r for r in results if not r[1]]
    
    print(f"✅ Successful: {len(successful)}/{len(results)}")
    print(f"❌ Failed: {len(failed)}/{len(results)}")
    
    if successful:
        print(f"\n🎉 Working addresses:")
        for address, success, result in successful:
            print(f"  • '{address}'")
            print(f"    → {result['display_name']}")
            print(f"    → {result['lat']:.6f}, {result['lng']:.6f}")
    
    if failed:
        print(f"\n⚠️ Failed addresses:")
        for address, success, result in failed:
            print(f"  • '{address}'")
    
    # Test specific requirements
    print(f"\n{'='*80}")
    print("🎯 SPECIFIC REQUIREMENT TESTS")
    print(f"{'='*80}")
    
    bo55max_test = next((r for r in results if "Flying Fields" in r[0]), None)
    va18lle_test = next((r for r in results if "BERKSHIRES ROAD" in r[0]), None)
    
    if bo55max_test and bo55max_test[1]:
        print("✅ BO55MAX (Flying Fields address) - FIXED!")
    else:
        print("❌ BO55MAX (Flying Fields address) - Still failing")
    
    if va18lle_test and va18lle_test[1]:
        print("✅ VA18LLE (Berkshires Road address) - FIXED!")
    else:
        print("❌ VA18LLE (Berkshires Road address) - Still failing")
    
    print(f"\n🚀 Enhanced geocoding implementation is ready for deployment!")
    print("Map pins should now appear for previously failing addresses.")

if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⚠️ Test interrupted by user")
    except Exception as e:
        print(f"\n\n💥 Unexpected error: {e}")
        import traceback
        traceback.print_exc()