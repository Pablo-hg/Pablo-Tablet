package com.pablohorcajada.tablet;

import android.content.Context;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

@RunWith(RobolectricTestRunner.class)
public class MobileAdminAccessPreferenceTest {
    private Context context;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        context.getSharedPreferences("mobile-admin-security", Context.MODE_PRIVATE).edit().clear().commit();
    }

    @Test
    public void defaultsToDisabledAndPersistsExplicitChanges() {
        MobileAdminAccessPreference firstInstance = new MobileAdminAccessPreference(context);
        assertFalse(firstInstance.isEnabled());

        firstInstance.setEnabled(true);
        assertTrue(new MobileAdminAccessPreference(context).isEnabled());

        firstInstance.setEnabled(false);
        assertFalse(new MobileAdminAccessPreference(context).isEnabled());
    }
}
