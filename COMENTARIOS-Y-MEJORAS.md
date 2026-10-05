# Comentarios, mejoras y errores desde el móvil

> Estado: fases 2A y código de 2B preparados; etiquetas creadas y despliegue del relay pendiente
>
> Versión de producto: `0.1.0`
>
> Actualizado: 05/10/2026

## Objetivo

La pestaña **Comentarios** permite que una persona con un móvil vinculado comunique un error, una mejora o una nueva función. El reporte se conserva primero en la tablet y, cuando se configure el relay HTTPS, llegará a GitHub sin incluir credenciales de escritura en la tablet o en el móvil.

## Estado implementado

La fase 2A incluye:

- formulario accesible solo para móviles vinculados;
- validación en el navegador y de nuevo en el servidor Android;
- cola persistente `feedback_reports` en SQLite;
- versión, modelo de tablet, fecha y móvil autorizado añadidos por Android;
- seguimiento visible limitado a `sent`, `seen`, `in_progress` e `implemented`;
- historial separado por móvil;
- cliente Android para un relay configurable exclusivamente mediante HTTPS;
- relay Cloudflare Worker en `feedback-relay/`, con autenticación, validación, límite de frecuencia y deduplicación;
- workflow `feedback-to-markdown.yml` para convertir Issues con la etiqueta `feedback-movil` en `feedback/issue-<numero>.md`.

Las etiquetas `feedback-movil`, `visto`, `en-desarrollo` e `implementado` ya existen en el repositorio privado. Todavía no se ha desplegado ni configurado el relay porque requiere autenticar una cuenta de Cloudflare y crear una credencial de GitHub limitada a Issues. Hasta entonces los reportes se guardan como pendientes y no crean un Issue real.

## Campos del formulario

- tipo: **Error**, **Mejora** o **Nueva función**;
- título breve;
- apartado afectado;
- descripción;
- importancia: baja, normal, alta o bloqueante;
- confirmación de privacidad.

## Flujo técnico

1. El usuario rellena el formulario desde el móvil vinculado.
2. El navegador valida los campos.
3. El servidor local autenticado de la tablet vuelve a validar y guarda el reporte en SQLite.
4. Android añade la versión `0.1.0`, el modelo de tablet, la fecha y el móvil autorizado.
5. Si no hay relay configurado, el reporte queda en `pending`; la interfaz no expone acciones para copiar o descargar el Markdown interno.
6. Si hay relay, Android realiza una petición HTTPS; el navegador nunca habla directamente con GitHub.
7. El relay aplica validación y límite de frecuencia, y usa una credencial guardada exclusivamente en servidor para crear el Issue.
8. El Issue recibe la etiqueta `feedback-movil` y las etiquetas funcionales correspondientes.
9. GitHub Actions genera o actualiza `feedback/issue-<numero>.md`.

GitHub Issues será la fuente de verdad cuando el relay esté operativo. El Markdown del repositorio será una representación generada.

## Contrato del relay HTTPS

La URL se inyecta al compilar, sin cambiar la versión:

```powershell
./gradlew assembleRelease `
  -PfeedbackRelayUrl=https://pablo-tablet-feedback.<cuenta>.workers.dev `
  -PfeedbackRelayKey=<clave-de-entrada>
```

Android envía `POST application/json` con `action: "create"` al registrar el comentario y `action: "status"` al actualizar su seguimiento:

```json
{
  "action": "create",
  "report": {
    "id": "...",
    "type": "error",
    "title": "...",
    "area": "Reloj",
    "priority": "high",
    "appVersion": "0.1.0",
    "tabletModel": "Teclast T65",
    "createdAt": 1791194400000,
    "markdown": "# ..."
  }
}
```

Una respuesta correcta debe ser:

```json
{
  "issueNumber": 123,
  "issueUrl": "https://github.com/propietario/repositorio/issues/123",
  "status": "seen"
}
```

El relay debe crear el Issue con la etiqueta `feedback-movil`. GitHub Issues es la fuente de verdad y el seguimiento se traduce así:

- Issue creado: `sent` (**Enviado**);
- etiqueta `visto`: `seen` (**Visto**);
- etiqueta `en-desarrollo`: `in_progress` (**En desarrollo**);
- Issue cerrado con la etiqueta `implementado`: `implemented` (**Implementado**).

`pending` y `failed` son condiciones internas de transporte anteriores a la creación del Issue, no estados del ticket mostrados en la línea de progreso. Una respuesta inválida o un error de red habilita **Reintentar envío**.

## Seguridad y privacidad

- No se guarda un Personal Access Token dentro del APK, JavaScript o almacenamiento del navegador.
- La clave incluida en Android solo permite presentar comentarios al relay; no es una credencial de GitHub.
- El endpoint solo se admite por HTTPS.
- El token del relay tendrá permisos mínimos y estará limitado al repositorio de feedback.
- El cliente no puede modificar código, crear Releases ni administrar el repositorio.
- No se envían notas, fotografías, calendario u otros datos personales automáticamente.
- El formulario exige confirmar que el texto se ha revisado antes de guardarlo.
- El número de serie no se recopila.
- El relay deberá aplicar limitación de frecuencia antes de producción.

## Formato Markdown

```md
# [Error] El reloj no reproduce la alarma

- Estado: pendiente-envio
- Apartado: Reloj
- Importancia: alta
- Versión: 0.1.0
- Tablet: Teclast T65
- Móvil autorizado: Móvil de casa
- Fecha: 2026-10-05T12:00:00Z

## Descripción
...
```

## Red y alcance

El formulario lo sirve la tablet, por lo que el móvil debe estar en la misma Wi-Fi para abrirlo y registrar el reporte. El envío posterior al relay requiere Internet en la tablet. Abrir el formulario desde cualquier red sigue fuera del alcance de `0.1.0`.

## Pendiente para completar la fase 2

- autenticar Cloudflare y desplegar `feedback-relay/`;
- crear y configurar en el Worker un token fine-grained con acceso únicamente a Issues de `Pablo-hg/Pablo-Tablet`;
- guardar la URL y la clave de entrada como secretos del proceso de compilación Android;
- probar la creación de un único Issue y su Markdown generado;
- probar el flujo desde un móvil real y la Teclast T65;
- decidir si una fase posterior admitirá capturas y respuestas desde el móvil.

La implementación no autoriza un cambio de versión. Pablo indicará expresamente cuándo debe incrementarse.
