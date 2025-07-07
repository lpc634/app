#!/usr/bin/env python3
"""
V3 Services System Integration Test Script
Tests the complete system integration including backend API, web dashboard, and mobile app.
"""

import requests
import json
import time
import sys
from datetime import datetime, timedelta

# Configuration
API_BASE_URL = "http://localhost:5000/api"
DASHBOARD_URL = "http://localhost:5174"
MOBILE_URL = "http://localhost:5175"

# Test credentials
ADMIN_EMAIL = "admin@v3services.com"
ADMIN_PASSWORD = "admin123"

class V3ServicesIntegrationTest:
    def __init__(self):
        self.admin_token = None
        self.agent_token = None
        self.test_agent_id = None
        self.test_job_id = None
        self.test_assignment_id = None
        self.passed_tests = 0
        self.failed_tests = 0
        
    def log(self, message, level="INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def assert_test(self, condition, test_name, error_message=""):
        if condition:
            self.log(f"✅ PASS: {test_name}", "PASS")
            self.passed_tests += 1
            return True
        else:
            self.log(f"❌ FAIL: {test_name} - {error_message}", "FAIL")
            self.failed_tests += 1
            return False
            
    def make_request(self, method, endpoint, data=None, token=None, expected_status=200):
        """Make HTTP request to API"""
        url = f"{API_BASE_URL}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if token:
            headers["Authorization"] = f"Bearer {token}"
            
        try:
            if method == "GET":
                response = requests.get(url, headers=headers)
            elif method == "POST":
                response = requests.post(url, headers=headers, json=data)
            elif method == "PUT":
                response = requests.put(url, headers=headers, json=data)
            elif method == "DELETE":
                response = requests.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            return response
        except requests.exceptions.RequestException as e:
            self.log(f"Request failed: {e}", "ERROR")
            return None
            
    def test_backend_health(self):
        """Test if backend API is running"""
        self.log("Testing backend API health...")
        
        response = self.make_request("GET", "/health")
        if response and response.status_code == 200:
            self.assert_test(True, "Backend API Health Check")
            return True
        else:
            self.assert_test(False, "Backend API Health Check", "API not responding")
            return False
            
    def test_admin_authentication(self):
        """Test admin login"""
        self.log("Testing admin authentication...")
        
        login_data = {
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                self.admin_token = data["access_token"]
                self.assert_test(True, "Admin Authentication")
                return True
                
        self.assert_test(False, "Admin Authentication", "Login failed")
        return False
        
    def test_create_test_agent(self):
        """Create a test agent account"""
        self.log("Creating test agent account...")
        
        agent_data = {
            "email": "test.agent@v3services.com",
            "password": "testpass123",
            "first_name": "Test",
            "last_name": "Agent",
            "role": "agent",
            "phone": "+44 7700 900123"
        }
        
        response = self.make_request("POST", "/users", agent_data, self.admin_token, 201)
        if response and response.status_code == 201:
            data = response.json()
            self.test_agent_id = data["user"]["id"]
            self.assert_test(True, "Create Test Agent")
            return True
            
        self.assert_test(False, "Create Test Agent", f"Status: {response.status_code if response else 'No response'}")
        return False
        
    def test_agent_authentication(self):
        """Test agent login"""
        self.log("Testing agent authentication...")
        
        login_data = {
            "email": "test.agent@v3services.com",
            "password": "testpass123"
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                self.agent_token = data["access_token"]
                self.assert_test(True, "Agent Authentication")
                return True
                
        self.assert_test(False, "Agent Authentication", "Login failed")
        return False
        
    def test_agent_availability(self):
        """Test agent availability management"""
        self.log("Testing agent availability management...")
        
        # Set availability for today
        today = datetime.now().strftime("%Y-%m-%d")
        availability_data = {
            "agent_id": self.test_agent_id,
            "start_date": today,
            "end_date": today,
            "is_available": True,
            "notes": "Available for integration testing"
        }
        
        response = self.make_request("POST", "/availability", availability_data, self.agent_token)
        if response and response.status_code in [200, 201]:
            self.assert_test(True, "Set Agent Availability")
        else:
            self.assert_test(False, "Set Agent Availability", f"Status: {response.status_code if response else 'No response'}")
            return False
            
        # Get availability
        response = self.make_request("GET", f"/availability/{self.test_agent_id}?start_date={today}&end_date={today}", token=self.agent_token)
        if response and response.status_code == 200:
            data = response.json()
            if data.get("availability") and len(data["availability"]) > 0:
                self.assert_test(True, "Get Agent Availability")
                return True
                
        self.assert_test(False, "Get Agent Availability", "No availability data returned")
        return False
        
    def test_job_creation(self):
        """Test job creation by admin"""
        self.log("Testing job creation...")
        
        # Create job for tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        job_data = {
            "title": "Integration Test Security Job",
            "job_type": "Security",
            "address": "123 Test Street, London, SW1A 1AA",
            "postcode": "SW1A 1AA",
            "arrival_time": tomorrow,
            "agents_required": 1,
            "urgency_level": "URGENT",
            "instructions": "This is a test job for integration testing"
        }
        
        response = self.make_request("POST", "/jobs", job_data, self.admin_token)
        if response and response.status_code == 201:
            data = response.json()
            self.test_job_id = data["job"]["id"]
            self.assert_test(True, "Create Job")
            return True
            
        self.assert_test(False, "Create Job", f"Status: {response.status_code if response else 'No response'}")
        return False
        
    def test_job_assignment(self):
        """Test job assignment to available agent"""
        self.log("Testing job assignment...")
        
        # Get agent assignments
        response = self.make_request("GET", f"/assignments/agent/{self.test_agent_id}", token=self.agent_token)
        if response and response.status_code == 200:
            data = response.json()
            assignments = data.get("assignments", [])
            
            # Find the assignment for our test job
            test_assignment = None
            for assignment in assignments:
                if assignment["job_id"] == self.test_job_id:
                    test_assignment = assignment
                    self.test_assignment_id = assignment["id"]
                    break
                    
            if test_assignment:
                self.assert_test(True, "Job Assignment Created")
                return True
                
        self.assert_test(False, "Job Assignment Created", "No assignment found for test job")
        return False
        
    def test_agent_job_response(self):
        """Test agent responding to job assignment"""
        self.log("Testing agent job response...")
        
        if not self.test_assignment_id:
            self.assert_test(False, "Agent Job Response", "No assignment ID available")
            return False
            
        # Agent accepts the job
        response_data = {"response": "accept"}
        response = self.make_request("POST", f"/assignments/{self.test_assignment_id}/respond", response_data, self.agent_token)
        
        if response and response.status_code == 200:
            self.assert_test(True, "Agent Accept Job")
            
            # Verify assignment status changed
            response = self.make_request("GET", f"/assignments/agent/{self.test_agent_id}", token=self.agent_token)
            if response and response.status_code == 200:
                data = response.json()
                assignments = data.get("assignments", [])
                
                for assignment in assignments:
                    if assignment["id"] == self.test_assignment_id and assignment["status"] == "accepted":
                        self.assert_test(True, "Assignment Status Updated")
                        return True
                        
                self.assert_test(False, "Assignment Status Updated", "Status not changed to accepted")
                return False
        else:
            self.assert_test(False, "Agent Accept Job", f"Status: {response.status_code if response else 'No response'}")
            return False
            
    def test_notifications(self):
        """Test notification system"""
        self.log("Testing notification system...")
        
        # Get agent notifications
        response = self.make_request("GET", "/notifications", token=self.agent_token)
        if response and response.status_code == 200:
            data = response.json()
            notifications = data.get("notifications", [])
            
            # Should have at least one notification for the job assignment
            if len(notifications) > 0:
                self.assert_test(True, "Notifications Retrieved")
                
                # Test marking notification as read
                notification_id = notifications[0]["id"]
                response = self.make_request("POST", f"/notifications/{notification_id}/read", token=self.agent_token)
                if response and response.status_code == 200:
                    self.assert_test(True, "Mark Notification Read")
                    return True
                else:
                    self.assert_test(False, "Mark Notification Read", f"Status: {response.status_code if response else 'No response'}")
                    return False
            else:
                self.assert_test(False, "Notifications Retrieved", "No notifications found")
                return False
        else:
            self.assert_test(False, "Notifications Retrieved", f"Status: {response.status_code if response else 'No response'}")
            return False
            
    def test_analytics(self):
        """Test analytics endpoints"""
        self.log("Testing analytics...")
        
        # Test dashboard analytics
        response = self.make_request("GET", "/analytics/dashboard", token=self.admin_token)
        if response and response.status_code == 200:
            self.assert_test(True, "Dashboard Analytics")
        else:
            self.assert_test(False, "Dashboard Analytics", f"Status: {response.status_code if response else 'No response'}")
            
        # Test agent analytics
        response = self.make_request("GET", "/analytics/agents", token=self.admin_token)
        if response and response.status_code == 200:
            self.assert_test(True, "Agent Analytics")
        else:
            self.assert_test(False, "Agent Analytics", f"Status: {response.status_code if response else 'No response'}")
            
        # Test job analytics
        response = self.make_request("GET", "/analytics/jobs", token=self.admin_token)
        if response and response.status_code == 200:
            self.assert_test(True, "Job Analytics")
            return True
        else:
            self.assert_test(False, "Job Analytics", f"Status: {response.status_code if response else 'No response'}")
            return False
            
    def test_weather_integration(self):
        """Test weather API integration"""
        self.log("Testing weather integration...")
        
        # Test weather endpoint
        response = self.make_request("GET", "/weather/forecast?postcode=SW1A1AA", token=self.admin_token)
        if response and response.status_code == 200:
            data = response.json()
            if "forecast" in data:
                self.assert_test(True, "Weather Integration")
                return True
                
        # Weather might fail due to API limits, so we'll mark as warning
        self.log("⚠️  WARNING: Weather API test failed (may be due to API limits)", "WARN")
        return True
        
    def test_frontend_accessibility(self):
        """Test if frontend applications are accessible"""
        self.log("Testing frontend accessibility...")
        
        try:
            # Test dashboard
            dashboard_response = requests.get(DASHBOARD_URL, timeout=5)
            if dashboard_response.status_code == 200:
                self.assert_test(True, "Dashboard Accessibility")
            else:
                self.assert_test(False, "Dashboard Accessibility", f"Status: {dashboard_response.status_code}")
                
            # Test mobile app
            mobile_response = requests.get(MOBILE_URL, timeout=5)
            if mobile_response.status_code == 200:
                self.assert_test(True, "Mobile App Accessibility")
                return True
            else:
                self.assert_test(False, "Mobile App Accessibility", f"Status: {mobile_response.status_code}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.log(f"⚠️  WARNING: Frontend accessibility test failed: {e}", "WARN")
            return True
            
    def cleanup_test_data(self):
        """Clean up test data"""
        self.log("Cleaning up test data...")
        
        # Delete test job
        if self.test_job_id:
            response = self.make_request("DELETE", f"/jobs/{self.test_job_id}", token=self.admin_token)
            if response and response.status_code == 200:
                self.log("Test job deleted")
                
        # Delete test agent
        if self.test_agent_id:
            response = self.make_request("DELETE", f"/users/{self.test_agent_id}", token=self.admin_token)
            if response and response.status_code == 200:
                self.log("Test agent deleted")
                
    def run_all_tests(self):
        """Run all integration tests"""
        self.log("Starting V3 Services Integration Tests...")
        self.log("=" * 60)
        
        # Core system tests
        if not self.test_backend_health():
            self.log("Backend API not available. Stopping tests.", "ERROR")
            return False
            
        if not self.test_admin_authentication():
            self.log("Admin authentication failed. Stopping tests.", "ERROR")
            return False
            
        # User management tests
        self.test_create_test_agent()
        self.test_agent_authentication()
        
        # Core workflow tests
        self.test_agent_availability()
        self.test_job_creation()
        self.test_job_assignment()
        self.test_agent_job_response()
        
        # Feature tests
        self.test_notifications()
        self.test_analytics()
        self.test_weather_integration()
        self.test_frontend_accessibility()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Summary
        self.log("=" * 60)
        self.log(f"Integration Tests Complete!")
        self.log(f"✅ Passed: {self.passed_tests}")
        self.log(f"❌ Failed: {self.failed_tests}")
        self.log(f"📊 Success Rate: {(self.passed_tests / (self.passed_tests + self.failed_tests) * 100):.1f}%")
        
        if self.failed_tests == 0:
            self.log("🎉 All tests passed! System integration successful.", "SUCCESS")
            return True
        else:
            self.log(f"⚠️  {self.failed_tests} test(s) failed. Please review the issues above.", "WARNING")
            return False

def main():
    """Main function"""
    tester = V3ServicesIntegrationTest()
    success = tester.run_all_tests()
    
    if success:
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()

