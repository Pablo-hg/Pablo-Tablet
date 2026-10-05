package com.pablohorcajada.tablet;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteOpenHelper;

final class PabloTabletDatabase extends SQLiteOpenHelper {
    static final String DASHBOARD_KEY = "dashboard-state";
    private static final String DATABASE_NAME = "pablo_tablet.db";
    private static final int DATABASE_VERSION = 2;
    private static PabloTabletDatabase instance;

    static synchronized PabloTabletDatabase get(Context context) {
        if (instance == null) instance = new PabloTabletDatabase(context.getApplicationContext());
        return instance;
    }

    private PabloTabletDatabase(Context context) {
        super(context, DATABASE_NAME, null, DATABASE_VERSION);
    }

    @Override
    public void onCreate(SQLiteDatabase database) {
        createStorageTable(database);
        createMobileAdminTables(database);
    }

    @Override
    public void onUpgrade(SQLiteDatabase database, int oldVersion, int newVersion) {
        if (oldVersion < 2) createMobileAdminTables(database);
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

    static final class StorageRecord {
        final String value;
        final Long updatedAt;

        StorageRecord(String value, Long updatedAt) {
            this.value = value;
            this.updatedAt = updatedAt;
        }
    }
}
