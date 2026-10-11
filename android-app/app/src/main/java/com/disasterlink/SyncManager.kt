package com.disasterlink

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class SyncManager {
    fun enqueue(context: Context) {
        val request = OneTimeWorkRequestBuilder<ReportSyncWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
        WorkManager.getInstance(context).enqueueUniqueWork("disasterlink-sync", ExistingWorkPolicy.APPEND_OR_REPLACE, request)
    }
}

class ReportSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {
    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val dao = LocalDatabase.get(applicationContext).reports()
        val pending = dao.pending()
        if (pending.isEmpty()) return@withContext Result.success()
        try {
            val reports = JSONArray()
            pending.forEach { r ->
                reports.put(JSONObject().put("reportId", r.reportId).put("message", r.message).put("category", r.category)
                    .put("peopleCount", r.peopleCount).put("location", r.location)
                    .put("latitude", r.latitude ?: JSONObject.NULL).put("longitude", r.longitude ?: JSONObject.NULL)
                    .put("deliveryStatus", if (r.deliveryStatus == "Relayed") "Relayed" else "Local")
                    .put("receivedVia", if (r.hopCount > 0) "Nearby" else "Internet")
                    .put("hopCount", r.hopCount).put("createdAt", java.time.Instant.ofEpochMilli(r.createdAt).toString()))
            }
            val connection = (URL("${BuildConfig.API_URL}/sos/sync").openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"; connectTimeout = 8000; readTimeout = 12000; doOutput = true
                setRequestProperty("Content-Type", "application/json")
            }
            connection.outputStream.use { it.write(JSONObject().put("reports", reports).toString().toByteArray()) }
            if (connection.responseCode !in 200..299) return@withContext Result.retry()
            val response = JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
            val results = response.optJSONArray("results") ?: return@withContext Result.retry()
            for (index in 0 until results.length()) {
                val item = results.optJSONObject(index) ?: continue
                if (item.optBoolean("ok")) dao.markSynced(item.optString("reportId"))
            }
            if (dao.pending().isEmpty()) Result.success() else Result.retry()
        } catch (_: Exception) { Result.retry() }
    }
}
