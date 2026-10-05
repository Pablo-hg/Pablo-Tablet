package com.pablohorcajada.tablet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MobileAdmin")
public class MobileAdminPlugin extends Plugin {
    private MobileAdminManager manager;

    @Override
    public void load() {
        manager = MobileAdminManager.get(getContext());
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            manager.start();
            String localAddress = manager.localAddress();
            JSObject result = new JSObject();
            result.put("running", manager.isRunning());
            result.put("port", manager.port());
            result.put("localAddress", localAddress == null ? JSObject.NULL : localAddress);
            result.put("hostname", "http://pablotablet.local:" + manager.port());
            result.put("error", manager.error() == null ? JSObject.NULL : manager.error());
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo consultar el servidor local.", error);
        }
    }

    @PluginMethod
    public void createPairing(PluginCall call) {
        try {
            MobileAdminRepository.PairingSession session = manager.repository().createPairing(manager.pairingBaseAddress());
            JSObject result = new JSObject();
            result.put("id", session.id);
            result.put("url", session.url);
            result.put("expiresAt", session.expiresAt);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("No se pudo crear el QR de vinculación.", error);
        }
    }

    @PluginMethod
    public void cancelPairing(PluginCall call) {
        String id = required(call, "id");
        if (id == null) return;
        manager.repository().cancelPairing(id);
        call.resolve();
    }

    @PluginMethod
    public void listPendingRequests(PluginCall call) {
        JSObject result = new JSObject();
        result.put("requests", manager.repository().pendingRequests());
        call.resolve(result);
    }

    @PluginMethod
    public void approveRequest(PluginCall call) {
        String id = required(call, "id");
        if (id == null) return;
        try {
            manager.repository().approve(id);
            call.resolve();
        } catch (Exception error) {
            call.reject("La solicitud ya no se puede aprobar.", error);
        }
    }

    @PluginMethod
    public void rejectRequest(PluginCall call) {
        String id = required(call, "id");
        if (id == null) return;
        manager.repository().reject(id);
        call.resolve();
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        JSObject result = new JSObject();
        result.put("devices", manager.repository().devices());
        call.resolve(result);
    }

    @PluginMethod
    public void renameDevice(PluginCall call) {
        String id = required(call, "id");
        String name = required(call, "name");
        if (id == null || name == null) return;
        manager.repository().renameDevice(id, name);
        call.resolve();
    }

    @PluginMethod
    public void revokeDevice(PluginCall call) {
        String id = required(call, "id");
        if (id == null) return;
        manager.repository().revokeDevice(id);
        call.resolve();
    }

    private String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) {
            call.reject("Falta el campo " + key + ".");
            return null;
        }
        return value;
    }
}
