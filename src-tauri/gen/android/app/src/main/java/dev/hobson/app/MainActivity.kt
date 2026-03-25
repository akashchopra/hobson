package dev.hobson.app

import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
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
