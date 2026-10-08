package com.pablohorcajada.tablet;

import org.junit.Test;

import java.net.InetAddress;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class MobileAdminNetworkPolicyTest {
    @Test
    public void acceptsOnlyRfc1918Ipv4Addresses() throws Exception {
        assertTrue(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("10.2.3.4")));
        assertTrue(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("172.16.0.1")));
        assertTrue(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("172.31.255.254")));
        assertTrue(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("192.168.50.10")));

        assertFalse(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("8.8.8.8")));
        assertFalse(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("172.32.0.1")));
        assertFalse(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("169.254.1.4")));
        assertFalse(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("127.0.0.1")));
        assertFalse(MobileAdminNetworkPolicy.isAllowedPrivateIpv4(InetAddress.getByName("2001:db8::1")));
    }
}
