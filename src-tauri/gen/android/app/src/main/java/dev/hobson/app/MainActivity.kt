package dev.hobson.app

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.File

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    android.webkit.WebView.setWebContentsDebuggingEnabled(true)
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    handleShareIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleShareIntent(intent)
  }

  private fun handleShareIntent(intent: Intent?) {
    Log.d("WebClipper", "handleShareIntent: action=${intent?.action} type=${intent?.type}")
    if (intent?.action != Intent.ACTION_SEND || intent.type != "text/plain") return
    val url = intent.getStringExtra(Intent.EXTRA_TEXT)?.trim() ?: return
    Log.d("WebClipper", "handleShareIntent: url=$url")
    File(cacheDir, "pending_share.txt").writeText(url)
    Log.d("WebClipper", "handleShareIntent: wrote file to ${cacheDir}/pending_share.txt")
    window.decorView.post {
      val webView = findWebView(window.decorView)
      Log.d("WebClipper", "handleShareIntent: webView=$webView")
      if (webView != null) {
        val encoded = java.net.URLEncoder.encode(url, "UTF-8")
        webView.evaluateJavascript(
          "window.__pendingShareUrl=decodeURIComponent('$encoded');window.dispatchEvent(new CustomEvent('hobson-check-share'))",
          null
        )
        Log.d("WebClipper", "handleShareIntent: dispatched hobson-check-share")
      }
    }
  }

  override fun onResume() {
    super.onResume()
    // Inject system bar heights as CSS custom properties.
    // Android WebView doesn't support env(safe-area-inset-*),
    // so we read the actual insets from Android and pass them to CSS.
    window.decorView.post {
      val insets = ViewCompat.getRootWindowInsets(window.decorView)
      val navBar = insets?.getInsets(WindowInsetsCompat.Type.navigationBars())
      val density = resources.displayMetrics.density
      val navBarCss = ((navBar?.bottom ?: 0) / density).toInt()

      findWebView(window.decorView)?.evaluateJavascript(
        "document.documentElement.style.setProperty('--android-nav-height','${navBarCss}px')",
        null
      )
    }
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        val result = findWebView(view.getChildAt(i))
        if (result != null) return result
      }
    }
    return null
  }
}
