package com.pablohorcajada.tablet;

import android.content.Context;
import android.content.SharedPreferences;

final class MobileAdminAccessPreference {
    private static final String PREFERENCES_NAME = "mobile-admin-security";
    private static final String ENABLED_KEY = "lan-access-enabled";
    private final SharedPreferences preferences;

    MobileAdminAccessPreference(Context context) {
        preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
    }

    boolean isEnabled() {
        // El servidor de administración tiene un puerto fijo (8765). No permitir
        // que DEV compita con la instalación estable al convivir ambas APK.
        return !BuildConfig.DEBUG && preferences.getBoolean(ENABLED_KEY, false);
    }

    void setEnabled(boolean enabled) {
        // DEV nunca levanta el servicio LAN, aunque el usuario pulse activar.
        preferences.edit().putBoolean(ENABLED_KEY, !BuildConfig.DEBUG && enabled).apply();
    }
}
