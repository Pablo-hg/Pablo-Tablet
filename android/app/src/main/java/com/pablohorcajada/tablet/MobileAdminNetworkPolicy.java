package com.pablohorcajada.tablet;

import java.net.Inet4Address;
import java.net.InetAddress;

final class MobileAdminNetworkPolicy {
    private MobileAdminNetworkPolicy() { }

    static boolean isAllowedPrivateIpv4(InetAddress address) {
        if (!(address instanceof Inet4Address) || address.isLoopbackAddress() || address.isLinkLocalAddress()) return false;
        byte[] octets = address.getAddress();
        int first = octets[0] & 0xff;
        int second = octets[1] & 0xff;
        return first == 10
            || (first == 172 && second >= 16 && second <= 31)
            || (first == 192 && second == 168);
    }
}
