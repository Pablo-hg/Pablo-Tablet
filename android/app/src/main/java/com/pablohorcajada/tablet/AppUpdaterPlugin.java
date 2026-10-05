package com.pablohorcajada.tablet;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedInputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Locale;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final String RELEASE_API = "https://api.github.com/repos/Pablo-hg/Pablo-Tablet-Releases/releases/latest";
    private static final String RELEASE_DOWNLOAD_PREFIX = "/Pablo-hg/Pablo-Tablet-Releases/releases/download/";
    private static final String UPDATE_FILE = "pablo-tablet-update.apk";
    private static final long MAX_APK_BYTES = 500L * 1024L * 1024L;

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                JSObject response = installedVersionResponse();
                connection = openConnection(new URL(RELEASE_API));
                int status = connection.getResponseCode();
                if (status == HttpURLConnection.HTTP_NOT_FOUND) {
                    response.put("releaseAvailable", false);
                    response.put("updateAvailable", false);
                    response.put("latestVersionName", JSONObject.NULL);
                    response.put("releaseName", JSONObject.NULL);
                    response.put("releaseNotes", JSONObject.NULL);
                    response.put("publishedAt", JSONObject.NULL);
                    response.put("downloadUrl", JSONObject.NULL);
                    response.put("sha256", JSONObject.NULL);
                    response.put("assetName", JSONObject.NULL);
                    response.put("assetSize", JSONObject.NULL);
                    call.resolve(response);
                    return;
                }
                if (status != HttpURLConnection.HTTP_OK) {
                    call.reject("GitHub respondió con el código " + status + ".");
                    return;
                }

                JSONObject release = new JSONObject(readText(connection.getInputStream()));
                String tagName = release.optString("tag_name", "").trim();
                if (tagName.isEmpty()) throw new IllegalStateException("La Release no tiene una versión válida.");

                JSONObject apkAsset = findApkAsset(release.optJSONArray("assets"));
                String downloadUrl = apkAsset.optString("browser_download_url", "");
                String digest = normalizeDigest(apkAsset.optString("digest", ""));
                if (downloadUrl.isEmpty()) throw new IllegalStateException("La Release no contiene una URL de descarga.");
                if (digest == null) throw new IllegalStateException("El APK publicado no incluye una huella SHA-256.");
                validateReleaseUrl(downloadUrl);

                String latestVersion = normalizeVersion(tagName);
                response.put("releaseAvailable", true);
                response.put("updateAvailable", compareVersions(latestVersion, response.getString("currentVersionName")) > 0);
                response.put("latestVersionName", latestVersion);
                response.put("releaseName", release.optString("name", tagName));
                response.put("releaseNotes", release.optString("body", ""));
                response.put("publishedAt", release.optString("published_at", ""));
                response.put("downloadUrl", downloadUrl);
                response.put("sha256", digest);
                response.put("assetName", apkAsset.optString("name", "Pablo-Tablet.apk"));
                response.put("assetSize", apkAsset.optLong("size", 0));
                call.resolve(response);
            } catch (Exception error) {
                call.reject(message(error, "No se pudo consultar la última versión."), error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "pablo-tablet-update-check").start();
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String downloadUrl = call.getString("downloadUrl", "");
        String expectedSha256 = normalizeDigest(call.getString("sha256", ""));
        String assetName = call.getString("assetName", "Pablo-Tablet.apk");
        if (expectedSha256 == null) {
            call.reject("La actualización no tiene una huella SHA-256 válida.");
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            File temporary = new File(updateDirectory(), UPDATE_FILE + ".part");
            try {
                validateReleaseUrl(downloadUrl);
                connection = openConnection(new URL(downloadUrl));
                int status = connection.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) throw new IllegalStateException("GitHub respondió con el código " + status + ".");
                long declaredSize = connection.getContentLengthLong();
                if (declaredSize > MAX_APK_BYTES) throw new IllegalStateException("El APK supera el tamaño máximo permitido.");

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long downloaded = 0;
                try (InputStream input = new BufferedInputStream(connection.getInputStream()); FileOutputStream output = new FileOutputStream(temporary)) {
                    byte[] buffer = new byte[16 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        downloaded += count;
                        if (downloaded > MAX_APK_BYTES) throw new IllegalStateException("El APK supera el tamaño máximo permitido.");
                        output.write(buffer, 0, count);
                        digest.update(buffer, 0, count);
                    }
                    output.getFD().sync();
                }

                String actualSha256 = hex(digest.digest());
                if (!actualSha256.equalsIgnoreCase(expectedSha256)) {
                    throw new SecurityException("La huella del APK descargado no coincide con la publicada en GitHub.");
                }

                File destination = downloadedUpdate();
                if (destination.exists() && !destination.delete()) throw new IllegalStateException("No se pudo reemplazar la descarga anterior.");
                if (!temporary.renameTo(destination)) throw new IllegalStateException("No se pudo guardar el APK descargado.");

                JSObject response = new JSObject();
                response.put("readyToInstall", true);
                response.put("assetName", assetName);
                response.put("bytesDownloaded", downloaded);
                call.resolve(response);
            } catch (Exception error) {
                if (temporary.exists()) temporary.delete();
                call.reject(message(error, "No se pudo descargar la actualización."), error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "pablo-tablet-update-download").start();
    }

    @PluginMethod
    public void installDownloadedUpdate(PluginCall call) {
        File apk = downloadedUpdate();
        if (!apk.isFile()) {
            call.reject("No hay ninguna actualización descargada.");
            return;
        }

        try {
            prepareForExternalActivity();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent settingsIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(settingsIntent);
                JSObject response = new JSObject();
                response.put("permissionRequired", true);
                response.put("installerOpened", false);
                call.resolve(response);
                return;
            }

            Uri apkUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().startActivity(installIntent);

            JSObject response = new JSObject();
            response.put("permissionRequired", false);
            response.put("installerOpened", true);
            call.resolve(response);
        } catch (Exception error) {
            call.reject(message(error, "No se pudo abrir el instalador de Android."), error);
        }
    }

    private HttpURLConnection openConnection(URL url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(60_000);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("X-GitHub-Api-Version", "2026-03-10");
        connection.setRequestProperty("User-Agent", "Pablo-Tablet-AppUpdater/1.0");
        return connection;
    }

    private JSObject installedVersionResponse() throws PackageManager.NameNotFoundException {
        PackageInfo packageInfo = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
        String currentVersion = packageInfo.versionName == null ? "0" : packageInfo.versionName;
        long currentVersionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P ? packageInfo.getLongVersionCode() : packageInfo.versionCode;
        JSObject response = new JSObject();
        response.put("currentVersionName", currentVersion);
        response.put("currentVersionCode", currentVersionCode);
        return response;
    }

    private JSONObject findApkAsset(JSONArray assets) {
        if (assets != null) {
            for (int index = 0; index < assets.length(); index++) {
                JSONObject asset = assets.optJSONObject(index);
                if (asset != null && asset.optString("name", "").toLowerCase(Locale.ROOT).endsWith(".apk")) return asset;
            }
        }
        throw new IllegalStateException("La Release no contiene ningún archivo APK.");
    }

    private String normalizeDigest(String value) {
        if (value == null) return null;
        String normalized = value.trim().toLowerCase(Locale.ROOT);
        if (normalized.startsWith("sha256:")) normalized = normalized.substring(7);
        return normalized.matches("[a-f0-9]{64}") ? normalized : null;
    }

    private void validateReleaseUrl(String value) throws Exception {
        URI uri = URI.create(value);
        if (!"https".equalsIgnoreCase(uri.getScheme()) || !"github.com".equalsIgnoreCase(uri.getHost()) || uri.getPath() == null || !uri.getPath().startsWith(RELEASE_DOWNLOAD_PREFIX)) {
            throw new SecurityException("La URL del APK no pertenece a las Releases oficiales de Pablo Tablet.");
        }
    }

    private String normalizeVersion(String value) {
        String normalized = value.trim();
        if (normalized.startsWith("v") || normalized.startsWith("V")) normalized = normalized.substring(1);
        return normalized;
    }

    private int compareVersions(String left, String right) {
        String[] leftParts = left.split("[-+]", 2)[0].split("\\.");
        String[] rightParts = right.split("[-+]", 2)[0].split("\\.");
        int length = Math.max(leftParts.length, rightParts.length);
        for (int index = 0; index < length; index++) {
            int leftValue = numericPart(leftParts, index);
            int rightValue = numericPart(rightParts, index);
            if (leftValue != rightValue) return Integer.compare(leftValue, rightValue);
        }
        return 0;
    }

    private int numericPart(String[] parts, int index) {
        if (index >= parts.length) return 0;
        String digits = parts[index].replaceAll("[^0-9].*$", "");
        if (digits.isEmpty()) return 0;
        try {
            return Integer.parseInt(digits);
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private File updateDirectory() {
        File directory = new File(getContext().getCacheDir(), "updates");
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException("No se pudo preparar la carpeta de actualizaciones.");
        return directory;
    }

    private File downloadedUpdate() {
        return new File(updateDirectory(), UPDATE_FILE);
    }

    private void prepareForExternalActivity() {
        if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).prepareForExternalActivity();
    }

    private String readText(InputStream input) throws Exception {
        StringBuilder text = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) text.append(line);
        }
        return text.toString();
    }

    private String hex(byte[] bytes) {
        StringBuilder value = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) value.append(String.format(Locale.ROOT, "%02x", item));
        return value.toString();
    }

    private String message(Exception error, String fallback) {
        String value = error.getMessage();
        return value == null || value.trim().isEmpty() ? fallback : value;
    }
}
