package com.pablohorcajada.tablet;

import android.app.Application;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.shadows.ShadowApplication;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
public class MobileAdminBootReceiverTest {
    private Context context;
    private ShadowApplication shadowApplication;
    private MobileAdminBootReceiver receiver;

    @Before
    public void setUp() {
        Application application = RuntimeEnvironment.getApplication();
        context = application;
        shadowApplication = shadowOf(application);
        shadowApplication.clearStartedServices();
        new MobileAdminAccessPreference(context).setEnabled(false);
        receiver = new MobileAdminBootReceiver();
    }

    @Test
    public void doesNotRestoreServiceAfterBootWhenAccessIsDisabled() {
        receiver.onReceive(context, new Intent(Intent.ACTION_BOOT_COMPLETED));

        assertNull(shadowApplication.getNextStartedService());
    }

    @Test
    public void restoresServiceAfterBootWhenAccessRemainsEnabled() {
        new MobileAdminAccessPreference(context).setEnabled(true);

        receiver.onReceive(context, new Intent(Intent.ACTION_BOOT_COMPLETED));

        Intent started = shadowApplication.getNextStartedService();
        assertEquals(new ComponentName(context, MobileAdminService.class), started.getComponent());
    }

    @Test
    public void ignoresUnrelatedBroadcasts() {
        new MobileAdminAccessPreference(context).setEnabled(true);

        receiver.onReceive(context, new Intent(Intent.ACTION_AIRPLANE_MODE_CHANGED));

        assertNull(shadowApplication.getNextStartedService());
    }
}
