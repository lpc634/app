import sys
sys.path.insert(0, '.')
from main import app
from src.models.user import User
import requests

with app.app_context():
    # Test if we can login and get assignments
    BASE_URL = "https://v3-app-49c3d1eff914.herokuapp.com"
    
    print("=== Testing Authentication Flow ===")
    
    # Step 1: Login as agent
    print("1. Logging in as agent...")
    login_data = {
        "email": "lpc634@gmail.com",
        "password": "admin123"  # You may need to update this
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
            print(f"   Token length: {len(token) if token else 0}")
            
            # Step 2: Test assignments endpoint
            print("\n2. Testing assignments endpoint...")
            headers = {'Authorization': f'Bearer {token}'}
            
            response = requests.get(f"{BASE_URL}/api/assignments/agent/{user.get('id')}?status=pending", headers=headers)
            print(f"   Assignments Status: {response.status_code}")
            
            if response.status_code == 200:
                assignments_data = response.json()
                assignments = assignments_data.get('assignments', [])
                print(f"   ✅ Found {len(assignments)} assignments")
                
                # Show assignment details
                for i, assignment in enumerate(assignments):
                    print(f"     Assignment {i+1}:")
                    print(f"       ID: {assignment.get('id')}")
                    print(f"       Job ID: {assignment.get('job_id')}")
                    print(f"       Status: {assignment.get('status')}")
                    print(f"       Has job_details: {bool(assignment.get('job_details'))}")
                    
                    if assignment.get('job_details'):
                        job = assignment['job_details']
                        print(f"       Job Title: {job.get('title')}")
                        print(f"       Job Address: {job.get('address')}")
                        print(f"       Job Time: {job.get('arrival_time')}")
            else:
                print(f"   ❌ Assignments failed: {response.text}")
                
        else:
            print(f"   ❌ Login failed: {response.text}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n=== Test Complete ===")
    print("If this test shows assignments, the backend is working.")
    print("The issue would then be in the frontend token handling.")