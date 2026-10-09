package com.pablohorcajada.tablet;

import android.content.Context;
import android.content.SharedPreferences;
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

final class MobileAdminManager {
    private static final String PREFERENCES_NAME = "mobile-admin-security";
    private static final String ENABLED_KEY = "lan-access-enabled";
    private static MobileAdminManager instance;
    private final Context context;
    private final MobileAdminRepository repository;
    private final SharedPreferences preferences;
    private final ConnectivityManager connectivityManager;
    private final NsdManager nsdManager;
    private boolean networkCallbackRegistered;
    private MobileAdminServer server;
    private String boundAddress;
    private Network boundNetwork;
    private String lastError;
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
        preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE);
        connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        nsdManager = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
        registerNetworkCallback();
    }

    synchronized void start() {
        if (!isEnabled()) repository.cancelPendingPairings();
        reconcileServer();
    }

    synchronized void setEnabled(boolean enabled) {
        preferences.edit().putBoolean(ENABLED_KEY, enabled).apply();
        if (enabled) {
            reconcileServer();
        } else {
            repository.cancelPendingPairings();
            stop();
        }
    }

    synchronized void stop() {
        stopServer();
        lastError = null;
        discoveryError = null;
    }

    boolean isEnabled() { return preferences.getBoolean(ENABLED_KEY, false); }
    synchronized boolean isRunning() { return server != null && server.isAlive(); }
    int port() { return MobileAdminServer.PORT; }
    synchronized String error() { return lastError == null ? discoveryError : lastError; }
    MobileAdminRepository repository() { return repository; }

    synchronized String localAddress() {
        return isRunning() && boundAddress != null ? "http://" + boundAddress + ":" + port() : null;
    }

    synchronized String pairingBaseAddress() {
        String address = localAddress();
        if (address == null) throw new IllegalStateException("Activa el acceso móvil y conecta la tablet a una Wi-Fi privada.");
        return address;
    }

    synchronized void broadcastStateChanged(long updatedAt) {
        if (server != null) server.broadcastStateChanged(updatedAt);
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
    }

    private void reconcileServer() {
        if (!isEnabled()) {
            stopServer();
            lastError = null;
            return;
        }
        if (!networkCallbackRegistered) {
            stopServer();
            lastError = "No se pueden vigilar los cambios de red; el servidor se mantiene detenido por seguridad.";
            return;
        }

        WifiBinding binding = activePrivateWifiBinding();
        if (binding == null) {
            stopServer();
            lastError = "Conecta la tablet a una red Wi-Fi privada para permitir el acceso móvil.";
            return;
        }
        if (binding.address.equals(boundAddress) && binding.network.equals(boundNetwork) && server != null && server.isAlive()) {
            lastError = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && registrationListener == null) registerMdns(binding.network);
            return;
        }

        stopServer();
        try {
            server = new MobileAdminServer(context, PabloTabletDatabase.get(context), repository, binding.address);
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
        if (connectivityManager == null) return null;
        Network network = connectivityManager.getActiveNetwork();
        if (network == null) return null;
        NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(network);
        if (capabilities == null || !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)) return null;
        LinkProperties properties = connectivityManager.getLinkProperties(network);
        if (properties == null) return null;
        for (LinkAddress linkAddress : properties.getLinkAddresses()) {
            InetAddress address = linkAddress.getAddress();
            if (MobileAdminNetworkPolicy.isAllowedPrivateIpv4(address)) return new WifiBinding(network, address.getHostAddress());
        }
        return null;
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
            }

            @Override public void onRegistrationFailed(NsdServiceInfo service, int errorCode) {
                synchronized (MobileAdminManager.this) {
                    if (registrationListener != this) return;
                    registrationListener = null;
                    discoveryError = "El servidor está activo por IP, pero no se pudo publicar mediante mDNS (" + errorCode + ").";
                }
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
}
