package com.pablohorcajada.tablet;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.util.Base64;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.UUID;

final class MobileAdminRepository {
    private static final long PAIRING_LIFETIME_MS = 5 * 60 * 1000L;
    private final PabloTabletDatabase database;
    private final SecureRandom random = new SecureRandom();

    MobileAdminRepository(PabloTabletDatabase database) {
        this.database = database;
    }

    PairingSession createPairing(String baseUrl) throws Exception {
        long now = System.currentTimeMillis();
        String id = UUID.randomUUID().toString();
        String token = randomToken();
        SQLiteDatabase writable = database.getWritableDatabase();
        writable.beginTransaction();
        try {
            ContentValues closeExisting = new ContentValues();
            closeExisting.put("consumed_at", now);
            writable.update("pairing_sessions", closeExisting, "consumed_at IS NULL", null);

            ContentValues row = new ContentValues();
            row.put("session_id", id);
            row.put("token_hash", hash(token));
            row.put("created_at", now);
            row.put("expires_at", now + PAIRING_LIFETIME_MS);
            writable.insertOrThrow("pairing_sessions", null, row);
            writable.setTransactionSuccessful();
        } finally {
            writable.endTransaction();
        }
        return new PairingSession(id, token, baseUrl + "/?pair=" + token, now + PAIRING_LIFETIME_MS);
    }

    void cancelPairing(String sessionId) {
        ContentValues row = new ContentValues();
        row.put("consumed_at", System.currentTimeMillis());
        database.getWritableDatabase().update(
            "pairing_sessions",
            row,
            "session_id = ? AND consumed_at IS NULL",
            new String[] { sessionId }
        );
    }

    PairingRequest requestPairing(String pairingToken, String requestedName, String userAgent) throws Exception {
        cleanupExpired();
        long now = System.currentTimeMillis();
        String sessionId = findActiveSessionId(pairingToken, now);
        if (sessionId == null) throw new SecurityException("El QR ha caducado o ya no es válido.");

        String requestId = UUID.randomUUID().toString();
        String name = cleanName(requestedName);
        String agent = cleanUserAgent(userAgent);
        ContentValues row = new ContentValues();
        row.put("request_id", requestId);
        row.put("session_id", sessionId);
        row.put("device_name", name);
        row.put("user_agent", agent);
        row.put("status", "pending");
        row.put("created_at", now);
        row.put("expires_at", now + PAIRING_LIFETIME_MS);
        database.getWritableDatabase().insertOrThrow("pairing_requests", null, row);
        return new PairingRequest(requestId, name, agent, "pending", now, now + PAIRING_LIFETIME_MS);
    }

    JSONObject pairingResult(String requestId, String pairingToken) throws Exception {
        long now = System.currentTimeMillis();
        String tokenHash = hash(pairingToken);
        String sql = "SELECT r.status, r.expires_at, r.issued_token " +
            "FROM pairing_requests r JOIN pairing_sessions s ON s.session_id = r.session_id " +
            "WHERE r.request_id = ? AND s.token_hash = ? LIMIT 1";
        try (Cursor cursor = database.getReadableDatabase().rawQuery(sql, new String[] { requestId, tokenHash })) {
            if (!cursor.moveToFirst()) throw new SecurityException("La solicitud de vinculación no existe.");
            String status = cursor.getString(0);
            long expiresAt = cursor.getLong(1);
            if (expiresAt <= now && "pending".equals(status)) status = "expired";
            JSONObject result = new JSONObject();
            result.put("status", status);
            result.put("expiresAt", expiresAt);
            if ("approved".equals(status) && !cursor.isNull(2)) result.put("credential", cursor.getString(2));
            return result;
        }
    }

    JSONArray pendingRequests() {
        cleanupExpired();
        JSONArray result = new JSONArray();
        long now = System.currentTimeMillis();
        try (Cursor cursor = database.getReadableDatabase().query(
            "pairing_requests",
            new String[] { "request_id", "device_name", "user_agent", "status", "created_at", "expires_at" },
            "status = ? AND expires_at > ?",
            new String[] { "pending", Long.toString(now) },
            null,
            null,
            "created_at ASC"
        )) {
            while (cursor.moveToNext()) {
                result.put(requestJson(cursor));
            }
        }
        return result;
    }

    String approve(String requestId) throws Exception {
        long now = System.currentTimeMillis();
        SQLiteDatabase writable = database.getWritableDatabase();
        writable.beginTransaction();
        try (Cursor cursor = writable.query(
            "pairing_requests",
            new String[] { "session_id", "device_name", "user_agent", "expires_at", "status" },
            "request_id = ?",
            new String[] { requestId },
            null,
            null,
            null,
            "1"
        )) {
            if (!cursor.moveToFirst() || !"pending".equals(cursor.getString(4)) || cursor.getLong(3) <= now) {
                throw new IllegalStateException("La solicitud ya no está disponible.");
            }
            String sessionId = cursor.getString(0);
            String credential = randomToken();
            ContentValues device = new ContentValues();
            device.put("device_id", UUID.randomUUID().toString());
            device.put("name", cursor.getString(1));
            device.put("user_agent", cursor.getString(2));
            device.put("token_hash", hash(credential));
            device.put("created_at", now);
            device.put("last_seen_at", now);
            writable.insertOrThrow("mobile_devices", null, device);

            ContentValues request = new ContentValues();
            request.put("status", "approved");
            request.put("decided_at", now);
            request.put("issued_token", credential);
            writable.update("pairing_requests", request, "request_id = ?", new String[] { requestId });

            ContentValues session = new ContentValues();
            session.put("consumed_at", now);
            writable.update("pairing_sessions", session, "session_id = ?", new String[] { sessionId });
            writable.setTransactionSuccessful();
            return credential;
        } finally {
            writable.endTransaction();
        }
    }

    void reject(String requestId) {
        ContentValues row = new ContentValues();
        row.put("status", "rejected");
        row.put("decided_at", System.currentTimeMillis());
        database.getWritableDatabase().update(
            "pairing_requests",
            row,
            "request_id = ? AND status = ?",
            new String[] { requestId, "pending" }
        );
    }

    Device authenticate(String credential) throws Exception {
        if (credential == null || credential.length() < 32) return null;
        String tokenHash = hash(credential);
        try (Cursor cursor = database.getReadableDatabase().query(
            "mobile_devices",
            new String[] { "device_id", "name" },
            "token_hash = ? AND revoked_at IS NULL",
            new String[] { tokenHash },
            null,
            null,
            null,
            "1"
        )) {
            if (!cursor.moveToFirst()) return null;
            Device device = new Device(cursor.getString(0), cursor.getString(1));
            ContentValues seen = new ContentValues();
            seen.put("last_seen_at", System.currentTimeMillis());
            database.getWritableDatabase().update("mobile_devices", seen, "device_id = ?", new String[] { device.id });
            return device;
        }
    }

    JSONArray devices() {
        JSONArray result = new JSONArray();
        try (Cursor cursor = database.getReadableDatabase().query(
            "mobile_devices",
            new String[] { "device_id", "name", "user_agent", "created_at", "last_seen_at", "revoked_at" },
            null,
            null,
            null,
            null,
            "created_at DESC"
        )) {
            while (cursor.moveToNext()) {
                JSONObject device = new JSONObject();
                try {
                    device.put("id", cursor.getString(0));
                    device.put("name", cursor.getString(1));
                    device.put("userAgent", cursor.getString(2));
                    device.put("createdAt", cursor.getLong(3));
                    device.put("lastSeenAt", cursor.getLong(4));
                    device.put("revokedAt", cursor.isNull(5) ? JSONObject.NULL : cursor.getLong(5));
                } catch (Exception ignored) { }
                result.put(device);
            }
        }
        return result;
    }

    void renameDevice(String deviceId, String name) {
        ContentValues row = new ContentValues();
        row.put("name", cleanName(name));
        database.getWritableDatabase().update("mobile_devices", row, "device_id = ?", new String[] { deviceId });
    }

    void revokeDevice(String deviceId) {
        ContentValues row = new ContentValues();
        row.put("revoked_at", System.currentTimeMillis());
        database.getWritableDatabase().update("mobile_devices", row, "device_id = ?", new String[] { deviceId });
    }

    private String findActiveSessionId(String pairingToken, long now) throws Exception {
        try (Cursor cursor = database.getReadableDatabase().query(
            "pairing_sessions",
            new String[] { "session_id" },
            "token_hash = ? AND consumed_at IS NULL AND expires_at > ?",
            new String[] { hash(pairingToken), Long.toString(now) },
            null,
            null,
            null,
            "1"
        )) {
            return cursor.moveToFirst() ? cursor.getString(0) : null;
        }
    }

    private void cleanupExpired() {
        long now = System.currentTimeMillis();
        ContentValues request = new ContentValues();
        request.put("status", "expired");
        request.put("decided_at", now);
        request.putNull("issued_token");
        database.getWritableDatabase().update(
            "pairing_requests",
            request,
            "status = ? AND expires_at <= ?",
            new String[] { "pending", Long.toString(now) }
        );
        ContentValues clearCredentials = new ContentValues();
        clearCredentials.putNull("issued_token");
        database.getWritableDatabase().update(
            "pairing_requests",
            clearCredentials,
            "expires_at <= ?",
            new String[] { Long.toString(now) }
        );
    }

    private static JSONObject requestJson(Cursor cursor) {
        JSONObject request = new JSONObject();
        try {
            request.put("id", cursor.getString(0));
            request.put("deviceName", cursor.getString(1));
            request.put("userAgent", cursor.getString(2));
            request.put("status", cursor.getString(3));
            request.put("createdAt", cursor.getLong(4));
            request.put("expiresAt", cursor.getLong(5));
        } catch (Exception ignored) { }
        return request;
    }

    private String randomToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.encodeToString(bytes, Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING);
    }

    private static String hash(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
        StringBuilder result = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) result.append(String.format("%02x", item & 0xff));
        return result.toString();
    }

    private static String cleanName(String value) {
        String clean = value == null ? "Móvil sin nombre" : value.trim();
        if (clean.isEmpty()) clean = "Móvil sin nombre";
        return clean.substring(0, Math.min(clean.length(), 60));
    }

    private static String cleanUserAgent(String value) {
        String clean = value == null ? "Navegador desconocido" : value.trim();
        return clean.substring(0, Math.min(clean.length(), 240));
    }

    static final class PairingSession {
        final String id;
        final String token;
        final String url;
        final long expiresAt;
        PairingSession(String id, String token, String url, long expiresAt) {
            this.id = id; this.token = token; this.url = url; this.expiresAt = expiresAt;
        }
    }

    static final class PairingRequest {
        final String id;
        final String deviceName;
        final String userAgent;
        final String status;
        final long createdAt;
        final long expiresAt;
        PairingRequest(String id, String deviceName, String userAgent, String status, long createdAt, long expiresAt) {
            this.id = id; this.deviceName = deviceName; this.userAgent = userAgent; this.status = status; this.createdAt = createdAt; this.expiresAt = expiresAt;
        }
    }

    static final class Device {
        final String id;
        final String name;
        Device(String id, String name) { this.id = id; this.name = name; }
    }
}
