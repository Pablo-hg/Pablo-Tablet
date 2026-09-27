package com.pablohorcajada.tablet;

import android.content.Context;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DeviceSettings")
public class DeviceSettingsPlugin extends Plugin {
    private ToneGenerator previewTone;

    @PluginMethod
    public void apply(PluginCall call) {
        int brightness = clamp(call.getInt("brightness", 75), 10, 100);
        int alarmVolume = clamp(call.getInt("alarmVolume", 80), 0, 100);
        int mediaVolume = clamp(call.getInt("mediaVolume", 60), 0, 100);
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
            WindowManager.LayoutParams attributes = getActivity().getWindow().getAttributes();
            attributes.screenBrightness = brightness / 100f;
            getActivity().getWindow().setAttributes(attributes);

            if (keepScreenAwake) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
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
