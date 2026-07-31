package com.sadnan.careeros

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class HubApi(private val ctx: Context) {

    companion object {
        const val BASE = "https://career-os-hub.vercel.app/api"
        const val PREFS = "careeros"

        fun tokenOf(ctx: Context): String =
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("hub_token", "") ?: ""
    }

    private fun prefs() = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    suspend fun getNotifications(since: String): JSONObject =
        request("GET", "/notifications?since=${java.net.URLEncoder.encode(since, "UTF-8")}", null)

    suspend fun getReminders(): JSONObject = request("GET", "/reminders", null)

    suspend fun registerDevice(fcmToken: String) {
        val t = tokenOf(ctx)
        if (t.isEmpty()) return
        val body = JSONObject()
            .put("token", fcmToken)
            .put("platform", "android")
            .put("name", android.os.Build.MODEL)
        request("POST", "/device", body)
    }

    private suspend fun request(method: String, path: String, body: JSONObject?): JSONObject =
        withContext(Dispatchers.IO) {
            val token = tokenOf(ctx)
            val conn = URL(BASE + path).openConnection() as HttpURLConnection
            conn.requestMethod = method
            conn.connectTimeout = 15000
            conn.readTimeout = 25000
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("User-Agent", "CareerOS-Android")
            if (token.isNotEmpty()) conn.setRequestProperty("x-hub-token", token)
            if (body != null) {
                conn.doOutput = true
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            }
            val code = conn.responseCode
            val stream = if (code in 200..299) conn.inputStream else conn.errorStream
            val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
            conn.disconnect()
            if (code !in 200..299) throw Exception("HTTP $code $text")
            JSONObject(text)
        }
}
