package com.sadnan.careeros

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(message: RemoteMessage) {
        val title = message.notification?.title
            ?: message.data["title"]
            ?: "Career OS"
        val body = message.notification?.body
            ?: message.data["body"]
            ?: ""
        NotificationHelper.show(this, title, body, "fcm_" + System.currentTimeMillis())
    }

    override fun onNewToken(token: String) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                HubApi(this@MessagingService).registerDevice(token)
            } catch (e: Exception) {
                // ignored - will retry on next app open / sync
            }
        }
    }
}
