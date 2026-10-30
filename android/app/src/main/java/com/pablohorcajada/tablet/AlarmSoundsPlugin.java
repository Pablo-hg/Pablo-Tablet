package com.pablohorcajada.tablet;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.database.Cursor;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "AlarmSounds")
public class AlarmSoundsPlugin extends Plugin {
    private Ringtone previewRingtone;
    private Vibrator vibrator;

    @PluginMethod
    public void listAlarmSounds(PluginCall call) {
        JSArray sounds = new JSArray();
        Set<String> includedUris = new HashSet<>();
        Uri defaultUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        addSound(sounds, includedUris, AppLocale.text(getContext(), R.string.alarm_default_sound), defaultUri);

        RingtoneManager manager = new RingtoneManager(getContext());
        manager.setType(RingtoneManager.TYPE_ALARM);
        Cursor cursor = manager.getCursor();
        try {
            for (int position = 0; position < cursor.getCount(); position++) {
                cursor.moveToPosition(position);
                Uri uri = manager.getRingtoneUri(position);
                Ringtone ringtone = manager.getRingtone(position);
                String title = ringtone != null ? ringtone.getTitle(getContext()) : AppLocale.text(getContext(), R.string.alarm_sound);
                addSound(sounds, includedUris, title, uri);
            }
        } finally {
            cursor.close();
        }

        JSObject result = new JSObject();
        result.put("sounds", sounds);
        call.resolve(result);
    }

    @PluginMethod
    public void playSound(PluginCall call) {
        stopPreview();
        Uri uri = parseSoundUri(call.getString("uri"));
        previewRingtone = RingtoneManager.getRingtone(getContext(), uri);
        if (previewRingtone == null) {
            call.reject(AppLocale.text(getContext(), R.string.error_alarm_sound_playback));
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            previewRingtone.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build());
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            previewRingtone.setLooping(call.getBoolean("loop", false));
        }
        previewRingtone.play();
        if (call.getBoolean("vibrate", false)) {
            vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            long[] pattern = new long[] { 0, 450, 220, 450, 500 };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                vibrator.vibrate(pattern, 0);
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void stopSound(PluginCall call) {
        stopPreview();
        call.resolve();
    }

    @PluginMethod
    public void configureChannel(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve();
            return;
        }

        String channelId = call.getString("channelId");
        String channelName = call.getString("name", AppLocale.text(getContext(), R.string.alarm_channel_name));
        if (channelId == null || channelId.isEmpty()) {
            call.reject(AppLocale.text(getContext(), R.string.error_alarm_channel_id_missing));
            return;
        }

        NotificationManager notificationManager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        // Sound is immutable once Android creates a channel. The web layer uses
        // a channel id per sound, preserving Android's per-channel user settings.
        NotificationChannel channel = new NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription(AppLocale.text(getContext(), R.string.alarm_channel_description));
        boolean silent = Boolean.TRUE.equals(call.getBoolean("silent", false));
        channel.enableVibration(!silent);
        if (silent) {
            channel.setSound(null, null);
        } else {
            AudioAttributes attributes = new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build();
            channel.setSound(parseSoundUri(call.getString("soundUri")), attributes);
        }
        notificationManager.createNotificationChannel(channel);
        call.resolve();
    }

    private Uri parseSoundUri(String value) {
        if (value == null || value.isEmpty()) return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
        return Uri.parse(value);
    }

    private void addSound(JSArray sounds, Set<String> includedUris, String name, Uri uri) {
        if (uri == null || !includedUris.add(uri.toString())) return;
        JSObject sound = new JSObject();
        sound.put("name", name);
        sound.put("uri", uri.toString());
        sounds.put(sound);
    }

    private void stopPreview() {
        if (previewRingtone != null && previewRingtone.isPlaying()) previewRingtone.stop();
        previewRingtone = null;
        if (vibrator != null) vibrator.cancel();
        vibrator = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopPreview();
    }
}
