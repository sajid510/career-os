# Career OS — Android App (`android/`)

The Android companion to **Career OS**, part of the `career-os` monorepo. The app is a thin client: a **WebView dashboard** wrapper with native push notifications and **offline-capable reminders**.

## Features

- **Full dashboard in a WebView** — loads `https://career-os-hub.vercel.app`; every feature of the web app (mission plan, classes, scholarships, AI assistant) is available on the phone.
- **Push notifications (online)** — real-time via Firebase Cloud Messaging, with a 15-minute polling fallback.
- **Offline reminders** — deadlines, class tests and the weekly class routine are synced to the phone and fire via exact Android `AlarmManager` alarms **even when offline** (re-armed after reboot via `BootReceiver`).
- **Single sign-in** — the hub token is entered once and shared between the WebView and native services via a JavaScript bridge.

## How it connects

```
Hub (Vercel) ── /api/reminders ──► SyncWorker (every 15 min) ──► AlarmManager (offline)
Hub (Vercel) ── /api/device ─────► FCM device token registration
Hub (Vercel) ── FCM push ───────► MessagingService ──► NotificationHelper
WebView ─────── window.Android ──► token sync between localStorage & SharedPreferences
```

## Source map (`app/src/main/java/com/sadnan/careeros/`)

| File | Responsibility |
| --- | --- |
| `MainActivity.kt` | WebView + JS bridge (`Android.setHubToken/getHubToken/notify`) |
| `HubApi.kt` | REST client for the hub API (base URL + hub token header) |
| `CareOsApp.kt` | Application class: registers the 15-min `SyncWorker` + FCM token |
| `SyncWorker.kt` | Polls `/api/notifications` + `/api/reminders`; schedules offline alarms |
| `ReminderScheduler.kt` | Converts server reminders into exact `AlarmManager` alarms (`dueAt - leadMinutes`) |
| `ReminderReceiver.kt` / `BootReceiver.kt` | Fires alarms / re-arms them after reboot |
| `MessagingService.kt` | FCM foreground push handling |
| `NotificationHelper.kt` | Notification channel + display |

## Build the APK

The GitHub Actions workflow `.github/workflows/android-build.yml` compiles a **signed `app-release.apk`** on every push and publishes Releases for `v*` tags. Download it from **Actions → build-apk → artifact `career-os-apk`**, or from a **Release**.

Local build:
```bash
cd android
KEYSTORE_FILE=... KEYSTORE_PASS=... KEY_PASS=... KEY_ALIAS=... gradle assembleRelease
```

Install by allowing "install unknown apps" (this app is not on the Play Store).

## Requirements

- minSdk 26, targetSdk 34, Java 17, Gradle 8.5.
- `app/google-services.json` from the Firebase project (already included; ensure the API key has Android application restrictions — see `../docs/deployment.md`).
