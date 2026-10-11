package com.disasterlink

import androidx.room.Entity
import androidx.room.ColumnInfo
import androidx.room.PrimaryKey
import java.util.UUID

@Entity(tableName = "sos_reports")
data class SOSReport(
    @PrimaryKey val reportId: String = UUID.randomUUID().toString(),
    val message: String,
    val category: String,
    val peopleCount: Int,
    val location: String,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val createdAt: Long = System.currentTimeMillis(),
    val deliveryStatus: String = "Local",
    val synced: Boolean = false,
    @ColumnInfo(defaultValue = "0") val hopCount: Int = 0,
)

class SOSManager(private val database: LocalDatabase) {
    suspend fun save(report: SOSReport) = database.reports().insert(report)
    suspend fun pending() = database.reports().pending()
}
