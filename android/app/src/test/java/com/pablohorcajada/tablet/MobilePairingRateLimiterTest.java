package com.pablohorcajada.tablet;

import org.junit.Test;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class MobilePairingRateLimiterTest {
    @Test
    public void permitsNormalPairingAndRecoversAfterPerSourceWindow() {
        FakeClock clock = new FakeClock();
        MobilePairingRateLimiter limiter = new MobilePairingRateLimiter(clock);

        for (int index = 0; index < MobilePairingRateLimiter.PER_SOURCE_ATTEMPTS; index++) {
            assertTrue(limiter.acquire("192.168.1.20").allowed);
            limiter.recordSuccess("192.168.1.20");
        }
        MobilePairingRateLimiter.Decision blocked = limiter.acquire("192.168.1.20");
        assertFalse(blocked.allowed);
        assertEquals(60, blocked.retryAfterSeconds);

        clock.advance(MobilePairingRateLimiter.WINDOW_MS);
        assertTrue(limiter.acquire("192.168.1.20").allowed);
    }

    @Test
    public void progressivelyCoolsDownRepeatedFailures() {
        FakeClock clock = new FakeClock();
        MobilePairingRateLimiter limiter = new MobilePairingRateLimiter(clock);

        for (int index = 0; index < MobilePairingRateLimiter.FAILURES_BEFORE_COOLDOWN; index++) {
            assertTrue(limiter.acquire("192.168.1.21").allowed);
            limiter.recordFailure("192.168.1.21");
        }
        MobilePairingRateLimiter.Decision firstCooldown = limiter.acquire("192.168.1.21");
        assertFalse(firstCooldown.allowed);
        assertEquals(30, firstCooldown.retryAfterSeconds);

        clock.advance(MobilePairingRateLimiter.INITIAL_COOLDOWN_MS);
        assertTrue(limiter.acquire("192.168.1.21").allowed);
        limiter.recordFailure("192.168.1.21");
        MobilePairingRateLimiter.Decision secondCooldown = limiter.acquire("192.168.1.21");
        assertFalse(secondCooldown.allowed);
        assertEquals(60, secondCooldown.retryAfterSeconds);

        clock.advance(60_000L);
        assertTrue(limiter.acquire("192.168.1.21").allowed);
        limiter.recordSuccess("192.168.1.21");
        assertTrue(limiter.acquire("192.168.1.21").allowed);
    }

    @Test
    public void limitsDistributedBurstGlobally() {
        FakeClock clock = new FakeClock();
        MobilePairingRateLimiter limiter = new MobilePairingRateLimiter(clock);

        for (int index = 0; index < MobilePairingRateLimiter.GLOBAL_ATTEMPTS; index++) {
            assertTrue(limiter.acquire("192.168.2." + index).allowed);
        }
        MobilePairingRateLimiter.Decision blocked = limiter.acquire("192.168.3.1");
        assertFalse(blocked.allowed);
        assertEquals(60, blocked.retryAfterSeconds);

        clock.advance(MobilePairingRateLimiter.WINDOW_MS);
        assertTrue(limiter.acquire("192.168.3.1").allowed);
    }

    @Test
    public void boundsTrackedSourceMemory() {
        FakeClock clock = new FakeClock();
        MobilePairingRateLimiter limiter = new MobilePairingRateLimiter(clock);

        for (int index = 0; index < MobilePairingRateLimiter.MAX_TRACKED_SOURCES + 50; index++) {
            limiter.acquire("10.0." + (index / 255) + "." + (index % 255));
        }

        assertTrue(limiter.trackedSourceCount() <= MobilePairingRateLimiter.MAX_TRACKED_SOURCES);
    }

    @Test
    public void removesInactiveSourcesAfterRetentionPeriod() {
        FakeClock clock = new FakeClock();
        MobilePairingRateLimiter limiter = new MobilePairingRateLimiter(clock);

        assertTrue(limiter.acquire("192.168.4.10").allowed);
        clock.advance(MobilePairingRateLimiter.MAX_COOLDOWN_MS);
        assertTrue(limiter.acquire("192.168.4.11").allowed);

        assertEquals(1, limiter.trackedSourceCount());
    }

    private static final class FakeClock implements MobilePairingRateLimiter.Clock {
        private long now = 1_000_000L;

        @Override public long now() { return now; }
        void advance(long milliseconds) { now += milliseconds; }
    }
}
