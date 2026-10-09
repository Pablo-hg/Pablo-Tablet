package com.pablohorcajada.tablet;

import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.shadows.ShadowService;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
public class MobileAdminServiceTest {
    private Context context;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        new MobileAdminAccessPreference(context).setEnabled(false);
    }

    @After
    public void tearDown() {
        new MobileAdminAccessPreference(context).setEnabled(false);
    }

    @Test
    public void stopsWithoutStickyRestartWhenAccessIsDisabled() {
        ServiceController<MobileAdminService> controller = Robolectric.buildService(MobileAdminService.class).create();
        MobileAdminService service = controller.get();

        int restartMode = service.onStartCommand(new Intent(context, MobileAdminService.class), 0, 7);

        assertEquals(Service.START_NOT_STICKY, restartMode);
        assertTrue(shadowOf(service).isStoppedBySelf());
        controller.destroy();
    }

    @Test
    public void staysStickyAndCreatesForegroundNotificationWhenAccessIsEnabled() {
        new MobileAdminAccessPreference(context).setEnabled(true);
        ServiceController<MobileAdminService> controller = Robolectric.buildService(MobileAdminService.class).create();
        MobileAdminService service = controller.get();

        int restartMode = service.onStartCommand(new Intent(context, MobileAdminService.class), 0, 8);
        ShadowService shadowService = shadowOf(service);
        NotificationManager notifications = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);

        assertEquals(Service.START_STICKY, restartMode);
        assertFalse(shadowService.isStoppedBySelf());
        assertNotNull(shadowService.getLastForegroundNotification());
        assertNotNull(notifications.getNotificationChannel(MobileAdminService.CHANNEL_ID));
        controller.destroy();
    }
}
