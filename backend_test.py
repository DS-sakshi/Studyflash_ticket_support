import requests
import sys
import json
from datetime import datetime

class StudyflashAPITester:
    def __init__(self, base_url="https://ticket-hub-150.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.ticket_id = None
        self.team_members = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.text else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test health endpoint - should show AI and Outlook disabled"""
        success, response = self.run_test(
            "Health Check",
            "GET",
            "/health",
            200
        )
        if success:
            ai_enabled = response.get('ai_enabled', True)
            outlook_enabled = response.get('outlook_enabled', True)
            print(f"   AI enabled: {ai_enabled}")
            print(f"   Outlook enabled: {outlook_enabled}")
            if not ai_enabled and not outlook_enabled:
                print("   ✅ Both AI and Outlook properly disabled")
            else:
                print("   ⚠️  Expected both AI and Outlook to be disabled")
        return success

    def test_seed_data(self):
        """Test seeding demo data"""
        success, response = self.run_test(
            "Seed Demo Data",
            "POST",
            "/seed",
            200
        )
        if success:
            print(f"   Seeded {response.get('tickets', 0)} tickets")
        return success

    def test_login(self, email="admin@studyflash.com", password="admin123"):
        """Test login and get token"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "/auth/login",
            200,
            data={"email": email, "password": password}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            print(f"   Logged in as: {response['user']['name']} ({response['user']['role']})")
            return True
        return False

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "/auth/me",
            200
        )
        return success

    def test_register(self):
        """Test user registration"""
        test_user = f"test_user_{datetime.now().strftime('%H%M%S')}"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "/auth/register",
            200,
            data={
                "name": "Test User",
                "email": f"{test_user}@studyflash.com",
                "password": "testpass123",
                "role": "agent"
            }
        )
        return success

    def test_get_team(self):
        """Test getting team members"""
        success, response = self.run_test(
            "Get Team Members",
            "GET",
            "/team",
            200
        )
        if success:
            self.team_members = response
            print(f"   Found {len(response)} team members")
        return success

    def test_ticket_stats(self):
        """Test getting ticket statistics"""
        success, response = self.run_test(
            "Get Ticket Stats",
            "GET",
            "/tickets/stats",
            200
        )
        if success:
            print(f"   Total tickets: {response.get('total', 0)}")
            print(f"   Open: {response.get('open', 0)}, In Progress: {response.get('in_progress', 0)}")
            print(f"   Categories: {len(response.get('categories', {}))}")
        return success

    def test_list_tickets(self):
        """Test listing tickets with filters"""
        success, response = self.run_test(
            "List All Tickets",
            "GET",
            "/tickets",
            200
        )
        if success and response.get('tickets'):
            self.ticket_id = response['tickets'][0]['id']
            print(f"   Found {len(response['tickets'])} tickets")
            print(f"   First ticket: {response['tickets'][0]['ticket_number']}")
        
        # Test with filters
        success2, response2 = self.run_test(
            "List Tickets with Filters",
            "GET",
            "/tickets?status=open&category=refund-request&limit=5",
            200
        )
        return success and success2

    def test_get_ticket_detail(self):
        """Test getting specific ticket details"""
        if not self.ticket_id:
            print("❌ No ticket ID available for detail test")
            return False
            
        success, response = self.run_test(
            "Get Ticket Detail",
            "GET",
            f"/tickets/{self.ticket_id}",
            200
        )
        if success:
            print(f"   Ticket: {response.get('subject', 'N/A')}")
            print(f"   Status: {response.get('status', 'N/A')}")
        return success

    def test_update_ticket(self):
        """Test updating ticket properties"""
        if not self.ticket_id:
            print("❌ No ticket ID available for update test")
            return False
            
        success, response = self.run_test(
            "Update Ticket Status",
            "PATCH",
            f"/tickets/{self.ticket_id}",
            200,
            data={"status": "in_progress", "priority": "high"}
        )
        if success:
            print(f"   Updated status to: {response.get('status', 'N/A')}")
        return success

    def test_get_messages(self):
        """Test getting ticket messages"""
        if not self.ticket_id:
            print("❌ No ticket ID available for messages test")
            return False
            
        success, response = self.run_test(
            "Get Ticket Messages",
            "GET",
            f"/tickets/{self.ticket_id}/messages",
            200
        )
        if success:
            print(f"   Found {len(response)} messages")
        return success

    def test_send_message(self):
        """Test sending a message to ticket"""
        if not self.ticket_id:
            print("❌ No ticket ID available for send message test")
            return False
            
        success, response = self.run_test(
            "Send Message",
            "POST",
            f"/tickets/{self.ticket_id}/messages",
            200,
            data={
                "body": "This is a test reply from the API testing suite.",
                "sender_type": "agent",
                "source": "platform"
            }
        )
        if success:
            print(f"   Message sent with ID: {response.get('id', 'N/A')}")
            print(f"   Outlook synced: {response.get('outlook_synced', False)}")
        return success

    def test_create_ticket(self):
        """Test creating a new ticket"""
        success, response = self.run_test(
            "Create New Ticket",
            "POST",
            "/tickets",
            200,
            data={
                "subject": "API Test Ticket",
                "body": "This is a test ticket created by the API testing suite.",
                "sender_email": "test@example.com",
                "sender_name": "API Tester",
                "language": "en",
                "tags": ["api-test"]
            }
        )
        if success:
            print(f"   Created ticket: {response.get('ticket_number', 'N/A')}")
        return success

    def test_ai_status(self):
        """Test AI status endpoint - should show disabled"""
        success, response = self.run_test(
            "AI Status Check",
            "GET",
            "/ai/status",
            200
        )
        if success:
            enabled = response.get('enabled', True)
            print(f"   AI enabled: {enabled}")
            if not enabled:
                print("   ✅ AI properly disabled")
            else:
                print("   ⚠️  Expected AI to be disabled")
        return success

    def test_ai_categorize(self):
        """Test AI categorization - should return 503"""
        if not self.ticket_id:
            print("❌ No ticket ID available for AI categorize test")
            return False
            
        success, response = self.run_test(
            "AI Categorize (Should Fail)",
            "POST",
            "/ai/categorize",
            503,  # Expecting 503 Service Unavailable
            data={
                "text": "I want to cancel my subscription and get a refund for this month.",
                "ticket_id": self.ticket_id
            }
        )
        if success:
            print("   ✅ AI categorize properly returns 503 (disabled)")
        return success

    def test_ai_draft(self):
        """Test AI draft response - should return 503"""
        success, response = self.run_test(
            "AI Draft Response (Should Fail)",
            "POST",
            "/ai/draft",
            503,  # Expecting 503 Service Unavailable
            data={
                "text": "I'm having trouble logging into my account after changing my password."
            }
        )
        if success:
            print("   ✅ AI draft properly returns 503 (disabled)")
        return success

    def test_ai_translate(self):
        """Test AI translation - should return 503"""
        success, response = self.run_test(
            "AI Translate (Should Fail)",
            "POST",
            "/ai/translate",
            503,  # Expecting 503 Service Unavailable
            data={
                "text": "Ich möchte mein Abonnement kündigen und eine Rückerstattung erhalten."
            }
        )
        if success:
            print("   ✅ AI translate properly returns 503 (disabled)")
        return success

    def test_ai_auto_assign(self):
        """Test AI auto-assignment - should return 503"""
        if not self.ticket_id:
            print("❌ No ticket ID available for AI auto-assign test")
            return False
            
        success, response = self.run_test(
            "AI Auto-Assign (Should Fail)",
            "POST",
            "/ai/auto-assign",
            503,  # Expecting 503 Service Unavailable
            data={
                "text": "I need help with a technical issue in the mobile app.",
                "ticket_id": self.ticket_id
            }
        )
        if success:
            print("   ✅ AI auto-assign properly returns 503 (disabled)")
        return success

    def test_outlook_sync(self):
        """Test Outlook sync - should return 400"""
        success, response = self.run_test(
            "Outlook Sync (Should Fail)",
            "POST",
            "/outlook/sync",
            400,  # Expecting 400 Bad Request
        )
        if success:
            print("   ✅ Outlook sync properly returns 400 (not configured)")
        return success

    def test_enrichment_data(self):
        """Test getting enrichment data"""
        if not self.ticket_id:
            print("❌ No ticket ID available for enrichment test")
            return False
            
        success, response = self.run_test(
            "Get Enrichment Data",
            "GET",
            f"/enrichment/{self.ticket_id}",
            200
        )
        if success:
            print(f"   Sentry errors: {len(response.get('sentry', {}).get('recent_errors', []))}")
            print(f"   PostHog sessions: {response.get('posthog', {}).get('total_sessions', 0)}")
            print(f"   User plan: {response.get('user', {}).get('plan', 'N/A')}")
        return success

def main():
    print("🚀 Starting Studyflash Support Platform API Tests")
    print("=" * 60)
    
    tester = StudyflashAPITester()
    
    # Test sequence
    tests = [
        ("Health Check", tester.test_health_check),
        ("AI Status Check", tester.test_ai_status),
        ("Seed Demo Data", tester.test_seed_data),
        ("Admin Login", tester.test_login),
        ("Get Current User", tester.test_auth_me),
        ("User Registration", tester.test_register),
        ("Get Team Members", tester.test_get_team),
        ("Get Ticket Stats", tester.test_ticket_stats),
        ("List Tickets", tester.test_list_tickets),
        ("Get Ticket Detail", tester.test_get_ticket_detail),
        ("Update Ticket", tester.test_update_ticket),
        ("Get Messages", tester.test_get_messages),
        ("Send Message", tester.test_send_message),
        ("Create Ticket", tester.test_create_ticket),
        ("AI Categorize (Should Fail)", tester.test_ai_categorize),
        ("AI Draft Response (Should Fail)", tester.test_ai_draft),
        ("AI Translate (Should Fail)", tester.test_ai_translate),
        ("AI Auto-Assign (Should Fail)", tester.test_ai_auto_assign),
        ("Outlook Sync (Should Fail)", tester.test_outlook_sync),
        ("Get Enrichment Data", tester.test_enrichment_data),
    ]
    
    print(f"\n📋 Running {len(tests)} API tests...\n")
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} - Exception: {str(e)}")
            tester.tests_run += 1
    
    # Print results
    print("\n" + "=" * 60)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"📈 Success Rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Backend API tests mostly successful!")
        return 0
    elif success_rate >= 50:
        print("⚠️  Backend API has some issues but core functionality works")
        return 1
    else:
        print("❌ Backend API has major issues")
        return 2

if __name__ == "__main__":
    sys.exit(main())