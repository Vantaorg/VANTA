package com.vanta.app

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.widget.FrameLayout

/**
 * Minimal hosted VANTA WebView shell.
 *
 * No addJavascriptInterface is exposed. Existing HTML file inputs are routed
 * through WebChromeClient's picker callback, which keeps the native surface
 * narrow while preserving VANTA's existing authenticated upload pipeline.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var pendingFileCallback: android.webkit.ValueCallback<Array<Uri>>? = null

    companion object {
        private const val VANTA_ORIGIN = "https://vanta-nu.vercel.app"
        private const val VANTA_HOST = "vanta-nu.vercel.app"
        private const val FILE_CHOOSER_REQUEST = 4107
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.statusBarColor = Color.rgb(5, 5, 5)
        window.navigationBarColor = Color.rgb(5, 5, 5)
        window.decorView.setBackgroundColor(Color.rgb(5, 5, 5))

        CookieManager.getInstance().setAcceptCookie(true)

        webView = WebView(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.rgb(5, 5, 5))

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.javaScriptCanOpenWindowsAutomatically = false
            settings.setSupportMultipleWindows(false)
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                settings.safeBrowsingEnabled = true
            }

            CookieManager.getInstance().setAcceptThirdPartyCookies(this, false)

            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    if (!request.isForMainFrame) return false
                    val uri = request.url
                    if (uri.scheme == "https" && uri.host == VANTA_HOST) return false

                    if (uri.scheme == "https") {
                        runCatching {
                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                        }
                    }
                    // Block non-HTTPS top-level navigation and do not let
                    // external sites inherit the VANTA WebView context.
                    return true
                }

                override fun onReceivedSslError(
                    view: WebView,
                    handler: SslErrorHandler,
                    error: SslError
                ) {
                    handler.cancel()
                }
            }

            webChromeClient = object : WebChromeClient() {
                override fun onShowFileChooser(
                    view: WebView,
                    filePathCallback: android.webkit.ValueCallback<Array<Uri>>,
                    fileChooserParams: FileChooserParams
                ): Boolean {
                    if (!isTrustedPage(view.url)) {
                        filePathCallback.onReceiveValue(null)
                        return true
                    }

                    pendingFileCallback?.onReceiveValue(null)
                    pendingFileCallback = filePathCallback

                    val acceptedTypes = fileChooserParams.acceptTypes
                        .flatMap { it.split(",") }
                        .map { it.trim() }
                        .filter { it.contains("/") }
                        .distinct()

                    val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                        addCategory(Intent.CATEGORY_OPENABLE)
                        type = if (acceptedTypes.size == 1) acceptedTypes[0] else "*/*"
                        if (acceptedTypes.size > 1) {
                            putExtra(Intent.EXTRA_MIME_TYPES, acceptedTypes.toTypedArray())
                        }
                        putExtra(
                            Intent.EXTRA_ALLOW_MULTIPLE,
                            fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE
                        )
                    }

                    return try {
                        startActivityForResult(
                            Intent.createChooser(intent, "Choose media"),
                            FILE_CHOOSER_REQUEST
                        )
                        true
                    } catch (_: ActivityNotFoundException) {
                        pendingFileCallback?.onReceiveValue(null)
                        pendingFileCallback = null
                        false
                    }
                }
            }
        }

        setContentView(FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(5, 5, 5))
            addView(webView)
        })

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        if (savedInstanceState == null) {
            webView.loadUrl(VANTA_ORIGIN)
        } else {
            webView.restoreState(savedInstanceState)
                ?: webView.loadUrl(VANTA_ORIGIN)
        }
    }

    private fun isTrustedPage(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = Uri.parse(url)
        return uri.scheme == "https" && uri.host == VANTA_HOST
    }

    @Deprecated("Deprecated by Android; retained for broad device compatibility.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != FILE_CHOOSER_REQUEST) return

        val callback = pendingFileCallback ?: return
        pendingFileCallback = null

        if (resultCode != RESULT_OK || data == null) {
            callback.onReceiveValue(null)
            return
        }

        val selected = mutableListOf<Uri>()
        val clipData = data.clipData
        if (clipData != null) {
            for (index in 0 until clipData.itemCount) {
                clipData.getItemAt(index).uri?.let(selected::add)
            }
        } else {
            data.data?.let(selected::add)
        }
        callback.onReceiveValue(selected.distinct().takeIf { it.isNotEmpty() }?.toTypedArray())
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated by Android; retained for compatibility.")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.webChromeClient = null
            webView.webViewClient = WebViewClient()
            webView.destroy()
        }
        super.onDestroy()
    }
}
