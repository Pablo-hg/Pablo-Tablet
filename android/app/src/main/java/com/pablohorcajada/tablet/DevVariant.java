package com.pablohorcajada.tablet;

/**
 * Bloqueos de la variante DEV (administración móvil, puerto 8765). Activos en todo APK debug.
 * Los tests unitarios corren en la variante debug y necesitan el comportamiento de producción:
 * Gradle fija -Dpablo.dev.lockdown=false solo en la JVM de pruebas; en el dispositivo nunca existe.
 */
final class DevVariant {
    private DevVariant() { }

    static boolean lockdown() {
        return BuildConfig.DEBUG && !"false".equals(System.getProperty("pablo.dev.lockdown"));
    }
}
