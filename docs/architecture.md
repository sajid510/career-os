# Career OS — Architecture

This document describes how the system works end-to-end: the data model, the request flows, the reminder engine, the AI agent and the self-learning loop.

---

## 1. System overview

Career OS is a **server-side application** with thin clients. All business logic and data access happen in the Vercel serverless Express app (`api/index.js`); Firestore is completely locked down and only the server talks to it.

```
                        ┌─────────────────────────────┐
   GitHub Actions       │        Vercel (Express)     │
   (scheduler) ────────►│                             │
                        │  /api/* routes (token auth) │────► Firestore (deny-all)
   Web dashboard ──────►│  Gemini "Pulse" agent       │────► Gemini API
   Android app ────────►│  Reminder engine            │────► Google Classroom API
                        │  FCM push (Firebase Admin)  │
                        └─────────────────────────────┘
```

### Components

| Component | Location | Responsibility |
| --- | --- | --- |
| **API server** | `api/index.js` | Express app, all REST endpoints, cron endpoints, auth middleware |
| **DB layer** | `api/lib/util.js` | Thin Firestore helpers (`getDoc/setDoc/addDoc/listDocs/queryDocs/deleteDoc`) + Dhaka timezone math |
| **Settings** | `api/lib/config.js` | Merged settings document (`settings/hub`) with env fallbacks and default values |
| **Agent** | `api/lib/gemini.js` | Gemini client, tool definitions, tool executor, dynamic system prompt |
| **Reminders** | `api/lib/reminders.js` | Generators for class (15-min) and deadline (24-h) reminders (idempotent) |
| **Classroom** | `api/lib/classroom.js` | OAuth token management + courses/coursework/announcements sync |
| **Connectors** | `api/lib/connectors.js` | career-io webhook, robot-oda RTDB, Classroom, CI ingest |
| **Plan & mission** | `api/lib/plan.js`, `api/lib/mission.js` | Seed data for the restart plan and the trackers |

---

## 2. Data model (Firestore)

All collections live in the `career-os-hub` Firestore project. `firestore.rules` denies client access; the server uses the Admin SDK.

| Collection / doc | Purpose | Key fields |
| --- | --- | --- |
| `settings/hub` | Global settings | `hubToken`, `geminiKey`, `geminiModel`, classroom OAuth fields, connector config |
| `profile/main` | Owner profile | name, education, research, skills, achievements, priorities, operating principles |
| `phases` | Plan phases | `label`, `focus[]`, `status` (active/pending) |
| `milestones` | Checkpoints | `title`, `dueAt`, `status`, `category` |
| `deadlines` | Hard dates | `title`, `dueAt`, `category`, `critical`, `notes`, `reminded24h`, `source` |
| `tasks` | Work items | `title`, `dueAt`, `category`, `priority`, `phase`, `status`, `description`, `outcome`, `rating` |
| `goals` | Career goals | `goal`, `by`, `status` |
| `schedule` | Weekly class routine | `dayOfWeek` (0=Sun), `startTime`, `endTime`, `room`, `teacher`, `enabled` |
| `reminders` | One-shot offline-capable reminders | `dueAt`, `leadMinutes`, `fired`, `source` (`schedule`/`deadline`/manual) |
| `notifications` | In-app feed | `title`, `body`, `type`, `read`, `createdAt`, `source` |
| `devices` | FCM tokens (doc id = token) | `registeredAt`, `platform`, `name` |
| `systems` | Connector status | `status`, `summary`, `lastSync`, `data` |
| `learning_events` | Self-learning raw events | `type`, `text`, `rating`, `ts` |
| `learning_facts` | Distilled facts about the user | `fact`, `strength`, `source` |
| `scholarships` | Scholarship tracker | `name`, `country`, `deadline`, `status`, `priority`, `coverage`, `docs`, `notes`, `url` |
| `universities` | University tracker | `name`, `country`, `dept`, `scholarship`, `appDeadline`, `status`, `priority` |
| `professors` | Outreach tracker | `name`, `university`, `field`, `status`, `response`, `scholarship` |
| `mission/cgpa` | CGPA tracker (single doc) | `cgpa`, `completedCredits`, `totalDegreeCredits`, `target`, `backlogs[]`, `futureSems[]` |
| `notes` | Notebooks | `title`, `color`, `entries[]` |
| `oauth/state` | One-time OAuth ticket for Classroom connect | `state`, `createdAt` |

---

## 3. Authentication

- Every protected endpoint requires the header `x-hub-token` to equal the value in `settings/hub.hubToken` (`api/index.js` `requireAuth`).
- The token is generated once by `POST /api/init` and shown to the owner. It is stored in:
  - Web dashboard → `localStorage`
  - Android app → `SharedPreferences` (synced from the WebView via a JS bridge)
  - GitHub Actions → repository secret `HUB_TOKEN`
- `POST /api/init` refuses to re-initialize if a token already exists (idempotent bootstrap).

---

## 4. Reminder engine (offline-capable)

The app must deliver reminders even when offline, so the hub **pre-generates** reminders and the app schedules them as exact alarms.

**Class reminders — 15 minutes before**
1. `ensureClassReminders()` (`api/lib/reminders.js`) runs on every cron tick (and after schedule edits).
2. For each enabled `schedule` entry it computes all occurrences in the next **7 days** (Dhaka time) and creates a `reminders` doc with `dueAt = class start`, `leadMinutes = 15`, `source = schedule`, deduplicated by `scheduleKey`.
3. The Android app (`SyncWorker`, every 15 min) fetches `/api/reminders` and schedules each future reminder as an `AlarmManager` alarm at `dueAt - leadMinutes`.

**Deadline reminders — 24 hours before**
1. `ensureDeadlineReminders()` creates a `reminders` doc per future deadline with `leadMinutes = 1440` and sets `deadlines/<id>.reminded24h`.
2. Fired automatically on the hub too — `processReminders()` sends a push notification at the same moment the app alarm fires.

**Server firing**
- `POST /api/cron/15min` → `processReminders()` (pushes any due reminder via FCM) + `ensureClassReminders()` + connector sync.
- `POST /api/cron/daily` → everything above + `ensureDeadlineReminders()` + the daily "morning brief" (includes today's classes).

**Cleanup** — orphaned reminders (removed schedule entries / plan re-ingests) and past schedule reminders are removed on each run.

---

## 5. AI agent ("Pulse")

`POST /api/chat` runs a **tool-calling loop** (up to 8 rounds):

1. `buildSystemPrompt()` assembles a dynamic prompt: profile, active phase, upcoming deadlines, open tasks, today's classes, upcoming tests, scholarship deadlines, professor outreach status, and **learned facts** about the user.
2. The model may call any of the registered **tools** (`TOOL_DEFS` in `api/lib/gemini.js`): task CRUD, deadlines, reminders, class schedule, tests, goals, notifications, learning stats, classroom status, system status, etc.
3. Tool results are fed back; the loop continues until the model emits a plain-text answer.

The agent's "self-learning" comes from:
- `POST /api/feedback` and task completions → `learning_events`.
- Monthly `refineLearning()` → Gemini distills the latest 30 events + existing facts into at most 10 `learning_facts`.
- Facts are injected into every subsequent system prompt, so Pulse adapts to the user's habits over time.

---

## 6. Google Classroom connector

1. **Connect** — `GET /api/classroom/start` (token-auth) returns a one-time `state`; `GET /api/classroom/auth?state=…` validates it (10-min TTL) and redirects to Google. The callback exchanges the code for a **refresh token**, stored in `settings/hub` (never exposed by any API).
2. **Sync** — `syncClassroom()`:
   - Lists active courses.
   - For each course, fetches `courseWork` (published items with due dates) → creates `deadlines` (`category=classroom`, `sourceId` for idempotency) → the reminder engine then gives them 24-h reminders.
   - Fetches `announcements` → creates `notifications` (deduplicated via `seenAnnouncements`).
   - Writes status to `systems/classroom`.
3. Runs automatically on the scheduler every 30 min and on-demand via `POST /api/classroom/sync`.

---

## 7. Deployment

See **[docs/deployment.md](docs/deployment.md)** for the full setup of Vercel, Firebase, Google Classroom OAuth, and CI/CD.
