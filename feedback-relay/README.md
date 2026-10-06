# Relay de comentarios

Cloudflare Worker desplegado para recibir los comentarios de la tablet y crear o consultar GitHub Issues en el repositorio público `Pablo-hg/Pablo-Tablet` sin exponer credenciales de escritura en el cliente.

## Seguridad

- `GITHUB_TOKEN` solo existe como secreto cifrado del Worker y necesita únicamente permiso **Issues: Read and write** sobre `Pablo-Tablet`.
- `FEEDBACK_RELAY_KEY` autentica a la tablet, pero no concede acceso directo a GitHub.
- El Worker acepta exclusivamente HTTPS, limita las peticiones, valida tamaño y campos, y evita Issues duplicados mediante el identificador del reporte.
- Los secretos no deben añadirse a archivos del repositorio.

## Despliegue

El Worker de producción ya está desplegado. Estos comandos documentan cómo reproducir el despliegue o rotar sus secretos sin guardar sus valores en Git:

```powershell
cd feedback-relay
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put FEEDBACK_RELAY_KEY
npx wrangler deploy
```

La compilación Android debe recibir la URL y la misma clave de entrada:

```powershell
./gradlew assembleRelease `
  -PfeedbackRelayUrl=https://pablo-tablet-feedback.<cuenta>.workers.dev `
  -PfeedbackRelayKey=<clave-de-entrada>
```

La clave de entrada debe ser aleatoria y tener al menos 32 caracteres. No es un token de GitHub y debe poder rotarse si se distribuyera fuera de los dispositivos autorizados.

En GitHub Actions deben existir también `FEEDBACK_RELAY_URL` y `FEEDBACK_RELAY_KEY`. El primero apunta al Worker desplegado y el segundo debe coincidir con el secreto de entrada configurado en Cloudflare. No deben anotarse sus valores en este documento.

## Estados

| Estado móvil | Estado del Issue |
| --- | --- |
| Enviado | Issue creado con `feedback-movil` |
| Visto | etiqueta `visto` |
| En desarrollo | etiqueta `en-desarrollo` |
| Implementado | Issue cerrado con etiqueta `implementado` |
