# System Architecture

## High-Level Overview

```
+------------------------------------------------------------------+
|                        FRONTEND (React SPA)                       |
|                                                                    |
|  +------------+  +-------------+  +--------------+  +-----------+ |
|  |   Login    |  |  Dashboard  |  | Ticket List  |  |   Team    | |
|  |   Page     |  |   Page      |  |    Page      |  |   Page    | |
|  +------------+  +-------------+  +--------------+  +-----------+ |
|                                   |                                |
|                          +--------v--------+                       |
|                          | Ticket Detail   |                       |
|                          | +Conversation   |                       |
|                          | +AI Toolbar     |                       |
|                          | +Enrichment     |                       |
|                          +-----------------+                       |
+-----------------------------+--------------------------------------+
                              |
                         axios + JWT
                              |
+-----------------------------v--------------------------------------+
|                      BACKEND (FastAPI)                             |
|                                                                    |
|  +----------+  +----------+  +----------+  +-------------------+  |
|  | Auth     |  | Tickets  |  | Messages |  | Team Management   |  |
|  | Routes   |  | CRUD     |  | CRUD     |  | Routes            |  |
|  +----------+  +----------+  +----------+  +-------------------+  |
|                                                                    |
|  +---------------------+  +------------------------------------+  |
|  | AI Pipeline          |  | Enrichment Engine                  |  |
|  |                      |  |                                    |  |
|  | POST /ai/categorize  |  | GET /enrichment/{id}              |  |
|  | POST /ai/draft       |  |   -> Sentry data (mock/real)      |  |
|  | POST /ai/translate   |  |   -> PostHog data (mock/real)     |  |
|  | POST /ai/auto-assign |  |   -> User DB data (mock/real)     |  |
|  +----------+-----------+  +--+-------------+------------------+  |
|             |                  |             |                     |
+-------------|------------------|-------------|---------------------+
              |                  |             |
    +---------v------+  +-------v---+  +------v------+  +-----------+
    | OpenAI GPT-5.2 |  | Sentry    |  | PostHog     |  | Postgres  |
    | (or any LLM)   |  | API       |  | API         |  | (User DB) |
    +-----------------+  +-----------+  +-------------+  +-----------+
```

## Data Model

### tickets
```json
{
  "id": "uuid",
  "ticket_number": "SF-3528",
  "subject": "Jahresabo Kundigung",
  "body": "Full ticket text...",
  "sender_email": "user@example.com",
  "sender_name": "Anastasia S.",
  "status": "open | in_progress | resolved | closed",
  "priority": "urgent | high | medium | low",
  "category": "refund-request | subscription-cancellation | ...",
  "assigned_to": "team_member_id | null",
  "language": "de | nl | en | fr",
  "tags": ["ai-draft", "refund-request"],
  "ai_summary": "English summary from AI",
  "ai_category": "AI-detected category",
  "ai_sentiment": "frustrated | negative | neutral | positive",
  "outlook_thread_id": "OTL-A1B2C3D4",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
```

### messages
```json
{
  "id": "uuid",
  "ticket_id": "parent ticket uuid",
  "sender_type": "customer | agent | system",
  "sender_name": "Display name",
  "sender_email": "email",
  "body": "Message content",
  "translated_body": "English translation (if applicable)",
  "source": "email | platform",
  "created_at": "ISO timestamp"
}
```

### team_members
```json
{
  "id": "uuid",
  "name": "Sarah Mueller",
  "email": "sarah@studyflash.com",
  "password_hash": "bcrypt hash",
  "role": "admin | lead | agent",
  "avatar_color": "#f59e0b",
  "created_at": "ISO timestamp"
}
```

## Request Flow: Ticket Lifecycle

```
1. Email arrives in Outlook
        |
2. MS Graph webhook -> POST /api/tickets (creates ticket + first message)
        |
3. AI auto-categorize (async or on-demand)
        |
        +-> Category: refund-request
        +-> Priority: high
        +-> Sentiment: frustrated
        +-> Language: de
        +-> Summary: "Customer requesting refund for annual subscription..."
        |
4. AI auto-assign (optional)
        |
        +-> Assigned to: Sarah Mueller (handles refund requests)
        |
5. Agent opens ticket in UI
        |
        +-> Sees original message (German)
        +-> Sees AI summary (English)
        +-> Sees enrichment sidebar:
            - User DB: plan=annual, payment=Klarna, country=DE
            - Sentry: no recent errors
            - PostHog: visited cancel page 3x
        |
6. Agent clicks "Draft Reply"
        |
        +-> AI generates response in German (matching customer's language)
        +-> Agent reviews, edits, sends
        |
7. Reply synced to Outlook thread via MS Graph API
        |
8. Customer sees reply in their email client
```

## AI Pipeline Detail

```
                    +------------------+
                    |   Ticket Text    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v--------+
     | Categorize |  | Draft Reply |  | Translate   |
     +--------+---+  +------+------+  +----+--------+
              |              |              |
     category,        draft text     English text
     priority,        (in customer's
     sentiment,       language)
     language,
     summary
```

Each AI call is independent and stateless. No conversation history is maintained in the LLM - each call gets full context in the prompt. This is intentional:
- Simpler to reason about
- No token budget creep
- Each operation is idempotent
- Can switch models per operation if needed

## Security Model

```
+-------------------+
|    JWT Token      |
|  user_id, email,  |
|  role, exp        |
+--------+----------+
         |
    +----v----+
    | Roles:  |
    | admin   | -> full access + team management + delete
    | lead    | -> ticket management + assignment + AI
    | agent   | -> view assigned + respond + AI tools
    +---------+
```

All API routes require a valid JWT token in the Authorization header. Token expires after 7 days.
