# Career OS — Android App

The Android companion to **Career OS Hub** — your all-in-one career command center.

## Features
- **Full dashboard in a WebView** — every feature of the web app is available on your phone.
- **Push notifications (online)** — real-time via Firebase Cloud Messaging + 15-min polling fallback.
- **Offline reminders** — deadlines and reminders are synced to the phone and fire via Android alarms **even when offline**.
- **Single sign-in** — enter your hub token once; it syncs between the app and the dashboard.

## Build the APK
The GitHub Actions workflow `build-apk` compiles `app-release.apk` automatically on every push.
Download it from **Actions → build-apk → artifact `career-os-apk`**, or from a **Release**.

Install by allowing "install unknown apps" (this app is not on the Play Store).

## How it connects
- WebView loads `https://career-os-hub.vercel.app`
- `SyncWorker` polls `/api/notifications` + `/api/reminders` every 15 minutes
- `ReminderScheduler` turns reminders into exact Android alarms (offline-capable)
- FCM device token registers itself at `/api/device`
- The hub token is shared between the WebView and native services via a JavaScript bridge
