package com.pablohorcajada.tablet;

import android.content.Context;
import android.net.nsd.NsdManager;
import android.net.nsd.NsdServiceInfo;

import java.io.IOException;
import java.net.Inet4Address;
import java.net.NetworkInterface;
import java.util.Collections;

final class MobileAdminManager {
    private static MobileAdminManager instance;
    private final Context context;
    private final MobileAdminRepository repository;
    private MobileAdminServer server;
    private String lastError;
    private NsdManager.RegistrationListener registrationListener;

    static synchronized MobileAdminManager get(Context context) {
        if (instance == null) instance = new MobileAdminManager(context.getApplicationContext());
        return instance;
    }

    private MobileAdminManager(Context context) {
        this.context = context;
        PabloTabletDatabase database = PabloTabletDatabase.get(context);
        repository = new MobileAdminRepository(database);
        start();
    }

    synchronized void start() {
        if (server != null && server.isAlive()) return;
        try {
            server = new MobileAdminServer(context, PabloTabletDatabase.get(context), repository);
            server.start(10_000, false);
            lastError = null;
            registerMdns();
        } catch (IOException error) {
            lastError = error.getMessage();
            server = null;
        }
    }

    boolean isRunning() { return server != null && server.isAlive(); }
    int port() { return MobileAdminServer.PORT; }
    String error() { return lastError; }
    MobileAdminRepository repository() { return repository; }

    String localAddress() {
        String ip = localIpv4();
        return ip == null ? null : "http://" + ip + ":" + port();
    }

    String pairingBaseAddress() {
        String address = localAddress();
        return address == null ? "http://pablotablet.local:" + port() : address;
    }

    void broadcastStateChanged(long updatedAt) {
        if (server != null) server.broadcastStateChanged(updatedAt);
    }

    private void registerMdns() {
        try {
            NsdManager nsd = (NsdManager) context.getSystemService(Context.NSD_SERVICE);
            if (nsd == null || registrationListener != null) return;
            NsdServiceInfo serviceInfo = new NsdServiceInfo();
            serviceInfo.setServiceName("pablotablet");
            serviceInfo.setServiceType("_http._tcp.");
            serviceInfo.setPort(port());
            registrationListener = new NsdManager.RegistrationListener() {
                @Override public void onServiceRegistered(NsdServiceInfo registered) { }
                @Override public void onRegistrationFailed(NsdServiceInfo service, int errorCode) { }
                @Override public void onServiceUnregistered(NsdServiceInfo service) { }
                @Override public void onUnregistrationFailed(NsdServiceInfo service, int errorCode) { }
            };
            nsd.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, registrationListener);
        } catch (Exception ignored) { }
    }

    private static String localIpv4() {
        try {
            for (NetworkInterface network : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!network.isUp() || network.isLoopback()) continue;
                for (java.net.InetAddress address : Collections.list(network.getInetAddresses())) {
                    if (address instanceof Inet4Address && !address.isLoopbackAddress() && address.isSiteLocalAddress()) return address.getHostAddress();
                }
            }
        } catch (Exception ignored) { }
        return null;
    }
}
