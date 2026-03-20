import requests
import json
import time

BASE_URL = "http://127.0.0.1:5000"

def test_api():
    print("--- Testing Smart Attendance ERP API ---")
    
    # Needs the Flask server to be running.
    # We will assume it starts successfully if we don't get a connection error.
    
    # 1. Test Login
    login_data = {"username": "admin", "password": "admin"}
    try:
        response = requests.post(f"{BASE_URL}/api/login", json=login_data)
        print(f"Login Response: {response.status_code}")
        login_result = response.json()
        print(f"Login Result: {json.dumps(login_result, indent=2)}")
        
        if not login_result.get("success"):
            print("Login failed!")
            return
        
        user_id = login_result["user"]["id"]
        
        # 2. Test Mark Attendance
        attendance_data = {
            "user_id": user_id,
            "status": "Present",
            "location": "Test Lab"
        }
        response = requests.post(f"{BASE_URL}/api/mark-attendance", json=attendance_data)
        print(f"Mark Attendance Response: {response.status_code}")
        print(f"Mark Result: {json.dumps(response.json(), indent=2)}")
        
        # 3. Test History
        response = requests.get(f"{BASE_URL}/api/attendance-history", params={"user_id": user_id})
        print(f"History Response: {response.status_code}")
        history_result = response.json()
        print(f"History count: {len(history_result.get('history', []))}")
        
        # 4. Test Stats
        response = requests.get(f"{BASE_URL}/api/attendance-stats", params={"user_id": user_id})
        print(f"Stats Response: {response.status_code}")
        print(f"Stats Result: {json.dumps(response.json(), indent=2)}")
        
        print("\n--- API Tests Completed Successfully! ---")
        
    except requests.exceptions.ConnectionError:
        print(f"Error: Could not connect to the server at {BASE_URL}. Is it running?")

if __name__ == "__main__":
    test_api()
