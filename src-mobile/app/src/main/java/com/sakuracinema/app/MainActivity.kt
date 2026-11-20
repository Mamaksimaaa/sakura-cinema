package com.sakuracinema.app

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Edge-to-edge — контент рисуется под статусбаром и навигацией
        WindowCompat.setDecorFitsSystemWindows(window, false)

        // Прозрачные системные панели
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        // Светлые/тёмные иконки статусбара — тёмная тема, иконки светлые
        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        insetsController.isAppearanceLightStatusBars = false
        insetsController.isAppearanceLightNavigationBars = false

        setContentView(R.layout.activity_main)

        webView = findViewById(R.id.webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            useWideViewPort = true
            loadWithOverviewMode = true
            // Запрещаем масштабирование пользователем — приложение адаптируется само
            builtInZoomControls = false
            displayZoomControls = false
            setSupportZoom(false)
            // Текстовый размер — авто
            textZoom = 100
        }

        // Инжектируем meta viewport и CSS-патч для мобильного при загрузке страницы
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                // Устанавливаем viewport и добавляем мобильный CSS-патч
                view.evaluateJavascript("""
                    (function() {
                        // Viewport meta
                        var meta = document.querySelector('meta[name=viewport]');
                        if (!meta) {
                            meta = document.createElement('meta');
                            meta.name = 'viewport';
                            document.head.appendChild(meta);
                        }
                        meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

                        // Флаг — мы на Android WebView
                        document.documentElement.classList.add('android-app');
                        document.body && document.body.classList.add('android-app');

                        // Безопасные отступы для edge-to-edge (вырезы, навигация)
                        var style = document.getElementById('__android_patch__');
                        if (!style) {
                            style = document.createElement('style');
                            style.id = '__android_patch__';
                            document.head.appendChild(style);
                        }
                        style.textContent = `
                            :root {
                                --safe-top: env(safe-area-inset-top, 0px);
                                --safe-bottom: env(safe-area-inset-bottom, 0px);
                                --safe-left: env(safe-area-inset-left, 0px);
                                --safe-right: env(safe-area-inset-right, 0px);
                            }
                            html.android-app body {
                                padding-top: env(safe-area-inset-top, 0px) !important;
                                padding-bottom: env(safe-area-inset-bottom, 0px) !important;
                                overflow-x: hidden !important;
                            }
                            /* Мобильный контейнер */
                            html.android-app .app-container {
                                padding: 12px 14px calc(72px + env(safe-area-inset-bottom, 0px)) 14px !important;
                                gap: 16px !important;
                                max-width: 100% !important;
                            }
                            /* Шапка */
                            html.android-app .main-header {
                                padding: 10px 14px !important;
                                gap: 10px !important;
                                flex-wrap: wrap !important;
                            }
                            html.android-app .logo-group { gap: 8px !important; }
                            html.android-app .logo-icon-wrap { width: 36px !important; height: 36px !important; }
                            html.android-app .brand-name { font-size: 16px !important; }
                            html.android-app .brand-tagline { display: none !important; }
                            /* Поиск */
                            html.android-app .search-container { padding: 10px 14px !important; }
                            html.android-app .search-input-wrap input { font-size: 15px !important; padding: 10px 14px 10px 42px !important; }
                            /* Категории */
                            html.android-app .category-pills { gap: 6px !important; overflow-x: auto !important; flex-wrap: nowrap !important; padding-bottom: 4px !important; }
                            html.android-app .category-pill { padding: 6px 14px !important; font-size: 12px !important; white-space: nowrap !important; flex-shrink: 0 !important; }
                            /* Сетка карточек — 2 колонки на телефоне */
                            html.android-app .sites-grid {
                                grid-template-columns: repeat(2, 1fr) !important;
                                gap: 10px !important;
                                padding: 12px !important;
                            }
                            html.android-app .site-card { min-height: 90px !important; }
                            html.android-app .site-card-name { font-size: 13px !important; }
                            html.android-app .site-card-desc { font-size: 11px !important; display: -webkit-box !important; -webkit-line-clamp: 2 !important; -webkit-box-orient: vertical !important; overflow: hidden !important; }
                            /* История просмотра */
                            html.android-app .history-scroll { gap: 10px !important; }
                            html.android-app .history-card { min-width: 130px !important; max-width: 150px !important; }
                            /* Маскот */
                            html.android-app .mascot-wrapper {
                                bottom: calc(16px + env(safe-area-inset-bottom, 0px)) !important;
                                right: 12px !important;
                            }
                            html.android-app .mascot-avatar { width: 56px !important; height: 56px !important; }
                            /* Зеркала */
                            html.android-app .mirror-badge { font-size: 10px !important; padding: 3px 8px !important; }
                            /* Секции */
                            html.android-app .section-title { font-size: 15px !important; }
                            /* Модальные окна — на весь экран */
                            html.android-app .modal-overlay .modal-box {
                                width: 100% !important;
                                max-width: 100% !important;
                                min-height: 50vh !important;
                                border-radius: 20px 20px 0 0 !important;
                                position: fixed !important;
                                bottom: 0 !important;
                                left: 0 !important;
                                margin: 0 !important;
                                padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px)) !important;
                            }
                            /* Скролл категорий без полосы прокрутки */
                            html.android-app .category-pills::-webkit-scrollbar { display: none !important; }
                        `;
                    })();
                """.trimIndent(), null)
            }

            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.scheme == "file" || uri.host == "app.sakura.cinema") {
                    false
                } else {
                    startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden()
                    return
                }
                fullscreenView = view
                fullscreenCallback = callback
                addContentView(view, FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                ))
                // Полный иммерсивный режим для видео
                insetsController.hide(WindowInsetsCompat.Type.systemBars())
                insetsController.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }

            override fun onHideCustomView() {
                fullscreenView?.let { v ->
                    (v.parent as? ViewGroup)?.removeView(v)
                }
                fullscreenView = null
                fullscreenCallback?.onCustomViewHidden()
                fullscreenCallback = null
                insetsController.show(WindowInsetsCompat.Type.systemBars())
            }
        }

        webView.loadUrl("file:///android_asset/index.html")

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    fullscreenView != null -> webView.webChromeClient?.onHideCustomView()
                    webView.canGoBack()   -> webView.goBack()
                    else                  -> finish()
                }
            }
        })
    }

    override fun onDestroy() {
        webView.destroy()
        super.onDestroy()
    }
}
