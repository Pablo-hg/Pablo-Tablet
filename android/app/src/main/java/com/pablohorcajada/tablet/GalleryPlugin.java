package com.pablohorcajada.tablet;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.time.Instant;
import java.util.UUID;

@CapacitorPlugin(name = "Gallery")
public class GalleryPlugin extends Plugin {
    @PluginMethod
    public void pickImages(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickedImages");
    }

    @ActivityCallback
    private void pickedImages(PluginCall call, ActivityResult result) {
        resumeKiosk();
        if (call == null) return;

        JSArray photos = new JSArray();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            JSObject response = new JSObject();
            response.put("photos", photos);
            call.resolve(response);
            return;
        }

        try {
            Intent data = result.getData();
            ClipData clipData = data.getClipData();
            if (clipData != null) {
                for (int index = 0; index < clipData.getItemCount(); index++) {
                    photos.put(copyImage(clipData.getItemAt(index).getUri()));
                }
            } else if (data.getData() != null) {
                photos.put(copyImage(data.getData()));
            }
            JSObject response = new JSObject();
            response.put("photos", photos);
            call.resolve(response);
        } catch (Exception error) {
            call.reject("No se pudieron copiar las imágenes seleccionadas.", error);
        }
    }

    @PluginMethod
    public void deleteImage(PluginCall call) {
        String uriValue = call.getString("uri");
        if (uriValue == null || uriValue.isEmpty()) {
            call.reject("Falta la imagen que se debe eliminar.");
            return;
        }

        try {
            File galleryDirectory = galleryDirectory().getCanonicalFile();
            File photo = new File(Uri.parse(uriValue).getPath()).getCanonicalFile();
            if (!photo.getPath().startsWith(galleryDirectory.getPath() + File.separator)) {
                call.reject("La imagen no pertenece a la galería de Pablo Tablet.");
                return;
            }
            if (photo.exists() && !photo.delete()) {
                call.reject("No se pudo eliminar el archivo de imagen.");
                return;
            }
            call.resolve();
        } catch (Exception error) {
            call.reject("No se pudo eliminar la imagen.", error);
        }
    }

    private JSObject copyImage(Uri source) throws Exception {
        String displayName = displayName(source);
        String extension = extension(source, displayName);
        String id = UUID.randomUUID().toString();
        File destination = new File(galleryDirectory(), id + extension);

        try (InputStream input = getContext().getContentResolver().openInputStream(source);
             FileOutputStream output = new FileOutputStream(destination)) {
            if (input == null) throw new IllegalStateException("No se pudo abrir la imagen.");
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        }

        JSObject photo = new JSObject();
        photo.put("id", id);
        photo.put("name", displayName);
        photo.put("uri", Uri.fromFile(destination).toString());
        photo.put("createdAt", Instant.now().toString());
        return photo;
    }

    private File galleryDirectory() {
        File directory = new File(getContext().getFilesDir(), "gallery");
        if (!directory.exists() && !directory.mkdirs()) {
            throw new IllegalStateException("No se pudo crear la carpeta de la galería.");
        }
        return directory;
    }

    private String displayName(Uri uri) {
        try (Cursor cursor = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int column = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (column >= 0) {
                    String value = cursor.getString(column);
                    if (value != null && !value.trim().isEmpty()) return value;
                }
            }
        }
        return "Foto";
    }

    private String extension(Uri uri, String displayName) {
        int dot = displayName.lastIndexOf('.');
        if (dot >= 0 && dot < displayName.length() - 1) {
            String value = displayName.substring(dot).toLowerCase();
            if (value.matches("\\.[a-z0-9]{1,8}")) return value;
        }
        String mime = getContext().getContentResolver().getType(uri);
        String value = mime == null ? null : MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
        return value == null ? ".jpg" : "." + value;
    }

    private void resumeKiosk() {
        if (getActivity() instanceof MainActivity) ((MainActivity) getActivity()).enterKioskMode();
    }
}
