# Career OS Hub

**Your all-in-one career command center** — unifies every automation system Sadnan Sajid has built into one self-learning dashboard, web app, and Android app.

## What it does
- **Unified dashboard** (web + Android) showing all systems in one place: robowatch, EEE_Academic_OS, robot-oda-dashboard, career-intelligence-agent-os, news-pulse.
- **Default intelligence "Pulse"** — a Gemini 2.5 Flash agent that knows your full profile, your career plan, your deadlines, and what it has learned about you. Upload a career plan/path file and it decomposes it into phases, milestones, deadlines and tasks.
- **Self-learning** — every task completion, rating and correction is stored and distilled into "learned facts" injected into every AI answer.
- **Deadlines, tasks, reminders** — unified schedule with reminders that fire on your Android phone **even offline**.
- **Class routine (timetable)** — weekly schedule in dashboard + app; every class gets an **offline reminder 15 minutes before** it starts. Class tests & deadlines get a reminder **24 hours before**.
- **Google Classroom connector** — syncs courses, assignments (with due dates → deadlines + 24h reminders) and announcements into the hub via OAuth.
- **Connectors** — reads career-io (webhook), robot-oda-dashboard (Firebase RTDB), Google Classroom (OAuth), robowatch / EEE / news-pulse (fetched by GitHub Actions scheduler).
- **100% free infrastructure**: Firebase (Firestore + Auth) + Vercel (API + web) + GitHub Actions (scheduler) + FCM (push).

## Architecture
```
GitHub Actions (scheduler) ──► Vercel API (/api/*) ──► Firestore (career-os-hub)
      │  fetch external systems          │  Gemini 2.5 Flash (agent)
      └───────────────┘                  ├── connectors (career-io webhook, robot-oda RTDB, Classroom OAuth)
Web dashboard (Vercel static) ◄──────────┘
Android app (WebView + FCM + offline alarms) ◄── polling + FCM
```

## Deploy
1. `vercel --prod` (API + web).
2. Set Vercel env `FIREBASE_SERVICE_ACCOUNT` (Firebase service account JSON) and `GEMINI_API_KEY`.
3. `POST /api/init` once → generates the hub token + seeds the roadmap.
4. Set GitHub secrets: `HUB_TOKEN` (hub token), `FIREBASE_TOKEN` (optional). The scheduler workflow runs every 30 min.

## Key endpoints
`POST /api/init` · `GET /api/overview` · `GET/POST /api/tasks` · `GET/POST /api/deadlines` · `POST /api/plan/ingest` · `POST /api/chat` · `POST /api/feedback` · `GET /api/learning` · `POST /api/device` · `GET/POST /api/reminders` · `GET/POST/PATCH/DELETE /api/schedule` · `GET /api/classroom/status` · `GET /api/classroom/auth` · `GET /api/classroom/oauth_callback` · `POST /api/classroom/sync` · `POST /api/classroom/disconnect` · `POST /api/cron/{15min,daily,weekly,monthly}`

## Google Classroom setup (one time)
1. In Google Cloud Console (project `career-os-hub`) enable the **Classroom API**, then create an **OAuth client ID** of type **Web application**.
2. Add redirect URI: `https://career-os-hub.vercel.app/api/classroom/oauth_callback`.
3. In the dashboard **Settings → Google Classroom**, paste the **Client ID** and **Client secret**, then press **Connect Classroom** and sign in with the UAP account (`23208149@uap-bd.edu`).
4. Press **Sync now** (or wait for the scheduler) — courses, assignments & announcements flow in as deadlines + 24h reminders.

## Class reminders
- **Weekly classes** (Classes tab): a reminder fires **15 min before** each class, on your Android phone **even offline** (generated for the next 7 days every cron tick).
- **Class tests / deadlines**: a reminder fires **24 h before** the due time.
