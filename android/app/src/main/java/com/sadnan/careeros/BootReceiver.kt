package com.sadnan.careeros

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_BOOT_COMPLETED && action != "android.intent.action.QUICKBOOT_POWERON") return
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val rems = HubApi(context).getReminders()
                val arr = rems.optJSONArray("reminders") ?: return@launch
                ReminderScheduler.scheduleFrom(context, arr)
            } catch (e: Exception) {
                // ignore - retried on next sync
            }
        }
    }
}
