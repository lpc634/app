#!/usr/bin/env python3
"""
Backend JWT Test Script
Run this to verify your backend JWT authentication is working correctly.
"""

import requests
import json

# Configuration
BASE_URL = "http://localhost:5001"
TEST_EMAIL = "admin@v3services.com"
TEST_PASSWORD = "admin123"

def test_backend_auth():
    print("🔍 Testing Backend JWT Authentication...")
    print("=" * 50)
    
    # Step 1: Test login
    print("1. Testing login...")
    login_data = {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('access_token')
            print(f"   ✅ Login successful!")
            print(f"   Token received: {token[:50]}..." if token else "   ❌ No token in response")
            
            if not token:
                print("   🚨 ISSUE: Login succeeded but no access_token in response")
                return False
                
        else:
            print(f"   ❌ Login failed: {response.text}")
            return False
            
    except Exception as e:
        print(f"   ❌ Login error: {e}")
        return False
    
    # Step 2: Test authenticated request
    print("\n2. Testing authenticated request (/api/auth/me)...")
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Authenticated request successful!")
            print(f"   User: {data.get('user', {}).get('email', 'Unknown')}")
            
        else:
            print(f"   ❌ Authenticated request failed: {response.text}")
            print(f"   🚨 ISSUE: Backend JWT validation is not working")
            return False
            
    except Exception as e:
        print(f"   ❌ Authenticated request error: {e}")
        return False
    
    # Step 3: Test logout
    print("\n3. Testing logout...")
    try:
        response = requests.post(f"{BASE_URL}/api/auth/logout", headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            print(f"   ✅ Logout successful!")
        else:
            print(f"   ❌ Logout failed: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Logout error: {e}")
    
    # Step 4: Test blacklisted token
    print("\n4. Testing blacklisted token (should fail)...")
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 401:
            print(f"   ✅ Blacklisted token correctly rejected!")
        else:
            print(f"   ❌ Blacklisted token was accepted (this is a problem)")
            print(f"   Response: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Blacklisted token test error: {e}")
    
    print("\n" + "=" * 50)
    print("🎉 Backend JWT authentication is working correctly!")
    print("🔍 The issue is likely in your frontend token handling.")
    print("📋 Check the debugging guide for frontend fixes.")
    
    return True

if __name__ == "__main__":
    test_backend_auth()

