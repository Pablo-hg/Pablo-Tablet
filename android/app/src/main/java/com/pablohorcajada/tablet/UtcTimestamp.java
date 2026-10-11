package com.pablohorcajada.tablet;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

final class UtcTimestamp {
    private static final String ISO_8601_UTC_PATTERN = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";

    private UtcTimestamp() { }

    static String now() {
        return format(System.currentTimeMillis());
    }

    static String format(long epochMillis) {
        SimpleDateFormat formatter = new SimpleDateFormat(ISO_8601_UTC_PATTERN, Locale.US);
        formatter.setTimeZone(TimeZone.getTimeZone("UTC"));
        return formatter.format(new Date(epochMillis));
    }
}
