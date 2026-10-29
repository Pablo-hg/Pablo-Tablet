package com.pablohorcajada.tablet;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import com.capacitorjs.plugins.localnotifications.DateMatch;
import com.capacitorjs.plugins.localnotifications.LocalNotificationManager;
import com.capacitorjs.plugins.localnotifications.LocalNotification;
import com.capacitorjs.plugins.localnotifications.LocalNotificationSchedule;
import com.capacitorjs.plugins.localnotifications.NotificationStorage;
import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
import com.getcapacitor.CapConfig;
import com.getcapacitor.JSObject;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.shadows.ShadowAlarmManager;
import java.util.Calendar;
import java.util.Date;
import java.util.Collections;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.assertNull;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
public class RecurringNotificationTest {
    private Context context;
    private ShadowAlarmManager alarms;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        alarms = shadowOf((AlarmManager) context.getSystemService(Context.ALARM_SERVICE));
        alarms.setCanScheduleExactAlarms(true);
    }

    @Test
    public void repeatedExactAlarmKeepsWakeupAndAllowWhileIdle() {
        publish(true);
        ShadowAlarmManager.ScheduledAlarm next = alarms.getScheduledAlarms().get(0);
        assertEquals(AlarmManager.RTC_WAKEUP, next.type);
        assertTrue(next.allowWhileIdle);
        assertEquals(0, next.getWindowLengthMs());
    }

    @Test
    public void repeatedInexactAlarmStillWakesAndAllowsIdle() {
        publish(false);
        ShadowAlarmManager.ScheduledAlarm next = alarms.getScheduledAlarms().get(0);
        assertEquals(AlarmManager.RTC_WAKEUP, next.type);
        assertTrue(next.allowWhileIdle);
    }

    @Test
    public void nativeAlarmsAndTimersKeepAlarmAudioCategory() throws Exception {
        assertEquals(Notification.CATEGORY_ALARM, scheduleNotification("alarm").category);
        assertEquals(Notification.CATEGORY_ALARM, scheduleNotification("timer").category);
    }

    @Test
    public void calendarIsNotClassifiedAsAnAudibleAlarm() throws Exception {
        assertNull(scheduleNotification("calendar").category);
    }

    private Notification scheduleNotification(String kind) throws Exception {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel("test-alarm", "Test", NotificationManager.IMPORTANCE_HIGH));
        LocalNotification notification = new LocalNotification();
        notification.setId(30);
        notification.setTitle("Prueba 30");
        notification.setChannelId("test-alarm");
        notification.setExtra(new JSObject().put("kind", kind));
        notification.setSchedule(new LocalNotificationSchedule(new JSObject("{\"allowWhileIdle\":true,\"on\":{\"hour\":7,\"minute\":30,\"second\":0}}")));
        new LocalNotificationManager(new NotificationStorage(context), null, context, CapConfig.loadDefault(context))
            .schedule(null, Collections.singletonList(notification));
        Intent saved = shadowOf(alarms.getScheduledAlarms().get(0).operation).getSavedIntent();
        return saved.getParcelableExtra(TimedNotificationPublisher.NOTIFICATION_KEY, Notification.class);
    }

    private void publish(boolean exact) {
        int id = 30;
        context.getSharedPreferences("NOTIFICATION_STORE", Context.MODE_PRIVATE).edit()
            .putString(Integer.toString(id), "{\"id\":30,\"isExactNotification\":" + exact
                + ",\"schedule\":{\"allowWhileIdle\":true,\"on\":{\"hour\":7,\"minute\":30,\"second\":0}}}")
            .commit();
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        manager.createNotificationChannel(new NotificationChannel("test-alarm", "Test", NotificationManager.IMPORTANCE_HIGH));
        Notification notification = new Notification.Builder(context, "test-alarm")
            .setSmallIcon(android.R.drawable.ic_dialog_alert).setContentTitle("Prueba 30").build();
        DateMatch match = new DateMatch();
        match.setWeekday(Calendar.MONDAY);
        match.setHour(7);
        match.setMinute(30);
        match.setSecond(0);
        match.nextTrigger(new Date());
        Intent intent = new Intent(context, TimedNotificationPublisher.class)
            .putExtra(LocalNotificationManager.NOTIFICATION_INTENT_KEY, id)
            .putExtra(TimedNotificationPublisher.NOTIFICATION_KEY, notification)
            .putExtra(TimedNotificationPublisher.CRON_KEY, match.toMatchString());
        new TimedNotificationPublisher().onReceive(context, intent);
    }
}
