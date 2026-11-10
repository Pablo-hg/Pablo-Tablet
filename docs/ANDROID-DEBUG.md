# Pablo Tablet DEV — instalación paralela sin releases
**Rama:** `chore/android-dev-variant` · **Fecha:** 05/11/2026.  
**Alcance:** introducir un `debug` con identidad distinta y protección de la versión estable. No se ha compilado/instalado físicamente desde GitHub; validar en Windows con la Teclast por USB.

## Qué cambia
- Release: `com.pablohorcajada.tablet`, misma versión estable, misma firma de release.
- Debug: `com.pablohorcajada.tablet.debug`, nombre **Pablo Tablet DEV**, firma automática debug de Android (distinta de release), sufijo `-dev`.
- Debug y release tienen almacenamiento interno, base de datos, SharedPreferences y WebView data independientes por paquete, y proveedores con autoridad basada en `${applicationId}`.
- **Solo debug:** no entra en modo quiosco automáticamente; vuelve normalmente a Android con Atrás/Home. El plugin de administración móvil no puede levantar el servidor del puerto fijo 8765; el actualizador nativo rechaza comprobación/descarga/instalación de actualizaciones de producción.
- **No tocar `capacitor.config.ts`**: el identificador de referencia del proyecto Capacitor permanece en producción; la separación de APK la crea Gradle. Se sobrescriben recursos Android `package_name` y `custom_url_scheme` solo para debug.
- La integración de cuentas externas y redirecciones OAuth puede necesitar registro explícito del esquema debug; **no usar credenciales o datos reales sin comprobar el flujo**.
- Algunas opciones de Android afectan a todo el dispositivo (volumen, ajustes del sistema, brillo), aunque la base de datos de cada app sea independiente.

## Primer uso (Windows PowerShell; desde carpeta de proyecto principal)
Se recomienda usar un worktree separado para no perder cambios que haya en `Pablo-Tablet`.

```powershell
cd C:\Users\Pablo\Desktop\Pablo-Tablet
git fetch origin
git worktree add -b chore/android-dev-variant ..\Pablo-Tablet-debug origin/chore/android-dev-variant
cd ..\Pablo-Tablet-debug
npm ci
adb devices
npm run android:sync
cd android
.\gradlew.bat :app:installDebug
cd ..
adb shell pm list packages | Select-String 'com.pablohorcajada.tablet'
adb shell monkey -p com.pablohorcajada.tablet.debug -c android.intent.category.LAUNCHER 1
```

El dispositivo debe mostrarse como `device` en `adb devices`, no `unauthorized`. Si el worktree o la rama local ya existen, **no repetir `git worktree add -b`**; reutilizar el directorio existente.

Esperamos ver los dos paquetes: `com.pablohorcajada.tablet` (estable) y `com.pablohorcajada.tablet.debug` (experimental). La aplicación DEV debe mostrar nombre **Pablo Tablet DEV**, permitir volver a Android y empezar con almacenamiento propio vacío.

## Iteraciones posteriores
- Cambio React/CSS/TS: desde la raíz, `npm run android:sync` y `cd android; .\gradlew.bat :app:installDebug; cd ..`.
- Cambio Java/Gradle/manifest o dependencias nativas: también compilar e instalar debug.
- Para desarrollo web puro, `npm run dev` en navegador sin tocar APK; Live Reload a WebView será un paso posterior que se configurará sin exponer servidor de Vite a redes públicas.
- **No ejecutar** `npm run release` ni `gradlew assembleRelease` para iterar.
- El comando `installDebug` genera y firma una APK debug local automáticamente; **no hace release ni utiliza el keystore de producción**.

## Comprobaciones antes de darlo por válido
1. La app estable sigue en la tablet, con sus notas, calendarios y configuración.
2. DEV aparece como aplicación independiente en Android, con datos vacíos.
3. Abrir/cerrar DEV no abre LockTask ni impide usar Atrás/Home.
4. El servicio LAN de producción no cambia; DEV aparece deshabilitado y no abre el puerto 8765.
5. DEV no puede instalar APK de producción desde Ajustes.
6. Un cambio de interfaz se refleja en DEV después de `installDebug`.
7. Se comprueba el comportamiento de permisos, notificaciones, identidad de enlaces y OAuth **sin asumir** equivalencia automática con release.
8. No se ha instalado APK de producción ni publicado GitHub Release.

## Recuperación y limpieza
```powershell
# ¡Esto borra SOLO los datos de DEV!
adb uninstall com.pablohorcajada.tablet.debug

# Para compilarla otra vez no hace falta borrar; usar installDebug.
```

Si aparece `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, revisar la **firma de la app debug previamente instalada** y qué APK existe; no ejecutar `adb uninstall com.pablohorcajada.tablet` porque esa es la aplicación estable y se perderían sus datos.

## Pendiente
- Validar `:app:assembleDebug`/`:app:installDebug` en Windows con Android SDK/JDK instalados.
- Confirmar visualmente y con `pm list packages` la coexistencia con release.
- Decidir si merece la pena habilitar más adelante administración móvil en DEV con **puerto propio** y un mDNS distinto.
- Configurar Live Reload de Vite por ADB una vez validado el modo debug básico.

## Comandos protegidos (Linux/macOS/Windows con Node 22)
Todos comprueban antes de actuar: que la copia de trabajo tenga `applicationIdSuffix ".debug"`, que el APK sea `com.pablohorcajada.tablet.debug` (debuggable, nombre "Pablo Tablet DEV", versión `-dev`) y que haya un único dispositivo (o `ANDROID_SERIAL`). Solo usan `adb install -r` (nunca `uninstall`, `pm clear` ni restauraciones) y tras instalar verifican que la app estable no ha cambiado.

| Comando | Qué hace |
|---|---|
| `npm run android:dev:status` | Solo lectura: estado de ambos paquetes y del APK local. |
| `npm run android:dev:build` | `android:sync` + `assembleDebug` + verificación del APK. No instala. |
| `npm run android:dev:install` | SIMULACIÓN: muestra el plan. |
| `npm run android:dev:install -- --yes` | Instala de verdad el APK DEV verificado. |
| `npm run android:dev:live` | Compila una APK Live y la verifica; SIMULACIÓN, no instala. |
| `npm run android:dev:live -- --yes` | Instala la APK Live, abre `adb reverse`, lanza DEV y arranca Vite. Ctrl+C lo desactiva todo. |
| `npm run android:dev:doctor` | Solo lectura: versiones de Node/Java/adb/Gradle, espacio de laboratorio y estado de ambos paquetes. |
| `npm run android:dev:logcat` | Logcat solo del proceso DEV (`-- --dump` para volcado único), guardado en `~/pablo-tablet-lab/logs/android/`. |
| `npm run android:dev:stop` | Para Vite (solo si es el de este proyecto), quita `adb reverse` y restaura la configuración normal. |
| `npm run android:dev:test` | lint + vitest + tests de scripts + tests unitarios Android (Robolectric). |
| `npm run android:dev:live-off` | Quita `adb reverse` y regenera la configuración normal de Capacitor. |

Gradle además bloquea `installDebug` salvo con `-PpabloDevInstall=true` (lo que evita instalaciones accidentales desde Android Studio o `./gradlew`) y bloquea cualquier `installRelease`. Los workflows de CI solo usan `assembleDebug`/`assembleRelease`.

## Live Reload (USB, sin exponer Vite)
- Vite escucha solo en `127.0.0.1:5173` (`--strictPort`); la tablet lo alcanza por `adb reverse tcp:5173 tcp:5173`. No se abre ningún puerto en la Wi-Fi.
- `capacitor.config.ts` añade `server.url = http://localhost:5173` y `cleartext` solo si existen `PABLO_ANDROID_VARIANT=dev` y `PABLO_DEV_LIVE_URL` (solo se aceptan URLs localhost). El comando las define únicamente durante su ejecución. Sin ellas la configuración es la de producción.
- La URL queda embebida en el APK Live instalado. Para volver a un DEV normal: `android:dev:live-off`, luego `android:dev:build` y `android:dev:install -- --yes`. Con Vite apagado, el DEV Live muestra error de conexión (la estable no se ve afectada).
- Cambios en React, CSS y TypeScript se ven al instante (HMR). Cambios Java/Gradle/manifest requieren reinstalar.
- Validado el 05/11/2026 sin instalar: configuración generada con y sin Live, rechazo de URL no local, Vite en loopback. Pendiente de prueba física: carga real en la T65.

## Qué se aísla y qué no
- Aislado: paquete, datos, base de datos, WebView, FileProvider, esquema de enlaces, canales de notificación y alarmas (todo por paquete). Quiosco, administración móvil (puerto 8765, mDNS) y actualizador de producción desactivados. Los volúmenes y el tiempo de pantalla del sistema no se modifican desde DEV.
- Compartido (no se puede aislar): Wi-Fi, brillo/orientación del hardware, permisos del sistema que se concedan a cada app, cuentas de calendario externas si se configuran en ambas, y la clave de firma debug (la de Android por defecto, distinta de la de release).

## Tests unitarios Android y variante DEV
Los tests Robolectric corren en la variante debug. Los bloqueos DEV pasan por `DevVariant.lockdown()`, que Gradle desactiva solo en la JVM de pruebas (`-Dpablo.dev.lockdown=false`); `DevVariantLockdownTest` comprueba que el bloqueo funciona cuando está activo. Sin esta costura 13 tests de administración móvil fallaban en debug.
