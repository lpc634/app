import sys
sys.path.insert(0, '.')
from main import app
from src.models.user import User
import requests

with app.app_context():
    # Test if we can login and get assignments
    BASE_URL = "https://v3-app-49c3d1eff914.herokuapp.com"
    
    print("=== Testing Authentication Flow ===")
    
    # Step 1: Login as agent with correct password
    print("1. Logging in as agent...")
    login_data = {
        "email": "lpc634@gmail.com",
        "password": "@1Cdvqfhmh1986"
    }
    
    try:
        response = requests.post(f"{BASE_URL}/api/auth/login", json=login_data)
        print(f"   Login Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            token = data.get('access_token')
            user = data.get('user')
            print(f"   ✅ Login successful!")
            print(f"   User ID: {user.get('id')}")
            print(f"   User Email: {user.get('email')}")
            print(f"   User Role: {user.get('role')}")
            print(f"   Token length: {len(token) if token else 0}")
            print(f"   Token preview: {token[:50] if token else 'None'}...")
            
            # Step 2: Test assignments endpoint
            print("\n2. Testing assignments endpoint...")
            headers = {
                'Authorization': f'Bearer {token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(f"{BASE_URL}/api/assignments/agent/{user.get('id')}?status=pending", headers=headers)
            print(f"   Assignments Status: {response.status_code}")
            
            if response.status_code == 200:
                assignments_data = response.json()
                assignments = assignments_data.get('assignments', [])
                print(f"   ✅ Found {len(assignments)} assignments")
                print(f"   Response keys: {list(assignments_data.keys())}")
                
                # Show assignment details
                for i, assignment in enumerate(assignments):
                    print(f"\n     Assignment {i+1}:")
                    print(f"       ID: {assignment.get('id')}")
                    print(f"       Job ID: {assignment.get('job_id')}")
                    print(f"       Status: {assignment.get('status')}")
                    print(f"       Created: {assignment.get('created_at')}")
                    print(f"       Has job_details: {bool(assignment.get('job_details'))}")
                    
                    if assignment.get('job_details'):
                        job = assignment['job_details']
                        print(f"       Job Title: {job.get('title')}")
                        print(f"       Job Address: {job.get('address')}")
                        print(f"       Job Time: {job.get('arrival_time')}")
                        print(f"       Job Keys: {list(job.keys())}")
                    else:
                        print(f"       ❌ Missing job_details!")
                        print(f"       Assignment Keys: {list(assignment.keys())}")
                        
            else:
                print(f"   ❌ Assignments failed: {response.text}")
                
            # Step 3: Test without status filter
            print("\n3. Testing assignments without status filter...")
            response = requests.get(f"{BASE_URL}/api/assignments/agent/{user.get('id')}", headers=headers)
            print(f"   All Assignments Status: {response.status_code}")
            
            if response.status_code == 200:
                all_data = response.json()
                all_assignments = all_data.get('assignments', [])
                print(f"   ✅ Found {len(all_assignments)} total assignments")
                
                for assignment in all_assignments:
                    print(f"     - Assignment {assignment.get('id')}: {assignment.get('status')}")
                
        else:
            print(f"   ❌ Login failed: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n=== Test Complete ===")
    print("This test will show us exactly what the backend returns")
    print("and help identify if the issue is in frontend or backend.")