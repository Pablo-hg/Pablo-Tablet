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
