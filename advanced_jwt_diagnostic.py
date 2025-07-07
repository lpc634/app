#!/usr/bin/env python3
"""
Advanced JWT Diagnostic Script
This script will help identify exactly why JWT tokens are being rejected.
"""

import requests
import json
import jwt
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:5001"
TEST_EMAIL = "admin@v3services.com"
TEST_PASSWORD = "admin123"

def decode_jwt_token(token, secret_key):
    """Decode JWT token to inspect its contents."""
    try:
        # Decode without verification first to see the payload
        unverified_payload = jwt.decode(token, options={"verify_signature": False})
        print(f"   📋 Token payload (unverified): {json.dumps(unverified_payload, indent=6)}")
        
        # Try to decode with verification
        try:
            verified_payload = jwt.decode(token, secret_key, algorithms=["HS256"])
            print(f"   ✅ Token verification successful!")
            return verified_payload
        except jwt.ExpiredSignatureError:
            print(f"   ❌ Token has expired")
            return None
        except jwt.InvalidSignatureError:
            print(f"   ❌ Token signature is invalid (wrong secret key?)")
            return None
        except jwt.InvalidTokenError as e:
            print(f"   ❌ Token is invalid: {e}")
            return None
            
    except Exception as e:
        print(f"   ❌ Error decoding token: {e}")
        return None

def test_jwt_secrets():
    """Test different possible JWT secret keys."""
    print("\n🔑 Testing JWT Secret Keys...")
    print("-" * 30)
    
    # Login to get a token
    login_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
    
    if response.status_code != 200:
        print("❌ Cannot get token for testing")
        return
        
    token = response.json().get('access_token')
    if not token:
        print("❌ No token in login response")
        return
    
    print(f"🎫 Token to test: {token[:50]}...")
    
    # Test common secret key configurations
    possible_secrets = [
        "jwt-secret-change-in-production",  # From your main.py
        "v3-services-secret-key-change-in-production",  # Your SECRET_KEY
        "your-secret-key",  # Common default
        "",  # Empty string
        None  # None value
    ]
    
    for i, secret in enumerate(possible_secrets, 1):
        print(f"\n{i}. Testing secret: {repr(secret)}")
        decode_jwt_token(token, secret)

def test_jwt_configuration():
    """Test JWT configuration issues."""
    print("\n⚙️ Testing JWT Configuration...")
    print("-" * 35)
    
    # Test if JWT_SECRET_KEY environment variable is set
    import os
    jwt_secret_env = os.environ.get('JWT_SECRET_KEY')
    secret_key_env = os.environ.get('SECRET_KEY')
    
    print(f"   JWT_SECRET_KEY env var: {repr(jwt_secret_env)}")
    print(f"   SECRET_KEY env var: {repr(secret_key_env)}")
    
    # Test the actual Flask app configuration
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            print(f"   ✅ Flask app is responding")
        else:
            print(f"   ❌ Flask app health check failed")
    except Exception as e:
        print(f"   ❌ Cannot reach Flask app: {e}")

def advanced_jwt_test():
    """Run comprehensive JWT diagnostics."""
    print("🔍 Advanced JWT Diagnostics")
    print("=" * 50)
    
    # Step 1: Basic connectivity
    print("1. Testing Flask app connectivity...")
    try:
        response = requests.get(f"{BASE_URL}/api/health")
        if response.status_code == 200:
            print("   ✅ Flask app is running")
        else:
            print(f"   ❌ Flask app returned {response.status_code}")
            return
    except Exception as e:
        print(f"   ❌ Cannot connect to Flask app: {e}")
        return
    
    # Step 2: Test login
    print("\n2. Testing login...")
    login_data = {"email": TEST_EMAIL, "password": TEST_PASSWORD}
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('access_token')
            print(f"   ✅ Login successful, token received")
            
            if not token:
                print("   ❌ No access_token in response")
                return
        else:
            print(f"   ❌ Login failed: {response.text}")
            return
    except Exception as e:
        print(f"   ❌ Login error: {e}")
        return
    
    # Step 3: Test JWT configuration
    test_jwt_configuration()
    
    # Step 4: Test JWT secrets
    test_jwt_secrets()
    
    # Step 5: Test authenticated request with detailed headers
    print("\n📡 Testing authenticated request with detailed logging...")
    print("-" * 55)
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    print(f"   Request headers: {json.dumps(dict(headers), indent=6)}")
    
    try:
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        print(f"   Response status: {response.status_code}")
        print(f"   Response headers: {dict(response.headers)}")
        print(f"   Response body: {response.text}")
        
        if response.status_code == 200:
            print("   ✅ Authentication successful!")
        else:
            print("   ❌ Authentication failed")
            
    except Exception as e:
        print(f"   ❌ Request error: {e}")

if __name__ == "__main__":
    advanced_jwt_test()

