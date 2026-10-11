package com.disasterlink

import android.Manifest
import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.wifi.p2p.WifiP2pConfig
import android.net.wifi.p2p.WifiP2pDevice
import android.net.wifi.p2p.WifiP2pDeviceList
import android.net.wifi.p2p.WifiP2pInfo
import android.net.wifi.p2p.WifiP2pManager
import android.os.Build
import android.os.Looper
import androidx.core.content.ContextCompat
import kotlinx.coroutines.runBlocking
import org.json.JSONArray
import org.json.JSONObject
import java.io.DataInputStream
import java.io.DataOutputStream
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.time.Instant
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

/** First-version, user-initiated Wi-Fi Direct store-and-forward. It is not a guaranteed mesh. */
class NearbyConnection(
    private val activity: Activity,
    private val database: LocalDatabase,
    private val onStatus: (String) -> Unit,
    private val onPeers: (List<WifiP2pDevice>) -> Unit,
) {
    private val manager = activity.getSystemService(Context.WIFI_P2P_SERVICE) as WifiP2pManager
    private val channel = manager.initialize(activity, Looper.getMainLooper(), null)
    private val io = Executors.newCachedThreadPool()
    private val serverRunning = AtomicBoolean(false)
    private val clientTransferRunning = AtomicBoolean(false)
    private var registered = false

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            when (intent?.action) {
                WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION -> {
                    val enabled = intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE, -1) == WifiP2pManager.WIFI_P2P_STATE_ENABLED
                    onStatus(if (enabled) "Wi-Fi Direct is available. Search for nearby DisasterLink phones." else "Turn on Wi-Fi to use nearby transfer.")
                }
                WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION -> if (hasPermission()) manager.requestPeers(channel) { list: WifiP2pDeviceList -> onPeers(list.deviceList.toList()) }
                WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION -> {
                    if (hasPermission()) manager.requestConnectionInfo(channel) { info: WifiP2pInfo -> onConnection(info) }
                }
            }
        }
    }

    fun register() {
        if (registered) return
        val filter = IntentFilter().apply {
            addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION)
            addAction(WifiP2pManager.WIFI_P2P_THIS_DEVICE_CHANGED_ACTION)
        }
        if (Build.VERSION.SDK_INT >= 33) activity.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        else activity.registerReceiver(receiver, filter)
        registered = true
    }

    fun discover() {
        if (!hasPermission()) { onStatus("Allow Nearby devices permission before searching."); return }
        register(); onStatus("Searching for compatible phones…")
        manager.discoverPeers(channel, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { onStatus("Search started. Keep both DisasterLink screens open.") }
            override fun onFailure(reason: Int) { onStatus("Could not search (code $reason). Check Wi-Fi and Nearby devices permission.") }
        })
    }

    fun connect(device: WifiP2pDevice) {
        if (!hasPermission()) { onStatus("Allow Nearby devices permission before connecting."); return }
        val config = WifiP2pConfig().apply { deviceAddress = device.deviceAddress }
        onStatus("Connecting to ${device.deviceName}…")
        manager.connect(channel, config, object : WifiP2pManager.ActionListener {
            override fun onSuccess() { onStatus("Connection request sent to ${device.deviceName}.") }
            override fun onFailure(reason: Int) { onStatus("Connection failed (code $reason). Try again on both phones.") }
        })
    }

    private fun onConnection(info: WifiP2pInfo) {
        if (!info.groupFormed) { onStatus("Not connected to a nearby phone."); return }
        if (info.isGroupOwner) startServer() else sendPending(info.groupOwnerAddress.hostAddress ?: return)
    }

    private fun startServer() {
        if (!serverRunning.compareAndSet(false, true)) return
        onStatus("Phone connected. Waiting on the Wi-Fi Direct link...")
        io.execute {
            try {
                ServerSocket(PORT).use { server ->
                    server.soTimeout = SOCKET_TIMEOUT
                    server.accept().use { socket ->
                        socket.soTimeout = SOCKET_TIMEOUT
                        val input = DataInputStream(socket.getInputStream())
                        val length = input.readInt()
                        require(length in 1..MAX_PACKET) { "Transfer is too large." }
                        val bytes = ByteArray(length); input.readFully(bytes)
                        val items = JSONArray(String(bytes, Charsets.UTF_8))
                        val accepted = JSONArray()
                        runBlocking {
                            val dao = database.reports()
                            for (i in 0 until minOf(items.length(), MAX_REPORTS)) {
                                val item = items.optJSONObject(i) ?: continue
                                val relayed = validatedRelay(item) ?: continue
                                dao.insert(relayed)
                                accepted.put(relayed.reportId)
                            }
                        }
                        val ack = JSONObject().put("acceptedIds", accepted).toString().toByteArray()
                        DataOutputStream(socket.getOutputStream()).apply { writeInt(ack.size); write(ack); flush() }
                        activity.runOnUiThread { onStatus("Nearby transfer received ${accepted.length()} report(s). They are stored locally; responders have not been notified.") }
                    }
                }
            } catch (e: Exception) { activity.runOnUiThread { onStatus("Nearby transfer did not complete: ${e.message ?: "connection ended"}.") } }
            finally { serverRunning.set(false) }
        }
    }

    private fun sendPending(address: String) {
        if (!clientTransferRunning.compareAndSet(false, true)) return
        onStatus("Connected. Preparing reports for relay…")
        io.execute {
            try {
                val pending = runBlocking { database.reports().pendingForRelay() }
                if (pending.isEmpty()) { activity.runOnUiThread { onStatus("Connected. No eligible reports to relay.") }; return@execute }
                val records = JSONArray()
                pending.forEach { r -> records.put(JSONObject().put("reportId", r.reportId).put("message", r.message)
                    .put("category", r.category).put("peopleCount", r.peopleCount).put("location", r.location)
                    .put("latitude", r.latitude ?: JSONObject.NULL).put("longitude", r.longitude ?: JSONObject.NULL)
                    .put("createdAt", Instant.ofEpochMilli(r.createdAt).toString()).put("hopCount", r.hopCount + 1)) }
                val payload = records.toString().toByteArray()
                require(payload.size <= MAX_PACKET) { "Too much data to relay in one transfer." }
                var lastError: Exception? = null
                for (attempt in 1..3) {
                    try {
                        Socket().use { socket ->
                            socket.connect(InetSocketAddress(address, PORT), SOCKET_TIMEOUT); socket.soTimeout = SOCKET_TIMEOUT
                            DataOutputStream(socket.getOutputStream()).apply { writeInt(payload.size); write(payload); flush() }
                            val input = DataInputStream(socket.getInputStream()); val length = input.readInt()
                            require(length in 1..MAX_PACKET) { "Invalid receiver response." }
                            val response = JSONObject(String(ByteArray(length).also { input.readFully(it) }, Charsets.UTF_8))
                            val ids = response.optJSONArray("acceptedIds") ?: JSONArray()
                            val accepted = (0 until ids.length()).map { ids.getString(it) }
                            if (accepted.isNotEmpty()) runBlocking { database.reports().markRelayed(accepted) }
                            activity.runOnUiThread { onStatus("Nearby relay accepted ${accepted.size} report(s). They remain queued to sync with the server.") }
                            return@execute
                        }
                    } catch (e: Exception) { lastError = e; Thread.sleep(700L * attempt) }
                }
                throw lastError ?: IllegalStateException("Transfer failed.")
            } catch (e: Exception) { activity.runOnUiThread { onStatus("Nearby transfer failed: ${e.message ?: "connection ended"}.") } }
            finally { clientTransferRunning.set(false) }
        }
    }

    private fun validatedRelay(item: JSONObject): SOSReport? {
        val id = item.optString("reportId"); val message = item.optString("message")
        val count = item.optInt("peopleCount", 1); val hop = item.optInt("hopCount", 1)
        if (id.isBlank() || id.length > 100 || message.isBlank() || message.length > 2000 || count !in 1..10000 || hop !in 1..3) return null
        val hasLat = item.has("latitude") && !item.isNull("latitude"); val hasLon = item.has("longitude") && !item.isNull("longitude")
        if (hasLat != hasLon) return null
        val lat = if (hasLat) item.optDouble("latitude", Double.NaN) else null
        val lon = if (hasLon) item.optDouble("longitude", Double.NaN) else null
        if (lat != null && (!lat.isFinite() || lat !in -90.0..90.0 || lon == null || !lon.isFinite() || lon !in -180.0..180.0)) return null
        val created = runCatching { Instant.parse(item.getString("createdAt")).toEpochMilli() }.getOrNull() ?: return null
        return SOSReport(reportId = id, message = message, category = item.optString("category", "Other").take(80),
            peopleCount = count, location = item.optString("location").take(300), latitude = lat, longitude = lon,
            createdAt = created, deliveryStatus = "Relayed", synced = false, hopCount = hop)
    }

    private fun hasPermission(): Boolean {
        val permission = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.NEARBY_WIFI_DEVICES else Manifest.permission.ACCESS_FINE_LOCATION
        return ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
    }

    fun close() {
        if (hasPermission()) {
            manager.stopPeerDiscovery(channel, null)
            manager.removeGroup(channel, null)
        }
        if (registered) runCatching { activity.unregisterReceiver(receiver) }
        registered = false; io.shutdownNow()
    }

    companion object { private const val PORT = 8988; private const val MAX_PACKET = 128 * 1024; private const val MAX_REPORTS = 50; private const val SOCKET_TIMEOUT = 20_000 }
}
