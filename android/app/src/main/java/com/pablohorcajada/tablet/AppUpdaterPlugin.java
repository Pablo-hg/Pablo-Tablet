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
    private static final String RELEASE_API = "https://api.github.com/repos/Pablo-hg/Pablo-Tablet/releases/latest";
    private static final String RELEASE_MANIFEST = "https://github.com/Pablo-hg/Pablo-Tablet/releases/latest/download/Pablo-Tablet-update.json";
    private static final String RELEASE_DOWNLOAD_PREFIX = "/Pablo-hg/Pablo-Tablet/releases/download/";
    private static final String UPDATE_FILE = "pablo-tablet-update.apk";
    private static final long MAX_APK_BYTES = 500L * 1024L * 1024L;

    @PluginMethod
    public void getInstalledVersion(PluginCall call) {
        try {
            call.resolve(installedVersionResponse());
        } catch (Exception error) {
            call.reject(message(error, AppLocale.text(getContext(), R.string.error_update_installed_version)), error);
        }
    }

    @PluginMethod
    public void checkForUpdate(PluginCall call) {
        new Thread(() -> {
            try {
                JSObject response = installedVersionResponse();
                ReleaseInfo release = readLatestRelease();
                if (release == null) {
                    response.put("releaseAvailable", false);
                    response.put("updateAvailable", false);
                    response.put("latestVersionName", JSONObject.NULL);
                    response.put("releaseName", JSONObject.NULL);
                    response.put("releaseNotes", JSONObject.NULL);
                    response.put("releaseHistory", JSONObject.NULL);
                    response.put("publishedAt", JSONObject.NULL);
                    response.put("downloadUrl", JSONObject.NULL);
                    response.put("sha256", JSONObject.NULL);
                    response.put("assetName", JSONObject.NULL);
                    response.put("assetSize", JSONObject.NULL);
                    call.resolve(response);
                    return;
                }

                String latestVersion = normalizeVersion(release.versionName);
                response.put("releaseAvailable", true);
                response.put("updateAvailable", compareVersions(latestVersion, response.getString("currentVersionName")) > 0);
                response.put("latestVersionName", latestVersion);
                response.put("releaseName", release.releaseName);
                response.put("releaseNotes", release.releaseNotes);
                response.put("releaseHistory", release.releaseHistory == null ? JSONObject.NULL : release.releaseHistory);
                response.put("publishedAt", release.publishedAt);
                response.put("downloadUrl", release.downloadUrl);
                response.put("sha256", release.sha256);
                response.put("assetName", release.assetName);
                response.put("assetSize", release.assetSize);
                call.resolve(response);
            } catch (Exception error) {
                call.reject(message(error, AppLocale.text(getContext(), R.string.error_update_latest_version)), error);
            }
        }, "pablo-tablet-update-check").start();
    }

    @PluginMethod
    public void downloadUpdate(PluginCall call) {
        String downloadUrl = call.getString("downloadUrl", "");
        String expectedSha256 = normalizeDigest(call.getString("sha256", ""));
        String assetName = call.getString("assetName", "Pablo-Tablet.apk");
        if (expectedSha256 == null) {
            call.reject(AppLocale.text(getContext(), R.string.error_update_invalid_digest));
            return;
        }

        new Thread(() -> {
            HttpURLConnection connection = null;
            File temporary = new File(updateDirectory(), UPDATE_FILE + ".part");
            try {
                validateReleaseUrl(downloadUrl);
                connection = openConnection(new URL(downloadUrl));
                int status = connection.getResponseCode();
                if (status != HttpURLConnection.HTTP_OK) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_github_status, status));
                long declaredSize = connection.getContentLengthLong();
                if (declaredSize > MAX_APK_BYTES) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_apk_too_large));
                notifyDownloadProgress("downloading", 0, declaredSize);

                MessageDigest digest = MessageDigest.getInstance("SHA-256");
                long downloaded = 0;
                long lastProgressNotification = 0;
                try (InputStream input = new BufferedInputStream(connection.getInputStream()); FileOutputStream output = new FileOutputStream(temporary)) {
                    byte[] buffer = new byte[16 * 1024];
                    int count;
                    while ((count = input.read(buffer)) != -1) {
                        downloaded += count;
                        if (downloaded > MAX_APK_BYTES) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_apk_too_large));
                        output.write(buffer, 0, count);
                        digest.update(buffer, 0, count);
                        long now = System.currentTimeMillis();
                        if (now - lastProgressNotification >= 200 || (declaredSize > 0 && downloaded >= declaredSize)) {
                            notifyDownloadProgress("downloading", downloaded, declaredSize);
                            lastProgressNotification = now;
                        }
                    }
                    output.getFD().sync();
                }

                notifyDownloadProgress("verifying", downloaded, declaredSize);
                String actualSha256 = hex(digest.digest());
                if (!actualSha256.equalsIgnoreCase(expectedSha256)) {
                    throw new SecurityException(AppLocale.text(getContext(), R.string.error_update_digest_mismatch));
                }

                File destination = downloadedUpdate();
                if (destination.exists() && !destination.delete()) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_replace_download));
                if (!temporary.renameTo(destination)) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_save_apk));
                notifyDownloadProgress("ready", downloaded, declaredSize);

                JSObject response = new JSObject();
                response.put("readyToInstall", true);
                response.put("assetName", assetName);
                response.put("bytesDownloaded", downloaded);
                call.resolve(response);
            } catch (Exception error) {
                if (temporary.exists()) temporary.delete();
                call.reject(message(error, AppLocale.text(getContext(), R.string.error_update_download)), error);
            } finally {
                if (connection != null) connection.disconnect();
            }
        }, "pablo-tablet-update-download").start();
    }

    @PluginMethod
    public void installDownloadedUpdate(PluginCall call) {
        File apk = downloadedUpdate();
        if (!apk.isFile()) {
            call.reject(AppLocale.text(getContext(), R.string.error_update_not_downloaded));
            return;
        }

        getActivity().runOnUiThread(() -> {
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
                call.reject(message(error, AppLocale.text(getContext(), R.string.error_update_open_installer)), error);
            }
        });
    }

    private HttpURLConnection openConnection(URL url) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(60_000);
        connection.setInstanceFollowRedirects(true);
        connection.setUseCaches(false);
        if ("api.github.com".equalsIgnoreCase(url.getHost())) {
            connection.setRequestProperty("Accept", "application/vnd.github+json");
            connection.setRequestProperty("X-GitHub-Api-Version", "2026-03-10");
        } else if (url.getPath().endsWith(".json")) {
            connection.setRequestProperty("Accept", "application/json");
        } else {
            connection.setRequestProperty("Accept", "application/octet-stream");
        }
        connection.setRequestProperty("User-Agent", "Pablo-Tablet-AppUpdater/1.0");
        return connection;
    }

    private ReleaseInfo readLatestRelease() throws Exception {
        HttpURLConnection connection = openConnection(new URL(RELEASE_MANIFEST));
        try {
            int status = connection.getResponseCode();
            if (status == HttpURLConnection.HTTP_OK) {
                return releaseFromManifest(new JSONObject(readText(connection.getInputStream())));
            }
            if (status != HttpURLConnection.HTTP_NOT_FOUND) {
                throw new IllegalStateException(githubErrorMessage(connection, status));
            }
        } finally {
            connection.disconnect();
        }
        return readLatestReleaseFromApi();
    }

    private ReleaseInfo readLatestReleaseFromApi() throws Exception {
        HttpURLConnection connection = openConnection(new URL(RELEASE_API));
        try {
            int status = connection.getResponseCode();
            if (status == HttpURLConnection.HTTP_NOT_FOUND) return null;
            if (status != HttpURLConnection.HTTP_OK) {
                throw new IllegalStateException(githubErrorMessage(connection, status));
            }

            JSONObject release = new JSONObject(readText(connection.getInputStream()));
            String tagName = release.optString("tag_name", "").trim();
            JSONObject apkAsset = findApkAsset(release.optJSONArray("assets"));
            return validatedReleaseInfo(
                tagName,
                release.optString("name", tagName),
                release.optString("body", ""),
                release.optString("published_at", ""),
                apkAsset.optString("browser_download_url", ""),
                apkAsset.optString("digest", ""),
                apkAsset.optString("name", "Pablo-Tablet.apk"),
                apkAsset.optLong("size", 0),
                null
            );
        } finally {
            connection.disconnect();
        }
    }

    private ReleaseInfo releaseFromManifest(JSONObject manifest) throws Exception {
        return validatedReleaseInfo(
            manifest.optString("versionName", ""),
            manifest.optString("releaseName", ""),
            manifest.optString("releaseNotes", ""),
            manifest.optString("publishedAt", ""),
            manifest.optString("downloadUrl", ""),
            manifest.optString("sha256", ""),
            manifest.optString("assetName", "Pablo-Tablet.apk"),
            manifest.optLong("assetSize", 0),
            manifest.optJSONArray("releaseHistory")
        );
    }

    private ReleaseInfo validatedReleaseInfo(
        String versionName,
        String releaseName,
        String releaseNotes,
        String publishedAt,
        String downloadUrl,
        String digestValue,
        String assetName,
        long assetSize,
        JSONArray releaseHistory
    ) throws Exception {
        String version = versionName.trim();
        if (version.isEmpty()) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_release_version));
        if (downloadUrl.isEmpty()) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_release_url_missing));
        String digest = normalizeDigest(digestValue);
        if (digest == null) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_release_digest_missing));
        validateReleaseUrl(downloadUrl);
        if (!assetName.toLowerCase(Locale.ROOT).endsWith(".apk")) {
            throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_manifest_not_apk));
        }
        if (assetSize < 0 || assetSize > MAX_APK_BYTES) {
            throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_manifest_size));
        }
        String name = releaseName.trim().isEmpty() ? version : releaseName;
        return new ReleaseInfo(version, name, releaseNotes, publishedAt, downloadUrl, digest, assetName, assetSize, releaseHistory);
    }

    private String githubErrorMessage(HttpURLConnection connection, int status) {
        String remaining = connection.getHeaderField("X-RateLimit-Remaining");
        if ((status == HttpURLConnection.HTTP_FORBIDDEN || status == 429) && "0".equals(remaining)) {
            return AppLocale.text(getContext(), R.string.error_update_rate_limited);
        }
        return AppLocale.text(getContext(), R.string.error_update_github_status, status);
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
        throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_release_no_apk));
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
            throw new SecurityException(AppLocale.text(getContext(), R.string.error_update_untrusted_url));
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
        if (!directory.exists() && !directory.mkdirs()) throw new IllegalStateException(AppLocale.text(getContext(), R.string.error_update_directory));
        return directory;
    }

    private File downloadedUpdate() {
        return new File(updateDirectory(), UPDATE_FILE);
    }

    private void notifyDownloadProgress(String phase, long downloaded, long total) {
        JSObject progress = new JSObject();
        progress.put("phase", phase);
        progress.put("bytesDownloaded", downloaded);
        progress.put("totalBytes", total > 0 ? total : JSONObject.NULL);
        progress.put("percent", total > 0 ? Math.min(100, Math.round(downloaded * 100f / total)) : JSONObject.NULL);
        getActivity().runOnUiThread(() -> notifyListeners("downloadProgress", progress));
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

    private static final class ReleaseInfo {
        final String versionName;
        final String releaseName;
        final String releaseNotes;
        final JSONArray releaseHistory;
        final String publishedAt;
        final String downloadUrl;
        final String sha256;
        final String assetName;
        final long assetSize;

        ReleaseInfo(
            String versionName,
            String releaseName,
            String releaseNotes,
            String publishedAt,
            String downloadUrl,
            String sha256,
            String assetName,
            long assetSize,
            JSONArray releaseHistory
        ) {
            this.versionName = versionName;
            this.releaseName = releaseName;
            this.releaseNotes = releaseNotes;
            this.releaseHistory = releaseHistory;
            this.publishedAt = publishedAt;
            this.downloadUrl = downloadUrl;
            this.sha256 = sha256;
            this.assetName = assetName;
            this.assetSize = assetSize;
        }
    }
}
