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
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

final class MobileAdminRepository {
    private static final long PAIRING_LIFETIME_MS = 5 * 60 * 1000L;
    private static final Set<String> FEEDBACK_TYPES = new HashSet<>(Arrays.asList("error", "improvement", "feature"));
    private static final Set<String> FEEDBACK_PRIORITIES = new HashSet<>(Arrays.asList("low", "normal", "high", "blocking"));
    private static final Set<String> FEEDBACK_STATUSES = new HashSet<>(Arrays.asList("sent", "seen", "in_progress", "implemented"));
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

    JSONObject createFeedback(Device device, JSONObject input, String appVersion, String tabletModel) throws Exception {
        String type = requiredChoice(input, "type", FEEDBACK_TYPES, "El tipo de reporte no es válido.");
        String priority = requiredChoice(input, "priority", FEEDBACK_PRIORITIES, "La importancia no es válida.");
        String title = requiredText(input, "title", 100, "Escribe un título.");
        String area = requiredText(input, "area", 60, "Selecciona el apartado afectado.");
        String description = requiredText(input, "description", 4000, "Describe el comentario o problema.");
        String steps = optionalText(input, "steps", 3000);
        String actualResult = optionalText(input, "actualResult", 2000);
        String expectedResult = optionalText(input, "expectedResult", 2000);
        if (!input.optBoolean("privacyAccepted", false)) {
            throw new IllegalArgumentException("Confirma que el reporte no contiene datos personales que no quieras enviar.");
        }

        String id = UUID.randomUUID().toString();
        long createdAt = System.currentTimeMillis();
        String markdown = feedbackMarkdown(type, title, area, description, steps, actualResult, expectedResult, priority, appVersion, tabletModel, device.name, createdAt);
        ContentValues row = new ContentValues();
        row.put("feedback_id", id);
        row.put("source_device_id", device.id);
        row.put("source_device_name", device.name);
        row.put("type", type);
        row.put("title", title);
        row.put("area", area);
        row.put("description", description);
        row.put("steps", steps);
        row.put("actual_result", actualResult);
        row.put("expected_result", expectedResult);
        row.put("priority", priority);
        row.put("app_version", appVersion);
        row.put("tablet_model", tabletModel);
        row.put("created_at", createdAt);
        row.put("status", "pending");
        row.put("status_updated_at", createdAt);
        row.put("markdown", markdown);
        database.getWritableDatabase().insertOrThrow("feedback_reports", null, row);
        return feedbackJson(id, device.id);
    }

    JSONArray feedbackForDevice(String deviceId) throws Exception {
        JSONArray result = new JSONArray();
        try (Cursor cursor = database.getReadableDatabase().query(
            "feedback_reports",
            new String[] { "feedback_id" },
            "source_device_id = ?",
            new String[] { deviceId },
            null,
            null,
            "created_at DESC",
            "50"
        )) {
            while (cursor.moveToNext()) result.put(feedbackJson(cursor.getString(0), deviceId));
        }
        return result;
    }

    JSONObject feedbackJson(String feedbackId, String deviceId) throws Exception {
        try (Cursor cursor = database.getReadableDatabase().query(
            "feedback_reports",
            new String[] { "feedback_id", "type", "title", "area", "description", "steps", "actual_result", "expected_result", "priority", "app_version", "tablet_model", "created_at", "status", "attempts", "last_error", "github_issue_number", "github_issue_url", "target_version", "status_updated_at", "markdown" },
            "feedback_id = ? AND source_device_id = ?",
            new String[] { feedbackId, deviceId },
            null,
            null,
            null,
            "1"
        )) {
            if (!cursor.moveToFirst()) throw new IllegalArgumentException("El reporte no existe.");
            JSONObject item = new JSONObject();
            item.put("id", cursor.getString(0));
            item.put("type", cursor.getString(1));
            item.put("title", cursor.getString(2));
            item.put("area", cursor.getString(3));
            item.put("description", cursor.getString(4));
            item.put("steps", cursor.getString(5));
            item.put("actualResult", cursor.getString(6));
            item.put("expectedResult", cursor.getString(7));
            item.put("priority", cursor.getString(8));
            item.put("appVersion", cursor.getString(9));
            item.put("tabletModel", cursor.getString(10));
            item.put("createdAt", cursor.getLong(11));
            item.put("status", cursor.getString(12));
            item.put("attempts", cursor.getInt(13));
            item.put("lastError", cursor.isNull(14) ? JSONObject.NULL : cursor.getString(14));
            item.put("githubIssueNumber", cursor.isNull(15) ? JSONObject.NULL : cursor.getInt(15));
            item.put("githubIssueUrl", cursor.isNull(16) ? JSONObject.NULL : cursor.getString(16));
            item.put("statusUpdatedAt", cursor.getLong(18));
            item.put("markdown", cursor.getString(19));
            return item;
        }
    }

    void updateFeedbackStatus(String feedbackId, String deviceId, int issueNumber, String issueUrl, String status) {
        String cleanStatus = FEEDBACK_STATUSES.contains(status) ? status : "sent";
        ContentValues row = new ContentValues();
        row.put("status", cleanStatus);
        row.put("github_issue_number", issueNumber);
        row.put("github_issue_url", issueUrl);
        row.put("status_updated_at", System.currentTimeMillis());
        row.putNull("last_error");
        database.getWritableDatabase().update("feedback_reports", row, "feedback_id = ? AND source_device_id = ?", new String[] { feedbackId, deviceId });
    }

    void markFeedbackFailed(String feedbackId, String deviceId, String message) {
        ContentValues row = new ContentValues();
        row.put("status", "failed");
        row.put("last_error", message == null ? "No se pudo enviar el reporte." : message.substring(0, Math.min(message.length(), 300)));
        database.getWritableDatabase().execSQL(
            "UPDATE feedback_reports SET status = ?, last_error = ?, attempts = attempts + 1, status_updated_at = ? WHERE feedback_id = ? AND source_device_id = ?",
            new Object[] { "failed", row.getAsString("last_error"), System.currentTimeMillis(), feedbackId, deviceId }
        );
    }

    private static String requiredChoice(JSONObject input, String key, Set<String> allowed, String message) {
        String value = input.optString(key, "").trim();
        if (!allowed.contains(value)) throw new IllegalArgumentException(message);
        return value;
    }

    private static String requiredText(JSONObject input, String key, int maximum, String message) {
        String value = optionalText(input, key, maximum);
        if (value.isEmpty()) throw new IllegalArgumentException(message);
        return value;
    }

    private static String optionalText(JSONObject input, String key, int maximum) {
        String value = input.optString(key, "").trim();
        if (value.length() > maximum) throw new IllegalArgumentException("El campo " + key + " es demasiado largo.");
        return value;
    }

    private static String feedbackMarkdown(String type, String title, String area, String description, String steps, String actualResult, String expectedResult, String priority, String appVersion, String tabletModel, String deviceName, long createdAt) {
        String label = "error".equals(type) ? "Error" : "feature".equals(type) ? "Nueva función" : "Mejora";
        StringBuilder result = new StringBuilder();
        result.append("# [").append(label).append("] ").append(title).append("\n\n");
        result.append("- Estado: pendiente-envio\n");
        result.append("- Apartado: ").append(area).append("\n");
        result.append("- Importancia: ").append(priority).append("\n");
        result.append("- Versión: ").append(appVersion).append("\n");
        result.append("- Tablet: ").append(tabletModel).append("\n");
        result.append("- Móvil autorizado: ").append(deviceName).append("\n");
        result.append("- Fecha: ").append(new java.util.Date(createdAt).toInstant()).append("\n\n");
        result.append("## Descripción\n\n").append(description).append("\n");
        return result.toString();
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
