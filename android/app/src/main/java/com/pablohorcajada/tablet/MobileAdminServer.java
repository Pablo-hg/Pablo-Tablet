package com.pablohorcajada.tablet;

import android.content.Context;
import android.net.Uri;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArraySet;

import fi.iki.elonen.NanoHTTPD;
import fi.iki.elonen.NanoWSD;

final class MobileAdminServer extends NanoWSD {
    static final int PORT = 8765;
    private static final int MAX_JSON_BYTES = 2 * 1024 * 1024;
    private static final int MAX_PHOTO_BYTES = 30 * 1024 * 1024;
    private final Context context;
    private final PabloTabletDatabase database;
    private final MobileAdminRepository repository;
    private final FeedbackRelayClient feedbackRelay;
    private final Set<AdminSocket> sockets = new CopyOnWriteArraySet<>();

    MobileAdminServer(Context context, PabloTabletDatabase database, MobileAdminRepository repository, String bindAddress) {
        super(bindAddress, PORT);
        this.context = context.getApplicationContext();
        this.database = database;
        this.repository = repository;
        this.feedbackRelay = new FeedbackRelayClient(BuildConfig.FEEDBACK_RELAY_URL, BuildConfig.FEEDBACK_RELAY_KEY);
    }

    @Override
    protected Response serveHttp(IHTTPSession session) {
        try {
            if (session.getMethod() == Method.OPTIONS) return response(Response.Status.NO_CONTENT, "text/plain", "");
            String path = normalizedPath(session.getUri());
            if ("/api/health".equals(path) && session.getMethod() == Method.GET) {
                return json(Response.Status.OK, new JSONObject().put("ok", true).put("service", "Pablo Tablet").put("version", 1));
            }
            if ("/api/pair/request".equals(path) && session.getMethod() == Method.POST) return createPairingRequest(session);
            if (path.startsWith("/api/pair/request/") && session.getMethod() == Method.GET) return readPairingRequest(session, path);
            if (path.startsWith("/api/")) {
                MobileAdminRepository.Device device = authenticate(session);
                if (device == null) return error(Response.Status.UNAUTHORIZED, "La credencial de este móvil no es válida.");
                if ("/api/state".equals(path) && session.getMethod() == Method.GET) return readState(device);
                if ("/api/state".equals(path) && session.getMethod() == Method.PUT) return writeState(session, device);
                if ("/api/feedback".equals(path) && session.getMethod() == Method.GET) return readFeedback(device);
                if ("/api/feedback".equals(path) && session.getMethod() == Method.POST) return createFeedback(session, device);
                if (path.matches("/api/feedback/[^/]+/refresh") && session.getMethod() == Method.POST) return refreshFeedback(path, device);
                if (path.matches("/api/feedback/[^/]+/retry") && session.getMethod() == Method.POST) return retryFeedback(path, device);
                if ("/api/photos".equals(path) && session.getMethod() == Method.POST) return uploadPhoto(session, device);
                if (path.startsWith("/api/photos/") && session.getMethod() == Method.GET) return readPhoto(path.substring("/api/photos/".length()));
                return error(Response.Status.NOT_FOUND, "La operación solicitada no existe.");
            }
            return serveAsset(path);
        } catch (SecurityException error) {
            return error(Response.Status.FORBIDDEN, error.getMessage());
        } catch (IllegalArgumentException error) {
            return error(Response.Status.BAD_REQUEST, error.getMessage());
        } catch (Exception error) {
            return error(Response.Status.INTERNAL_ERROR, "No se pudo completar la operación en la tablet.");
        }
    }

    @Override
    protected WebSocket openWebSocket(IHTTPSession handshake) {
        boolean authorized = false;
        try {
            String token = handshake.getParms().get("token");
            authorized = repository.authenticate(token) != null;
        } catch (Exception ignored) { }
        return new AdminSocket(handshake, authorized);
    }

    void broadcastStateChanged(long updatedAt) {
        JSONObject event = new JSONObject();
        try {
            event.put("type", "state-changed");
            event.put("updatedAt", updatedAt);
        } catch (Exception ignored) { }
        String payload = event.toString();
        for (AdminSocket socket : sockets) {
            try {
                if (socket.isOpen()) socket.send(payload);
                else sockets.remove(socket);
            } catch (IOException error) {
                sockets.remove(socket);
            }
        }
    }

    private Response createPairingRequest(IHTTPSession session) throws Exception {
        JSONObject body = readJsonBody(session);
        MobileAdminRepository.PairingRequest request = repository.requestPairing(
            body.optString("pairingToken"),
            body.optString("deviceName"),
            body.optString("userAgent", session.getHeaders().get("user-agent"))
        );
        JSONObject result = new JSONObject();
        result.put("requestId", request.id);
        result.put("status", request.status);
        result.put("expiresAt", request.expiresAt);
        return json(Response.Status.CREATED, result);
    }

    private Response readPairingRequest(IHTTPSession session, String path) throws Exception {
        String requestId = path.substring("/api/pair/request/".length());
        String pairingToken = session.getParms().get("pairingToken");
        if (pairingToken == null) throw new SecurityException("Falta el token temporal de vinculación.");
        return json(Response.Status.OK, repository.pairingResult(requestId, pairingToken));
    }

    private Response readState(MobileAdminRepository.Device device) throws Exception {
        PabloTabletDatabase.StorageRecord record = database.readStorage(PabloTabletDatabase.DASHBOARD_KEY);
        JSONObject result = new JSONObject();
        result.put("state", record.value == null ? JSONObject.NULL : new JSONObject(record.value));
        result.put("updatedAt", record.updatedAt == null ? JSONObject.NULL : record.updatedAt);
        result.put("device", new JSONObject().put("id", device.id).put("name", device.name));
        return json(Response.Status.OK, result);
    }

    private Response writeState(IHTTPSession session, MobileAdminRepository.Device device) throws Exception {
        JSONObject body = readJsonBody(session);
        JSONObject state = body.optJSONObject("state");
        if (state == null) throw new IllegalArgumentException("El estado enviado no es válido.");
        String serialized = state.toString();
        if (serialized.getBytes(StandardCharsets.UTF_8).length > MAX_JSON_BYTES) throw new IllegalArgumentException("Los datos enviados son demasiado grandes.");
        long updatedAt = database.writeStorage(PabloTabletDatabase.DASHBOARD_KEY, serialized);
        broadcastStateChanged(updatedAt);
        return json(Response.Status.OK, new JSONObject().put("updatedAt", updatedAt).put("changedBy", device.id));
    }

    private Response readFeedback(MobileAdminRepository.Device device) throws Exception {
        return json(Response.Status.OK, new JSONObject().put("reports", repository.feedbackForDevice(device.id)));
    }

    private Response createFeedback(IHTTPSession session, MobileAdminRepository.Device device) throws Exception {
        JSONObject report = repository.createFeedback(
            device,
            readJsonBody(session),
            BuildConfig.VERSION_NAME,
            android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL
        );
        report = deliverFeedback(report, device);
        return json(Response.Status.CREATED, new JSONObject().put("report", report));
    }

    private Response retryFeedback(String path, MobileAdminRepository.Device device) throws Exception {
        String prefix = "/api/feedback/";
        String feedbackId = path.substring(prefix.length(), path.length() - "/retry".length());
        JSONObject report = repository.feedbackJson(feedbackId, device.id);
        if ("sent".equals(report.optString("status"))) return json(Response.Status.OK, new JSONObject().put("report", report));
        if (!feedbackRelay.isConfigured()) throw new IllegalArgumentException("El servicio seguro de GitHub todavía no está configurado.");
        return json(Response.Status.OK, new JSONObject().put("report", deliverFeedback(report, device)));
    }

    private Response refreshFeedback(String path, MobileAdminRepository.Device device) throws Exception {
        String prefix = "/api/feedback/";
        String feedbackId = path.substring(prefix.length(), path.length() - "/refresh".length());
        JSONObject report = repository.feedbackJson(feedbackId, device.id);
        if (!feedbackRelay.isConfigured()) throw new IllegalArgumentException("El seguimiento remoto todavía no está configurado.");
        if (report.isNull("githubIssueNumber")) throw new IllegalArgumentException("El comentario todavía no se ha enviado.");
        try {
            FeedbackRelayClient.Result result = feedbackRelay.status(report);
            applyRelayStatus(report.getString("id"), device, result);
        } catch (Exception error) {
            throw new IllegalArgumentException("No se pudo actualizar el estado: " + error.getMessage());
        }
        return json(Response.Status.OK, new JSONObject().put("report", repository.feedbackJson(feedbackId, device.id)));
    }

    private JSONObject deliverFeedback(JSONObject report, MobileAdminRepository.Device device) throws Exception {
        if (!feedbackRelay.isConfigured()) return report;
        try {
            FeedbackRelayClient.Result result = feedbackRelay.send(report);
            applyRelayStatus(report.getString("id"), device, result);
        } catch (Exception error) {
            repository.markFeedbackFailed(report.getString("id"), device.id, error.getMessage());
        }
        return repository.feedbackJson(report.getString("id"), device.id);
    }

    private void applyRelayStatus(String feedbackId, MobileAdminRepository.Device device, FeedbackRelayClient.Result result) {
        repository.updateFeedbackStatus(feedbackId, device.id, result.issueNumber, result.issueUrl, result.status);
    }

    private Response uploadPhoto(IHTTPSession session, MobileAdminRepository.Device device) throws Exception {
        int length = contentLength(session);
        if (length <= 0) throw new IllegalArgumentException("No se recibió ninguna imagen.");
        if (length > MAX_PHOTO_BYTES) return error(Response.Status.PAYLOAD_TOO_LARGE, "La imagen supera el límite de 30 MB.");
        String mime = session.getHeaders().get("content-type");
        if (mime == null || !mime.toLowerCase().startsWith("image/")) return error(Response.Status.UNSUPPORTED_MEDIA_TYPE, "El archivo debe ser una imagen.");

        String encodedName = session.getHeaders().get("x-file-name");
        String originalName = encodedName == null ? "Foto" : URLDecoder.decode(encodedName, "UTF-8");
        String id = UUID.randomUUID().toString();
        File gallery = new File(context.getFilesDir(), "gallery");
        if (!gallery.exists() && !gallery.mkdirs()) throw new IOException("No se pudo preparar la galería privada.");
        File destination = new File(gallery, id + extensionFor(originalName, mime));
        copyExact(session.getInputStream(), destination, length);

        PabloTabletDatabase.StorageRecord record = database.readStorage(PabloTabletDatabase.DASHBOARD_KEY);
        JSONObject state = record.value == null ? new JSONObject() : new JSONObject(record.value);
        JSONArray photos = state.optJSONArray("galleryPhotos");
        if (photos == null) {
            photos = new JSONArray();
            state.put("galleryPhotos", photos);
        }
        JSONObject photo = new JSONObject();
        photo.put("id", id);
        photo.put("name", cleanFileName(originalName));
        photo.put("uri", Uri.fromFile(destination).toString());
        photo.put("createdAt", new java.util.Date().toInstant().toString());
        photo.put("deletedAt", JSONObject.NULL);
        photos.put(photo);
        long updatedAt = database.writeStorage(PabloTabletDatabase.DASHBOARD_KEY, state.toString());
        broadcastStateChanged(updatedAt);
        return json(Response.Status.CREATED, new JSONObject().put("photo", photo).put("updatedAt", updatedAt).put("changedBy", device.id));
    }

    private Response readPhoto(String photoId) throws Exception {
        PabloTabletDatabase.StorageRecord record = database.readStorage(PabloTabletDatabase.DASHBOARD_KEY);
        if (record.value == null) return error(Response.Status.NOT_FOUND, "La foto no existe.");
        JSONArray photos = new JSONObject(record.value).optJSONArray("galleryPhotos");
        if (photos == null) return error(Response.Status.NOT_FOUND, "La foto no existe.");
        for (int index = 0; index < photos.length(); index += 1) {
            JSONObject photo = photos.optJSONObject(index);
            if (photo == null || !photoId.equals(photo.optString("id")) || !photo.isNull("deletedAt")) continue;
            File gallery = new File(context.getFilesDir(), "gallery").getCanonicalFile();
            File file = new File(Uri.parse(photo.optString("uri")).getPath()).getCanonicalFile();
            if (!file.getPath().startsWith(gallery.getPath() + File.separator) || !file.isFile()) break;
            return newFixedLengthResponse(Response.Status.OK, NanoHTTPD.getMimeTypeForFile(file.getName()), new FileInputStream(file), file.length());
        }
        return error(Response.Status.NOT_FOUND, "La foto no existe o está en la papelera.");
    }

    private Response serveAsset(String path) {
        String assetName;
        if ("/".equals(path) || "/index.html".equals(path)) assetName = "public/mobile/index.html";
        else if (path.matches("/[a-zA-Z0-9._-]+")) assetName = "public/mobile" + path;
        else return error(Response.Status.NOT_FOUND, "Página no encontrada.");
        try {
            InputStream stream = context.getAssets().open(assetName);
            String mime = withUtf8Charset(NanoHTTPD.getMimeTypeForFile(assetName));
            Response result = newChunkedResponse(Response.Status.OK, mime, stream);
            boolean editableAsset = assetName.endsWith(".html") || assetName.endsWith(".js") || assetName.endsWith(".css") || assetName.endsWith(".webmanifest");
            result.addHeader("Cache-Control", editableAsset ? "no-store" : "public, max-age=3600");
            addSecurityHeaders(result);
            return result;
        } catch (IOException error) {
            return error(Response.Status.NOT_FOUND, "Página no encontrada.");
        }
    }

    private MobileAdminRepository.Device authenticate(IHTTPSession session) throws Exception {
        String authorization = session.getHeaders().get("authorization");
        if (authorization == null || !authorization.startsWith("Bearer ")) return null;
        return repository.authenticate(authorization.substring(7).trim());
    }

    private static JSONObject readJsonBody(IHTTPSession session) throws Exception {
        int length = contentLength(session);
        if (length > MAX_JSON_BYTES) throw new IllegalArgumentException("Los datos enviados son demasiado grandes.");
        Map<String, String> files = new java.util.HashMap<>();
        session.parseBody(files);
        String raw = files.get("postData");
        if (raw == null || raw.trim().isEmpty()) throw new IllegalArgumentException("Faltan los datos de la solicitud.");
        return new JSONObject(raw);
    }

    private static int contentLength(IHTTPSession session) {
        try {
            String raw = session.getHeaders().get("content-length");
            return raw == null ? -1 : Integer.parseInt(raw);
        } catch (NumberFormatException ignored) {
            return -1;
        }
    }

    private static void copyExact(InputStream source, File destination, int length) throws IOException {
        int remaining = length;
        byte[] buffer = new byte[32 * 1024];
        try (FileOutputStream output = new FileOutputStream(destination)) {
            while (remaining > 0) {
                int read = source.read(buffer, 0, Math.min(buffer.length, remaining));
                if (read < 0) throw new IOException("La imagen se recibió incompleta.");
                output.write(buffer, 0, read);
                remaining -= read;
            }
        } catch (IOException error) {
            if (destination.exists()) destination.delete();
            throw error;
        }
    }

    private static String extensionFor(String name, String mime) {
        int dot = name.lastIndexOf('.');
        if (dot >= 0) {
            String extension = name.substring(dot).toLowerCase();
            if (extension.matches("\\.(jpg|jpeg|png|webp|gif|heic|heif)")) return extension;
        }
        if (mime.toLowerCase().contains("png")) return ".png";
        if (mime.toLowerCase().contains("webp")) return ".webp";
        if (mime.toLowerCase().contains("gif")) return ".gif";
        return ".jpg";
    }

    private static String cleanFileName(String name) {
        String cleaned = name.replaceAll("[\\r\\n\\t]", " ").trim();
        if (cleaned.isEmpty()) cleaned = "Foto";
        return cleaned.substring(0, Math.min(cleaned.length(), 160));
    }

    private static String withUtf8Charset(String mime) {
        if (mime == null) return "application/octet-stream";
        String lower = mime.toLowerCase();
        if (lower.startsWith("text/") || lower.contains("javascript") || lower.contains("json") || lower.contains("svg+xml")) {
            return mime + "; charset=utf-8";
        }
        return mime;
    }

    private static String normalizedPath(String raw) {
        if (raw == null || raw.isEmpty()) return "/";
        int query = raw.indexOf('?');
        return query >= 0 ? raw.substring(0, query) : raw;
    }

    private static Response json(Response.Status status, JSONObject value) {
        return response(status, "application/json; charset=utf-8", value.toString());
    }

    private static Response error(Response.Status status, String message) {
        JSONObject body = new JSONObject();
        try { body.put("error", message == null ? "Error desconocido." : message); } catch (Exception ignored) { }
        return json(status, body);
    }

    private static Response response(Response.Status status, String mime, String body) {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        Response result = newFixedLengthResponse(status, mime, new ByteArrayInputStream(bytes), bytes.length);
        addSecurityHeaders(result);
        return result;
    }

    private static void addSecurityHeaders(Response result) {
        result.addHeader("X-Content-Type-Options", "nosniff");
        result.addHeader("Referrer-Policy", "no-referrer");
        result.addHeader("Content-Security-Policy", "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; script-src 'self'; connect-src 'self' ws: https://geocoding-api.open-meteo.com");
        result.addHeader("Access-Control-Allow-Origin", "*");
        result.addHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-File-Name");
        result.addHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
    }

    private final class AdminSocket extends WebSocket {
        private final boolean authorized;

        AdminSocket(IHTTPSession handshake, boolean authorized) {
            super(handshake);
            this.authorized = authorized;
        }

        @Override protected void onOpen() {
            if (!authorized) {
                try { close(WebSocketFrame.CloseCode.PolicyViolation, "Credencial no válida", false); } catch (IOException ignored) { }
                return;
            }
            sockets.add(this);
            try { send(new JSONObject().put("type", "connected").toString()); } catch (Exception ignored) { }
        }

        @Override protected void onClose(WebSocketFrame.CloseCode code, String reason, boolean initiatedByRemote) { sockets.remove(this); }
        @Override protected void onMessage(WebSocketFrame frame) {
            if ("ping".equals(frame.getTextPayload())) {
                try { send("{\"type\":\"pong\"}"); } catch (IOException ignored) { }
            }
        }
        @Override protected void onPong(WebSocketFrame frame) { }
        @Override protected void onException(IOException error) { sockets.remove(this); }
    }
}
