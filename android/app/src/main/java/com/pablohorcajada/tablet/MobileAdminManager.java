package com.pablohorcajada.tablet;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.LinkAddress;
import android.net.LinkProperties;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;
import android.os.Build;

import java.io.IOException;
import java.net.InetAddress;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

final class MobileAdminManager {
    private static MobileAdminManager instance;
    private final Context context;
    private final MobileAdminRepository repository;
    private final MobilePairingRateLimiter pairingRateLimiter;
    private final ScheduledExecutorService maintenanceExecutor;
    private final MobileAdminAccessPreference accessPreference;
    private final ConnectivityManager connectivityManager;
    private final NsdManager nsdManager;
    private final Set<Runnable> statusListeners = new CopyOnWriteArraySet<>();
    private boolean networkCallbackRegistered;
    private MobileAdminServer server;
    private String boundAddress;
    private Network boundNetwork;
    private String observedAddress;
    private Network observedNetwork;
    private long networkGeneration;
    private String lastError;
    private String networkError;
    private String discoveryError;
    private NsdManager.RegistrationListener registrationListener;

    static synchronized MobileAdminManager get(Context context) {
        if (instance == null) instance = new MobileAdminManager(context.getApplicationContext());
        return instance;
    }

    private MobileAdminManager(Context context) {
        this.context = context;
        PabloTabletDatabase database = PabloTabletDatabase.get(context);
        repository = new MobileAdminRepository(database);
        pairingRateLimiter = new MobilePairingRateLimiter();
        maintenanceExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "mobile-admin-maintenance");
            thread.setDaemon(true);
            return thread;
        });
        runMaintenance();
        maintenanceExecutor.scheduleWithFixedDelay(this::runMaintenance, 1, 1, TimeUnit.MINUTES);
        accessPreference = new MobileAdminAccessPreference(context);
        connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        registerNetworkCallback();
    }

    synchronized void start() {
        if (!isEnabled()) repository.cancelPendingPairings();
        reconcileServer();
    }

    synchronized void setEnabled(boolean enabled) {
        accessPreference.setEnabled(enabled);
        if (enabled) {
            reconcileServer();
        } else {
            repository.cancelPendingPairings();
            updateObservedBinding(null);
            stop();
        }
        notifyStatusChanged();
    }

    synchronized void stop() {
        stopServer();
        lastError = null;
        discoveryError = null;
    }

    boolean isEnabled() { return accessPreference.isEnabled(); }
    synchronized boolean isRunning() { return server != null && server.isAlive(); }
    int port() { return MobileAdminServer.PORT; }
    synchronized String error() { return lastError == null ? discoveryError : lastError; }
    MobileAdminRepository repository() { return repository; }

    void addStatusListener(Runnable listener) { statusListeners.add(listener); }
    void removeStatusListener(Runnable listener) { statusListeners.remove(listener); }

    private void runMaintenance() {
        try {
            repository.cleanupExpired();
        } catch (RuntimeException ignored) {
            // A transient database failure must not cancel future scheduled cleanups.
        }
    }

    synchronized String localAddress() {
        return isRunning() && boundAddress != null ? "http://" + boundAddress + ":" + port() : null;
    }

    synchronized StatusSnapshot statusSnapshot() {
        return new StatusSnapshot(isEnabled(), isRunning(), port(), localAddress(), networkGeneration, error());
    }

    synchronized String pairingBaseAddress() {
        String address = localAddress();
        if (address == null) throw new IllegalStateException("Activa el acceso móvil y conecta la tablet a una Wi-Fi privada.");
        return address;
    }

    synchronized PairingSnapshot createPairing() throws Exception {
        MobileAdminRepository.PairingSession session = repository.createPairing(pairingBaseAddress());
        return new PairingSnapshot(session, networkGeneration);
    }

    synchronized void broadcastStateChanged(long updatedAt) {
        if (server != null) server.broadcastStateChanged(updatedAt);
    }

    synchronized void revokeDevice(String deviceId) {
        repository.revokeDevice(deviceId);
        if (server != null) server.disconnectDevices(java.util.Collections.singleton(deviceId));
    }

    synchronized int revokeAllDevices() {
        MobileAdminRepository.RevocationResult result = repository.revokeAllDevices();
        if (server != null) server.disconnectDevices(result.deviceIds);
        return result.count();
    }

    private void registerNetworkCallback() {
        if (connectivityManager == null) return;
        try {
            connectivityManager.registerDefaultNetworkCallback(new ConnectivityManager.NetworkCallback() {
                @Override public void onAvailable(Network network) { refreshAfterNetworkChange(); }
                @Override public void onLost(Network network) { refreshAfterNetworkChange(); }
                @Override public void onLinkPropertiesChanged(Network network, LinkProperties properties) { refreshAfterNetworkChange(); }
                @Override public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) { refreshAfterNetworkChange(); }
            });
            networkCallbackRegistered = true;
        } catch (RuntimeException error) {
            synchronized (this) { lastError = "No se pudieron vigilar los cambios de red."; }
        }
    }

    private void refreshAfterNetworkChange() {
        synchronized (this) { reconcileServer(); }
        notifyStatusChanged();
    }

    private void reconcileServer() {
        if (!isEnabled()) {
            updateObservedBinding(null);
            stopServer();
            lastError = null;
            return;
        }
        if (!networkCallbackRegistered) {
            updateObservedBinding(null);
            stopServer();
            lastError = "No se pueden vigilar los cambios de red; el servidor se mantiene detenido por seguridad.";
            return;
        }

        WifiBinding binding = activePrivateWifiBinding();
        if (updateObservedBinding(binding)) repository.cancelPendingPairings();
        if (binding == null) {
            stopServer();
            lastError = networkError;
            return;
        }
        if (binding.address.equals(boundAddress) && binding.network.equals(boundNetwork) && server != null && server.isAlive()) {
            lastError = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && registrationListener == null) registerMdns(binding.network);
            return;
        }

        stopServer();
        try {
            server = new MobileAdminServer(context, PabloTabletDatabase.get(context), repository, pairingRateLimiter, binding.address);
            server.start(10_000, false);
            boundAddress = binding.address;
            boundNetwork = binding.network;
            lastError = null;
            registerMdns(binding.network);
        } catch (IOException | RuntimeException error) {
            stopServer();
            lastError = "No se pudo limitar el servidor a la Wi-Fi privada: " + safeMessage(error);
        }
    }

    private void stopServer() {
        unregisterMdns();
        if (server != null) server.stop();
        server = null;
        boundAddress = null;
        boundNetwork = null;
    }

    private WifiBinding activePrivateWifiBinding() {
        networkError = null;
        if (connectivityManager == null) {
            networkError = "Android no permite consultar la red activa; el servidor se mantiene detenido.";
            return null;
        }
        Network network = connectivityManager.getActiveNetwork();
        if (network == null) {
            networkError = "La tablet no está conectada a una red Wi-Fi.";
            return null;
        }
        NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);
        if (capabilities == null || !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) {
            networkError = "La conexión activa no es una red Wi-Fi privada.";
            return null;
        }
        LinkProperties properties = connectivityManager.getLinkProperties(network);
        if (properties == null) {
            networkError = "Android todavía no ha proporcionado una dirección para esta Wi-Fi.";
            return null;
        }
        for (LinkAddress linkAddress : properties.getLinkAddresses()) {
            InetAddress address = linkAddress.getAddress();
            if (MobileAdminNetworkPolicy.isAllowedPrivateIpv4(address)) return new WifiBinding(network, address.getHostAddress());
        }
        networkError = "La Wi-Fi actual no tiene una dirección IPv4 privada disponible.";
        return null;
    }

    private boolean updateObservedBinding(WifiBinding binding) {
        Network nextNetwork = binding == null ? null : binding.network;
        String nextAddress = binding == null ? null : binding.address;
        boolean sameNetwork = observedNetwork == null ? nextNetwork == null : observedNetwork.equals(nextNetwork);
        boolean sameAddress = observedAddress == null ? nextAddress == null : observedAddress.equals(nextAddress);
        if (sameNetwork && sameAddress) return false;
        observedNetwork = nextNetwork;
        observedAddress = nextAddress;
        networkGeneration++;
        return true;
    }

    private void notifyStatusChanged() {
        if (statusListeners.isEmpty()) return;
        context.getMainExecutor().execute(() -> {
            for (Runnable listener : statusListeners) listener.run();
        });
    }

    private void registerMdns(Network network) {
        discoveryError = null;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return;
        if (nsdManager == null) {
            discoveryError = "El servidor está activo por IP, pero Android no permite publicar el servicio local.";
            return;
        }

        NsdServiceInfo serviceInfo = new NsdServiceInfo();
        serviceInfo.setServiceName("pablotablet");
        serviceInfo.setServiceType("_http._tcp.");
        serviceInfo.setPort(port());
        serviceInfo.setNetwork(network);

        NsdManager.RegistrationListener listener = new NsdManager.RegistrationListener() {
            @Override public void onServiceRegistered(NsdServiceInfo registered) {
                synchronized (MobileAdminManager.this) {
                    if (registrationListener == this) discoveryError = null;
                }
                notifyStatusChanged();
            }

            @Override public void onRegistrationFailed(NsdServiceInfo service, int errorCode) {
                synchronized (MobileAdminManager.this) {
                    if (registrationListener != this) return;
                    registrationListener = null;
                    discoveryError = "El servidor está activo por IP, pero no se pudo publicar mediante mDNS (" + errorCode + ").";
                }
                notifyStatusChanged();
            }

            @Override public void onServiceUnregistered(NsdServiceInfo service) { }
            @Override public void onUnregistrationFailed(NsdServiceInfo service, int errorCode) { }
        };

        registrationListener = listener;
        try {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, context.getMainExecutor(), listener);
        } catch (RuntimeException error) {
            registrationListener = null;
            discoveryError = "El servidor está activo por IP, pero no se pudo publicar mediante mDNS.";
            notifyStatusChanged();
        }
    }

    private void unregisterMdns() {
        NsdManager.RegistrationListener listener = registrationListener;
        registrationListener = null;
        discoveryError = null;
        if (listener == null || nsdManager == null) return;
        try {
            nsdManager.unregisterService(listener);
        } catch (IllegalArgumentException ignored) { }
    }

    private static String safeMessage(Exception error) {
        String message = error.getMessage();
        return message == null || message.trim().isEmpty() ? "error de red desconocido" : message;
    }

    private static final class WifiBinding {
        final Network network;
        final String address;

        WifiBinding(Network network, String address) {
            this.network = network;
            this.address = address;
        }
    }

    static final class PairingSnapshot {
        final MobileAdminRepository.PairingSession session;
        final long networkGeneration;

        PairingSnapshot(MobileAdminRepository.PairingSession session, long networkGeneration) {
            this.session = session;
            this.networkGeneration = networkGeneration;
        }
    }

    static final class StatusSnapshot {
        final boolean enabled;
        final boolean running;
        final int port;
        final String localAddress;
        final long networkGeneration;
        final String error;

        StatusSnapshot(boolean enabled, boolean running, int port, String localAddress, long networkGeneration, String error) {
            this.enabled = enabled;
            this.running = running;
            this.port = port;
            this.localAddress = localAddress;
            this.networkGeneration = networkGeneration;
            this.error = error;
        }
    }
}
