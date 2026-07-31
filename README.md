# Career OS Hub

**Your all-in-one career command center** — unifies every automation system Sadnan Sajid has built into one self-learning dashboard, web app, and Android app.

## What it does
- **Unified dashboard** (web + Android) showing all systems in one place: robowatch, EEE_Academic_OS, robot-oda-dashboard, career-intelligence-agent-os, news-pulse.
- **Default intelligence "Pulse"** — a Gemini 2.5 Flash agent that knows your full profile, your career plan, your deadlines, and what it has learned about you. Upload a career plan/path file and it decomposes it into phases, milestones, deadlines and tasks.
- **Self-learning** — every task completion, rating and correction is stored and distilled into "learned facts" injected into every AI answer.
- **Deadlines, tasks, reminders** — unified schedule with reminders that fire on your Android phone **even offline**.
- **Connectors** — reads career-io (webhook), robot-oda-dashboard (Firebase RTDB), robowatch / EEE / news-pulse (fetched by GitHub Actions scheduler).
- **100% free infrastructure**: Firebase (Firestore + Auth) + Vercel (API + web) + GitHub Actions (scheduler) + FCM (push).

## Architecture
```
GitHub Actions (scheduler) ──► Vercel API (/api/*) ──► Firestore (career-os-hub)
      │  fetch external systems          │  Gemini 2.5 Flash (agent)
      └───────────────┘                  ├── connectors (career-io webhook, robot-oda RTDB)
Web dashboard (Vercel static) ◄──────────┘
Android app (WebView + FCM + offline alarms) ◄── polling + FCM
```

## Deploy
1. `vercel --prod` (API + web).
2. Set Vercel env `FIREBASE_SERVICE_ACCOUNT` (Firebase service account JSON) and `GEMINI_API_KEY`.
3. `POST /api/init` once → generates the hub token + seeds the roadmap.
4. Set GitHub secrets: `HUB_TOKEN` (hub token), `FIREBASE_TOKEN` (optional). The scheduler workflow runs every 30 min.

## Key endpoints
`POST /api/init` · `GET /api/overview` · `GET/POST /api/tasks` · `GET/POST /api/deadlines` · `POST /api/plan/ingest` · `POST /api/chat` · `POST /api/feedback` · `GET /api/learning` · `POST /api/device` · `GET/POST /api/reminders` · `POST /api/cron/{15min,daily,weekly,monthly}`
