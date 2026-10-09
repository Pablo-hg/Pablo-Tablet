package com.pablohorcajada.tablet;

import java.util.ArrayDeque;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * In-memory protection for the unauthenticated pairing endpoint.
 *
 * The instance is owned by {@link MobileAdminManager}, so recreating a screen or
 * restarting the LAN server does not reset its counters. State is deliberately
 * bounded and contains only socket source addresses and timestamps.
 */
final class MobilePairingRateLimiter {
    static final int PER_SOURCE_ATTEMPTS = 5;
    static final int GLOBAL_ATTEMPTS = 30;
    static final long WINDOW_MS = 60_000L;
    static final int FAILURES_BEFORE_COOLDOWN = 3;
    static final long INITIAL_COOLDOWN_MS = 30_000L;
    static final long MAX_COOLDOWN_MS = 5 * 60_000L;
    static final int MAX_TRACKED_SOURCES = 256;

    interface Clock { long now(); }

    private final Clock clock;
    private final ArrayDeque<Long> globalAttempts = new ArrayDeque<>();
    private final LinkedHashMap<String, SourceState> sources = new LinkedHashMap<>(16, 0.75f, true);
    private long globalBlockedUntil;

    MobilePairingRateLimiter() {
        this(System::currentTimeMillis);
    }

    MobilePairingRateLimiter(Clock clock) {
        this.clock = clock;
    }

    synchronized Decision acquire(String remoteAddress) {
        long now = clock.now();
        pruneGlobal(now);
        pruneInactiveSources(now);
        String source = normalize(remoteAddress);
        SourceState state = sources.get(source);
        if (state == null) {
            if (sources.size() >= MAX_TRACKED_SOURCES) {
                Iterator<Map.Entry<String, SourceState>> iterator = sources.entrySet().iterator();
                if (iterator.hasNext()) {
                    iterator.next();
                    iterator.remove();
                }
            }
            state = new SourceState();
            sources.put(source, state);
        }
        state.lastSeenAt = now;
        prune(state.attempts, now);

        long blockedUntil = Math.max(globalBlockedUntil, state.blockedUntil);
        if (blockedUntil > now) return Decision.denied(secondsUntil(blockedUntil, now));

        if (globalAttempts.size() >= GLOBAL_ATTEMPTS) {
            globalBlockedUntil = Math.max(globalBlockedUntil, globalAttempts.peekFirst() + WINDOW_MS);
            return Decision.denied(secondsUntil(globalBlockedUntil, now));
        }
        if (state.attempts.size() >= PER_SOURCE_ATTEMPTS) {
            long retryAt = state.attempts.peekFirst() + WINDOW_MS;
            state.blockedUntil = Math.max(state.blockedUntil, retryAt);
            return Decision.denied(secondsUntil(state.blockedUntil, now));
        }

        globalAttempts.addLast(now);
        state.attempts.addLast(now);
        return Decision.allowed();
    }

    synchronized void recordFailure(String remoteAddress) {
        long now = clock.now();
        SourceState state = sources.get(normalize(remoteAddress));
        if (state == null) return;
        state.lastSeenAt = now;
        state.consecutiveFailures++;
        if (state.consecutiveFailures < FAILURES_BEFORE_COOLDOWN) return;
        int exponent = Math.min(20, state.consecutiveFailures - FAILURES_BEFORE_COOLDOWN);
        long cooldown = Math.min(MAX_COOLDOWN_MS, INITIAL_COOLDOWN_MS * (1L << exponent));
        state.blockedUntil = Math.max(state.blockedUntil, now + cooldown);
    }

    synchronized void recordSuccess(String remoteAddress) {
        SourceState state = sources.get(normalize(remoteAddress));
        if (state == null) return;
        state.consecutiveFailures = 0;
        state.blockedUntil = 0;
        state.lastSeenAt = clock.now();
    }

    synchronized int trackedSourceCount() {
        return sources.size();
    }

    private void pruneGlobal(long now) {
        prune(globalAttempts, now);
        if (globalBlockedUntil <= now) globalBlockedUntil = 0;
    }

    private void pruneInactiveSources(long now) {
        Iterator<Map.Entry<String, SourceState>> iterator = sources.entrySet().iterator();
        while (iterator.hasNext()) {
            SourceState state = iterator.next().getValue();
            prune(state.attempts, now);
            if (state.blockedUntil <= now) state.blockedUntil = 0;
            if (state.attempts.isEmpty() && state.blockedUntil == 0 && now - state.lastSeenAt >= MAX_COOLDOWN_MS) {
                iterator.remove();
            }
        }
    }

    private static void prune(ArrayDeque<Long> attempts, long now) {
        while (!attempts.isEmpty() && attempts.peekFirst() <= now - WINDOW_MS) attempts.removeFirst();
    }

    private static String normalize(String remoteAddress) {
        if (remoteAddress == null || remoteAddress.trim().isEmpty()) return "unknown-socket-source";
        return remoteAddress.trim();
    }

    private static int secondsUntil(long target, long now) {
        return (int) Math.max(1L, (target - now + 999L) / 1000L);
    }

    static final class Decision {
        final boolean allowed;
        final int retryAfterSeconds;

        private Decision(boolean allowed, int retryAfterSeconds) {
            this.allowed = allowed;
            this.retryAfterSeconds = retryAfterSeconds;
        }

        static Decision allowed() { return new Decision(true, 0); }
        static Decision denied(int retryAfterSeconds) { return new Decision(false, retryAfterSeconds); }
    }

    private static final class SourceState {
        final ArrayDeque<Long> attempts = new ArrayDeque<>();
        int consecutiveFailures;
        long blockedUntil;
        long lastSeenAt;
    }
}
