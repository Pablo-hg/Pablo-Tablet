package com.pablohorcajada.tablet;

import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;

import org.json.JSONObject;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

@RunWith(RobolectricTestRunner.class)
public class MobileAdminRepositoryTest {
    private PabloTabletDatabase database;
    private MobileAdminRepository repository;

    @Before
    public void setUp() {
        Context context = RuntimeEnvironment.getApplication();
        database = new PabloTabletDatabase(context, null);
        repository = new MobileAdminRepository(database);
    }

    @After
    public void tearDown() {
        database.close();
    }

    @Test
    public void approvesAuthenticatesAndRevokesOneDevice() throws Exception {
        Authorized authorized = authorize("Móvil personal");

        MobileAdminRepository.Device device = repository.authenticate(authorized.credential);
        assertNotNull(device);
        assertEquals("Móvil personal", device.name);
        assertNull(repository.authenticate("credencial-no-valida"));

        repository.revokeDevice(device.id);

        assertNull(repository.authenticate(authorized.credential));
        assertTrue(repository.devices().getJSONObject(0).has("revokedAt"));
    }

    @Test
    public void rejectsInvalidExpiredAndExplicitlyRejectedPairings() throws Exception {
        MobileAdminRepository.PairingSession rejectedSession = repository.createPairing("http://192.168.1.50:8765");
        MobileAdminRepository.PairingRequest rejectedRequest = repository.requestPairing(rejectedSession.token, "Móvil rechazado", "Chrome");
        repository.reject(rejectedRequest.id);
        assertEquals("rejected", repository.pairingResult(rejectedRequest.id, rejectedSession.token).getString("status"));
        assertThrows(SecurityException.class, () -> repository.requestPairing("token-invalido", "Intruso", "Bot"));

        MobileAdminRepository.PairingSession expiredSession = repository.createPairing("http://192.168.1.50:8765");
        MobileAdminRepository.PairingRequest expiredRequest = repository.requestPairing(expiredSession.token, "Móvil lento", "Firefox");
        SQLiteDatabase writable = database.getWritableDatabase();
        writable.execSQL("UPDATE pairing_requests SET expires_at = ? WHERE request_id = ?", new Object[] { System.currentTimeMillis() - 1, expiredRequest.id });
        writable.execSQL("UPDATE pairing_sessions SET expires_at = ? WHERE session_id = ?", new Object[] { System.currentTimeMillis() - 1, expiredSession.id });

        assertEquals("expired", repository.pairingResult(expiredRequest.id, expiredSession.token).getString("status"));
        assertThrows(IllegalStateException.class, () -> repository.approve(expiredRequest.id));
        assertThrows(SecurityException.class, () -> repository.requestPairing(expiredSession.token, "Móvil lento", "Firefox"));
    }

    @Test
    public void capsPendingRequestsAndCancelsThemTogether() throws Exception {
        MobileAdminRepository.PairingSession session = repository.createPairing("http://192.168.1.50:8765");
        MobileAdminRepository.PairingRequest first = null;
        for (int index = 0; index < 8; index++) {
            MobileAdminRepository.PairingRequest request = repository.requestPairing(session.token, "Móvil " + index, "Navegador");
            if (first == null) first = request;
        }
        assertEquals(8, repository.pendingRequests().length());
        assertThrows(MobileAdminRepository.PairingCapacityException.class, () -> repository.requestPairing(session.token, "Móvil extra", "Navegador"));

        repository.cancelPendingPairings();

        assertEquals(0, repository.pendingRequests().length());
        assertEquals("cancelled", repository.pairingResult(first.id, session.token).getString("status"));
        assertThrows(SecurityException.class, () -> repository.requestPairing(session.token, "Móvil nuevo", "Navegador"));
    }

    @Test
    public void revokesAllDevicesAndAllowsFreshPairingAfterwards() throws Exception {
        Authorized first = authorize("Móvil uno");
        Authorized second = authorize("Móvil dos");
        MobileAdminRepository.PairingSession pendingSession = repository.createPairing("http://192.168.1.50:8765");
        MobileAdminRepository.PairingRequest pending = repository.requestPairing(pendingSession.token, "Móvil pendiente", "Safari");

        MobileAdminRepository.RevocationResult result = repository.revokeAllDevices();

        assertEquals(2, result.count());
        assertNull(repository.authenticate(first.credential));
        assertNull(repository.authenticate(second.credential));
        assertEquals("cancelled", repository.pairingResult(pending.id, pendingSession.token).getString("status"));
        assertThrows(SecurityException.class, () -> repository.requestPairing(pendingSession.token, "Reintento", "Safari"));

        MobileAdminRepository.PairingSession fresh = repository.createPairing("http://192.168.1.50:8765");
        assertNotNull(repository.requestPairing(fresh.token, "Móvil nuevo", "Chrome"));
    }

    @Test
    public void removesExpiredPairingHistoryAfterRetentionWindow() throws Exception {
        MobileAdminRepository.PairingSession session = repository.createPairing("http://192.168.1.50:8765");
        MobileAdminRepository.PairingRequest request = repository.requestPairing(session.token, "Móvil antiguo", "Chrome");
        long oldExpiry = System.currentTimeMillis() - (25L * 60 * 60 * 1000);
        SQLiteDatabase writable = database.getWritableDatabase();
        writable.execSQL("UPDATE pairing_requests SET expires_at = ? WHERE request_id = ?", new Object[] { oldExpiry, request.id });
        writable.execSQL("UPDATE pairing_sessions SET expires_at = ? WHERE session_id = ?", new Object[] { oldExpiry, session.id });

        repository.cleanupExpired();

        assertEquals(0, countRows("pairing_requests"));
        assertEquals(0, countRows("pairing_sessions"));
    }

    private Authorized authorize(String name) throws Exception {
        MobileAdminRepository.PairingSession session = repository.createPairing("http://192.168.1.50:8765");
        MobileAdminRepository.PairingRequest request = repository.requestPairing(session.token, name, "Navegador de prueba");
        String credential = repository.approve(request.id);
        JSONObject result = repository.pairingResult(request.id, session.token);
        assertEquals("approved", result.getString("status"));
        assertEquals(credential, result.getString("credential"));
        return new Authorized(credential);
    }

    private int countRows(String table) {
        try (Cursor cursor = database.getReadableDatabase().rawQuery("SELECT COUNT(*) FROM " + table, null)) {
            return cursor.moveToFirst() ? cursor.getInt(0) : 0;
        }
    }

    private static final class Authorized {
        final String credential;

        Authorized(String credential) {
            this.credential = credential;
        }
    }
}
