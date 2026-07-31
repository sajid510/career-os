package com.sadnan.careeros

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import org.json.JSONArray

class SyncWorker(
    ctx: Context,
    params: WorkerParameters
) : CoroutineWorker(ctx, params) {

    override suspend fun doWork(): Result {
        val app = applicationContext
        val prefs = app.getSharedPreferences(HubApi.PREFS, Context.MODE_PRIVATE)
        val token = prefs.getString("hub_token", "") ?: ""
        if (token.isEmpty()) return Result.retry()

        return try {
            val api = HubApi(app)

            // Poll notifications since last seen
            val since = prefs.getString("last_seen", "") ?: ""
            val notifs = api.getNotifications(since)
            val arr: JSONArray = notifs.optJSONArray("notifications") ?: JSONArray()
            var latest = since
            for (i in arr.length() - 1 downTo 0) {
                val n = arr.getJSONObject(i)
                val ts = n.optString("createdAt", "")
                if (ts > latest) latest = ts
                if (!n.optBoolean("read", false)) {
                    NotificationHelper.show(
                        app,
                        n.optString("title", "Career OS"),
                        n.optString("body", ""),
                        "n_" + n.optString("id", i.toString())
                    )
                }
            }
            if (latest.isNotEmpty()) prefs.edit().putString("last_seen", latest).apply()

            // Sync reminders -> offline alarms
            try {
                val rem = api.getReminders()
                val rems = rem.optJSONArray("reminders") ?: JSONArray()
                ReminderScheduler.scheduleFrom(app, rems)
            } catch (e: Exception) {
                // reminder sync is best-effort
            }

            Result.success()
        } catch (e: Exception) {
            Result.retry()
        }
    }
}
