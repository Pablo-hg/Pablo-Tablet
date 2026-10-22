package com.pablohorcajada.tablet;

import android.Manifest;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "MobileAdmin",
    permissions = {
        @Permission(alias = MobileAdminPlugin.NOTIFICATIONS_PERMISSION, strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public class MobileAdminPlugin extends Plugin {
    static final String NOTIFICATIONS_PERMISSION = "notifications";
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
            call.resolve(statusResult());
        } catch (Exception error) {
            call.reject(AppLocale.text(getContext(), R.string.error_mobile_admin_status), error);
        }
    }

    @PluginMethod
    public void setEnabled(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled");
        if (enabled == null) {
            call.reject(AppLocale.text(getContext(), R.string.error_mobile_admin_enabled_missing));
            return;
        }
        if (enabled && shouldRequestNotificationPermission()) {
            requestPermissionForAlias(NOTIFICATIONS_PERMISSION, call, "enableAfterNotificationPermission");
            return;
        }
        applyEnabled(call, enabled);
    }

    @PermissionCallback
    private void enableAfterNotificationPermission(PluginCall call) {
        if (getPermissionState(NOTIFICATIONS_PERMISSION) != PermissionState.GRANTED) {
            call.reject(AppLocale.text(getContext(), R.string.error_mobile_admin_notifications_permission));
            return;
        }
        applyEnabled(call, true);
    }

    private boolean shouldRequestNotificationPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState(NOTIFICATIONS_PERMISSION) != PermissionState.GRANTED;
    }

    private void applyEnabled(PluginCall call, boolean enabled) {
        MobileAdminServiceController.setEnabled(getContext(), enabled);
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
            call.reject(AppLocale.text(getContext(), R.string.error_mobile_admin_pairing_qr), error);
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
            call.reject(AppLocale.text(getContext(), R.string.error_mobile_admin_request_approve), error);
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
        manager.revokeDevice(id);
        call.resolve();
    }

    @PluginMethod
    public void revokeAllDevices(PluginCall call) {
        try {
            int revokedCount = manager.revokeAllDevices();
            JSObject result = new JSObject();
            result.put("revokedCount", revokedCount);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(AppLocale.text(getContext(), R.string.error_mobile_admin_revoke_devices), error);
        }
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
        result.put("serviceState", snapshot.serviceState);
        return result;
    }

    private String required(PluginCall call, String key) {
        String value = call.getString(key);
        if (value == null || value.trim().isEmpty()) {
            call.reject(AppLocale.text(getContext(), R.string.error_required_field, key));
            return null;
        }
        return value;
    }
}
