package com.vanta.app

import android.app.Activity
import android.app.Dialog
import android.content.ActivityNotFoundException
import android.content.ContentValues
import android.content.ClipData
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.net.http.SslError
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Hosted VANTA WebView shell with a native, unified Camera / Photos / Files picker.
 *
 * No JavaScript bridge is exposed. Existing HTML file inputs are routed through
 * WebChromeClient.onShowFileChooser, then the selected content URIs are returned
 * to the original upload input. Authentication and uploads remain in VANTA.
 */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private var pendingFileCallback: android.webkit.ValueCallback<Array<Uri>>? = null
    private var pendingCameraUri: Uri? = null
    private var acceptedFileTypes: Array<String> = emptyArray()

    companion object {
        private const val VANTA_ORIGIN = "https://vanta-nu.vercel.app"
        private const val VANTA_HOST = "vanta-nu.vercel.app"
        private const val FILE_CHOOSER_REQUEST = 4107
        private const val CAMERA_REQUEST = 4108
        private const val CAMERA_URI_STATE = "vanta.pending.camera.uri"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        window.decorView.setBackgroundColor(Color.rgb(5, 5, 5))
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false)
        } else {
            @Suppress("DEPRECATION")
            window.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                )
        }
        CookieManager.getInstance().setAcceptCookie(true)

        pendingCameraUri = savedInstanceState?.getString(CAMERA_URI_STATE)?.let(Uri::parse)

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
            settings.userAgentString = settings.userAgentString + " VANTAAndroid"

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
                        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri)) }
                    }
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
                    acceptedFileTypes = fileChooserParams.acceptTypes
                        .flatMap { it.split(",") }
                        .map { it.trim() }
                        .filter { it.contains("/") }
                        .distinct()
                        .toTypedArray()

                    showNativeAttachmentPicker()
                    return true
                }
            }
        }

        val root = FrameLayout(this).apply {
            setBackgroundColor(Color.rgb(5, 5, 5))
            addView(webView)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            root.setOnApplyWindowInsetsListener { view, insets ->
                val bars = insets.getInsets(WindowInsets.Type.systemBars())
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
                insets
            }
        }
        setContentView(root)

        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        if (savedInstanceState == null) {
            webView.loadUrl(VANTA_ORIGIN)
        } else {
            webView.restoreState(savedInstanceState) ?: webView.loadUrl(VANTA_ORIGIN)
        }
    }

    private fun isTrustedPage(url: String?): Boolean {
        if (url.isNullOrBlank()) return false
        val uri = Uri.parse(url)
        return uri.scheme == "https" && uri.host == VANTA_HOST
    }

    private fun showNativeAttachmentPicker() {
        val dialog = Dialog(this)
        val panel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(20), dp(20), dp(22))
            background = roundedBackground(Color.rgb(17, 17, 19), 26)
        }

        val heading = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        val titleBlock = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        titleBlock.addView(TextView(this).apply {
            text = "Share a file"
            setTextColor(Color.WHITE)
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
        })
        titleBlock.addView(TextView(this).apply {
            text = "Choose how you want to attach it"
            setTextColor(Color.rgb(155, 155, 160))
            textSize = 12f
            setPadding(0, dp(4), 0, 0)
        })
        heading.addView(titleBlock, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        heading.addView(TextView(this).apply {
            text = "×"
            textSize = 27f
            setTextColor(Color.rgb(175, 175, 180))
            gravity = Gravity.CENTER
            setPadding(dp(10), 0, dp(4), dp(4))
            setOnClickListener { dialog.dismiss(); completeFileSelection(null) }
        })
        panel.addView(heading)

        val grid = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(18), dp(8), dp(4))
        }
        grid.addView(
            pickerTile("📷", "Camera", "Take a photo", Color.rgb(201, 162, 39)) {
                dialog.dismiss()
                launchCamera()
            },
            tileLayoutParams()
        )
        grid.addView(
            pickerTile("▧", "Photos", "Images & videos", Color.rgb(65, 177, 128)) {
                dialog.dismiss()
                launchPhotos()
            },
            tileLayoutParams()
        )
        grid.addView(
            pickerTile("📁", "Files", "Documents", Color.rgb(205, 205, 210)) {
                dialog.dismiss()
                launchFiles()
            },
            tileLayoutParams()
        )
        panel.addView(grid)
        dialog.setContentView(panel)
        dialog.setCancelable(true)
        dialog.setOnCancelListener { completeFileSelection(null) }
        dialog.window?.apply {
            setBackgroundDrawableResource(android.R.color.transparent)
            setLayout(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
            setGravity(Gravity.BOTTOM)
            addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
            setDimAmount(0.58f)
            attributes = attributes.apply {
                width = ViewGroup.LayoutParams.MATCH_PARENT
                height = ViewGroup.LayoutParams.WRAP_CONTENT
                gravity = Gravity.BOTTOM
                windowAnimations = android.R.style.Animation_InputMethod
            }
        }
        dialog.show()
        dialog.window?.setLayout(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        )
        dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
    }

    private fun pickerTile(
        symbol: String,
        label: String,
        detail: String,
        accent: Int,
        onClick: () -> Unit
    ): View {
        // Telegram-style attachment option: bare circular icon with a label
        // underneath, no card behind it.
        val tile = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(dp(6), dp(4), dp(6), dp(6))
            isClickable = true
            isFocusable = true
            setOnClickListener { onClick() }
        }
        val circle = FrameLayout(this).apply {
            val size = dp(56)
            layoutParams = LinearLayout.LayoutParams(size, size)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.argb(38, Color.red(accent), Color.green(accent), Color.blue(accent)))
            }
            addView(TextView(this@showNativeAttachmentPicker.context).apply {
                text = symbol
                textSize = 24f
                gravity = Gravity.CENTER
                setTextColor(accent)
            }, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        }
        tile.addView(circle)
        tile.addView(TextView(this).apply {
            text = label
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, dp(7), 0, 0)
        })
        return tile
    }

    private fun tileLayoutParams() = LinearLayout.LayoutParams(
        0,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        1f
    ).apply {
        marginStart = dp(4)
        marginEnd = dp(4)
    }

    private fun roundedBackground(color: Int, radiusDp: Int) = GradientDrawable().apply {
        setColor(color)
        cornerRadius = dp(radiusDp).toFloat()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun launchCamera() {
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (intent.resolveActivity(packageManager) == null) {
            completeFileSelection(null)
            return
        }

        pendingCameraUri = null
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val values = ContentValues().apply {
                put(MediaStore.Images.Media.DISPLAY_NAME, "vanta_capture_${System.currentTimeMillis()}.jpg")
                put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg")
                put(
                    MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES + "/VANTA"
                )
            }
            pendingCameraUri = contentResolver.insert(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                values
            )
            pendingCameraUri?.let { uri ->
                intent.putExtra(MediaStore.EXTRA_OUTPUT, uri)
                intent.clipData = ClipData.newRawUri("VANTA camera output", uri)
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)
                // Camera apps often run in a separate package and require an
                // explicit URI grant to write the full-resolution capture.
                intent.resolveActivity(packageManager)?.let { resolved ->
                    grantUriPermission(
                        resolved.packageName,
                        uri,
                        Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                    )
                }
            }
        } else {
            // On older Android versions, request a full capture result rather
            // than allowing a picker-style fallback to satisfy the intent.
            intent.putExtra("return-data", true)
        }
        launchIntent(intent, CAMERA_REQUEST)
    }

    private fun launchPhotos() {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            Intent(MediaStore.ACTION_PICK_IMAGES).apply {
                type = "*/*"
                putExtra(MediaStore.EXTRA_PICK_IMAGES_MAX, 10)
            }
        } else {
            Intent(Intent.ACTION_GET_CONTENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = "*/*"
                putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/*", "video/*"))
                putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
        }
        launchIntent(intent, FILE_CHOOSER_REQUEST)
    }

    private fun launchFiles() {
        val documentTypes = acceptedFileTypes.filterNot {
            it.startsWith("image/") || it.startsWith("video/")
        }
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = if (documentTypes.size == 1) documentTypes[0] else "*/*"
            if (documentTypes.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, documentTypes.toTypedArray())
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
        }
        launchIntent(intent, FILE_CHOOSER_REQUEST)
    }

    private fun launchIntent(intent: Intent, requestCode: Int) {
        try {
            startActivityForResult(intent, requestCode)
        } catch (_: ActivityNotFoundException) {
            pendingCameraUri?.let { runCatching { contentResolver.delete(it, null, null) } }
            pendingCameraUri = null
            completeFileSelection(null)
        } catch (_: SecurityException) {
            pendingCameraUri?.let { runCatching { contentResolver.delete(it, null, null) } }
            pendingCameraUri = null
            completeFileSelection(null)
        }
    }

    private fun completeFileSelection(uris: Array<Uri>?) {
        val callback = pendingFileCallback
        pendingFileCallback = null
        callback?.onReceiveValue(uris)
    }

    @Deprecated("Deprecated by Android; retained for broad device compatibility.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode == CAMERA_REQUEST) {
            val cameraUri = pendingCameraUri
            pendingCameraUri = null
            if (resultCode == RESULT_OK) {
                val selected = cameraUri ?: data?.data
                if (selected != null) completeFileSelection(arrayOf(selected))
                else completeFileSelection(null)
            } else {
                cameraUri?.let { runCatching { contentResolver.delete(it, null, null) } }
                completeFileSelection(null)
            }
            return
        }

        if (requestCode != FILE_CHOOSER_REQUEST) return
        if (resultCode != RESULT_OK || data == null) {
            completeFileSelection(null)
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
        completeFileSelection(selected.distinct().takeIf { it.isNotEmpty() }?.toTypedArray())
    }

    override fun onSaveInstanceState(outState: Bundle) {
        pendingCameraUri?.let { outState.putString(CAMERA_URI_STATE, it.toString()) }
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
        if (isFinishing) {
            pendingCameraUri?.let { runCatching { contentResolver.delete(it, null, null) } }
            pendingCameraUri = null
        }
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.webChromeClient = null
            webView.webViewClient = WebViewClient()
            webView.destroy()
        }
        super.onDestroy()
    }
}
