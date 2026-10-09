package com.pablohorcajada.tablet;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MobileAdmin")
public class MobileAdminPlugin extends Plugin {
    private MobileAdminManager manager;
    private final Runnable statusListener = this::emitStatusChanged;

    @Override
    public void load() {
        manager = MobileAdminManager.get(getContext());
        manager.addStatusListener(statusListener);
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) manager.removeStatusListener(statusListener);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        try {
            manager.start();
            call.resolve(statusResult());
        } catch (Exception error) {
            call.reject("No se pudo consultar el servidor local.", error);
        }
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject("Falta indicar si el acceso móvil debe estar activado.");
            return;
        }
        manager.setEnabled(enabled);
        getStatus(call);
    }

    @PluginMethod
    public void createPairing(PluginCall call) {
        try {
            MobileAdminManager.PairingSnapshot snapshot = manager.createPairing();
            MobileAdminRepository.PairingSession session = snapshot.session;
            JSObject result = new JSObject();
            result.put("id", session.id);
            result.put("url", session.url);
            result.put("expiresAt", session.expiresAt);
            result.put("networkGeneration", snapshot.networkGeneration);
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

    private void emitStatusChanged() {
        notifyListeners("statusChanged", statusResult(), true);
    }

    private JSObject statusResult() {
        MobileAdminManager.StatusSnapshot snapshot = manager.statusSnapshot();
        JSObject result = new JSObject();
        result.put("enabled", snapshot.enabled);
        result.put("running", snapshot.running);
        result.put("port", snapshot.port);
        result.put("localAddress", snapshot.localAddress == null ? JSObject.NULL : snapshot.localAddress);
        result.put("hostname", JSObject.NULL);
        result.put("networkGeneration", snapshot.networkGeneration);
        result.put("error", snapshot.error == null ? JSObject.NULL : snapshot.error);
        return result;
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
