package com.sadnan.careeros

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant

object ReminderScheduler {

    fun scheduleFrom(ctx: Context, reminders: JSONArray) {
        val prefs = ctx.getSharedPreferences(HubApi.PREFS, Context.MODE_PRIVATE)
        val fired = prefs.getStringSet("reminders_fired", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
        val alarm = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        for (i in 0 until reminders.length()) {
            val r: JSONObject = reminders.getJSONObject(i)
            val id = r.optString("id")
            if (id.isEmpty() || id in fired) continue
            val dueAt = r.optString("dueAt")
            if (dueAt.isEmpty()) continue
            val lead = r.optLong("leadMinutes", 60) * 60_000L
            val due: Long = try {
                Instant.parse(dueAt).toEpochMilli()
            } catch (e: Exception) {
                continue
            }
            val fireAt = due - lead
            if (fireAt <= System.currentTimeMillis()) {
                fired.add(id)
                NotificationHelper.show(ctx, r.optString("title", "Reminder"), r.optString("body", ""), "rem_" + id)
                continue
            }
            val pi = PendingIntent.getBroadcast(
                ctx,
                id.hashCode(),
                Intent(ctx, ReminderReceiver::class.java)
                    .putExtra("title", r.optString("title"))
                    .putExtra("body", r.optString("body"))
                    .putExtra("rid", id),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            try {
                alarm.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, fireAt, pi)
            } catch (e: Exception) {
                alarm.set(AlarmManager.RTC_WAKEUP, fireAt, pi)
            }
        }
        prefs.edit().putStringSet("reminders_fired", fired).apply()
    }
}
