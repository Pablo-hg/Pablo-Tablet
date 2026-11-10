package com.pablohorcajada.tablet;

import android.content.Context;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

/** La variante DEV nunca puede levantar la administración móvil (puerto fijo 8765), aunque se active. */
@RunWith(RobolectricTestRunner.class)
public class DevVariantLockdownTest {
    @Before
    public void enableLockdown() {
        System.setProperty("pablo.dev.lockdown", "true");
    }

    @After
    public void restoreProductionBehaviour() {
        System.setProperty("pablo.dev.lockdown", "false");
    }

    @Test
    public void devNeverEnablesMobileAdmin() {
        Context context = RuntimeEnvironment.getApplication();
        context.getSharedPreferences("mobile-admin-security", Context.MODE_PRIVATE).edit().clear().commit();
        assertTrue(DevVariant.lockdown());
        MobileAdminAccessPreference preference = new MobileAdminAccessPreference(context);
        preference.setEnabled(true);
        assertFalse(preference.isEnabled());
    }
}
