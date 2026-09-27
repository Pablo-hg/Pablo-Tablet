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
    private boolean kioskExitRequested = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmSoundsPlugin.class);
        registerPlugin(DeviceSettingsPlugin.class);
        registerPlugin(KioskPlugin.class);
        registerPlugin(GalleryPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setOnSystemUiVisibilityChangeListener((visibility) -> {
            if (!kioskExitRequested && (visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                new Handler(Looper.getMainLooper()).postDelayed(this::enableImmersiveMode, 80);
            }
        });
        enterKioskMode();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!kioskExitRequested) {
            enterKioskMode();
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus && !kioskExitRequested) {
            enableImmersiveMode();
        }
    }

    @Override
    public void onBackPressed() {
        if (kioskExitRequested) {
            super.onBackPressed();
        }
    }

    public void enterKioskMode() {
        kioskExitRequested = false;
        enableImmersiveMode();
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            if (!isInLockTaskMode()) {
                try {
                    startLockTask();
                } catch (IllegalStateException ignored) {
                    // Immersive mode remains active when lock task is unavailable.
                }
            }
        }, 350);
    }

    public void exitKioskMode() {
        kioskExitRequested = true;
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

        new Handler(Looper.getMainLooper()).postDelayed(() -> finishAndRemoveTask(), 180);
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
