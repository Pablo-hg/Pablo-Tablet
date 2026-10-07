package com.pablohorcajada.tablet;

import android.content.Context;
import android.content.pm.ActivityInfo;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceSettings")
public class DeviceSettingsPlugin extends Plugin implements SensorEventListener {
    private ToneGenerator previewTone;
    private SensorManager sensorManager;
    private Sensor lightSensor;
    private boolean automaticBrightnessEnabled = false;
    private float appliedAutomaticBrightness = -1f;

    @PluginMethod
    public void apply(PluginCall call) {
        int brightness = clamp(call.getInt("brightness", 75), 1, 100);
        boolean autoBrightness = call.getBoolean("autoBrightness", false);
        int alarmVolume = clamp(call.getInt("alarmVolume", 80), 0, 100);
        int mediaVolume = clamp(call.getInt("mediaVolume", 60), 0, 100);
        boolean autoRotate = call.getBoolean("autoRotate", true);
        boolean keepScreenAwake = call.getBoolean("keepScreenAwake", true);
        int screenTimeoutSeconds = clamp(call.getInt("screenTimeoutSeconds", 60), 30, 600);

        AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            setStreamVolume(audioManager, AudioManager.STREAM_ALARM, alarmVolume);
            setStreamVolume(audioManager, AudioManager.STREAM_MUSIC, mediaVolume);
        }

        if (!keepScreenAwake && Settings.System.canWrite(getContext())) {
            Settings.System.putInt(getContext().getContentResolver(), Settings.System.SCREEN_OFF_TIMEOUT, screenTimeoutSeconds * 1000);
        }

        getActivity().runOnUiThread(() -> {
            getActivity().setRequestedOrientation(
                autoRotate
                    ? ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                    : ActivityInfo.SCREEN_ORIENTATION_LOCKED
            );

            if (autoBrightness) {
                enableAutomaticBrightness();
            } else {
                disableAutomaticBrightness();
                setWindowBrightness(brightness / 100f);
            }

            if (keepScreenAwake) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }

    private void enableAutomaticBrightness() {
        if (automaticBrightnessEnabled) return;
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        lightSensor = sensorManager == null ? null : sensorManager.getDefaultSensor(Sensor.TYPE_LIGHT);
        automaticBrightnessEnabled = true;
        appliedAutomaticBrightness = -1f;
        if (lightSensor != null) {
            sensorManager.registerListener(this, lightSensor, SensorManager.SENSOR_DELAY_NORMAL);
        } else {
            setWindowBrightness(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE);
        }
    }

    private void disableAutomaticBrightness() {
        automaticBrightnessEnabled = false;
        appliedAutomaticBrightness = -1f;
        if (sensorManager != null) sensorManager.unregisterListener(this);
        lightSensor = null;
    }

    private void setWindowBrightness(float brightness) {
        WindowManager.LayoutParams attributes = getActivity().getWindow().getAttributes();
        attributes.screenBrightness = brightness;
        getActivity().getWindow().setAttributes(attributes);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (!automaticBrightnessEnabled || event.sensor.getType() != Sensor.TYPE_LIGHT) return;
        float lux = Math.max(0f, event.values[0]);
        float normalized = (float) (Math.log10(lux + 1f) / 4f);
        float target = Math.max(0.10f, Math.min(1f, 0.10f + normalized * 0.90f));
        if (appliedAutomaticBrightness >= 0f) target = appliedAutomaticBrightness * 0.72f + target * 0.28f;
        if (Math.abs(target - appliedAutomaticBrightness) < 0.025f) return;
        appliedAutomaticBrightness = target;
        float nextBrightness = target;
        getActivity().runOnUiThread(() -> setWindowBrightness(nextBrightness));
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // No calibration action is needed for brightness changes.
    }

    @Override
    protected void handleOnDestroy() {
        disableAutomaticBrightness();
        releasePreviewTone();
        super.handleOnDestroy();
    }

    @PluginMethod
    public synchronized void previewVolume(PluginCall call) {
        String channel = call.getString("channel", "media");
        int volume = clamp(call.getInt("volume", 60), 0, 100);
        int stream = "alarm".equals(channel) ? AudioManager.STREAM_ALARM : AudioManager.STREAM_MUSIC;
        AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            setStreamVolume(audioManager, stream, volume);
        }
        releasePreviewTone();
        previewTone = new ToneGenerator(stream, 100);
        previewTone.startTone(ToneGenerator.TONE_PROP_BEEP, 140);
        new Handler(Looper.getMainLooper()).postDelayed(this::releasePreviewTone, 220);
        call.resolve();
    }

    @PluginMethod
    public void playInteractionSound(PluginCall call) {
        int volume = clamp(call.getInt("volume", 60), 0, 100);
        AudioManager audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null && volume > 0) {
            setStreamVolume(audioManager, AudioManager.STREAM_MUSIC, volume);
            audioManager.playSoundEffect(AudioManager.FX_KEY_CLICK, volume / 100f);
        }
        call.resolve();
    }

    private void setStreamVolume(AudioManager audioManager, int stream, int percentage) {
        int maximum = audioManager.getStreamMaxVolume(stream);
        int volume = Math.round(maximum * (percentage / 100f));
        audioManager.setStreamVolume(stream, volume, 0);
    }

    private synchronized void releasePreviewTone() {
        if (previewTone != null) {
            previewTone.stopTone();
            previewTone.release();
            previewTone = null;
        }
    }

    private int clamp(int value, int minimum, int maximum) {
        return Math.max(minimum, Math.min(maximum, value));
    }
}
