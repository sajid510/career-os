package com.sadnan.careeros

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val title = intent.getStringExtra("title") ?: "Reminder"
        val body = intent.getStringExtra("body") ?: ""
        val rid = intent.getStringExtra("rid") ?: ""
        NotificationHelper.show(context, title, body, "rem_" + rid)
        if (rid.isNotEmpty()) {
            val prefs = context.getSharedPreferences(HubApi.PREFS, Context.MODE_PRIVATE)
            val set = prefs.getStringSet("reminders_fired", mutableSetOf())?.toMutableSet() ?: mutableSetOf()
            set.add(rid)
            prefs.edit().putStringSet("reminders_fired", set).apply()
        }
    }
}
