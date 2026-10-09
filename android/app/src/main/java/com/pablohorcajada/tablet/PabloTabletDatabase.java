package com.pablohorcajada.tablet;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

final class PabloTabletDatabase extends SQLiteOpenHelper {
    static final String DASHBOARD_KEY = "dashboard-state";
    private static final String DATABASE_NAME = "pablo_tablet.db";
    private static final int DATABASE_VERSION = 4;
    private static PabloTabletDatabase instance;

    static synchronized PabloTabletDatabase get(Context context) {
        if (instance == null) instance = new PabloTabletDatabase(context.getApplicationContext());
        return instance;
    }

    private PabloTabletDatabase(Context context) {
        this(context, DATABASE_NAME);
    }

    PabloTabletDatabase(Context context, String databaseName) {
        super(context, databaseName, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase database) {
        createStorageTable(database);
        createMobileAdminTables(database);
        createFeedbackTables(database);
    }

    @Override
    public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
        if (oldVersion < 2) createMobileAdminTables(database);
        if (oldVersion < 3) createFeedbackTables(database);
        if (oldVersion >= 3 && oldVersion < 4) addFeedbackTrackingColumns(database);
    }

    StorageRecord readStorage(String key) {
        try (Cursor cursor = getReadableDatabase().query(
            "app_storage",
            new String[] { "value", "updated_at" },
            "storage_key = ?",
            new String[] { key },
            null,
            null,
            null,
            "1"
        )) {
            if (!cursor.moveToFirst()) return new StorageRecord(null, null);
            return new StorageRecord(cursor.getString(0), cursor.getLong(1));
        }
    }

    long writeStorage(String key, String value) {
        long updatedAt = System.currentTimeMillis();
        ContentValues row = new ContentValues();
        row.put("storage_key", key);
        row.put("value", value);
        row.put("updated_at", updatedAt);
        getWritableDatabase().insertWithOnConflict("app_storage", null, row, SQLiteDatabase.CONFLICT_REPLACE);
        return updatedAt;
    }

    void removeStorage(String key) {
        getWritableDatabase().delete("app_storage", "storage_key = ?", new String[] { key });
    }

    private static void createStorageTable(SQLiteDatabase database) {
        database.execSQL(
            "CREATE TABLE IF NOT EXISTS app_storage (" +
                "storage_key TEXT PRIMARY KEY NOT NULL," +
                "value TEXT NOT NULL," +
                "updated_at INTEGER NOT NULL" +
            ")"
        );
    }

    private static void createMobileAdminTables(SQLiteDatabase database) {
        database.execSQL(
            "CREATE TABLE IF NOT EXISTS mobile_devices (" +
                "device_id TEXT PRIMARY KEY NOT NULL," +
                "name TEXT NOT NULL," +
                "user_agent TEXT NOT NULL," +
                "token_hash TEXT UNIQUE NOT NULL," +
                "created_at INTEGER NOT NULL," +
                "last_seen_at INTEGER NOT NULL," +
                "revoked_at INTEGER" +
            ")"
        );
        database.execSQL(
            "CREATE TABLE IF NOT EXISTS pairing_sessions (" +
                "session_id TEXT PRIMARY KEY NOT NULL," +
                "token_hash TEXT UNIQUE NOT NULL," +
                "created_at INTEGER NOT NULL," +
                "expires_at INTEGER NOT NULL," +
                "consumed_at INTEGER" +
            ")"
        );
        database.execSQL(
            "CREATE TABLE IF NOT EXISTS pairing_requests (" +
                "request_id TEXT PRIMARY KEY NOT NULL," +
                "session_id TEXT NOT NULL," +
                "device_name TEXT NOT NULL," +
                "user_agent TEXT NOT NULL," +
                "status TEXT NOT NULL," +
                "created_at INTEGER NOT NULL," +
                "expires_at INTEGER NOT NULL," +
                "decided_at INTEGER," +
                "issued_token TEXT," +
                "FOREIGN KEY(session_id) REFERENCES pairing_sessions(session_id)" +
            ")"
        );
        database.execSQL("CREATE INDEX IF NOT EXISTS idx_pairing_requests_status ON pairing_requests(status, expires_at)");
        database.execSQL("CREATE INDEX IF NOT EXISTS idx_mobile_devices_token ON mobile_devices(token_hash, revoked_at)");
    }

    private static void createFeedbackTables(SQLiteDatabase database) {
        database.execSQL(
            "CREATE TABLE IF NOT EXISTS feedback_reports (" +
                "feedback_id TEXT PRIMARY KEY NOT NULL," +
                "source_device_id TEXT NOT NULL," +
                "source_device_name TEXT NOT NULL," +
                "type TEXT NOT NULL," +
                "title TEXT NOT NULL," +
                "area TEXT NOT NULL," +
                "description TEXT NOT NULL," +
                "steps TEXT NOT NULL," +
                "actual_result TEXT NOT NULL," +
                "expected_result TEXT NOT NULL," +
                "priority TEXT NOT NULL," +
                "app_version TEXT NOT NULL," +
                "tablet_model TEXT NOT NULL," +
                "created_at INTEGER NOT NULL," +
                "status TEXT NOT NULL," +
                "attempts INTEGER NOT NULL DEFAULT 0," +
                "last_error TEXT," +
                "github_issue_number INTEGER," +
                "github_issue_url TEXT," +
                "target_version TEXT," +
                "status_updated_at INTEGER NOT NULL," +
                "markdown TEXT NOT NULL," +
                "FOREIGN KEY(source_device_id) REFERENCES mobile_devices(device_id)" +
            ")"
        );
        database.execSQL("CREATE INDEX IF NOT EXISTS idx_feedback_device_created ON feedback_reports(source_device_id, created_at DESC)");
        database.execSQL("CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_reports(status, created_at)");
    }

    private static void addFeedbackTrackingColumns(SQLiteDatabase database) {
        database.execSQL("ALTER TABLE feedback_reports ADD COLUMN target_version TEXT");
        database.execSQL("ALTER TABLE feedback_reports ADD COLUMN status_updated_at INTEGER NOT NULL DEFAULT 0");
        database.execSQL("UPDATE feedback_reports SET status_updated_at = created_at WHERE status_updated_at = 0");
    }

    static final class StorageRecord {
        final String value;
        final Long updatedAt;

        StorageRecord(String value, Long updatedAt) {
            this.value = value;
            this.updatedAt = updatedAt;
        }
    }
}
