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
        return preferences.getBoolean(ENABLED_KEY, false);
    }

    void setEnabled(boolean enabled) {
        preferences.edit().putBoolean(ENABLED_KEY, enabled).apply();
    }
}
