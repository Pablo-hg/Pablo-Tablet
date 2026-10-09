package com.pablohorcajada.tablet;

import android.content.Context;
import android.content.Intent;

import androidx.core.content.ContextCompat;

final class MobileAdminServiceController {
    private MobileAdminServiceController() { }

    static void reconcile(Context context) {
        Context applicationContext = context.getApplicationContext();
        if (new MobileAdminAccessPreference(applicationContext).isEnabled()) {
            start(applicationContext);
        } else {
            MobileAdminManager.get(applicationContext).stop();
            applicationContext.stopService(serviceIntent(applicationContext));
        }
    }

    static void setEnabled(Context context, boolean enabled) {
        Context applicationContext = context.getApplicationContext();
        MobileAdminManager manager = MobileAdminManager.get(applicationContext);
        manager.setEnabled(enabled);
        if (enabled) start(applicationContext);
        else applicationContext.stopService(serviceIntent(applicationContext));
    }

    private static void start(Context context) {
        try {
            ContextCompat.startForegroundService(context, serviceIntent(context));
        } catch (RuntimeException error) {
            MobileAdminManager.get(context).reportLifecycleError("Android no pudo mantener activo el servicio de administración móvil.");
        }
    }

    static Intent serviceIntent(Context context) {
        return new Intent(context, MobileAdminService.class);
    }
}
