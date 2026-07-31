package com.sadnan.careeros

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private val prefs by lazy { getSharedPreferences(HubApi.PREFS, Context.MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NotificationHelper.createChannel(this)
        requestNotificationPermission()

        webView = WebView(this)
        configureWebView()
        setContentView(webView)
        webView.loadUrl(HubApi.BASE.replace("/api", ""))
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.allowFileAccess = true
        settings.mediaPlaybackRequiresUserGesture = false

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                if (url.startsWith(HubApi.BASE.replace("/api", ""))) {
                    return false
                }
                return false
            }

            override fun onPageFinished(view: WebView, url: String?) {
                super.onPageFinished(view, url)
                pushBridge()
            }

            override fun onReceivedError(
                view: WebView,
                request: WebResourceRequest,
                error: WebResourceError
            ) {
                super.onReceivedError(view, request, error)
            }
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(Bridge(), "Android")
    }

    private fun pushBridge() {
        val token = prefs.getString("hub_token", "") ?: ""
        val js = "(function(){ window.__hubToken = " + JSONObject.quote(token) +
            "; if (window.careerOsAndroidBridge) window.careerOsAndroidBridge(window.__hubToken); })();"
        webView.evaluateJavascript(js, null)
    }

    inner class Bridge {
        @JavascriptInterface
        fun setHubToken(token: String) {
            val t = token ?: ""
            prefs.edit().putString("hub_token", t).apply()
            if (t.isNotEmpty()) {
                CoroutineScope(Dispatchers.IO).launch {
                    try {
                        FirebaseMessaging.getInstance().token.addOnSuccessListener { fcm ->
                            CoroutineScope(Dispatchers.IO).launch {
                                try { HubApi(this@MainActivity).registerDevice(fcm) } catch (e: Exception) {}
                            }
                        }
                    } catch (e: Exception) {
                    }
                }
            }
        }

        @JavascriptInterface
        fun getHubToken(): String = prefs.getString("hub_token", "") ?: ""

        @JavascriptInterface
        fun notify(title: String, body: String) {
            NotificationHelper.show(this@MainActivity, title ?: "Career OS", body ?: "", "web_" + System.currentTimeMillis())
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED
            ) {
                ActivityCompat.requestPermissions(
                    this,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    101
                )
            }
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
