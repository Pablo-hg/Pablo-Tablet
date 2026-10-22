package com.pablohorcajada.tablet;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

import androidx.annotation.StringRes;

import java.util.Locale;

final class AppLocale {
    private static final String PREFERENCES = "pablo-tablet-locale";
    private static final String LANGUAGE_KEY = "language";
    private static final String DEFAULT_LANGUAGE = "es";

    private AppLocale() { }

    static String language(Context context) {
        String language = preferences(context).getString(LANGUAGE_KEY, DEFAULT_LANGUAGE);
        return "en".equals(language) ? "en" : DEFAULT_LANGUAGE;
    }

    static void setLanguage(Context context, String language) {
        preferences(context).edit().putString(LANGUAGE_KEY, "en".equals(language) ? "en" : DEFAULT_LANGUAGE).apply();
    }

    static String text(Context context, @StringRes int resourceId, Object... arguments) {
        Configuration configuration = new Configuration(context.getResources().getConfiguration());
        configuration.setLocale(Locale.forLanguageTag(language(context)));
        Context localizedContext = context.createConfigurationContext(configuration);
        return arguments.length == 0
            ? localizedContext.getString(resourceId)
            : localizedContext.getString(resourceId, arguments);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
    }
}
