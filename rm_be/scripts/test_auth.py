"""Test script for authentication endpoints"""

import httpx
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

BASE_URL = "http://localhost:8000"


def test_endpoint(method: str, endpoint: str, token: str = None, expected_status: int = 200):
    """Test an endpoint with optional authentication"""
    url = f"{BASE_URL}{endpoint}"
    headers = {}
    
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    try:
        if method.upper() == "GET":
            response = httpx.get(url, headers=headers, timeout=5.0)
        elif method.upper() == "POST":
            response = httpx.post(url, headers=headers, timeout=5.0)
        else:
            print(f"Unsupported method: {method}")
            return False
        
        status_ok = response.status_code == expected_status
        status_icon = "✓" if status_ok else "✗"
        
        print(f"{status_icon} {method} {endpoint} - Status: {response.status_code} (expected: {expected_status})")
        
        if response.status_code == 200:
            try:
                data = response.json()
                print(f"   Response: {data}")
            except:
                print(f"   Response: {response.text[:100]}")
        elif response.status_code >= 400:
            try:
                error = response.json()
                print(f"   Error: {error.get('detail', 'Unknown error')}")
            except:
                print(f"   Error: {response.text[:100]}")
        
        return status_ok
    
    except httpx.ConnectError:
        print(f"✗ {method} {endpoint} - Connection failed. Is the server running?")
        return False
    except Exception as e:
        print(f"✗ {method} {endpoint} - Error: {str(e)}")
        return False


def main():
    """Run authentication tests"""
    print("=" * 60)
    print("Authentication Test Suite")
    print("=" * 60)
    print()
    
    # Test public endpoints
    print("Testing Public Endpoints:")
    print("-" * 60)
    test_endpoint("GET", "/")
    test_endpoint("GET", "/health")
    print()
    
    # Test authenticated endpoints without token
    print("Testing Authenticated Endpoints (No Token):")
    print("-" * 60)
    test_endpoint("GET", "/auth/me", expected_status=401)
    test_endpoint("GET", "/auth/admin", expected_status=401)
    print()
    
    # Test with mock users
    print("Testing with Mock Users:")
    print("-" * 60)
    
    # Admin user
    print("\n1. Testing as Admin:")
    admin_token = "admin@example.com"
    test_endpoint("GET", "/auth/me", token=admin_token)
    test_endpoint("GET", "/auth/admin", token=admin_token)
    test_endpoint("GET", "/auth/responsible", token=admin_token)  # Admin should have access
    test_endpoint("GET", "/auth/collaborator", token=admin_token)  # Admin should have access
    
    # Responsible user
    print("\n2. Testing as Responsible:")
    responsible_token = "responsible@example.com"
    test_endpoint("GET", "/auth/me", token=responsible_token)
    test_endpoint("GET", "/auth/admin", token=responsible_token, expected_status=403)
    test_endpoint("GET", "/auth/responsible", token=responsible_token)
    test_endpoint("GET", "/auth/collaborator", token=responsible_token)
    
    # Collaborator user
    print("\n3. Testing as Collaborator:")
    collaborator_token = "collaborator1@example.com"
    test_endpoint("GET", "/auth/me", token=collaborator_token)
    test_endpoint("GET", "/auth/admin", token=collaborator_token, expected_status=403)
    test_endpoint("GET", "/auth/responsible", token=collaborator_token, expected_status=403)
    test_endpoint("GET", "/auth/collaborator", token=collaborator_token)
    
    # Invalid token
    print("\n4. Testing with Invalid Token:")
    test_endpoint("GET", "/auth/me", token="invalid@example.com", expected_status=401)
    
    print()
    print("=" * 60)
    print("Test Suite Complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
