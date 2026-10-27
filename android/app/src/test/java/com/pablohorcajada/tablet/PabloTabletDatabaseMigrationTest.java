package com.pablohorcajada.tablet;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.junit.After;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;

import java.util.UUID;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

@RunWith(RobolectricTestRunner.class)
public class PabloTabletDatabaseMigrationTest {
    private final Context context = RuntimeEnvironment.getApplication();
    private String databaseName;

    @After
    public void tearDown() {
        if (databaseName != null) context.deleteDatabase(databaseName);
    }

    @Test
    public void upgradesVersionOneInstallationWithoutLosingStoredState() {
        databaseName = "migration-v1-" + UUID.randomUUID() + ".db";
        SQLiteDatabase legacy = context.openOrCreateDatabase(databaseName, Context.MODE_PRIVATE, null);
        legacy.execSQL("CREATE TABLE app_storage (storage_key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL)");
        legacy.execSQL("INSERT INTO app_storage VALUES ('dashboard-state', '{\"kept\":true}', 123)");
        legacy.setVersion(1);
        legacy.close();

        PabloTabletDatabase upgraded = new PabloTabletDatabase(context, databaseName);
        SQLiteDatabase database = upgraded.getWritableDatabase();

        assertEquals(5, database.getVersion());
        assertTrue(tableExists(database, "mobile_devices"));
        assertTrue(tableExists(database, "pairing_sessions"));
        assertTrue(tableExists(database, "pairing_requests"));
        assertTrue(tableExists(database, "feedback_reports"));
        assertEquals("{\"kept\":true}", upgraded.readStorage(PabloTabletDatabase.DASHBOARD_KEY).value);
        upgraded.close();
    }

    @Test
    public void addsFeedbackTrackingColumnsWhenUpgradingVersionThree() {
        databaseName = "migration-v3-" + UUID.randomUUID() + ".db";
        SQLiteDatabase legacy = context.openOrCreateDatabase(databaseName, Context.MODE_PRIVATE, null);
        legacy.execSQL("CREATE TABLE feedback_reports (created_at INTEGER NOT NULL)");
        legacy.execSQL("CREATE TABLE mobile_devices (device_id TEXT)");
        legacy.execSQL("CREATE TABLE pairing_requests (request_id TEXT)");
        legacy.execSQL("INSERT INTO feedback_reports VALUES (456)");
        legacy.setVersion(3);
        legacy.close();

        PabloTabletDatabase upgraded = new PabloTabletDatabase(context, databaseName);
        SQLiteDatabase database = upgraded.getWritableDatabase();

        assertEquals(5, database.getVersion());
        assertTrue(columnExists(database, "feedback_reports", "target_version"));
        assertTrue(columnExists(database, "feedback_reports", "status_updated_at"));
        try (Cursor cursor = database.rawQuery("SELECT status_updated_at FROM feedback_reports LIMIT 1", null)) {
            assertTrue(cursor.moveToFirst());
            assertEquals(456, cursor.getLong(0));
        }
        upgraded.close();
    }

    private static boolean tableExists(SQLiteDatabase database, String table) {
        try (Cursor cursor = database.rawQuery("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", new String[] { table })) {
            return cursor.moveToFirst();
        }
    }

    @Test
    public void addsDeviceModelsToVersionFourWithoutLosingAuthorizations() {
        databaseName = "migration-v4-" + UUID.randomUUID() + ".db";
        SQLiteDatabase legacy = context.openOrCreateDatabase(databaseName, Context.MODE_PRIVATE, null);
        legacy.execSQL("CREATE TABLE mobile_devices (device_id TEXT, name TEXT, token_hash TEXT)");
        legacy.execSQL("INSERT INTO mobile_devices VALUES ('kept-id', 'Móvil personal', 'kept-hash')");
        legacy.execSQL("CREATE TABLE pairing_requests (request_id TEXT, device_name TEXT)");
        legacy.execSQL("INSERT INTO pairing_requests VALUES ('pending-id', 'Móvil nuevo')");
        legacy.setVersion(4);
        legacy.close();

        PabloTabletDatabase upgraded = new PabloTabletDatabase(context, databaseName);
        SQLiteDatabase database = upgraded.getWritableDatabase();
        assertEquals(5, database.getVersion());
        try (Cursor cursor = database.rawQuery("SELECT device_id, name, token_hash, device_model FROM mobile_devices", null)) {
            assertTrue(cursor.moveToFirst());
            assertEquals("kept-id", cursor.getString(0));
            assertEquals("Móvil personal", cursor.getString(1));
            assertEquals("kept-hash", cursor.getString(2));
            assertEquals("", cursor.getString(3));
        }
        try (Cursor cursor = database.rawQuery("SELECT device_name, device_model FROM pairing_requests", null)) {
            assertTrue(cursor.moveToFirst());
            assertEquals("Móvil nuevo", cursor.getString(0));
            assertEquals("", cursor.getString(1));
        }
        upgraded.close();
    }

    private static boolean columnExists(SQLiteDatabase database, String table, String column) {
        try (Cursor cursor = database.rawQuery("PRAGMA table_info(" + table + ")", null)) {
            while (cursor.moveToNext()) {
                if (column.equals(cursor.getString(cursor.getColumnIndexOrThrow("name")))) return true;
            }
            return false;
        }
    }
}
