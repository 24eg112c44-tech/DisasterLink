package com.disasterlink

import androidx.room.Dao
import androidx.room.Database
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

private val MIGRATION_1_2 = object : Migration(1, 2) {
    override fun migrate(db: SupportSQLiteDatabase) { db.execSQL("ALTER TABLE sos_reports ADD COLUMN hopCount INTEGER NOT NULL DEFAULT 0") }
}

@Dao
interface ReportDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insert(report: SOSReport): Long
    @Query("SELECT * FROM sos_reports WHERE synced = 0 ORDER BY createdAt ASC") suspend fun pending(): List<SOSReport>
    @Query("SELECT * FROM sos_reports WHERE synced = 0 AND hopCount < 3 ORDER BY createdAt ASC LIMIT 50") suspend fun pendingForRelay(): List<SOSReport>
    @Query("SELECT * FROM sos_reports ORDER BY createdAt DESC LIMIT 100") suspend fun recent(): List<SOSReport>
    @Query("UPDATE sos_reports SET synced = 1, deliveryStatus = 'Synced' WHERE reportId = :reportId") suspend fun markSynced(reportId: String)
    @Query("UPDATE sos_reports SET deliveryStatus = 'Relayed' WHERE reportId IN (:reportIds)") suspend fun markRelayed(reportIds: List<String>)
}

@Database(entities = [SOSReport::class], version = 2, exportSchema = true)
abstract class LocalDatabase : RoomDatabase() {
    abstract fun reports(): ReportDao
    companion object {
        @Volatile private var instance: LocalDatabase? = null
        fun get(context: android.content.Context): LocalDatabase = instance ?: synchronized(this) {
            instance ?: androidx.room.Room.databaseBuilder(context.applicationContext, LocalDatabase::class.java, "disasterlink.db")
                .addMigrations(MIGRATION_1_2).build().also { instance = it }
        }
    }
}
