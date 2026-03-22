# Studyflash Support Platform - PRD

## Original Problem Statement
Build a web platform where Studyflash team members can view, respond to, and manage support tickets with AI assistance, Outlook email sync simulation, and enrichment from internal tools.

## Architecture
- **Frontend**: React 19 + Tailwind + Shadcn UI (dark theme, teal accent)
- **Backend**: FastAPI + MongoDB (Motor async driver)
- **AI**: OpenAI GPT-5.2 via emergentintegrations library
- **Auth**: JWT-based (bcrypt password hashing)

## User Personas
- **Admin**: Full access, team management, all ticket operations
- **Lead**: Ticket management, assignment, AI tools
- **Agent**: View assigned tickets, respond, use AI tools

## Core Requirements (Static)
1. Ticket viewing and response
2. Ticket assignment to team members
3. Enrichment panels (Sentry, PostHog, User DB) - MOCKED
4. AI pipelines (categorize, draft, translate, auto-assign)
5. Simulated Outlook bidirectional email sync
6. Multilingual support (DE, NL, EN)
7. JWT authentication

## What's Been Implemented (2026-03-21)
- Full JWT auth (login, register, token management)
- Dashboard with metrics, charts (category, priority, pie), team workload, recent tickets, language breakdown
- Ticket list with search, filters (status/category/priority), sorting, pagination
- Ticket detail with conversation thread, AI toolbar, properties sidebar, enrichment tabs
- AI Categorization (GPT-5.2): classifies tickets by category, priority, sentiment, language
- AI Draft Response (GPT-5.2): generates context-aware replies in ticket language
- AI Translation (GPT-5.2): translates multilingual tickets to English
- AI Auto-Assignment (GPT-5.2): smart ticket routing to team members
- Mock enrichment panels: User DB data, Sentry errors, PostHog sessions/recordings/events
- Simulated Outlook sync with thread IDs and source indicators
- Team management (add/remove members, role-based access)
- 12 pre-seeded multilingual sample tickets
- Dark theme UI with DM Sans font

## Prioritized Backlog
### P0 (Critical)
- None remaining for MVP

### P1 (Important)
- Real Microsoft Graph API integration for Outlook
- Real Sentry/PostHog API integration
- Bulk ticket actions (assign, close, categorize multiple)
- Ticket SLA tracking and reminders

### P2 (Nice to Have)
- Real-time notifications (WebSocket)
- Canned response templates
- Ticket analytics/reporting dashboard
- Export tickets to CSV
- AI confidence scoring and progressive automation
- Keyboard shortcuts

## Next Tasks
1. Add bulk AI categorization for all uncategorized tickets
2. Implement canned response templates
3. Add ticket creation from the platform (not just email ingestion)
4. Real-time updates with WebSocket
5. Advanced filtering and saved views
