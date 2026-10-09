package com.pablohorcajada.tablet;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

public final class MobileAdminService extends Service {
    static final String CHANNEL_ID = "mobile-admin";
    static final int NOTIFICATION_ID = 8765;

    private MobileAdminManager manager;
    private NotificationManager notificationManager;
    private final Runnable statusListener = this::updateNotification;

    @Override
    public void onCreate() {
        super.onCreate();
        manager = MobileAdminManager.get(this);
        notificationManager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        createNotificationChannel();
        manager.addStatusListener(statusListener);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!new MobileAdminAccessPreference(this).isEnabled()) {
            manager.stop();
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf(startId);
            return START_NOT_STICKY;
        }

        int foregroundType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
            : 0;
        ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(manager.statusSnapshot()), foregroundType);
        manager.clearLifecycleError();
        manager.start();
        updateNotification();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        manager.removeStatusListener(statusListener);
        manager.stop();
        stopForeground(STOP_FOREGROUND_REMOVE);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (notificationManager == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            getString(R.string.mobile_admin_channel_name),
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription(getString(R.string.mobile_admin_notification_waiting));
        channel.setShowBadge(false);
        notificationManager.createNotificationChannel(channel);
    }

    private void updateNotification() {
        if (notificationManager == null || manager == null || !manager.isEnabled()) return;
        notificationManager.notify(NOTIFICATION_ID, buildNotification(manager.statusSnapshot()));
    }

    private Notification buildNotification(MobileAdminManager.StatusSnapshot snapshot) {
        Intent openApp = new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            openApp,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        String content = snapshot.localAddress != null
            ? getString(R.string.mobile_admin_notification_available, snapshot.localAddress)
            : snapshot.error == null
                ? getString(R.string.mobile_admin_notification_waiting)
                : snapshot.error;
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_mobile_admin)
            .setContentTitle(getString(R.string.mobile_admin_notification_title))
            .setContentText(content)
            .setContentIntent(contentIntent)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }
}
