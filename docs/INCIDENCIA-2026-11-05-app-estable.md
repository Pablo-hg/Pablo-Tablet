# Incidencia 05/11/2026: sustitución de la app estable por una compilación debug

## Qué ocurrió
Durante la configuración de Live Reload se ejecutó Capacitor desde la carpeta principal (rama `main`). En `main` el tipo `debug` no tiene `applicationIdSuffix`, así que la APK debug se instaló con el identificador estable `com.pablohorcajada.tablet` (versión 0.2.0, versionCode 1, DEBUGGABLE, firma debug). Una release firmada con otra clave no puede actualizarse con una APK debug, por lo que Android exige desinstalar la anterior y eso borra sus datos.

## Evidencia (solo lectura, 05/11/2026)
- `firstInstallTime` de la estable: 13:32:55; los ficheros de la copia `~/pablo-tablet-rescate/datos-actuales.tar` son de las 13:32. La app instalada es por tanto una instalación nueva, no una actualización.
- Copia de seguridad íntegra (SHA-256 del tar `19cc01ca...`, `PRAGMA integrity_check` = ok, la BD extraída es idéntica a la suelta). Contiene una fila `app_storage/dashboard-state` escrita 4 s después de la instalación con todas las colecciones vacías (notas, alarmas, temporizadores, eventos, cuentas, galería, ubicaciones: 0) y solo preferencias por defecto y 5 widgets. Tablas de administración móvil y feedback: 0 filas.
- WebView (`Local Storage`, `Session Storage`): ficheros de decenas de bytes, sin datos de usuario.
- La app DEV (instalada 12:36) tiene el mismo estado vacío.
- `allowBackup=false`: no existe copia automática de Android/Google. No hay otros `.ab`, `.db` ni tar en el PC ni exportaciones en `/sdcard`.

## Conclusión
Los datos de la instalación anterior no figuran en la tablet ni en el PC. Lo más probable es que se perdieran al desinstalarse la app original (no demostrable: no existe copia previa al incidente, así que tampoco se puede saber qué contenía). Datos recuperables hoy: ninguno de usuario. La copia actual solo documenta el estado vacío.

## Qué se puede reconstruir
- Calendarios externos y relay: se resincronizan al volver a configurar las cuentas.
- Notas, tareas, alarmas, temporizadores, galería y ubicaciones: solo desde fuentes externas del usuario (capturas, otro dispositivo, memoria).
- Administración móvil: hay que volver a emparejar los móviles.

## Procedimiento seguro para el futuro (no ejecutado)
1. Antes de tocar nada, copia solo lectura (funciona mientras la app sea debuggable): `adb exec-out run-as <paquete> tar -cf - databases shared_prefs files > copia.tar`. Con la release de producción (no debuggable) `run-as` no funciona: usar la exportación de la app si existe.
2. Verificar la copia: `sha256sum`, abrir la BD con `file:...?mode=ro` y `PRAGMA integrity_check`, contar filas por tabla (no volcar contenido).
3. Restaurar solo con autorización expresa, con la app cerrada, y únicamente sobre una app debuggable con el mismo paquete: `run-as` + extracción de `databases/pablo_tablet.db`. En una release no debuggable no es posible sin root.
4. Nunca ejecutar `adb uninstall`, `pm clear` ni `adb install` de otra firma sobre el identificador estable. Para volver a la release hay que desinstalar la debug actual (se pierden sus datos): hacer antes la copia del punto 1.

## Estado de la estable y pasos pendientes (requieren autorización)
- La "estable" instalada es una APK debug 0.2.0 sin TTS: la copia de trabajo de `main` tiene `node_modules` antiguo y `cap sync` quitó `capacitor-community/text-to-speech` de `capacitor.build.gradle` y `capacitor.settings.gradle` (cambios sin confirmar en `main`). Conviene `git checkout -- android/app/capacitor.build.gradle android/capacitor.settings.gradle` y `npm ci` en `main`.
- Reinstalar la release oficial vigente (0.5.2) implicará desinstalar la debug (borra su BD vacía). Hacer la copia del punto 1 antes si ha habido uso desde el incidente.

## Prevención implementada
Ver `docs/ANDROID-DEBUG.md`: sufijo `.debug` obligatorio, scripts `android:dev:*` con lista blanca de adb, bloqueo de `installDebug` e `installRelease` en Gradle.
