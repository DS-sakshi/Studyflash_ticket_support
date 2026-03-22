from fastapi import FastAPI, APIRouter, HTTPException, Depends, Query, Header, Request
from fastapi.responses import PlainTextResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
import hashlib
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
import re
from datetime import datetime, timezone
import jwt
import bcrypt
from openai import AsyncOpenAI
import msal

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT config
JWT_SECRET = os.environ.get('JWT_SECRET', 'studyflash-support-secret-key-2025')
JWT_ALGORITHM = 'HS256'

# LLM config — uses the standard OpenAI Python SDK
# Set OPENAI_API_KEY in .env to enable AI features (categorize, draft, translate, auto-assign)
# AI features are optional — the app works without a key, AI buttons just return a 503
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')
OPENAI_MODEL = os.environ.get('OPENAI_MODEL', 'gpt-4o')
openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

# Outlook config — enables real MS Graph integration when credentials present
OUTLOOK_ENABLED = all([
    os.environ.get('MICROSOFT_CLIENT_ID'),
    os.environ.get('MICROSOFT_CLIENT_SECRET'),
    os.environ.get('MICROSOFT_TENANT_ID'),
])

app = FastAPI(title="Studyflash Support Hub", version="1.0.0")
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ─── Pydantic Models ────────────────────────────────────────────
class TeamMemberCreate(BaseModel):
    name: str
    email: str
    password: str
    role: str = "agent"

class TeamMemberLogin(BaseModel):
    email: str
    password: str

class TeamMemberOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    avatar_color: str
    created_at: str

class TicketCreate(BaseModel):
    subject: str
    body: str
    sender_email: str
    sender_name: str
    language: str = "en"
    tags: List[str] = []

class TicketUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    category: Optional[str] = None
    tags: Optional[List[str]] = None

class MessageCreate(BaseModel):
    body: str
    sender_type: str = "agent"
    source: str = "platform"

class AIRequest(BaseModel):
    text: str
    ticket_id: Optional[str] = None

# ─── Auth helpers ────────────────────────────────────────────────

def strip_html(text: str) -> str:
    """Strip HTML tags and decode entities from email body."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', ' ', text)
    # Replace common HTML entities
    clean = clean.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&nbsp;', ' ').replace('<br>', '\n')
    # Collapse whitespace
    clean = re.sub(r'\s+', ' ', clean).strip()
    return clean


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str, email: str, role: str) -> str:
    return jwt.encode({'user_id': user_id, 'email': email, 'role': role, 'exp': datetime.now(timezone.utc).timestamp() + 86400 * 7}, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.team_members.find_one({"id": payload['user_id']}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# ─── Auth Routes ─────────────────────────────────────────────────
@api_router.post("/auth/register")
async def register(data: TeamMemberCreate):
    existing = await db.team_members.find_one({"email": data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    colors = ["#06b6d4", "#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#ec4899", "#3b82f6", "#f97316"]
    count = await db.team_members.count_documents({})
    member = {
        "id": str(uuid.uuid4()),
        "name": data.name,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "role": data.role,
        "avatar_color": colors[count % len(colors)],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.team_members.insert_one(member)
    token = create_token(member['id'], member['email'], member['role'])
    return {"token": token, "user": {k: v for k, v in member.items() if k not in ['password_hash', '_id']}}

@api_router.post("/auth/login")
async def login(data: TeamMemberLogin):
    user = await db.team_members.find_one({"email": data.email}, {"_id": 0})
    if not user or not verify_password(data.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = create_token(user['id'], user['email'], user['role'])
    return {"token": token, "user": {k: v for k, v in user.items() if k != 'password_hash'}}

@api_router.get("/auth/me")
async def get_me(authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    return {k: v for k, v in user.items() if k != 'password_hash'}

# ─── Team Routes ─────────────────────────────────────────────────
@api_router.get("/team")
async def get_team(authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    members = await db.team_members.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return members

@api_router.delete("/team/{member_id}")
async def remove_member(member_id: str, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    if user.get('role') != 'admin':
        raise HTTPException(status_code=403, detail="Only admins can remove members")
    await db.team_members.delete_one({"id": member_id})
    return {"status": "deleted"}

# ─── Ticket Routes ───────────────────────────────────────────────
@api_router.post("/tickets")
async def create_ticket(data: TicketCreate, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    ticket = {
        "id": str(uuid.uuid4()),
        "ticket_number": f"SF-{await db.tickets.count_documents({}) + 3500}",
        "subject": data.subject,
        "body": strip_html(data.body),
        "sender_email": data.sender_email,
        "sender_name": data.sender_name,
        "status": "open",
        "priority": "medium",
        "category": "uncategorized",
        "assigned_to": None,
        "language": data.language,
        "tags": data.tags,
        "ai_summary": None,
        "ai_category": None,
        "ai_sentiment": None,
        "outlook_thread_id": f"OTL-{uuid.uuid4().hex[:8].upper()}",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tickets.insert_one(ticket)
    # Create initial message
    msg = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket['id'],
        "sender_type": "customer",
        "sender_name": data.sender_name,
        "sender_email": data.sender_email,
        "body": strip_html(data.body),
        "translated_body": None,
        "source": "email",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(msg)
    return {k: v for k, v in ticket.items() if k != '_id'}

@api_router.get("/tickets")
async def list_tickets(
    authorization: Optional[str] = Header(None),
    status: Optional[str] = None,
    category: Optional[str] = None,
    assigned_to: Optional[str] = None,
    priority: Optional[str] = None,
    search: Optional[str] = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    limit: int = 50
):
    await get_current_user(authorization)
    query = {}
    if status and status != "all":
        query["status"] = status
    if category and category != "all":
        query["category"] = category
    if assigned_to and assigned_to != "all":
        query["assigned_to"] = assigned_to
    if priority and priority != "all":
        query["priority"] = priority
    if search:
        query["$or"] = [
            {"subject": {"$regex": search, "$options": "i"}},
            {"body": {"$regex": search, "$options": "i"}},
            {"sender_name": {"$regex": search, "$options": "i"}},
            {"sender_email": {"$regex": search, "$options": "i"}},
            {"ticket_number": {"$regex": search, "$options": "i"}}
        ]
    sort_dir = -1 if sort_order == "desc" else 1
    total = await db.tickets.count_documents(query)
    skip = (page - 1) * limit
    tickets = await db.tickets.find(query, {"_id": 0}).sort(sort_by, sort_dir).skip(skip).limit(limit).to_list(limit)
    return {"tickets": tickets, "total": total, "page": page, "pages": (total + limit - 1) // limit}

@api_router.get("/tickets/stats")
async def ticket_stats(authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    total = await db.tickets.count_documents({})
    open_count = await db.tickets.count_documents({"status": "open"})
    in_progress = await db.tickets.count_documents({"status": "in_progress"})
    resolved = await db.tickets.count_documents({"status": "resolved"})
    closed = await db.tickets.count_documents({"status": "closed"})
    unassigned = await db.tickets.count_documents({"assigned_to": None})
    
    # Category breakdown
    categories = {}
    for cat in ["refund-request", "subscription-cancellation", "account-issues", "subscription-info", "technical-issue", "feature-request", "garbage", "uncategorized"]:
        categories[cat] = await db.tickets.count_documents({"category": cat})
    
    # Priority breakdown
    priorities = {}
    for p in ["urgent", "high", "medium", "low"]:
        priorities[p] = await db.tickets.count_documents({"priority": p})
    
    # Language breakdown
    langs = {}
    for lang in ["de", "nl", "en", "fr"]:
        c = await db.tickets.count_documents({"language": lang})
        if c > 0:
            langs[lang] = c
    
    # Team workload
    members = await db.team_members.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    workload = []
    for m in members:
        assigned = await db.tickets.count_documents({"assigned_to": m['id'], "status": {"$nin": ["closed", "resolved"]}})
        workload.append({"name": m['name'], "id": m['id'], "count": assigned, "avatar_color": m['avatar_color']})
    
    return {
        "total": total, "open": open_count, "in_progress": in_progress,
        "resolved": resolved, "closed": closed, "unassigned": unassigned,
        "categories": categories, "priorities": priorities, "languages": langs,
        "workload": workload
    }

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    # Get assigned member info
    if ticket.get('assigned_to'):
        member = await db.team_members.find_one({"id": ticket['assigned_to']}, {"_id": 0, "password_hash": 0})
        ticket['assigned_member'] = member
    return ticket

@api_router.patch("/tickets/{ticket_id}")
async def update_ticket(ticket_id: str, data: TicketUpdate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    update = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if data.status is not None:
        update["status"] = data.status
    if data.priority is not None:
        update["priority"] = data.priority
    if data.assigned_to is not None:
        update["assigned_to"] = data.assigned_to if data.assigned_to != "" else None
    if data.category is not None:
        update["category"] = data.category
    if data.tags is not None:
        update["tags"] = data.tags
    await db.tickets.update_one({"id": ticket_id}, {"$set": update})
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    return ticket

# ─── Message Routes ──────────────────────────────────────────────
@api_router.get("/tickets/{ticket_id}/messages")
async def get_messages(ticket_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    messages = await db.messages.find({"ticket_id": ticket_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return messages

@api_router.post("/tickets/{ticket_id}/messages")
async def send_message(ticket_id: str, data: MessageCreate, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    msg = {
        "id": str(uuid.uuid4()),
        "ticket_id": ticket_id,
        "sender_type": data.sender_type,
        "sender_name": user['name'],
        "sender_email": user['email'],
        "body": strip_html(data.body),
        "translated_body": None,
        "source": data.source,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(msg)
    # Update ticket status if agent replies
    if data.sender_type == "agent":
        await db.tickets.update_one({"id": ticket_id}, {"$set": {"status": "in_progress", "updated_at": datetime.now(timezone.utc).isoformat()}})
    # Outlook sync: send reply to email thread if configured
    outlook_synced = False
    if data.sender_type == "agent" and data.source == "platform" and OUTLOOK_ENABLED:
        ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
        if ticket and ticket.get("outlook_thread_id"):
            try:
                await outlook_client.send_reply(
                    conversation_id=ticket["outlook_thread_id"],
                    reply_body=data.body,
                    to_email=ticket["sender_email"],
                )
                outlook_synced = True
            except Exception as e:
                logger.error(f"Outlook sync failed (non-blocking): {e}")
    msg['outlook_synced'] = outlook_synced or not OUTLOOK_ENABLED  # True in mock mode
    return {k: v for k, v in msg.items() if k != '_id'}

# ─── AI Routes ───────────────────────────────────────────────────
async def ai_complete(system_message: str, user_message: str) -> str:
    """Send a chat completion via the OpenAI SDK. Returns 503 if no key configured."""
    if not openai_client:
        raise HTTPException(
            status_code=503,
            detail="AI not configured. Set OPENAI_API_KEY in backend/.env (see README).",
        )
    response = await openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": system_message},
            {"role": "user", "content": user_message},
        ],
        temperature=0.3,
    )
    return response.choices[0].message.content

@api_router.get("/ai/status")
async def ai_status():
    """Check whether AI features are available."""
    return {
        "enabled": openai_client is not None,
        "model": OPENAI_MODEL if openai_client else None,
        "outlook_enabled": OUTLOOK_ENABLED,
    }

@api_router.post("/ai/categorize")
async def ai_categorize(data: AIRequest, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    try:
        response_text = await ai_complete(
            "You are a support ticket classifier for Studyflash, an educational flashcard platform. "
            "Classify the ticket into exactly ONE category from: refund-request, subscription-cancellation, "
            "account-issues, subscription-info, technical-issue, feature-request, garbage. "
            "Also determine: priority (urgent/high/medium/low), sentiment (positive/neutral/negative/frustrated), "
            "and detected language code (de/nl/en/fr/etc). "
            "Respond ONLY in valid JSON: {\"category\":\"...\",\"priority\":\"...\",\"sentiment\":\"...\",\"language\":\"...\",\"summary\":\"brief English summary in 1-2 sentences\"}",
            f"Classify this support ticket:\n\n{data.text}",
        )
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(response_text)

        if data.ticket_id:
            await db.tickets.update_one({"id": data.ticket_id}, {"$set": {
                "category": result.get("category", "uncategorized"),
                "ai_category": result.get("category"),
                "priority": result.get("priority", "medium"),
                "ai_sentiment": result.get("sentiment"),
                "ai_summary": result.get("summary"),
                "language": result.get("language", "en"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }})
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI categorize error: {e}")
        raise HTTPException(status_code=500, detail=f"AI categorization failed: {str(e)}")

@api_router.post("/ai/draft")
async def ai_draft_response(data: AIRequest, authorization: Optional[str] = Header(None)):
    user = await get_current_user(authorization)
    try:
        response_text = await ai_complete(
            "You are a support agent for Studyflash, an educational flashcard/study platform. "
            "Draft a professional, helpful response to the customer's support ticket. "
            "Be empathetic but concise. If the ticket is in a language other than English, "
            "respond in the SAME language as the customer. Sign off as the Studyflash Support Team. "
            "Do not use markdown formatting.",
            f"Draft a response to this support message. The agent's name is {user['name']}:\n\n{data.text}",
        )
        return {"draft": response_text.strip()}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI draft error: {e}")
        raise HTTPException(status_code=500, detail=f"AI draft failed: {str(e)}")

@api_router.post("/ai/translate")
async def ai_translate(data: AIRequest, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    try:
        response_text = await ai_complete(
            "You are a translator. Translate the given text to English. "
            "If the text is already in English, return it as-is. "
            "Preserve the original meaning and tone. Only return the translation, nothing else.",
            f"Translate to English:\n\n{data.text}",
        )
        return {"translation": response_text.strip(), "original": data.text}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI translate error: {e}")
        raise HTTPException(status_code=500, detail=f"Translation failed: {str(e)}")

@api_router.post("/ai/auto-assign")
async def ai_auto_assign(data: AIRequest, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    try:
        members = await db.team_members.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
        if not members:
            return {"assigned_to": None, "reason": "No team members available"}

        member_info = "\n".join([f"- {m['name']} (ID: {m['id']}, Role: {m['role']})" for m in members])

        response_text = await ai_complete(
            f"You are a ticket routing system for Studyflash support. "
            f"Based on the ticket content, assign it to the most appropriate team member. "
            f"Available team members:\n{member_info}\n\n"
            f"Respond ONLY in valid JSON: {{\"assigned_to\":\"member_id\",\"reason\":\"brief reason\"}}",
            f"Assign this ticket:\n\n{data.text}",
        )
        response_text = response_text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(response_text)

        if data.ticket_id and result.get("assigned_to"):
            await db.tickets.update_one({"id": data.ticket_id}, {"$set": {
                "assigned_to": result['assigned_to'],
                "updated_at": datetime.now(timezone.utc).isoformat()
            }})
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI auto-assign error: {e}")
        raise HTTPException(status_code=500, detail=f"Auto-assign failed: {str(e)}")

# ─── Mock Enrichment Routes ─────────────────────────────────────
@api_router.get("/enrichment/{ticket_id}")
async def get_enrichment(ticket_id: str, authorization: Optional[str] = Header(None)):
    await get_current_user(authorization)
    ticket = await db.tickets.find_one({"id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    import hashlib
    seed = hashlib.md5(ticket.get('sender_email', ticket_id).encode()).hexdigest()
    seed_int = int(seed[:8], 16)
    
    # Mock Sentry data
    sentry_data = {
        "recent_errors": [
            {"title": "TypeError: Cannot read property 'flashcards' of undefined", "count": 3, "last_seen": "2025-01-18T14:30:00Z", "level": "error"},
            {"title": "NetworkError: Failed to fetch /api/study-session", "count": 1, "last_seen": "2025-01-17T09:15:00Z", "level": "warning"},
        ] if seed_int % 3 != 0 else [],
        "error_rate": round((seed_int % 50) / 10, 1),
        "sessions_with_errors": seed_int % 12
    }
    
    # Mock PostHog data
    posthog_data = {
        "total_sessions": 15 + (seed_int % 85),
        "avg_session_duration": f"{1 + (seed_int % 8)}m {seed_int % 60}s",
        "last_active": "2025-01-19T16:45:00Z",
        "feature_flags": ["beta-podcasts", "new-editor"] if seed_int % 2 == 0 else ["new-editor"],
        "recordings": [
            {"id": f"rec_{seed[:6]}_1", "duration": "4m 23s", "date": "2025-01-19", "url": "#"},
            {"id": f"rec_{seed[:6]}_2", "duration": "2m 11s", "date": "2025-01-18", "url": "#"},
        ],
        "key_events": [
            {"event": "subscription_page_viewed", "count": 3},
            {"event": "cancel_button_clicked", "count": seed_int % 3},
            {"event": "flashcard_created", "count": 12 + seed_int % 50},
        ]
    }
    
    # Mock User DB data
    plans = ["free", "monthly", "annual"]
    user_data = {
        "user_id": f"usr_{seed[:8]}",
        "email": ticket.get('sender_email', 'unknown@email.com'),
        "name": ticket.get('sender_name', 'Unknown'),
        "plan": plans[seed_int % 3],
        "plan_status": "active" if seed_int % 4 != 0 else "cancelled",
        "signup_date": "2024-06-15",
        "last_login": "2025-01-19T10:30:00Z",
        "total_flashcards": 45 + (seed_int % 500),
        "total_study_sessions": 12 + (seed_int % 100),
        "payment_method": "Klarna" if seed_int % 3 == 0 else "Credit Card" if seed_int % 3 == 1 else "PayPal",
        "total_paid": f"{(seed_int % 10) * 30 + 30} CHF",
        "country": "DE" if seed_int % 3 == 0 else "NL" if seed_int % 3 == 1 else "CH"
    }
    
    return {"sentry": sentry_data, "posthog": posthog_data, "user": user_data}

# ─── Seed Data ───────────────────────────────────────────────────
@api_router.post("/seed")
async def seed_data(authorization: Optional[str] = Header(None)):
    # Check if already seeded
    count = await db.tickets.count_documents({})
    if count > 0:
        return {"message": "Data already seeded", "tickets": count}
    
    # Seed default admin
    admin_exists = await db.team_members.find_one({"email": "admin@studyflash.com"})
    if not admin_exists:
        admin = {
            "id": str(uuid.uuid4()),
            "name": "Admin",
            "email": "admin@studyflash.com",
            "password_hash": hash_password("admin123"),
            "role": "admin",
            "avatar_color": "#06b6d4",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.team_members.insert_one(admin)
    
    # Seed team members
    team = [
        {"name": "Sarah Mueller", "email": "sarah@studyflash.com", "role": "agent", "color": "#f59e0b"},
        {"name": "Tom van Berg", "email": "tom@studyflash.com", "role": "agent", "color": "#10b981"},
        {"name": "Lisa Schmidt", "email": "lisa@studyflash.com", "role": "lead", "color": "#8b5cf6"},
        {"name": "Max Weber", "email": "max@studyflash.com", "role": "agent", "color": "#ef4444"},
    ]
    member_ids = []
    for t in team:
        existing = await db.team_members.find_one({"email": t['email']})
        if not existing:
            m = {
                "id": str(uuid.uuid4()),
                "name": t['name'],
                "email": t['email'],
                "password_hash": hash_password("agent123"),
                "role": t['role'],
                "avatar_color": t['color'],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.team_members.insert_one(m)
            member_ids.append(m['id'])
        else:
            member_ids.append(existing.get('id', ''))
    
    
    
    statuses = ["open", "open", "open", "in_progress", "open", "in_progress", "open", "open", "open", "resolved", "closed", "open"]
    
   

# ─── Outlook / Microsoft Graph Integration ───────────────────────
# This code is LIVE when MICROSOFT_CLIENT_ID/SECRET/TENANT_ID are set in .env.
# When those vars are absent, Outlook features are disabled (mock mode).

class OutlookClient:
    """Microsoft Graph API client for Outlook shared mailbox integration."""
    GRAPH_URL = "https://graph.microsoft.com/v1.0"

    def __init__(self):
        self.client_id = os.environ.get('MICROSOFT_CLIENT_ID', '')
        self.client_secret = os.environ.get('MICROSOFT_CLIENT_SECRET', '')
        self.tenant_id = os.environ.get('MICROSOFT_TENANT_ID', '')
        self.mailbox = os.environ.get('OUTLOOK_SHARED_MAILBOX', 'sakshichaudhari2000@outlook.com')
        self._token = None
        self._token_expires = 0

    async def _get_token(self) -> str:
        """Acquire token via delegated OAuth2 flow."""
        import httpx, time
        if self._token and time.time() < self._token_expires - 60:
            return self._token
        if hasattr(self, "_refresh_token") and self._refresh_token:
            async with httpx.AsyncClient() as http:
                resp = await http.post(
                    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "refresh_token": self._refresh_token,
                        "grant_type": "refresh_token",
                        "scope": "Mail.Read Mail.ReadWrite Mail.Send offline_access",
                    }
                )
                data = resp.json()
            if "access_token" in data:
                self._token = data["access_token"]
                self._token_expires = time.time() + data.get("expires_in", 3600)
                self._refresh_token = data.get("refresh_token", self._refresh_token)
                return self._token
        raise Exception("Outlook not authenticated. Please visit /api/outlook/login first.")

    def _headers(self, token: str) -> dict:
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def fetch_new_emails(self, since: str = None) -> list:
        """Fetch unread emails from the shared mailbox."""
        import httpx
        token = await self._get_token()
        filt = "isRead eq false"
        if since:
            filt += f" and receivedDateTime ge {since}"
        url = (
            f"{self.GRAPH_URL}/me/messages"
            f"?$filter={filt}&$orderby=receivedDateTime desc&$top=50"
            f"&$select=id,subject,body,from,receivedDateTime,conversationId,isRead"
        )
        async with httpx.AsyncClient() as http:
            resp = await http.get(url, headers=self._headers(token))
            resp.raise_for_status()
            return resp.json().get("value", [])

    async def mark_as_read(self, message_id: str):
        import httpx
        token = await self._get_token()
        url = f"{self.GRAPH_URL}/me/messages/{message_id}"
        async with httpx.AsyncClient() as http:
            await http.patch(url, headers=self._headers(token), json={"isRead": True})

    async def send_reply(self, conversation_id: str, reply_body: str, to_email: str):
        """Reply within an existing Outlook conversation thread."""
        import httpx
        token = await self._get_token()
        # Escape single quotes in conversationId for OData filter
        safe_conv_id = conversation_id.replace("'", "''")
        url = (
            f"{self.GRAPH_URL}/me/messages"
            f"?$filter=conversationId eq '{safe_conv_id}'"
            f"&$top=10&$select=id,receivedDateTime,conversationId"
        )
        async with httpx.AsyncClient() as http:
            resp = await http.get(url, headers=self._headers(token))
            resp.raise_for_status()
            messages = resp.json().get("value", [])
            if not messages:
                raise Exception(f"No messages found for conversation {conversation_id}")
            original_id = messages[0]["id"]
            reply_url = f"{self.GRAPH_URL}/me/messages/{original_id}/reply"
            await http.post(reply_url, headers=self._headers(token), json={
                "message": {"toRecipients": [{"emailAddress": {"address": to_email}}]},
                "comment": reply_body,
            })

    async def create_subscription(self, webhook_url: str) -> dict:
        """Subscribe to new-email notifications via Graph webhooks."""
        import httpx
        from datetime import timedelta
        token = await self._get_token()
        expiry = (datetime.now(timezone.utc) + timedelta(days=2)).isoformat() + "Z"
        async with httpx.AsyncClient() as http:
            resp = await http.post(
                f"{self.GRAPH_URL}/subscriptions",
                headers=self._headers(token),
                json={
                    "changeType": "created",
                    "notificationUrl": webhook_url,
                    "resource": "me/messages",
                    "expirationDateTime": expiry,
                    "clientState": "studyflash-support-hub",
                },
            )
            resp.raise_for_status()
            return resp.json()

# Instantiate (safe even when creds are missing — methods will fail on _get_token)
outlook_client = OutlookClient()

async def process_incoming_email(message_id: str):
    """Convert an incoming email into a ticket (new) or a message (reply)."""
    import httpx
    token = await outlook_client._get_token()
    url = f"{OutlookClient.GRAPH_URL}/me/messages/{message_id}"
    async with httpx.AsyncClient() as http:
        resp = await http.get(url, headers=outlook_client._headers(token))
        resp.raise_for_status()
        email = resp.json()

    conversation_id = email.get("conversationId")
    sender_email = email.get("from", {}).get("emailAddress", {}).get("address", "unknown")
    sender_name = email.get("from", {}).get("emailAddress", {}).get("name", "Unknown")
    body_content = email.get("body", {}).get("content", "")

    # Check if this conversation already has a ticket
    existing = await db.tickets.find_one({"outlook_thread_id": conversation_id}, {"_id": 0})

    if existing:
        # Reply to existing ticket
        msg = {
            "id": str(uuid.uuid4()),
            "ticket_id": existing["id"],
            "sender_type": "customer",
            "sender_name": sender_name,
            "sender_email": sender_email,
            "body": body_content,
            "translated_body": None,
            "source": "email",
            "created_at": email.get("receivedDateTime", datetime.now(timezone.utc).isoformat()),
        }
        await db.messages.insert_one(msg)
        if existing["status"] in ("resolved", "closed"):
            await db.tickets.update_one(
                {"id": existing["id"]},
                {"$set": {"status": "open", "updated_at": datetime.now(timezone.utc).isoformat()}},
            )
    else:
        # New ticket
        ticket = {
            "id": str(uuid.uuid4()),
            "ticket_number": f"SF-{await db.tickets.count_documents({}) + 3500}",
            "subject": email.get("subject", "No subject"),
            "body": body_content,
            "sender_email": sender_email,
            "sender_name": sender_name,
            "status": "open",
            "priority": "medium",
            "category": "uncategorized",
            "assigned_to": None,
            "language": "en",
            "tags": [],
            "ai_summary": None,
            "ai_category": None,
            "ai_sentiment": None,
            "outlook_thread_id": conversation_id,
            "created_at": email.get("receivedDateTime", datetime.now(timezone.utc).isoformat()),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.tickets.insert_one(ticket)
        msg = {
            "id": str(uuid.uuid4()),
            "ticket_id": ticket["id"],
            "sender_type": "customer",
            "sender_name": sender_name,
            "sender_email": sender_email,
            "body": body_content,
            "translated_body": None,
            "source": "email",
            "created_at": ticket["created_at"],
        }
        await db.messages.insert_one(msg)

    await outlook_client.mark_as_read(message_id)

@api_router.post("/outlook/webhook")
async def outlook_webhook(request: Request):
    """Handle Microsoft Graph change notifications (webhooks)."""
    # Subscription validation handshake
    validation = request.query_params.get("validationToken")
    if validation:
        return PlainTextResponse(validation)

    body = await request.json()
    for notification in body.get("value", []):
        if notification.get("clientState") != "studyflash-support-hub":
            continue
        resource_data = notification.get("resourceData", {})
        message_id = resource_data.get("id")
        if message_id:
            try:
                await process_incoming_email(message_id)
            except Exception as e:
                logger.error(f"Webhook email processing failed: {e}")
    return {"status": "ok"}

@api_router.get("/outlook/callback")
async def outlook_callback(code: str):
    import httpx, time
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            data={
                "client_id": outlook_client.client_id,
                "client_secret": outlook_client.client_secret,
                "code": code,
                "redirect_uri": "http://localhost:8001/api/outlook/callback",
                "grant_type": "authorization_code",
            }
        )
        data = resp.json()
    if "access_token" in data:
        import time
        outlook_client._token = data["access_token"]
        outlook_client._token_expires = time.time() + data.get("expires_in", 3600)
        outlook_client._refresh_token = data.get("refresh_token", "")
        # Persist refresh token to MongoDB so it survives restarts
        await db.settings.update_one(
            {"key": "outlook_refresh_token"},
            {"$set": {"key": "outlook_refresh_token", "value": outlook_client._refresh_token}},
            upsert=True
        )
        return {"message": "Outlook connected successfully!"}
    return {"error": data.get("error_description", "Unknown error")}

@api_router.post("/outlook/sync")
async def outlook_manual_sync(authorization: Optional[str] = Header(None)):
    """Manually trigger a sync of new emails from Outlook."""
    await get_current_user(authorization)
    if not OUTLOOK_ENABLED:
        raise HTTPException(status_code=400, detail="Outlook not configured. Set MICROSOFT_CLIENT_ID/SECRET/TENANT_ID in .env.")
    try:
        emails = await outlook_client.fetch_new_emails()
        processed = 0
        for email in emails:
            await process_incoming_email(email["id"])
            processed += 1
        return {"processed": processed, "total_fetched": len(emails)}
    except Exception as e:
        logger.error(f"Manual Outlook sync error: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

@api_router.post("/outlook/subscribe")
async def outlook_subscribe(authorization: Optional[str] = Header(None)):
    """Create a Graph API webhook subscription for real-time email notifications."""
    user = await get_current_user(authorization)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can manage subscriptions")
    if not OUTLOOK_ENABLED:
        raise HTTPException(status_code=400, detail="Outlook not configured.")
    webhook_url = os.environ.get("OUTLOOK_WEBHOOK_URL", "")
    if not webhook_url:
        raise HTTPException(status_code=400, detail="Set OUTLOOK_WEBHOOK_URL in .env (public HTTPS URL).")
    try:
        result = await outlook_client.create_subscription(webhook_url)
        return {"subscription_id": result.get("id"), "expiration": result.get("expirationDateTime")}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Subscription failed: {str(e)}")

# ─── Health check ────────────────────────────────────────────────
@api_router.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "ai_enabled": openai_client is not None,
        "outlook_enabled": OUTLOOK_ENABLED,
    }

app.include_router(api_router)

@app.on_event("startup")
async def start_background_sync():
    """Load persisted token and auto sync emails from Outlook every 60 seconds."""
    import asyncio, time
    # Load refresh token from MongoDB if it exists
    try:
        stored = await db.settings.find_one({"key": "outlook_refresh_token"})
        if stored and stored.get("value"):
            outlook_client._refresh_token = stored["value"]
            logger.info("✅ Outlook refresh token loaded from DB")
    except Exception as e:
        logger.error(f"Could not load Outlook token from DB: {e}")

    async def sync_loop():
        while True:
            try:
                if OUTLOOK_ENABLED and outlook_client._token:
                    emails = await outlook_client.fetch_new_emails()
                    for email in emails:
                        await process_incoming_email(email["id"])
                    if emails:
                        logger.info(f"Auto sync: processed {len(emails)} new email(s)")
            except Exception as e:
                logger.error(f"Auto sync error: {e}")
            await asyncio.sleep(60)  # runs every 60 seconds
    asyncio.create_task(sync_loop())


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
