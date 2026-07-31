# Career OS — Deployment & Setup Guide

This guide covers provisioning the free infrastructure and deploying the system.

---

## 1. Infrastructure summary

| Service | Purpose | Free tier |
| --- | --- | --- |
| **Firebase** (Firestore + FCM) | Database, push notifications | ✅ Spark plan |
| **Vercel** | Serverless API + static dashboard | ✅ Hobby |
| **GitHub Actions** | Scheduler + Android APK builds | ✅ Public repos |
| **Google Gemini API** | AI assistant | ✅ Free tier |
| **Google Classroom API** | Course/assignment sync | ✅ |

---

## 2. Firebase setup

1. Create a Firebase project (e.g. `career-os-hub`).
2. Enable **Firestore**, **Authentication** (optional), **Cloud Messaging**.
3. Copy the **Firebase Admin SDK service account JSON** → this becomes the `FIREBASE_SERVICE_ACCOUNT` Vercel env var (JSON as a string).
4. Deploy the security rules:
   ```
   firestore.rules   # deny-all: allow read, write: if false;
   ```
5. Register the **Android app** in Firebase (`com.sadnan.careeros`) → download `google-services.json` → it lives at `android/app/google-services.json`.

### 🔐 Google API key restriction (important)
The `google-services.json` contains an **Android API key**. It is *public by design* (embedded in the APK), so its security comes from **application restrictions**, not secrecy:

1. Google Cloud Console → **APIs & Services → Credentials** → open the API key.
2. Under **Application restrictions → Android apps**, add:
   - Package name: `com.sadnan.careeros`
   - SHA-1 fingerprint of your release signing key.
3. Under **API restrictions**, limit to the services used (Firebase/FCM, Classroom) so the key can't be abused elsewhere.

> GitHub secret-scanning flags this key as a `google_api_key`. Because it is a mobile-client key (not a server credential), close that alert as a **false positive** — but only after the application restrictions above are in place.

---

## 3. Vercel deployment (hub + dashboard)

The repo is a **monorepo**: `api/` + `public/` deploy from the repo **root** (Vercel git integration), so no `rootDirectory` setting is needed.

1. Import the GitHub repo into Vercel (Framework preset: **Other**).
2. Set environment variables:

   | Variable | Value |
   | --- | --- |
   | `FIREBASE_SERVICE_ACCOUNT` | Firebase Admin service-account JSON (as a string) |
   | `GEMINI_API_KEY` | Google Gemini API key |
   | `HUB_BASE_URL` | `https://<your-vercel-domain>` (defaults to `https://career-os-hub.vercel.app`) |

3. Deploy. Push to `main` auto-deploys (git integration).

### Bootstrap the hub token (one time)

```bash
curl -X POST https://<your-domain>/api/init
```
This generates the **hub token** and seeds the roadmap. Keep it secret — it authenticates every API call.

### GitHub secrets (scheduler + APK builds)

| Secret | Used by | Purpose |
| --- | --- | --- |
| `HUB_TOKEN` | `scheduler.yml` | Authenticates the cron/connector calls |
| `KEYSTORE_BASE64` | `android-build.yml` | Base64 of the release keystore |
| `KEYSTORE_PASS` | `android-build.yml` | Keystore password |
| `KEY_PASS` | `android-build.yml` | Key password |
| `KEY_ALIAS` | `android-build.yml` | Key alias |

---

## 4. Google Classroom connector (one time)

1. Google Cloud Console → project `career-os-hub` → **APIs & Services → Enable APIs** → enable **Google Classroom API**.
2. **Credentials → OAuth client ID → Web application**, authorized redirect URI:
   ```
   https://<your-domain>/api/classroom/oauth_callback
   ```
3. Configure the **OAuth consent screen**:
   - User type: **External**
   - App name, support email.
   - **Test users**: add the account that owns the Classroom data (e.g. `23208149@uap-bd.edu`). Alternatively **Publish app**.
4. In the dashboard → **Settings → Google Classroom**: paste the **Client ID** and **Client secret**, then click **Connect Classroom** and authorize with the Classroom account (choosing it in Google's account picker).
5. Press **Sync now**. Courses → deadlines + 24-h reminders; announcements → notifications. Auto re-syncs every 30 min.

> ⚠️ University Workspace accounts (`*.edu`) sometimes block unverified OAuth apps via admin policy. If you see *"This app is blocked"*, the org admin must allow it, or use a personal Google account that can access the classroom.

---

## 5. Android app build & install

- **CI build**: `.github/workflows/android-build.yml` builds a **signed release APK** on every push to `main` (and `v*` tags), uploads it as an artifact and publishes a GitHub Release for tags. Download from **Actions → career-os-apk** or **Releases**.
- **Local build**:
  ```bash
  cd android
  KEYSTORE_FILE=... KEYSTORE_PASS=... KEY_PASS=... KEY_ALIAS=... gradle assembleRelease
  ```
- Install by allowing "install unknown apps" (sideload; not on the Play Store).
- The app's WebView loads `https://<your-domain>/` and shares the hub token with native services (FCM + offline alarms) via a JS bridge.

---

## 6. REST API quick reference

| Method & path | Purpose |
| --- | --- |
| `POST /api/init` | Bootstrap hub token + seed plan |
| `GET /api/overview` | Dashboard stats, today's classes, systems, notifications |
| `GET/POST/PATCH/DELETE /api/tasks` · `/api/deadlines` | Plan CRUD (deadlines auto-create 24-h reminders) |
| `GET/POST/PATCH/DELETE /api/schedule` | Weekly class routine (auto 15-min reminders) |
| `POST /api/plan/ingest` | AI-decompose an uploaded career plan |
| `POST /api/plan/restart` | Reset to the Aug-2026 restart mission |
| `GET/POST/PATCH/DELETE /api/scholarships` · `/api/universities` · `/api/professors` | Mission trackers |
| `GET/POST /api/cgpa` · `GET/POST/PATCH/DELETE /api/notes` | CGPA + notebooks |
| `GET /api/classroom/start` · `/api/classroom/auth` · `/api/classroom/oauth_callback` | Classroom OAuth flow |
| `POST /api/classroom/sync` | Manual Classroom sync |
| `POST /api/chat` | Pulse AI assistant (tool-calling) |
| `POST /api/feedback` | Self-learning feedback |
| `POST /api/cron/{15min,daily,weekly,monthly}` | Called by GitHub Actions |
