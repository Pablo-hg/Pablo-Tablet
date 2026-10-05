# Comentarios, mejoras y errores desde el móvil

> Estado: especificación de la fase técnica 2; no implementada en `0.1.0`
>
> Actualizado: 05/10/2026

## Objetivo

Añadir al editor móvil una pestaña **Comentarios y mejoras** para que una persona autorizada pueda comunicar un error, una sugerencia o una petición de implementación. El reporte llegará a GitHub sin incluir credenciales de escritura en la tablet o en el móvil.

## Experiencia prevista

El formulario tendrá:

- tipo: **Error**, **Mejora** o **Nueva función**;
- título breve;
- apartado afectado: Inicio, Calendario, Reloj, Tiempo, Notas, Galería, Ajustes, Administración móvil u Otro;
- descripción;
- pasos para reproducir el problema, cuando sea un error;
- resultado obtenido y resultado esperado;
- importancia: baja, normal, alta o bloqueante;
- captura de pantalla opcional;
- consentimiento explícito antes de adjuntar una imagen;
- versión de la aplicación, modelo de tablet y fecha añadidos automáticamente.

Después del envío se mostrará uno de estos estados:

- **Enviado**, con el número del Issue;
- **Pendiente de conexión**, si se decide implementar una cola local;
- **No enviado**, con una causa y opción de reintento.

## Flujo técnico previsto

1. El usuario rellena el formulario desde el móvil vinculado.
2. El navegador valida los campos y muestra exactamente qué información se enviará.
3. El cliente realiza una petición HTTPS a un endpoint específico de feedback.
4. El endpoint aplica validación, límite de frecuencia y tamaño máximo de adjuntos.
5. Una GitHub App o token fine-grained guardado exclusivamente en el servidor crea un Issue en el repositorio acordado.
6. El Issue recibe etiquetas como `bug`, `mejora`, `nueva-funcion`, `tablet-remota` y `pendiente-revisar`.
7. Una GitHub Action puede convertir el Issue en `feedback/<numero>-<slug>.md` o actualizar un resumen Markdown.
8. El desarrollador responde y gestiona el trabajo desde GitHub.

GitHub Issues será la fuente de verdad del reporte. El Markdown del repositorio será una representación generada, no un archivo escrito directamente por el móvil.

## Formato Markdown previsto

```md
# [Error] El widget del tiempo queda cortado

- Issue: #123
- Estado: pendiente-revisar
- Apartado: Tiempo
- Importancia: alta
- Versión: 0.1.0
- Dispositivo: Teclast T65
- Fecha: 2026-10-05T12:00:00+02:00

## Descripción
...

## Pasos para reproducir
...

## Resultado obtenido
...

## Resultado esperado
...
```

## Seguridad y privacidad

- No se guardará un Personal Access Token dentro del APK, JavaScript o almacenamiento del navegador.
- El token del servicio tendrá permisos mínimos y estará limitado al repositorio de feedback.
- El endpoint no permitirá modificar código, crear Releases ni administrar el repositorio.
- Los adjuntos serán opcionales y se limitarán por tipo y tamaño.
- No se enviarán notas, fotografías de la galería, calendario ni otros datos personales automáticamente.
- El identificador del dispositivo será seudónimo; no se utilizará el número de serie.
- Se aplicará limitación de frecuencia para evitar spam o envíos accidentales repetidos.

## Relación con la administración local

La pestaña vivirá inicialmente en el editor móvil servido por la tablet, por lo que el móvil deberá estar conectado a la misma Wi‑Fi para abrirla. El envío del reporte sí requerirá Internet.

Permitir abrir el formulario desde cualquier red sería una ampliación posterior y exigiría alojar una web pública autenticada. No se considera implementado ni aprobado en `0.1.0`.

## Decisiones pendientes antes de implementar

- proveedor del endpoint HTTPS;
- repositorio exacto donde se crearán los Issues;
- si los Issues serán privados o visibles públicamente;
- almacenamiento de capturas;
- si habrá cola offline;
- si el autor podrá consultar el estado y las respuestas desde el móvil.

## Criterios de aceptación de la fase técnica 2

- La pestaña es usable desde un móvil vinculado.
- Un reporte válido crea un único Issue con los campos y etiquetas esperados.
- La versión `0.1.0` o la versión vigente se adjunta automáticamente.
- Ningún secreto de GitHub aparece en el APK, recursos web, tráfico local o almacenamiento del navegador.
- Los errores de red conservan el contenido del formulario y permiten reintentar.
- Un adjunto no autorizado, demasiado grande o con tipo incorrecto se rechaza de forma clara.
- La automatización genera el Markdown sin conceder escritura directa al cliente.
- El flujo queda probado desde al menos un móvil real y la Teclast T65.

La implementación de esta especificación no autoriza por sí sola un cambio de versión. Pablo indicará cuándo debe incrementarse.
