package com.pablohorcajada.tablet;

import android.content.Context;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;

import static org.junit.Assert.assertEquals;

@RunWith(RobolectricTestRunner.class)
public class AppLocaleTest {
    private Context context;

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        context.getSharedPreferences("pablo-tablet-locale", Context.MODE_PRIVATE).edit().clear().commit();
    }

    @After
    public void tearDown() {
        context.getSharedPreferences("pablo-tablet-locale", Context.MODE_PRIVATE).edit().clear().commit();
    }

    @Test
    public void defaultsToSpanish() {
        assertEquals("es", AppLocale.language(context));
        assertEquals("Foto", AppLocale.text(context, R.string.gallery_default_photo_name));
    }

    @Test
    public void persistsEnglishAndReadsEnglishResources() {
        AppLocale.setLanguage(context, "en");

        assertEquals("en", AppLocale.language(context));
        assertEquals("Photo", AppLocale.text(context, R.string.gallery_default_photo_name));
    }

    @Test
    public void unsupportedLanguageFallsBackToSpanish() {
        AppLocale.setLanguage(context, "fr");

        assertEquals("es", AppLocale.language(context));
        assertEquals("Foto", AppLocale.text(context, R.string.gallery_default_photo_name));
    }
}
