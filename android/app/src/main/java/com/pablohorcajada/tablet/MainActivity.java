package com.pablohorcajada.tablet;

import android.app.ActivityManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private final Handler kioskHandler = new Handler(Looper.getMainLooper());
    private boolean appExitRequested = false;
    private boolean activityResumed = false;
    private final Runnable startLockTaskRunnable = () -> {
        if (appExitRequested || !activityResumed || !hasWindowFocus() || isInLockTaskMode()) return;

        try {
            startLockTask();
        } catch (RuntimeException ignored) {
            // The activity can lose focus while Android handles permissions or another native screen.
            // onWindowFocusChanged will retry when Pablo Tablet is foreground again.
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmSoundsPlugin.class);
        registerPlugin(DeviceSettingsPlugin.class);
        registerPlugin(KioskPlugin.class);
        registerPlugin(GalleryPlugin.class);
        registerPlugin(AppStoragePlugin.class);
        registerPlugin(MobileAdminPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
        MobileAdminManager.get(this).start();
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener((visibility) -> {
            if (!appExitRequested && (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                new Handler(Looper.getMainLooper()).postDelayed(this::enableImmersiveMode, 80);
            }
        });
        enableImmersiveMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        activityResumed = true;
        if (!appExitRequested) {
            enterKioskMode();
        }
    }

    @Override
    public void onPause() {
        activityResumed = false;
        kioskHandler.removeCallbacks(startLockTaskRunnable);
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && activityResumed && !appExitRequested) {
            enterKioskMode();
        }
    }

    @Override
    public void onBackPressed() {
        if (appExitRequested) {
            super.onBackPressed();
        }
    }

    public void enterKioskMode() {
        appExitRequested = false;
        enableImmersiveMode();
        kioskHandler.removeCallbacks(startLockTaskRunnable);
        kioskHandler.postDelayed(startLockTaskRunnable, 350);
    }

    public void exitKioskMode() {
        appExitRequested = true;
        kioskHandler.removeCallbacks(startLockTaskRunnable);
        leaveKioskMode();

        new Handler(Looper.getMainLooper()).postDelayed(() -> finishAndRemoveTask(), 180);
    }

    public void prepareForExternalActivity() {
        kioskHandler.removeCallbacks(startLockTaskRunnable);
        leaveKioskMode();
    }

    private void leaveKioskMode() {
        if (isInLockTaskMode()) {
            try {
                stopLockTask();
            } catch (IllegalStateException ignored) {
                // The activity may already have left lock task mode.
            }
        }

        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.show(WindowInsetsCompat.Type.systemBars());
        }
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
    }

    private boolean isInLockTaskMode() {
        ActivityManager manager = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        return manager != null && manager.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private void enableImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        );
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
        }
    }
}
