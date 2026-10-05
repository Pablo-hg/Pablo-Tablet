package com.pablohorcajada.tablet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AppStorage")
public class AppStoragePlugin extends Plugin {
    private PabloTabletDatabase database;

    @Override
    public void load() {
        database = PabloTabletDatabase.get(getContext());
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = requiredKey(call);
        if (key == null) return;

        try {
            PabloTabletDatabase.StorageRecord record = database.readStorage(key);
            JSObject result = new JSObject();
            if (record.value != null) {
                result.put("value", record.value);
                result.put("updatedAt", record.updatedAt);
            } else {
                result.put("value", JSObject.NULL);
                result.put("updatedAt", JSObject.NULL);
            }
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudieron leer los datos locales de Pablo Tablet.", error);
        }
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = requiredKey(call);
        if (key == null) return;
        String value = call.getString("value");
        if (value == null) {
            call.reject("Falta el valor que se debe guardar.");
            return;
        }

        try {
            long updatedAt = database.writeStorage(key, value);
            MobileAdminManager.get(getContext()).broadcastStateChanged(updatedAt);
            JSObject result = new JSObject();
            result.put("updatedAt", updatedAt);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudieron guardar los datos locales de Pablo Tablet.", error);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = requiredKey(call);
        if (key == null) return;
        try {
            database.removeStorage(key);
            call.resolve();
        } catch (Exception error) {
            call.reject("No se pudieron eliminar los datos locales solicitados.", error);
        }
    }

    private String requiredKey(PluginCall call) {
        String key = call.getString("key");
        if (key == null || key.trim().isEmpty() || key.length() > 100) {
            call.reject("La clave de almacenamiento no es válida.");
            return null;
        }
        return key;
    }
}
