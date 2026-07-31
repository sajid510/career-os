package com.sadnan.careeros

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.google.firebase.messaging.FirebaseMessaging
import java.util.concurrent.TimeUnit

class CareOsApp : Application() {

    override fun onCreate() {
        super.onCreate()
        NotificationHelper.createChannel(this)

        // Periodic background sync (poll notifications + reminders, fallback to FCM)
        val syncRequest = PeriodicWorkRequestBuilder<SyncWorker>(15, TimeUnit.MINUTES).build()
        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            "careeros_sync",
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )

        // Register this device for push notifications
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            try {
                HubApi(this).registerDevice(token)
            } catch (e: Exception) {
                // ignored - registered again on next token/launch
            }
        }
    }
}
