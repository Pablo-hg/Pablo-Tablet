# Validación del MVP de administración móvil local

> Issue: #25
>
> Fecha de automatización: 10/10/2026
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
| Migraciones | `PabloTabletDatabaseMigrationTest` abre instalaciones simuladas de versiones 1 y 3, migra a la versión 4 y conserva el estado existente | Superado |
| Cliente web | 46/46 pruebas Vitest cubren HTTP 401, pérdida de autorización por WebSocket, reconexión breve y borrado de la credencial revocada | Superado |
| Compilación | `npm run lint`, `npm run build`, `npm run android:sync`, 15/15 pruebas JVM y `assembleDebug` | Superado |

La publicación mDNS, el enlace del socket a la Wi-Fi activa y el cierre efectivo de conexiones en Android están compilados y cubiertos indirectamente por las políticas y estados puros. Su comportamiento real depende de servicios Android, router y red, por lo que se mantiene dentro de la matriz física.

## Matriz física pendiente

| Escenario | Estado | Evidencia necesaria |
| --- | --- | --- |
| Inicio limpio con acceso LAN desactivado | Pendiente | Foto/captura y estado mostrado tras iniciar la app |
| Activación y conexión desde un móvil en la misma Wi-Fi | Pendiente | URL abierta, solicitud y aprobación |
| Intento desde un móvil no vinculado | Pendiente | Respuesta no autorizada y pantalla mostrada |
| Revocación individual y global con la web abierta | Pendiente | Cierre WebSocket, pantalla de nueva vinculación y HTTP 401 |
| Reinicio de app y tablet | Pendiente | Persistencia del interruptor y dispositivos según el caso |
| Cambio de IP y entre redes Wi-Fi | Pendiente | Nueva dirección, mDNS actualizado y QR anterior inválido |
| Red de invitados con aislamiento | Pendiente | Imposibilidad documentada de alcanzar el servidor |
| Intento desde otra red/Internet | Pendiente | Servicio no accesible fuera de la LAN |
| Instalación y relanzado del APK firmado compatible | Pendiente | Salida ADB y versión/firma instaladas sin borrar datos |

## Regla de cierre

El Issue #25 y el Issue padre #3 deben permanecer abiertos hasta completar todos los escenarios físicos. No se debe desinstalar la aplicación ni borrar sus datos para sustituir la versión instalada: la validación necesita un APK firmado de forma compatible con la instalación existente.
