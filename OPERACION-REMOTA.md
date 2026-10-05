# Operación remota de Pablo Tablet

> Versión de producto actual: `0.1.0`
>
> Actualizado: 05/10/2026

Este documento explica cómo se mantiene y administra Pablo Tablet cuando la Teclast T65 está instalada en otra vivienda. Es el punto de entrada de la documentación remota y separa expresamente lo que ya existe de lo que todavía está planificado.

## Mapa de capacidades

| Capacidad | Alcance de red | Estado en `0.1.0` | Documento detallado |
| --- | --- | --- | --- |
| Uso normal de la tablet | Sin Internet, salvo servicios concretos como Tiempo | Implementado | [README](README.md) |
| Administración desde un móvil vinculado | Misma Wi‑Fi que la tablet | Implementada en código; validación completa pendiente | [ADMINISTRACION-MOVIL](ADMINISTRACION-MOVIL.md) |
| Buscar, descargar e instalar actualizaciones | Internet | Implementado y probado con APK debug; preparación de producción pendiente | [ACTUALIZACIONES](ACTUALIZACIONES.md) |
| Enviar comentarios, mejoras y errores | Wi-Fi local para registrar; Internet para GitHub | Formulario y cola implementados; relay y prueba real pendientes | [COMENTARIOS-Y-MEJORAS](COMENTARIOS-Y-MEJORAS.md) |
| Control total de la tablet desde fuera de la vivienda | Internet | Fuera del alcance actual | — |

Las fases técnicas de esta tabla no cambian la versión del producto. La versión solo se incrementa cuando Pablo lo indica expresamente.

## Arquitectura general

```text
Desarrollo                         Internet                         Otra vivienda

Repositorio privado
Pablo-Tablet
      |
      | tag aprobado + GitHub Actions
      v
Repositorio público de Releases  -------- descarga HTTPS ------->  Teclast T65
Pablo-Tablet-Releases                                              verifica SHA-256
                                                                  abre instalador Android

GitHub Issues                    <-------- HTTPS (fase 2) --------  formulario del móvil
      |
      v
Markdown generado por Action

Móvil vinculado                  <--------- Wi-Fi local --------->  servidor de la tablet
                                                                  SQLite = fuente de verdad
```

El código fuente permanece privado. El repositorio público de distribución solo contendrá APK firmados y sus datos de Release. Ninguna credencial de escritura de GitHub se incluirá en la tablet ni en el navegador móvil.

## Flujo de una actualización

1. Pablo confirma expresamente el nuevo número de versión.
2. Se validan los cambios con lint, tests, build web, sincronización Android, ensamblado e instalación en la tablet de desarrollo.
3. Se crea y envía el tag aprobado al repositorio privado.
4. GitHub Actions compila el APK con la clave definitiva y publica la Release en `Pablo-Tablet-Releases`.
5. La tablet remota abre **Ajustes → Sistema → Actualizaciones** y consulta la última Release.
6. Si la versión es superior, muestra las novedades y permite descargarla.
7. La aplicación limita la descarga al repositorio de distribución oficial y verifica el SHA-256.
8. Android valida el identificador, el `versionCode` y la firma del APK.
9. Una persona en la vivienda confirma la instalación cuando Android la solicite.
10. Tras reiniciarse la app, se comprueba la versión instalada y el funcionamiento del modo hogar.

La instalación completamente silenciosa no forma parte de `0.1.0`. Exigiría administrar la tablet como Device Owner/MDM.

## Flujo de administración móvil local

1. La tablet muestra un QR temporal desde **Ajustes → Administración móvil**.
2. Un móvil conectado a la misma Wi‑Fi escanea el QR y solicita acceso.
3. Una persona confirma físicamente la solicitud en la tablet.
4. El móvil recibe una credencial individual y revocable.
5. El editor web modifica el estado almacenado en la tablet; no mantiene una copia maestra en la nube.
6. WebSocket notifica los cambios y la interfaz vuelve a leer el estado compartido desde SQLite.

Este flujo no permite administrar la tablet desde otra red. Su validación completa con móviles y routers reales continúa pendiente.

## Flujo de comentarios y mejoras

La fase técnica 2A ha añadido la pestaña **Comentarios** al cliente móvil. El formulario entrega el reporte al servidor autenticado de la tablet y Android lo conserva en SQLite. Cuando se configure el relay HTTPS, la tablet enviará el reporte para crear un GitHub Issue. La Action incluida generará a partir del Issue el archivo Markdown solicitado.

El servicio intermedio sigue siendo obligatorio para no exponer una clave de GitHub. Su código está preparado en `feedback-relay/` y las cuatro etiquetas ya existen en el repositorio privado, pero falta autenticar Cloudflare, guardar los secretos y desplegarlo. Mientras tanto se informa de que el Issue aún no se ha creado. Una vez creado, la pestaña solo muestra **Enviado**, **Visto**, **En desarrollo** e **Implementado**, sincronizados desde GitHub Issues. No se ofrece copia o descarga del Markdown interno. La definición completa está en [COMENTARIOS-Y-MEJORAS.md](COMENTARIOS-Y-MEJORAS.md).

## Preparación operativa pendiente

Antes de trasladar la tablet a la otra vivienda hay que completar:

- crear el repositorio público `Pablo-hg/Pablo-Tablet-Releases`;
- crear y respaldar la clave de firma definitiva;
- configurar los secretos de GitHub Actions;
- proteger los datos actuales y hacer la instalación inicial firmada;
- autorizar una vez la instalación desde Pablo Tablet;
- publicar y probar una Release real sin cambiar `0.1.0` salvo instrucción expresa;
- validar la administración móvil con el router y los móviles de la vivienda;
- documentar quién puede confirmar físicamente una instalación o un nuevo emparejamiento.

Hasta completar esos puntos, la interfaz de actualización está presente y validada, pero no existe un canal de producción operativo.

## Recuperación y límites

- Si GitHub no responde, la tablet continúa usando la versión instalada.
- Si el hash no coincide, el APK se elimina y no se abre el instalador.
- Si Android rechaza la firma o el `versionCode`, la versión instalada se conserva.
- Si la actualización falla, se debe recopilar el mensaje mostrado y resolverlo antes de volver a publicar.
- Una actualización no debe borrar datos. La primera migración de debug a la firma definitiva es la excepción y debe prepararse localmente con copia o exportación previa.
- No existe todavía rollback automático, reinicio remoto, escritorio remoto ni acceso general al sistema Android.

## Regla de versionado

La versión actual es `0.1.0`. Los tags, `versionName`, documentación y Releases deben conservar ese número hasta que Pablo comunique expresamente el siguiente.
