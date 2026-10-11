package com.pablohorcajada.tablet;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class UtcTimestampTest {
    @Test
    public void formatUsesIso8601UtcWithMilliseconds() {
        assertEquals("1970-01-01T00:00:00.000Z", UtcTimestamp.format(0L));
        assertEquals("2024-02-29T12:34:56.789Z", UtcTimestamp.format(1709210096789L));
    }
}
