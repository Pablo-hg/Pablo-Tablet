# Validación del MVP de administración móvil local

> Issue: #25
>
> Última ejecución automatizada: 12/10/2026
>
> Estado global: **automatización completada; instalación y demostración física pendientes**

Este informe separa de forma explícita lo que está implementado, compilado y probado automáticamente de lo que todavía necesita la Teclast T65 y móviles reales. Un APK generado no cuenta como instalado ni demostrado en hardware.

## Matriz automatizada

| Área | Evidencia automática | Estado |
| --- | --- | --- |
| Preferencia de acceso LAN | `MobileAdminAccessPreferenceTest` comprueba desactivación inicial y persistencia entre instancias | Superado |
| Interfaces de red permitidas | `MobileAdminNetworkPolicyTest` cubre IPv4 privadas RFC1918 y rechaza públicas, loopback, link-local e IPv6 | Superado |
| Vinculación y autenticación | `MobileAdminRepositoryTest` cubre token inválido, aprobación, credencial válida y revocación individual | Superado |
| Rechazo y caducidad | `MobileAdminRepositoryTest` comprueba rechazo explícito, sesión caducada y bloqueo de aprobación posterior | Superado |
| Límites de vinculación | `MobilePairingRateLimiterTest` cubre ráfaga por IP, límite global, espera progresiva, recuperación y memoria acotada; el repositorio comprueba el máximo de pendientes | Superado |
| Revocación global | Pruebas nativas y web comprueban transacción, cancelación de pendientes, invalidación de credenciales y evento WebSocket | Superado |
| Cambio de IP y QR | `MobileAdminSettings.test.tsx` comprueba el cambio de generación de red y la cancelación del QR anterior | Superado |
| Servicio Android recuperable | `MobileAdminServiceTest` y `MobileAdminBootReceiverTest` cubren `START_STICKY`, notificación foreground única, acceso desactivado y recuperación condicionada tras reinicio | Superado |
| Permiso y declaración foreground | El manifiesto fusionado contiene `POST_NOTIFICATIONS`, los permisos foreground, el tipo `connectedDevice` y un receptor de arranque no exportado | Superado |
| Migraciones | `PabloTabletDatabaseMigrationTest` abre instalaciones simuladas de versiones 1 y 3, migra a la versión 4 y conserva el estado existente | Superado |
| Calendario local y externo | Pruebas de mapeo, coexistencia local/Google/Outlook, outbox, conflictos, visibilidad, paginación y recuperación de cursores | Superado |
| Asistente local | Pruebas de interpretación, confirmación previa, cancelación y ejecución tipada; flujo visual revisado sin modificar datos | Superado |
| Notificaciones locales | Pruebas de programación, actualización, cancelación y estados de permisos; comportamiento real con la app cerrada sigue en la matriz física | Superado |
| Canal de actualización | Pruebas del verificador de paquete, versión, certificado y SHA-256; no se ha generado ni publicado una Release | Superado |
| Cliente web | 86/86 pruebas Vitest cubren administración móvil, calendario, asistente, notificaciones y verificación de release | Superado |
| Servicio de calendarios | 2/2 pruebas cubren paginación y recuperación de cursores inválidos de Google y Outlook; `tsc --noEmit` limpio | Superado |
| Compilación | `npm run lint`, `npm run build`, `npm run android:sync`, 23/23 pruebas JVM, `lintDebug` y `assembleDebug` | Superado |
| Revisión visual web | Dashboard, asistente, calendario y ajustes revisados en navegador; 0 errores de consola | Superado |

Esta ejecución usa la rama vinculada `test/25-validate-mobile-admin-mvp` como candidata integral. Combina `dev` (`e3617ef`) con #19, #26, #27, #28, #30, #31, #32 y #40. Las tareas #20–#24 ya forman parte de `dev`. La publicación mDNS, el enlace del socket a la Wi-Fi activa y el cierre efectivo de conexiones en Android están compilados y cubiertos indirectamente por las políticas y estados puros. Su comportamiento real depende de servicios Android, router y red, por lo que se mantiene dentro de la matriz física.

La integración necesitó conservar conjuntamente el servicio recuperable de #31 y las correcciones compatibles con `minSdk 24` de #40. `gradlew lintDebug` finaliza ahora sin errores.

## Preparación externa pendiente

- `calendar-relay` está desplegado en `https://pablo-tablet-calendar-relay.phghorcajada.workers.dev`, con D1 inicializada en Europa occidental y la clave de cifrado almacenada como secreto de Cloudflare.
- Para validar #19 con cuentas reales todavía hay que crear y cargar las credenciales OAuth de Google y Microsoft. Ningún secreto OAuth forma parte del repositorio.
- La compilación de la candidata `v0.3.0` ya incorpora la URL pública del relay; la Release todavía no se ha generado ni publicado.
- Para instalar sobre la aplicación existente hay que generar un APK con su misma firma. El APK debug solo demuestra que el proyecto compila y no debe usarse para sustituir una release instalada.
- No se ha cambiado `versionName`/`versionCode`, no se ha publicado ninguna Release y no se ha abierto una PR contra `dev`.

## Matriz física pendiente

| Escenario | Estado | Evidencia necesaria |
| --- | --- | --- |
| Inicio limpio con acceso LAN desactivado | Pendiente | Foto/captura y estado mostrado tras iniciar la app |
| Activación y conexión desde un móvil en la misma Wi-Fi | Pendiente | URL abierta, solicitud y aprobación |
| Intento desde un móvil no vinculado | Pendiente | Respuesta no autorizada y pantalla mostrada |
| Revocación individual y global con la web abierta | Pendiente | Cierre WebSocket, pantalla de nueva vinculación y HTTP 401 |
| Reinicio de app y tablet | Pendiente | Persistencia del interruptor y dispositivos según el caso |
| Cierre de interfaz y recuperación del servicio | Pendiente | URL accesible sin la actividad, una sola notificación y una sola instancia en `dumpsys` |
| Permiso de notificaciones | Pendiente | Solicitud al activar, notificación persistente visible y mensaje correcto si se deniega |
| Cambio de IP y entre redes Wi-Fi | Pendiente | Nueva dirección, mDNS actualizado y QR anterior inválido |
| Red de invitados con aislamiento | Pendiente | Imposibilidad documentada de alcanzar el servidor |
| Intento desde otra red/Internet | Pendiente | Servicio no accesible fuera de la LAN |
| Instalación y relanzado del APK firmado compatible | Pendiente | Salida ADB y versión/firma instaladas sin borrar datos |

## Regla de cierre

El Issue #25 y el Issue padre #3 deben permanecer abiertos hasta completar todos los escenarios físicos. No se debe desinstalar la aplicación ni borrar sus datos para sustituir la versión instalada: la validación necesita un APK firmado de forma compatible con la instalación existente.
