package com.disasterlink

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.p2p.WifiP2pDevice
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import kotlinx.coroutines.runBlocking
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

/**
 * DisasterLink Mobile Client
 * Supports all 6 required screens:
 * 1. Home Screen
 * 2. Send SOS Screen
 * 3. Emergency Report History
 * 4. Nearby-Device Communication (Wi-Fi Direct Store-and-Forward)
 * 5. Connectivity & Sync Status
 * 6. About & Safety Information
 */
class MainActivity : Activity() {

    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private lateinit var database: LocalDatabase
    private var nearbyConnection: NearbyConnection? = null

    // Root Containers
    private lateinit var rootContainer: LinearLayout
    private lateinit var screenContainer: LinearLayout
    private val tabButtons = mutableListOf<Button>()

    // Screen State: 0=Home, 1=Send SOS, 2=History, 3=Nearby, 4=Sync, 5=About
    private var currentScreenIndex = 0

    // Form inputs for Send SOS Screen
    private var inputMessage: EditText? = null
    private var inputCategory: EditText? = null
    private var inputCount: EditText? = null
    private var inputLocation: EditText? = null
    private var inputLatitude: EditText? = null
    private var inputLongitude: EditText? = null
    private var textFormResult: TextView? = null

    // Nearby Screen elements
    private var textNearbyStatus: TextView? = null
    private var peersListContainer: LinearLayout? = null

    // Sync Screen elements
    private var textSyncState: TextView? = null

    // History Screen elements
    private var historyContainer: LinearLayout? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        database = LocalDatabase.get(this)

        rootContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#070F1E"))
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        // 1. Top App Header
        val header = createHeaderView()
        rootContainer.addView(header)

        // 2. Navigation Tab Bar (6 Screens)
        val tabScroll = HorizontalScrollView(this).apply {
            isHorizontalScrollBarEnabled = false
            setBackgroundColor(Color.parseColor("#0C1728"))
        }
        val tabRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(12, 10, 12, 10)
        }

        val screenTitles = listOf(
            "🏠 Home",
            "🚨 Send SOS",
            "📋 History",
            "📡 Nearby Relay",
            "🔄 Sync Status",
            "ℹ️ Safety Info"
        )

        screenTitles.forEachIndexed { index, title ->
            val btn = Button(this).apply {
                text = title
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setPadding(28, 14, 28, 14)
                setOnClickListener { switchScreen(index) }
            }
            tabButtons.add(btn)
            tabRow.addView(btn)
        }
        tabScroll.addView(tabRow)
        rootContainer.addView(tabScroll)

        // 3. Dynamic Screen Content Container
        screenContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        rootContainer.addView(screenContainer)

        setContentView(rootContainer)

        // Initialize Nearby Wi-Fi Direct Manager if supported
        if (packageManager.hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT)) {
            nearbyConnection = NearbyConnection(
                this,
                database,
                { statusText ->
                    mainHandler.post { textNearbyStatus?.text = statusText }
                },
                { foundPeers ->
                    mainHandler.post { updatePeersList(foundPeers) }
                }
            )
        }

        // Open Home screen initially
        switchScreen(0)
    }

    private fun createHeaderView(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(24, 28, 24, 20)
            setBackgroundColor(Color.parseColor("#0C182A"))
            gravity = Gravity.CENTER_VERTICAL

            val icon = TextView(this@MainActivity).apply {
                text = "DL"
                textSize = 16f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
                gravity = Gravity.CENTER
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#0284C7"))
                    cornerRadius = 14f
                }
                layoutParams = LinearLayout.LayoutParams(80, 80).apply { setMargins(0, 0, 20, 0) }
            }
            addView(icon)

            val titleCol = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.VERTICAL
                val title = TextView(this@MainActivity).apply {
                    text = "DisasterLink"
                    textSize = 20f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.WHITE)
                }
                val sub = TextView(this@MainActivity).apply {
                    text = "Flood Emergency Response · Offline Mesh Ready"
                    textSize = 11f
                    setTextColor(Color.parseColor("#94A3B8"))
                }
                addView(title)
                addView(sub)
            }
            addView(titleCol)
        }
    }

    private fun switchScreen(index: Int) {
        currentScreenIndex = index

        // Update tab styles
        tabButtons.forEachIndexed { i, btn ->
            if (i == index) {
                btn.setTextColor(Color.WHITE)
                btn.background = GradientDrawable().apply {
                    setColor(Color.parseColor("#0284C7"))
                    cornerRadius = 18f
                }
            } else {
                btn.setTextColor(Color.parseColor("#94A3B8"))
                btn.background = GradientDrawable().apply {
                    setColor(Color.parseColor("#132238"))
                    cornerRadius = 18f
                }
            }
        }

        screenContainer.removeAllViews()

        val screenContent: View = when (index) {
            0 -> buildHomeScreen()
            1 -> buildSendSOSScreen()
            2 -> buildHistoryScreen()
            3 -> buildNearbyScreen()
            4 -> buildSyncScreen()
            5 -> buildAboutScreen()
            else -> buildHomeScreen()
        }

        val scroll = ScrollView(this).apply {
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
            addView(screenContent)
        }
        screenContainer.addView(scroll)
    }

    // ==========================================
    // SCREEN 1: HOME SCREEN
    // ==========================================
    private fun buildHomeScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 40)
        }

        // Alert Disclaimer Banner
        val alert = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(22, 18, 22, 18)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1B1A28"))
                setStroke(2, Color.parseColor("#FF5267"))
                cornerRadius = 16f
            }
            val title = TextView(this@MainActivity).apply {
                text = "⚠️ EMERGENCY PROTOTYPE DISCLAIMER"
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#FF5267"))
            }
            val desc = TextView(this@MainActivity).apply {
                text = "Reports saved on this phone are NOT confirmed received by rescue teams until server sync completes. In life-threatening emergencies, dial 112 or 911 when cellular voice is available."
                textSize = 12f
                setTextColor(Color.parseColor("#E2E8F0"))
                setPadding(0, 6, 0, 0)
                setLineSpacing(4f, 1.1f)
            }
            addView(title)
            addView(desc)
        }
        root.addView(alert)

        // Huge Emergency SOS Button
        val bigSOS = Button(this).apply {
            text = "🚨 SEND EMERGENCY SOS"
            textSize = 18f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#E11D48"))
                cornerRadius = 20f
            }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 150).apply {
                setMargins(0, 28, 0, 24)
            }
            setOnClickListener { switchScreen(1) }
        }
        root.addView(bigSOS)

        // Quick Stats Cards
        val statsTitle = TextView(this).apply {
            text = "Local Device Status"
            textSize = 15f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            setPadding(0, 0, 0, 14)
        }
        root.addView(statsTitle)

        val statsCol = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }

        executor.execute {
            val pendingList = runBlocking { database.reports().pending() }
            val recentList = runBlocking { database.reports().recent() }
            val isOnline = isNetworkConnected()

            mainHandler.post {
                statsCol.removeAllViews()
                statsCol.addView(createMetricRow("Internet Connection", if (isOnline) "🟢 ONLINE" else "🔴 OFFLINE / DISCONNECTED"))
                statsCol.addView(createMetricRow("Total Local Reports", "${recentList.size} stored on device"))
                statsCol.addView(createMetricRow("Pending Server Upload", "${pendingList.size} reports awaiting sync"))
                statsCol.addView(createMetricRow("Wi-Fi Direct Relay", if (nearbyConnection != null) "Ready for Store & Forward" else "Not supported"))
            }
        }
        root.addView(statsCol)

        // Navigation Quick Action Buttons
        val quickActions = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 20, 0, 0)
            val btnHist = createActionButton("📋 View Saved Reports History") { switchScreen(2) }
            val btnRelay = createActionButton("📡 Connect to Nearby Phone via Wi-Fi Direct") { switchScreen(3) }
            val btnSync = createActionButton("🔄 Check Sync & Network Status") { switchScreen(4) }
            addView(btnHist)
            addView(btnRelay)
            addView(btnSync)
        }
        root.addView(quickActions)

        return root
    }

    // ==========================================
    // SCREEN 2: SEND SOS SCREEN
    // ==========================================
    private fun buildSendSOSScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 40)
        }

        val title = TextView(this).apply {
            text = "File Flood Emergency Report"
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        }
        val subtitle = TextView(this).apply {
            text = "Report is stored locally on this phone first. It will sync automatically when network returns or when relayed to a nearby phone."
            textSize = 12f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 4, 0, 20)
        }
        root.addView(title)
        root.addView(subtitle)

        inputMessage = createInputField("What emergency assistance is needed? * (Required)", true)
        inputCategory = createInputField("Category (Flooding, Medical, Trapped, Other)").apply { setText("Flooding") }
        inputCount = createInputField("Number of people in danger *").apply { setText("1") }
        inputLocation = createInputField("Landmark or location description (e.g. 2nd floor, Main Rd)")

        root.addView(inputMessage)
        root.addView(inputCategory)
        root.addView(inputCount)
        root.addView(inputLocation)

        // GPS Capture Section
        val gpsRow = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 10, 0, 14)
            val gpsDesc = TextView(this@MainActivity).apply {
                text = "GPS Coordinates (Optional - reports can be saved without GPS):"
                textSize = 12f
                setTextColor(Color.parseColor("#94A3B8"))
                setPadding(0, 0, 0, 8)
            }
            val btnGps = Button(this@MainActivity).apply {
                text = "📍 CAPTURE CURRENT GPS COORDINATES"
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#0369A1"))
                    cornerRadius = 14f
                }
                setPadding(20, 16, 20, 16)
                setOnClickListener { requestLocationPermission() }
            }
            addView(gpsDesc)
            addView(btnGps)
        }
        root.addView(gpsRow)

        val coordsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            inputLatitude = createInputField("Latitude (-90 to 90)").apply {
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { setMargins(0, 0, 10, 0) }
            }
            inputLongitude = createInputField("Longitude (-180 to 180)").apply {
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply { setMargins(10, 0, 0, 0) }
            }
            addView(inputLatitude)
            addView(inputLongitude)
        }
        root.addView(coordsRow)

        textFormResult = TextView(this).apply {
            textSize = 13f
            setPadding(0, 12, 0, 12)
        }
        root.addView(textFormResult)

        // Submit Button
        val btnSubmit = Button(this).apply {
            text = "🚨 SAVE SOS ON THIS DEVICE"
            textSize = 16f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#E11D48"))
                cornerRadius = 16f
            }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 130).apply {
                setMargins(0, 14, 0, 14)
            }
            setOnClickListener { handleSaveSOS() }
        }
        root.addView(btnSubmit)

        return root
    }

    // ==========================================
    // SCREEN 3: EMERGENCY REPORT HISTORY
    // ==========================================
    private fun buildHistoryScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 40)
        }

        val topRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            val title = TextView(this@MainActivity).apply {
                text = "Stored SOS Reports"
                textSize = 20f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            val btnRefresh = Button(this@MainActivity).apply {
                text = "↻ Refresh"
                textSize = 11f
                setTextColor(Color.WHITE)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#1E293B"))
                    cornerRadius = 12f
                }
                setOnClickListener { loadReportHistory() }
            }
            addView(title)
            addView(btnRefresh)
        }
        root.addView(topRow)

        val sub = TextView(this).apply {
            text = "Reports saved in Room database on this device. Displays transmission state and hop count."
            textSize = 12f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 4, 0, 16)
        }
        root.addView(sub)

        historyContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        root.addView(historyContainer)

        loadReportHistory()
        return root
    }

    private fun loadReportHistory() {
        val container = historyContainer ?: return
        container.removeAllViews()

        val loading = TextView(this).apply {
            text = "Loading saved reports from local database…"
            textSize = 13f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 20, 0, 20)
        }
        container.addView(loading)

        executor.execute {
            val list = runBlocking { database.reports().recent() }
            val dateFormat = SimpleDateFormat("MMM dd, yyyy HH:mm", Locale.getDefault())

            mainHandler.post {
                container.removeAllViews()
                if (list.isEmpty()) {
                    val empty = TextView(this@MainActivity).apply {
                        text = "No emergency reports have been filed on this phone yet."
                        textSize = 14f
                        setTextColor(Color.parseColor("#64748B"))
                        setPadding(0, 24, 0, 24)
                    }
                    container.addView(empty)
                    return@post
                }

                list.forEach { r ->
                    val card = LinearLayout(this@MainActivity).apply {
                        orientation = LinearLayout.VERTICAL
                        setPadding(20, 18, 20, 18)
                        background = GradientDrawable().apply {
                            setColor(Color.parseColor("#0E1A2D"))
                            setStroke(1, Color.parseColor("#1E3250"))
                            cornerRadius = 14f
                        }
                        layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                            setMargins(0, 0, 0, 16)
                        }

                        val header = LinearLayout(this@MainActivity).apply {
                            orientation = LinearLayout.HORIZONTAL
                            val cat = TextView(this@MainActivity).apply {
                                text = "${r.category} · ${r.peopleCount} ${if (r.peopleCount == 1) "person" else "people"}"
                                textSize = 13f
                                typeface = Typeface.DEFAULT_BOLD
                                setTextColor(Color.parseColor("#38BDF8"))
                                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                            }
                            val badge = TextView(this@MainActivity).apply {
                                text = if (r.synced) "✓ SYNCED" else "⏳ LOCAL PENDING"
                                textSize = 10f
                                typeface = Typeface.DEFAULT_BOLD
                                setTextColor(if (r.synced) Color.parseColor("#34D399") else Color.parseColor("#FFAA00"))
                                background = GradientDrawable().apply {
                                    setColor(if (r.synced) Color.parseColor("#13362B") else Color.parseColor("#362D14"))
                                    cornerRadius = 8f
                                }
                                setPadding(12, 6, 12, 6)
                            }
                            addView(cat)
                            addView(badge)
                        }
                        addView(header)

                        val msg = TextView(this@MainActivity).apply {
                            text = r.message
                            textSize = 13f
                            setTextColor(Color.parseColor("#E2E8F0"))
                            setPadding(0, 10, 0, 8)
                            setLineSpacing(3f, 1.1f)
                        }
                        addView(msg)

                        val loc = TextView(this@MainActivity).apply {
                            text = if (r.location.isNotBlank()) "📍 ${r.location}" else if (r.latitude != null) "📍 ${r.latitude}, ${r.longitude}" else "📍 Location not specified"
                            textSize = 11f
                            setTextColor(Color.parseColor("#94A3B8"))
                        }
                        addView(loc)

                        val meta = TextView(this@MainActivity).apply {
                            text = "Created: ${dateFormat.format(Date(r.createdAt))} · Hops: ${r.hopCount} · Delivery: ${r.deliveryStatus}"
                            textSize = 10f
                            setTextColor(Color.parseColor("#64748B"))
                            setPadding(0, 6, 0, 0)
                        }
                        addView(meta)
                    }
                    container.addView(card)
                }
            }
        }
    }

    // ==========================================
    // SCREEN 4: NEARBY COMMUNICATION (WI-FI DIRECT)
    // ==========================================
    private fun buildNearbyScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 40)
        }

        val title = TextView(this).apply {
            text = "Offline Phone-to-Phone Relay"
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        }
        val sub = TextView(this).apply {
            text = "Uses Wi-Fi Direct store-and-forward to transfer reports to compatible nearby Android phones without internet. When any relay device reconnects, reports sync to central rescue server."
            textSize = 12f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 4, 0, 16)
        }
        root.addView(title)
        root.addView(sub)

        // Safety limitation box
        val warn = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(16, 14, 16, 14)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#152033"))
                setStroke(1, Color.parseColor("#253D60"))
                cornerRadius = 12f
            }
            val t = TextView(this@MainActivity).apply {
                text = "Store-and-Forward Rules"
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.parseColor("#38BDF8"))
            }
            val d = TextView(this@MainActivity).apply {
                text = "• Forwarding capped at 3 hops to prevent loops.\n• Reports keep original timestamp and reportId.\n• Relayed reports are stored locally on recipient phone until internet returns."
                textSize = 11f
                setTextColor(Color.parseColor("#CBD5E1"))
                setPadding(0, 6, 0, 0)
                setLineSpacing(3f, 1.15f)
            }
            addView(t)
            addView(d)
        }
        root.addView(warn)

        textNearbyStatus = TextView(this).apply {
            text = "Wi-Fi Direct ready. Ensure Wi-Fi is enabled on both devices."
            textSize = 13f
            setTextColor(Color.parseColor("#FFAA00"))
            setPadding(0, 16, 0, 14)
        }
        root.addView(textNearbyStatus)

        // Search Button
        val btnSearch = Button(this).apply {
            text = "🔍 SEARCH FOR NEARBY DISASTERLINK PHONES"
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0284C7"))
                cornerRadius = 14f
            }
            setPadding(20, 18, 20, 18)
            setOnClickListener { requestNearbyPermission() }
        }
        root.addView(btnSearch)

        val peersLabel = TextView(this).apply {
            text = "Discovered Devices:"
            textSize = 14f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            setPadding(0, 20, 0, 10)
        }
        root.addView(peersLabel)

        peersListContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(TextView(this@MainActivity).apply {
                text = "No devices detected. Tap search to scan for nearby phones running DisasterLink."
                textSize = 12f
                setTextColor(Color.parseColor("#64748B"))
            })
        }
        root.addView(peersListContainer)

        return root
    }

    private fun updatePeersList(found: List<WifiP2pDevice>) {
        val container = peersListContainer ?: return
        container.removeAllViews()

        if (found.isEmpty()) {
            container.addView(TextView(this).apply {
                text = "No compatible devices discovered in this scan. Try scanning from both phones."
                textSize = 12f
                setTextColor(Color.parseColor("#64748B"))
            })
            return
        }

        found.forEach { dev ->
            val row = LinearLayout(this).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(18, 14, 18, 14)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#0E1A2D"))
                    cornerRadius = 12f
                }
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    setMargins(0, 0, 0, 10)
                }

                val info = TextView(this@MainActivity).apply {
                    text = dev.deviceName.ifBlank { "DisasterLink Device" }
                    textSize = 14f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.WHITE)
                    layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
                }
                val btnConnect = Button(this@MainActivity).apply {
                    text = "Connect & Relay"
                    textSize = 11f
                    setTextColor(Color.WHITE)
                    background = GradientDrawable().apply {
                        setColor(Color.parseColor("#0369A1"))
                        cornerRadius = 10f
                    }
                    setOnClickListener { nearbyConnection?.connect(dev) }
                }
                addView(info)
                addView(btnConnect)
            }
            container.addView(row)
        }
    }

    // ==========================================
    // SCREEN 5: CONNECTIVITY & SYNC STATUS
    // ==========================================
    private fun buildSyncScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 40)
        }

        val title = TextView(this).apply {
            text = "Connectivity & Sync Telemetry"
            textSize = 20f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        }
        val sub = TextView(this).apply {
            text = "Monitors central rescue API connection and background WorkManager queue."
            textSize = 12f
            setTextColor(Color.parseColor("#94A3B8"))
            setPadding(0, 4, 0, 20)
        }
        root.addView(title)
        root.addView(sub)

        textSyncState = TextView(this).apply {
            textSize = 13f
            setTextColor(Color.WHITE)
            setLineSpacing(4f, 1.2f)
        }
        root.addView(textSyncState)

        refreshSyncTelemetry()

        // Sync Trigger Button
        val btnSyncNow = Button(this).apply {
            text = "🔄 TRIGGER WORKMANAGER SYNC NOW"
            textSize = 13f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0284C7"))
                cornerRadius = 14f
            }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 120).apply {
                setMargins(0, 20, 0, 14)
            }
            setOnClickListener {
                SyncManager().enqueue(this@MainActivity)
                textSyncState?.text = "WorkManager sync job queued. Attempting connection to API..."
                mainHandler.postDelayed({ refreshSyncTelemetry() }, 2000)
            }
        }
        root.addView(btnSyncNow)

        return root
    }

    private fun refreshSyncTelemetry() {
        executor.execute {
            val pending = runBlocking { database.reports().pending() }
            val isOnline = isNetworkConnected()
            val apiUrl = BuildConfig.API_URL

            mainHandler.post {
                textSyncState?.text = """
                    • Network Connection: ${if (isOnline) "🟢 ONLINE" else "🔴 DISCONNECTED"}
                    • Pending Upload Queue: ${pending.size} report(s)
                    • Configured API Endpoint: $apiUrl
                    • Background Worker: WorkManager (Requires CONNECTED network)
                    • Duplicate Prevention: Idempotent reportId matching
                """.trimIndent()
            }
        }
    }

    // ==========================================
    // SCREEN 6: ABOUT & SAFETY INFORMATION
    // ==========================================
    private fun buildAboutScreen(): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(28, 24, 28, 40)
        }

        val title = TextView(this).apply {
            text = "About DisasterLink"
            textSize = 22f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
        }
        val version = TextView(this).apply {
            text = "Version 1.0.0 · Flood Response Prototype"
            textSize = 12f
            setTextColor(Color.parseColor("#38BDF8"))
            setPadding(0, 4, 0, 20)
        }
        root.addView(title)
        root.addView(version)

        val textSections = listOf(
            "⚠️ Life Safety Priority" to "DisasterLink is a university student research prototype. It is NOT an official or certified emergency service. Saving a report locally or relaying it to a nearby phone DOES NOT prove that government disaster agencies or rescue boats have received your call. Always dial official emergency numbers (911 or 112) when voice cellular networks are available.",
            "📦 Offline Store-and-Forward" to "When internet and cell towers fail during a flood, emergency reports are saved into the device's encrypted Room SQLite database. The app discovers nearby compatible Android phones using Wi-Fi Direct and forwards pending reports without relying on internet. A report can hop up to 3 times between compatible phones.",
            "🔒 Privacy & Data Policy" to "DisasterLink does not require or collect personal names, telephone numbers, or social accounts. Reports identify incidents solely by message description, landmark, and optional coordinates. Location permissions are used exclusively to tag emergency coordinates when explicitly granted by the user.",
            "🌊 Flood Survival Guidance" to "• Do not attempt to walk or drive through flowing floodwaters.\n• Move to upper floors or roof if water levels continue rising.\n• Keep phone battery conserved by dimming brightness and closing background apps.\n• Signal rescuers using a whistle, flashlight, or brightly colored cloth."
        )

        textSections.forEach { (secTitle, secBody) ->
            val card = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(20, 16, 20, 16)
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#0C182A"))
                    setStroke(1, Color.parseColor("#1B304F"))
                    cornerRadius = 14f
                }
                layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                    setMargins(0, 0, 0, 14)
                }

                val h = TextView(this@MainActivity).apply {
                    text = secTitle
                    textSize = 14f
                    typeface = Typeface.DEFAULT_BOLD
                    setTextColor(Color.WHITE)
                }
                val p = TextView(this@MainActivity).apply {
                    text = secBody
                    textSize = 12f
                    setTextColor(Color.parseColor("#CBD5E1"))
                    setPadding(0, 6, 0, 0)
                    setLineSpacing(4f, 1.15f)
                }
                addView(h)
                addView(p)
            }
            root.addView(card)
        }

        return root
    }

    // ==========================================
    // ACTIONS & FORM HANDLERS
    // ==========================================
    private fun handleSaveSOS() {
        val msg = inputMessage?.text?.toString()?.trim().orEmpty()
        val count = inputCount?.text?.toString()?.toIntOrNull()
        val cat = inputCategory?.text?.toString()?.trim()?.ifBlank { "Other" } ?: "Other"
        val loc = inputLocation?.text?.toString()?.trim().orEmpty()
        val latText = inputLatitude?.text?.toString()?.trim().orEmpty()
        val lonText = inputLongitude?.text?.toString()?.trim().orEmpty()

        if (msg.isBlank() || msg.length > 2000) {
            textFormResult?.setTextColor(Color.parseColor("#FF5267"))
            textFormResult?.text = "Please enter an emergency description (up to 2000 characters)."
            return
        }

        if (count == null || count < 1 || count > 10000) {
            textFormResult?.setTextColor(Color.parseColor("#FF5267"))
            textFormResult?.text = "People count must be a number between 1 and 10000."
            return
        }

        val lat = latText.toDoubleOrNull()
        val lon = lonText.toDoubleOrNull()
        val hasLat = latText.isNotBlank()
        val hasLon = lonText.isNotBlank()

        if (hasLat != hasLon) {
            textFormResult?.setTextColor(Color.parseColor("#FF5267"))
            textFormResult?.text = "Latitude and longitude must both be provided together, or leave both empty."
            return
        }

        if (hasLat && hasLon) {
            if (lat == null || lat !in -90.0..90.0 || lon == null || lon !in -180.0..180.0) {
                textFormResult?.setTextColor(Color.parseColor("#FF5267"))
                textFormResult?.text = "Invalid coordinates: Latitude must be -90..90, Longitude -180..180."
                return
            }
        }

        val report = SOSReport(
            message = msg,
            category = cat,
            peopleCount = count,
            location = loc,
            latitude = lat,
            longitude = lon
        )

        textFormResult?.setTextColor(Color.parseColor("#38BDF8"))
        textFormResult?.text = "Saving report locally into device database…"

        executor.execute {
            runBlocking { database.reports().insert(report) }

            mainHandler.post {
                textFormResult?.setTextColor(Color.parseColor("#34D399"))
                textFormResult?.text = "✓ Report saved locally on this phone! Upload will sync when network is restored. Responders have NOT been notified yet."
                inputMessage?.text?.clear()
                SyncManager().enqueue(this@MainActivity)
            }
        }
    }

    // ==========================================
    // LOCATION CAPTURE
    // ==========================================
    private fun requestLocationPermission() {
        val fine = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (fine || coarse) {
            captureLocation()
        } else {
            textFormResult?.setTextColor(Color.parseColor("#FFAA00"))
            textFormResult?.text = "Location permission requested. You can decline and type landmarks manually."
            requestPermissions(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION), REQUEST_LOCATION)
        }
    }

    @Suppress("MissingPermission")
    private fun captureLocation() {
        val manager = getSystemService(LOCATION_SERVICE) as LocationManager
        val provider = when {
            manager.isProviderEnabled(LocationManager.GPS_PROVIDER) -> LocationManager.GPS_PROVIDER
            manager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) -> LocationManager.NETWORK_PROVIDER
            else -> {
                textFormResult?.setTextColor(Color.parseColor("#FF5267"))
                textFormResult?.text = "Device location is disabled. Enter landmark manually."
                return
            }
        }
        textFormResult?.setTextColor(Color.parseColor("#38BDF8"))
        textFormResult?.text = "Acquiring GPS fix…"

        if (Build.VERSION.SDK_INT >= 30) {
            manager.getCurrentLocation(provider, null, mainExecutor) { loc -> applyLocation(loc) }
        } else {
            @Suppress("DEPRECATION")
            manager.requestSingleUpdate(provider, object : LocationListener {
                override fun onLocationChanged(loc: Location) = applyLocation(loc)
                @Deprecated("Deprecated by Android") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) = Unit
                override fun onProviderEnabled(provider: String) = Unit
                override fun onProviderDisabled(provider: String) = Unit
            }, Looper.getMainLooper())
        }
    }

    private fun applyLocation(loc: Location?) {
        if (loc == null) {
            textFormResult?.setTextColor(Color.parseColor("#FFAA00"))
            textFormResult?.text = "Could not obtain GPS fix. You can enter landmark description manually."
            return
        }
        inputLatitude?.setText(loc.latitude.toString())
        inputLongitude?.setText(loc.longitude.toString())
        if (inputLocation?.text.isNullOrBlank()) {
            inputLocation?.setText("Device GPS captured")
        }
        textFormResult?.setTextColor(Color.parseColor("#34D399"))
        textFormResult?.text = "✓ GPS coordinates acquired: ${loc.latitude}, ${loc.longitude}"
    }

    // ==========================================
    // PERMISSIONS CALLBACK
    // ==========================================
    private fun requestNearbyPermission() {
        val required = if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.NEARBY_WIFI_DEVICES)
        else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)

        if (required.all { ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED }) {
            nearbyConnection?.discover() ?: run {
                textNearbyStatus?.text = "Wi-Fi Direct is unavailable on this device."
            }
        } else {
            requestPermissions(required, REQUEST_NEARBY)
        }
    }

    @Deprecated("Android permission callback")
    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val granted = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        when (requestCode) {
            REQUEST_LOCATION -> if (granted) captureLocation() else textFormResult?.text = "Location permission declined. Landmark description can be entered manually."
            REQUEST_NEARBY -> if (granted) nearbyConnection?.discover() else textNearbyStatus?.text = "Nearby device permission declined."
        }
    }

    // ==========================================
    // UTILITY HELPERS
    // ==========================================
    private fun createInputField(hintText: String, multiline: Boolean = false): EditText {
        return EditText(this).apply {
            hint = hintText
            textSize = 14f
            setTextColor(Color.WHITE)
            setHintTextColor(Color.parseColor("#64748B"))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0C182A"))
                setStroke(1, Color.parseColor("#1B304F"))
                cornerRadius = 12f
            }
            setPadding(20, 18, 20, 18)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                setMargins(0, 0, 0, 14)
            }
            if (multiline) {
                minLines = 3
                gravity = Gravity.TOP
                inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE
            }
        }
    }

    private fun createMetricRow(label: String, value: String): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setPadding(16, 12, 16, 12)
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0C1728"))
                cornerRadius = 10f
            }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                setMargins(0, 0, 0, 8)
            }
            val lbl = TextView(this@MainActivity).apply {
                text = label
                textSize = 12f
                setTextColor(Color.parseColor("#94A3B8"))
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            }
            val vl = TextView(this@MainActivity).apply {
                text = value
                textSize = 12f
                typeface = Typeface.DEFAULT_BOLD
                setTextColor(Color.WHITE)
            }
            addView(lbl)
            addView(vl)
        }
    }

    private fun createActionButton(label: String, onClick: () -> Unit): Button {
        return Button(this).apply {
            text = label
            textSize = 12f
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#CBD5E1"))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#102035"))
                setStroke(1, Color.parseColor("#1E3350"))
                cornerRadius = 12f
            }
            setPadding(20, 16, 20, 16)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                setMargins(0, 0, 0, 10)
            }
            setOnClickListener { onClick() }
        }
    }

    private fun isNetworkConnected(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val net = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(net) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    override fun onDestroy() {
        nearbyConnection?.close()
        executor.shutdown()
        super.onDestroy()
    }

    companion object {
        private const val REQUEST_LOCATION = 4101
        private const val REQUEST_NEARBY = 4102
    }
}
