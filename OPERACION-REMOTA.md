# Operación remota de Pablo Tablet

> Versión de producto actual: `0.1.0`
>
> Actualizado: 06/10/2026

Este documento explica cómo se mantiene y administra Pablo Tablet cuando la Teclast T65 está instalada en otra vivienda. Es el punto de entrada de la documentación remota y separa expresamente lo que ya existe de lo que todavía está planificado.

## Mapa de capacidades

| Capacidad | Alcance de red | Estado en `0.1.0` | Documento detallado |
| --- | --- | --- | --- |
| Uso normal de la tablet | Sin Internet, salvo servicios concretos como Tiempo | Implementado | [README](README.md) |
| Administración desde un móvil vinculado | Misma Wi‑Fi que la tablet | Implementada en código; validación completa pendiente | [ADMINISTRACION-MOVIL](ADMINISTRACION-MOVIL.md) |
| Buscar, descargar e instalar actualizaciones | Internet | Implementado y probado con APK debug; preparación de producción pendiente | [ACTUALIZACIONES](ACTUALIZACIONES.md) |
| Enviar comentarios, mejoras y errores | Wi-Fi local para registrar; Internet para GitHub | Implementado; Worker e Issue real validados | [COMENTARIOS-Y-MEJORAS](COMENTARIOS-Y-MEJORAS.md) |
| Control total de la tablet desde fuera de la vivienda | Internet | Fuera del alcance actual | — |

Las fases técnicas de esta tabla no cambian la versión del producto. La versión solo se incrementa cuando Pablo lo indica expresamente.

## Arquitectura general

```text
Desarrollo                         Internet                         Otra vivienda

Repositorio público Pablo-Tablet
      |
      | tag aprobado + GitHub Actions
      v
Release con APK y SHA-256  -------- descarga HTTPS ----------->  Teclast T65
                                                               verifica SHA-256
                                                               abre instalador Android

GitHub Issues                    <-------- HTTPS (fase 2) --------  formulario del móvil
      |
      v
Markdown generado por Action

Móvil vinculado                  <--------- Wi-Fi local --------->  servidor de la tablet
                                                                  SQLite = fuente de verdad
```

El código fuente y las Releases oficiales se mantienen en `Pablo-hg/Pablo-Tablet`. Cada Release contiene únicamente el APK firmado y su SHA-256 como artefactos descargables; los secretos de compilación permanecen cifrados en GitHub Actions. Que el código sea público no cambia la regla de seguridad: ninguna credencial de escritura de GitHub, clave de firma o secreto del Worker se incluye en la tablet, el navegador móvil o el repositorio.

## Flujo de una actualización

1. Pablo confirma expresamente el nuevo número de versión.
2. Se prueban en `dev` las incidencias candidatas.
3. Se crea `release/<version>` desde `main` y se incorporan únicamente los cambios aprobados.
4. Se valida de nuevo la rama de publicación con lint, tests, build web, sincronización Android, ensamblado e instalación en la tablet de desarrollo.
5. Se fusiona mediante PR hacia `main` y se crea el tag aprobado sobre ese resultado.
6. GitHub Actions compila el APK con la clave definitiva y publica la Release en `Pablo-hg/Pablo-Tablet`.
7. La tablet remota abre **Ajustes → Sistema → Actualizaciones** y consulta la última Release.
8. Si la versión es superior, muestra las novedades y permite descargarla.
9. La aplicación limita la descarga al repositorio de distribución oficial y verifica el SHA-256.
10. Android valida el identificador, el `versionCode` y la firma del APK.
11. Una persona en la vivienda confirma la instalación cuando Android la solicite.
12. Tras reiniciarse la app, se comprueba la versión instalada y el funcionamiento del modo hogar.

La instalación completamente silenciosa no forma parte de `0.1.0`. Exigiría administrar la tablet como Device Owner/MDM.

## Flujo de administración móvil local

1. La opción **Permitir administración desde otros dispositivos** está desactivada por defecto, tanto en instalaciones nuevas como al actualizar desde una versión que no guardaba esta preferencia. Los dispositivos ya vinculados se conservan, pero Pablo debe volver a activar expresamente el acceso LAN.
2. Al activarla, la tablet inicia el servidor en la IPv4 privada de la Wi‑Fi activa y, desde Android 13, anuncia el servicio mDNS únicamente en esa red. En versiones anteriores se mantiene la URL por IP y se omite el anuncio global por seguridad.
3. La tablet muestra un QR temporal desde **Ajustes → Administración móvil**.
4. Un móvil conectado a la misma Wi‑Fi escanea el QR y solicita acceso.
5. Una persona confirma físicamente la solicitud en la tablet.
6. El móvil recibe una credencial individual y revocable.
7. Al desactivar el acceso se invalidan los QR y solicitudes pendientes, se retira mDNS y se cierran el servidor y sus conexiones; la app de la tablet continúa usando SQLite directamente.
8. El editor web modifica el estado almacenado en la tablet; no mantiene una copia maestra en la nube.
9. WebSocket notifica los cambios y la interfaz vuelve a leer el estado compartido desde SQLite.

Este flujo no permite administrar la tablet desde otra red. Su validación completa con móviles y routers reales continúa pendiente.

## Flujo de comentarios y mejoras

La pestaña **Comentarios** del cliente móvil entrega el reporte al servidor autenticado de la tablet y Android lo conserva en SQLite. La tablet lo envía al Worker HTTPS de Cloudflare, que crea el GitHub Issue sin revelar su token al móvil ni al APK. La creación real quedó validada con el Issue #1.

El servicio intermedio sigue siendo obligatorio para no exponer una clave de GitHub. Su código está en `feedback-relay/`, está desplegado en Cloudflare y utiliza secretos configurados fuera del repositorio. La pestaña solo muestra **Enviado**, **Visto**, **En desarrollo** e **Implementado**, sincronizados desde GitHub Issues. El Markdown interno se genera mediante un PR hacia `dev` únicamente al aplicar la etiqueta `implementado`; no se ofrece copiarlo o descargarlo desde el móvil. La definición completa está en [COMENTARIOS-Y-MEJORAS.md](COMENTARIOS-Y-MEJORAS.md).

## Preparación operativa pendiente

Antes de trasladar la tablet a la otra vivienda hay que completar:

- crear y respaldar la clave de firma definitiva;
- configurar los secretos de GitHub Actions;
- proteger los datos actuales y hacer la instalación inicial firmada;
- autorizar una vez la instalación desde Pablo Tablet;
- publicar y probar una Release real sin cambiar `0.1.0` salvo instrucción expresa;
- validar la administración móvil con el router y los móviles de la vivienda;
- documentar quién puede confirmar físicamente una instalación o un nuevo emparejamiento.

Hasta completar esos puntos, la interfaz de actualización está presente y validada, pero no existe un canal de producción operativo.

La lista de secretos, etiquetas, permisos y comprobaciones iniciales se mantiene en [CONFIGURACION-REMOTA.md](CONFIGURACION-REMOTA.md).

## Recuperación y límites

- Si GitHub no responde, la tablet continúa usando la versión instalada.
- Si el hash no coincide, el APK se elimina y no se abre el instalador.
- Si Android rechaza la firma o el `versionCode`, la versión instalada se conserva.
- Si la actualización falla, se debe recopilar el mensaje mostrado y resolverlo antes de volver a publicar.
- Una actualización no debe borrar datos. La primera migración de debug a la firma definitiva es la excepción y debe prepararse localmente con copia o exportación previa.
- No existe todavía rollback automático, reinicio remoto, escritorio remoto ni acceso general al sistema Android.

## Regla de versionado

La versión actual es `0.1.0`. Los tags, `versionName`, documentación y Releases deben conservar ese número hasta que Pablo comunique expresamente el siguiente.
