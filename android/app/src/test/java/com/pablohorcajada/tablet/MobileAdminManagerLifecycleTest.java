package com.pablohorcajada.tablet;

import android.content.ComponentName;
import android.content.Context;
import android.content.ContextWrapper;
import android.content.Intent;
import android.net.ConnectivityManager;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowConnectivityManager;
import org.robolectric.util.ReflectionHelpers;

import java.util.concurrent.ScheduledExecutorService;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = {24, 35})
public class MobileAdminManagerLifecycleTest {
    private MobileAdminManager manager;
    private ShadowConnectivityManager connectivity;

    @Before
    public void setUp() {
        Context context = RuntimeEnvironment.getApplication();
        ReflectionHelpers.setStaticField(MobileAdminManager.class, "instance", null);
        new MobileAdminAccessPreference(context).setEnabled(false);
        connectivity = shadowOf((ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE));
        connectivity.clearAllNetworks();
        connectivity.setActiveNetworkInfo(null);
        manager = MobileAdminManager.get(context);
    }

    @After
    public void tearDown() {
        manager.setEnabled(false);
        ReflectionHelpers.<ScheduledExecutorService>getField(manager, "maintenanceExecutor").shutdownNow();
        ReflectionHelpers.setStaticField(MobileAdminManager.class, "instance", null);
    }

    @Test
    public void enablingAccessWaitsForForegroundServiceBeforeCheckingNetwork() {
        manager.setEnabled(true);
        signalNetworkChange();

        assertTrue(manager.isEnabled());
        assertFalse(manager.isRunning());
        assertEquals("starting", manager.statusSnapshot().serviceState);
        assertNull(manager.error());

        manager.start();

        assertEquals("error", manager.statusSnapshot().serviceState);
        assertNotNull(manager.error());
    }

    @Test
    public void networkChangesAfterStopCannotReactivateTheServer() {
        manager.setEnabled(true);
        manager.start();
        manager.stop();

        signalNetworkChange();

        assertTrue(manager.isEnabled());
        assertFalse(manager.isRunning());
        assertNull(manager.error());

        manager.start();

        assertNotNull(manager.error());
    }

    @Test
    public void disabledAccessCannotBeReactivatedByAServiceRestartOrNetworkChange() {
        manager.setEnabled(true);
        manager.start();
        manager.setEnabled(false);

        manager.start();
        signalNetworkChange();

        assertFalse(manager.isRunning());
        assertEquals("disabled", manager.statusSnapshot().serviceState);
        assertNull(manager.error());
    }

    @Test
    public void failedForegroundStartSuspendsNetworkRecovery() {
        manager.setEnabled(true);
        manager.start();
        Context failingContext = new ContextWrapper(RuntimeEnvironment.getApplication()) {
            @Override public Context getApplicationContext() { return this; }
            @Override public ComponentName startForegroundService(Intent intent) {
                throw new IllegalStateException("Foreground start rejected");
            }
            @Override public ComponentName startService(Intent intent) {
                throw new IllegalStateException("Service start rejected");
            }
        };

        MobileAdminServiceController.reconcile(failingContext);

        assertEquals("error", manager.statusSnapshot().serviceState);
        assertTrue(manager.isEnabled());
        assertFalse(manager.isRunning());

        manager.clearLifecycleError();
        signalNetworkChange();

        assertNull(manager.error());
    }

    private void signalNetworkChange() {
        assertFalse(connectivity.getNetworkCallbacks().isEmpty());
        for (ConnectivityManager.NetworkCallback callback : connectivity.getNetworkCallbacks()) {
            callback.onAvailable(null);
        }
    }
}
