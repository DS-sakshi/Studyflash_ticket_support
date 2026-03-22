# Enrichment Setup Guide

This guide covers connecting the three enrichment sources to replace mock data with real data from your infrastructure.

## Overview

The enrichment system is accessible via `GET /api/enrichment/{ticket_id}`. It returns data from three sources based on the ticket sender's email. Currently returns mock data; this guide shows how to connect real sources.

The design principle: **the endpoint signature and response shape stay the same**. Only the data source changes. The frontend doesn't need any modifications.

---

## 1. Sentry Integration

### Prerequisites
- Sentry account with the Studyflash project
- Auth token with `project:read` and `event:read` scopes

### Configuration

```env
# backend/.env
SENTRY_AUTH_TOKEN=your-sentry-auth-token
SENTRY_ORG=your-sentry-org-slug
SENTRY_PROJECT=your-sentry-project-slug
```

### Implementation

```python
import httpx

class SentryClient:
    BASE_URL = "https://sentry.io/api/0"
    
    def __init__(self):
        self.token = os.environ.get('SENTRY_AUTH_TOKEN')
        self.org = os.environ.get('SENTRY_ORG')
        self.project = os.environ.get('SENTRY_PROJECT')
        self.enabled = all([self.token, self.org, self.project])
    
    async def get_user_errors(self, email: str) -> dict:
        """Fetch recent errors associated with a user email."""
        if not self.enabled:
            return None  # Falls back to mock data
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        async with httpx.AsyncClient() as client:
            # Search for issues tagged with the user's email
            url = (
                f"{self.BASE_URL}/projects/{self.org}/{self.project}/issues/"
                f"?query=user.email:{email}"
                f"&sort=date"
                f"&limit=5"
            )
            response = await client.get(url, headers=headers)
            
            if response.status_code != 200:
                return None
            
            issues = response.json()
            
            recent_errors = []
            for issue in issues:
                recent_errors.append({
                    "title": issue["title"],
                    "count": issue["count"],
                    "last_seen": issue["lastSeen"],
                    "level": issue["level"]
                })
            
            # Get error rate from project stats
            stats_url = f"{self.BASE_URL}/projects/{self.org}/{self.project}/stats/"
            stats_response = await client.get(stats_url, headers=headers)
            
            return {
                "recent_errors": recent_errors,
                "error_rate": len(recent_errors),  # Simplified
                "sessions_with_errors": sum(e["count"] for e in recent_errors)
            }
```

---

## 2. PostHog Integration

### Prerequisites
- PostHog instance (cloud or self-hosted)
- Personal API key with read access

### Configuration

```env
# backend/.env
POSTHOG_API_KEY=phx_your-personal-api-key
POSTHOG_HOST=https://app.posthog.com
# or for EU: https://eu.posthog.com
# or self-hosted: https://your-posthog-instance.com
```

### Implementation

```python
class PostHogClient:
    def __init__(self):
        self.api_key = os.environ.get('POSTHOG_API_KEY')
        self.host = os.environ.get('POSTHOG_HOST', 'https://app.posthog.com')
        self.enabled = bool(self.api_key)
    
    async def get_user_data(self, email: str) -> dict:
        """Fetch user behavior data from PostHog."""
        if not self.enabled:
            return None
        
        headers = {"Authorization": f"Bearer {self.api_key}"}
        
        async with httpx.AsyncClient() as client:
            # Find the person by email
            persons_url = f"{self.host}/api/projects/@current/persons/?search={email}"
            response = await client.get(persons_url, headers=headers)
            
            if response.status_code != 200:
                return None
            
            persons = response.json().get("results", [])
            if not persons:
                return None
            
            person = persons[0]
            person_id = person["id"]
            distinct_id = person["distinct_ids"][0] if person["distinct_ids"] else None
            
            # Get session recordings
            recordings_url = (
                f"{self.host}/api/projects/@current/session_recordings"
                f"?person_id={person_id}&limit=5"
            )
            rec_response = await client.get(recordings_url, headers=headers)
            recordings_data = rec_response.json().get("results", [])
            
            recordings = []
            for rec in recordings_data[:3]:
                recordings.append({
                    "id": rec["id"],
                    "duration": f"{rec.get('recording_duration', 0) // 60}m {rec.get('recording_duration', 0) % 60}s",
                    "date": rec.get("start_time", "")[:10],
                    "url": f"{self.host}/recordings/{rec['id']}"
                })
            
            # Get key events
            events_url = (
                f"{self.host}/api/projects/@current/events"
                f"?person_id={person_id}"
                f"&limit=100"
            )
            events_response = await client.get(events_url, headers=headers)
            events = events_response.json().get("results", [])
            
            # Count event types
            event_counts = {}
            for event in events:
                name = event.get("event", "unknown")
                event_counts[name] = event_counts.get(name, 0) + 1
            
            # Get feature flags for this person
            flags = person.get("properties", {}).get("$feature_flags", [])
            
            return {
                "total_sessions": len(recordings_data),
                "avg_session_duration": "N/A",  # Calculate from recordings
                "last_active": person.get("properties", {}).get("$last_seen", "Unknown"),
                "feature_flags": flags if isinstance(flags, list) else [],
                "recordings": recordings,
                "key_events": [
                    {"event": k, "count": v}
                    for k, v in sorted(event_counts.items(), key=lambda x: -x[1])[:5]
                ]
            }
```

---

## 3. User Database (PostgreSQL)

### Prerequisites
- Read-only access to the Studyflash production PostgreSQL database
- Connection string with limited permissions

### Configuration

```env
# backend/.env
DATABASE_URL=postgresql://readonly_user:password@host:5432/studyflash
```

### Implementation

```python
import asyncpg

class UserDBClient:
    def __init__(self):
        self.database_url = os.environ.get('DATABASE_URL')
        self.enabled = bool(self.database_url)
        self._pool = None
    
    async def _get_pool(self):
        if not self._pool:
            self._pool = await asyncpg.create_pool(self.database_url, min_size=1, max_size=5)
        return self._pool
    
    async def get_user_data(self, email: str) -> dict:
        """Fetch user data from the Studyflash database."""
        if not self.enabled:
            return None
        
        pool = await self._get_pool()
        
        async with pool.acquire() as conn:
            # Adapt these queries to your actual schema
            user = await conn.fetchrow("""
                SELECT 
                    id, email, name, 
                    plan_type, plan_status,
                    created_at, last_login_at,
                    payment_method, country
                FROM users 
                WHERE email = $1
            """, email)
            
            if not user:
                return None
            
            user_id = user['id']
            
            # Get usage stats
            stats = await conn.fetchrow("""
                SELECT 
                    COUNT(DISTINCT fc.id) as total_flashcards,
                    COUNT(DISTINCT ss.id) as total_study_sessions
                FROM users u
                LEFT JOIN flashcards fc ON fc.user_id = u.id
                LEFT JOIN study_sessions ss ON ss.user_id = u.id
                WHERE u.id = $1
            """, user_id)
            
            # Get payment total
            payment = await conn.fetchrow("""
                SELECT COALESCE(SUM(amount), 0) as total_paid, currency
                FROM payments 
                WHERE user_id = $1 AND status = 'completed'
                GROUP BY currency
            """, user_id)
            
            return {
                "user_id": str(user['id']),
                "email": user['email'],
                "name": user['name'],
                "plan": user['plan_type'] or 'free',
                "plan_status": user['plan_status'] or 'unknown',
                "signup_date": str(user['created_at'])[:10] if user['created_at'] else 'Unknown',
                "last_login": str(user['last_login_at']) if user['last_login_at'] else 'Unknown',
                "total_flashcards": stats['total_flashcards'] if stats else 0,
                "total_study_sessions": stats['total_study_sessions'] if stats else 0,
                "payment_method": user['payment_method'] or 'Unknown',
                "total_paid": f"{payment['total_paid']} {payment['currency']}" if payment else "0",
                "country": user['country'] or 'Unknown'
            }
```

---

## Wiring It All Together

Replace the mock enrichment endpoint in `server.py`:

```python
sentry = SentryClient()
posthog = PostHogClient()
user_db = UserDBClient()

@api_router.get("/enrichment/{ticket_id}")
async def get_enrichment(ticket_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    email = ticket.get('sender_email', '')
    
    # Try real sources first, fall back to mock
    sentry_data = await sentry.get_user_errors(email)
    posthog_data = await posthog.get_user_data(email)
    user_data = await user_db.get_user_data(email)
    
    # Generate mock data for any source that returned None
    if not sentry_data:
        sentry_data = generate_mock_sentry(email)
    if not posthog_data:
        posthog_data = generate_mock_posthog(email)
    if not user_data:
        user_data = generate_mock_user(email, ticket)
    
    return {"sentry": sentry_data, "posthog": posthog_data, "user": user_data}
```

This graceful degradation means you can connect one source at a time. If Sentry is configured but PostHog isn't, you get real Sentry data with mock PostHog data.

---

## Additional Dependencies

```bash
pip install httpx asyncpg
```

Add to `requirements.txt`:
```
httpx>=0.27.0
asyncpg>=0.29.0
```
