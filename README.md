# Studyflash Support Hub

An internal support platform that ingests incoming support emails, structures them into actionable tickets, enriches them with internal context, and assists the team with triage and responses using AI.

Built as an intelligent layer on top of Outlook: not replacing it, but augmenting it with categorization, translation, draft generation, and contextual enrichment.

---

## Diagrams

See the [Excalidraw diagrams](docs) for visual architecture and flow documentation:

- **System Architecture** — high-level overview of all components and integrations
- **Ticket Lifecycle** — end-to-end flow from email arrival to agent response
- **AI Pipeline** — how categorization, drafting, translation, and auto-assignment work
- **Data Flow** — sequence diagrams showing frontend ↔ backend ↔ database interactions


---

## Quick Start (Docker)

```bash
# 1. Clone
git clone https://github.com/your-org/studyflash-support-hub.git
cd studyflash-support-hub

# 2. Configure backend
cp backend/.env.example backend/.env
# Edit backend/.env — set MONGO_URL, JWT_SECRET, and optionally OPENAI_API_KEY

# 3. Run
docker compose up --build

# 4. Open http://localhost:3000
# Register an admin account or seed demo data via POST /api/seed
```

**To stop:** `docker compose down` | **Reset DB:** `docker compose down -v`

> **Secrets and Keys.** The app works without an OpenAI key — you just won't have categorization, drafting, translation, or auto-assignment. Set `OPENAI_API_KEY`, 'OUTLOOK_SHARED_MAILBOX', 'MICROSOFT_TENANT_ID', 'MICROSOFT_CLIENT_SECRET','MICROSOFT_CLIENT_ID' when ready.

---

## Manual Setup (without Docker)

### Prerequisites
- Python 3.11+
- Node.js 20+ and Yarn
- MongoDB 7+ (local or cloud)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — set MONGO_URL, OPENAI_API_KEY, etc.

uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend

```bash
cd frontend
yarn install

cp .env.example .env
# Ensure REACT_APP_BACKEND_URL=http://localhost:8001

yarn start
```

### Seed Demo Data

Open http://localhost:3000 and click **"Load Demo Data & Login"**, or:

```bash
curl -X POST http://localhost:8001/api/seed
# Login: admin@studyflash.com / admin123
```

---

## Architecture

```
                    +------------------+
                    |   Outlook/Email  |
                    |  (MS Graph API)  |
                    +--------+---------+
                             |
                    ingest / sync replies
                             |
+------------+      +--------v---------+      +-------------+
|            |      |                  |      |             |
|  React UI  +<---->+  FastAPI Backend +<---->+   MongoDB   |
|  (SPA)     |      |                  |      |             |
+------------+      +----+----+--------+      +-------------+
                         |    |
              +----------+    +----------+
              |                          |
     +--------v--------+    +-----------v-----------+
     |  OpenAI (any    |    |  Enrichment Sources   |
     |  model)         |    |  Sentry / PostHog /   |
     |  - Categorize   |    |  User DB (Postgres)   |
     |  - Draft        |    +-----------------------+
     |  - Translate    |
     |  - Auto-assign  |
     +------------------+
```

---

## Features

| Feature | Status | Notes |
|---------|--------|-------|
| Ticket viewing & filtering | Done | Search, filter by status/category/priority/assignee |
| Conversation threads | Done | Messages with source indicators (Email/Platform) |
| Ticket assignment | Done | Manual + AI auto-assignment |
| AI Categorization | Done | Category, priority, sentiment, language detection |
| AI Draft Responses | Done | Replies in the customer's language |
| AI Translation | Done | Any language to English |
| AI Auto-Assignment | Done | Routes to appropriate team member |
| Outlook integration | Code ready | Real MS Graph API code in `server.py` — needs Azure AD credentials |
| Enrichment: Sentry | Mock | Shows error data (connect real API via env vars) |
| Enrichment: PostHog | Mock | Shows session/recording data |
| Enrichment: User DB | Mock | Shows user plan/payment data |
| JWT Authentication | Done | Roles: admin, lead, agent |
| Dashboard analytics | Done | Charts, workload, language breakdown |

---

## Configuration

### `backend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB connection string |
| `DB_NAME` | Yes | Database name |
| `JWT_SECRET` | Yes | Secret for JWT signing (change in prod!) |
| `OPENAI_API_KEY` | No* | OpenAI API key. AI features disabled without it. |
| `OPENAI_MODEL` | No | Model name (default: `gpt-4o`) |
| `MICROSOFT_CLIENT_ID` | No* | Azure AD app client ID |
| `MICROSOFT_CLIENT_SECRET` | No* | Azure AD app client secret |
| `MICROSOFT_TENANT_ID` | No* | Azure AD tenant ID |
| `OUTLOOK_SHARED_MAILBOX` | No | Mailbox to monitor (default: support@studyflash.com) |
| `OUTLOOK_WEBHOOK_URL` | No | Public HTTPS URL for Graph webhooks |

*When omitted, the corresponding feature runs in mock/disabled mode.

### `frontend/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `REACT_APP_BACKEND_URL` | Yes | Backend URL (default: http://localhost:8001) |


---

## Connecting Outlook (Microsoft Graph API)

The Outlook integration code is **already in `server.py`** — it activates when you set the three Microsoft env vars. Steps to get the Microsoft ID's and values

Step 1 — Create a Microsoft Account

Step 2 — Sign Into Azure Portal

Step 3 — Go to Azure Active Directory > App Registrations

Step 4 — Create a New App Registration

--In the left sidebar, click "App registrations"
--Click "+ New registration" at the top
--Fill in the form:
---Name: StudyFlash Support (or any name you prefer)
---Supported account types: Select this option:
---Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts (e.g. Skype, Xbox)
--Click "Register"

Step 5 — Fix Token Version (Required for Personal Accounts)
--In the left sidebar, click "Manifest"
--Find this line in the JSON:
---before "requestedAccessTokenVersion": null,
---change to "requestedAccessTokenVersion": 2,
--Click "Save" at the top
--Go back to "Authentication" in the sidebar and change the supported account types to Multitenant + personal accounts

Step 6 — Copy Your CLIENT_ID and TENANT_ID

Step 7 — Add API Permissions
--In the left sidebar, click "API permissions"
--Click "+ Add a permission"
--Click "Microsoft Graph"
--Click "Delegated permissions" ← This is important. Do NOT select Application permissions
--In the search box, search and add each of these one by one:
Mail.Read
Mail.ReadWrite
Mail.Send
offline_access
--Click "Add permissions"

Step 8 — Add Redirect URI
--In the left sidebar, click "Authentication"
--Click "+ Add a platform"
--Click "Web"
--In the Redirect URI field, enter exactly:http://localhost:8001/api/outlook/callback
--Scroll down to "Advanced settings"
--Set "Allow public client flows" to Yes
--Click "Save"

Step 9 — Create a Client Secret
--In the left sidebar, click "Certificates & secrets"
--Click "+ New client secret"
--Fill in:
Description: MVP Secret
Expires: 24 months
--Click "Add"
--You will see the secret appear in the table Copy the VALUE column immediately. This is your MICROSOFT_CLIENT_SECRET which you need to add in /backend/.env

Step 10 — Your Final Credentials
--You should now have all three values:MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_TENANT_ID

Step 11 — Authenticate Outlook (One-Time Step)
--Create this file on your Desktop:
--nano ~/Desktop/generate_url.py
--Paste this (replace CLIENT_ID with your actual value):
import urllib.parse

CLIENT_ID = "paste-your-client-id-here"
TENANT_ID = "consumers"
REDIRECT_URI = "http://localhost:8001/api/outlook/callback"
SCOPES = "Mail.Read Mail.ReadWrite Mail.Send offline_access"

params = {
    "client_id": CLIENT_ID,
    "response_type": "code",
    "redirect_uri": REDIRECT_URI,
    "scope": SCOPES,
    "response_mode": "query"
}

url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"
print(url)
--Run it: python3 ~/Desktop/generate_url.py
--Copy the printed URL → paste in browser → log in with your Outlook account → accept permissions.
--You should see: {"message": "Outlook connected successfully!"}



### How It Works

- **Ingest**: `POST /api/outlook/sync` fetches unread emails and creates tickets
- **Webhook**: `POST /api/outlook/webhook` receives real-time notifications from Graph API
- **Reply sync**: When an agent sends a reply from the platform, it's posted to the Outlook thread via Graph API
- **Thread parity**: Replies from either side appear in both the platform and Outlook



---

## Connecting Enrichment Sources

The enrichment system uses mock data by default. To connect real sources, see [docs/enrichment-setup.md](docs/enrichment-setup.md).

The endpoint shape stays the same regardless of data source — the frontend needs no changes.

---

## AI Pipeline

Uses the standard [OpenAI Python SDK](https://github.com/openai/openai-python). Any OpenAI-compatible key works.

| Operation | What it does |
|-----------|-------------|
| **Categorize** | Detects category, priority, sentiment, language; generates English summary |
| **Draft** | Generates a reply **in the customer's language** |
| **Translate** | Translates any text to English |
| **Auto-Assign** | Routes ticket to the best team member |

Set `OPENAI_MODEL` in `.env` to use a different model (default: `gpt-4o`).

**Graceful degradation**: If `OPENAI_API_KEY` is not set, AI buttons return a clear "AI not configured" error. The rest of the app works normally.

---

## API Reference

All endpoints prefixed with `/api`. Auth via `Authorization: Bearer <token>` header.

<details>
<summary>Click to expand full API reference</summary>

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Get JWT token |
| GET | `/api/auth/me` | Current user info |

### Tickets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List (filterable: status, category, priority, assigned_to, search) |
| POST | `/api/tickets` | Create ticket |
| GET | `/api/tickets/{id}` | Get ticket detail |
| PATCH | `/api/tickets/{id}` | Update (status, priority, assignee, category) |
| GET | `/api/tickets/stats` | Dashboard statistics |

### Messages
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets/{id}/messages` | Conversation thread |
| POST | `/api/tickets/{id}/messages` | Send reply (syncs to Outlook if configured) |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ai/status` | Check AI + Outlook availability |
| POST | `/api/ai/categorize` | Categorize ticket |
| POST | `/api/ai/draft` | Generate draft response |
| POST | `/api/ai/translate` | Translate to English |
| POST | `/api/ai/auto-assign` | AI ticket routing |

### Outlook
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/outlook/webhook` | Graph API webhook receiver |
| POST | `/api/outlook/sync` | Manual email sync trigger |
| POST | `/api/outlook/subscribe` | Create webhook subscription (admin) |

### Other
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/team` | List team members |
| DELETE | `/api/team/{id}` | Remove member (admin) |
| GET | `/api/enrichment/{id}` | Enrichment data |
| POST | `/api/seed` | Seed demo data |
| GET | `/api/health` | Health check (shows AI/Outlook status) |

</details>

---

## Project Structure

```
studyflash-support-hub/
+-- docker-compose.yml
+-- README.md
+-- LICENSE
+-- docs/
|   +-- architecture.md
|   +-- outlook-integration.md
|   +-- enrichment-setup.md
|   +-- loom-script.md
+-- backend/
|   +-- Dockerfile
|   +-- server.py
|   +-- requirements.txt
|   +-- .env.example
+-- frontend/
|   +-- Dockerfile
|   +-- package.json
|   +-- .env.example
|   +-- src/
|       +-- App.js
|       +-- context/AuthContext.js
|       +-- pages/
|       |   +-- LoginPage.js
|       |   +-- DashboardPage.js
|       |   +-- TicketsPage.js
|       |   +-- TicketDetailPage.js
|       |   +-- TeamPage.js
|       +-- components/
|           +-- Sidebar.js
|           +-- ui/ (shadcn components)
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Single-file backend** | ~900 lines with clear sections. For 5-15 users, navigating one file is faster than navigating modules. Split at ~1500 lines. |
| **MongoDB** | Tickets are document-shaped (nested tags, variable metadata). Schema flexibility for rapid iteration. |
| **OpenAI SDK directly** | No wrappers — the standard `openai` package works everywhere. Set `OPENAI_MODEL` to switch models. |
| **Outlook code in server.py** | Behind an env-var feature flag. When creds are absent, the code is inert. No separate service needed at this scale. |
| **Mock enrichment** | Validates UX without requiring Sentry/PostHog credentials. Same API shape — swap mock for real with env vars only. |

### Decided Against
- **WebSocket**: Polling is fine for 5-15 people. Adds deployment complexity.
- **Microservices**: Single process is simpler to deploy and debug at this scale.
- **IMAP**: Graph API has native thread tracking, webhooks, and modern auth. IMAP requires manual threading.

---

## Roadmap

- [x] Ticket CRUD + conversations
- [x] AI categorization, drafting, translation, auto-assignment
- [x] Outlook integration code (needs Azure AD creds to activate)
- [x] Mock enrichment panels
- [ ] Connect real Sentry/PostHog/Postgres
- [ ] AI confidence scoring + progressive automation
- [ ] Canned response templates
- [ ] SLA tracking
- [ ] WebSocket real-time updates

---

## License

MIT
