package com.pablohorcajada.tablet;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

final class FeedbackRelayClient {
    private final String endpoint;
    private final String relayKey;

    FeedbackRelayClient(String endpoint, String relayKey) {
        this.endpoint = endpoint == null ? "" : endpoint.trim();
        this.relayKey = relayKey == null ? "" : relayKey.trim();
        if (!this.endpoint.isEmpty() && !this.endpoint.startsWith("https://")) {
            throw new IllegalArgumentException("El endpoint de comentarios debe usar HTTPS.");
        }
        if (!this.endpoint.isEmpty() && this.relayKey.length() < 32) {
            throw new IllegalArgumentException("La clave del relay de comentarios no es válida.");
        }
    }

    boolean isConfigured() {
        return !endpoint.isEmpty();
    }

    Result send(JSONObject report) throws Exception {
        return request("create", report);
    }

    Result status(JSONObject report) throws Exception {
        return request("status", report);
    }

    private Result request(String action, JSONObject report) throws Exception {
        if (!isConfigured()) throw new IllegalStateException("El servicio de comentarios no está configurado.");
        HttpURLConnection connection = (HttpURLConnection) new URL(endpoint).openConnection();
        connection.setRequestMethod("POST");
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(12_000);
        connection.setDoOutput(true);
        connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("Authorization", "Bearer " + relayKey);
        connection.setRequestProperty("User-Agent", "Pablo-Tablet/" + BuildConfig.VERSION_NAME);
        byte[] payload = new JSONObject().put("action", action).put("report", report).toString().getBytes(StandardCharsets.UTF_8);
        connection.setFixedLengthStreamingMode(payload.length);
        try (OutputStream output = connection.getOutputStream()) {
            output.write(payload);
        }
        int status = connection.getResponseCode();
        InputStream stream = status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream();
        String raw = stream == null ? "" : readAll(stream);
        if (status < 200 || status >= 300) {
            String detail = raw.isEmpty() ? "HTTP " + status : new JSONObject(raw).optString("error", "HTTP " + status);
            throw new IllegalStateException("El servicio rechazó el reporte: " + detail);
        }
        JSONObject body = new JSONObject(raw);
        int issueNumber = body.optInt("issueNumber", 0);
        String issueUrl = body.optString("issueUrl", "");
        if (issueNumber <= 0 || !issueUrl.startsWith("https://github.com/")) {
            throw new IllegalStateException("El servicio no devolvió un Issue válido.");
        }
        return new Result(issueNumber, issueUrl, body.optString("status", "sent"));
    }

    private static String readAll(InputStream input) throws Exception {
        try (InputStream source = input; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int read;
            while ((read = source.read(buffer)) >= 0) {
                output.write(buffer, 0, read);
                if (output.size() > 256 * 1024) throw new IllegalStateException("La respuesta del servicio es demasiado grande.");
            }
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }

    static final class Result {
        final int issueNumber;
        final String issueUrl;
        final String status;

        Result(int issueNumber, String issueUrl, String status) {
            this.issueNumber = issueNumber;
            this.issueUrl = issueUrl;
            this.status = status;
        }
    }
}
