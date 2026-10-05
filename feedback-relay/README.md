# Relay de comentarios

Cloudflare Worker que recibe los comentarios de la tablet y crea o consulta GitHub Issues en el repositorio privado `Pablo-hg/Pablo-Tablet`.

## Seguridad

- `GITHUB_TOKEN` solo existe como secreto cifrado del Worker y necesita únicamente permiso **Issues: Read and write** sobre `Pablo-Tablet`.
- `FEEDBACK_RELAY_KEY` autentica a la tablet, pero no concede acceso directo a GitHub.
- El Worker acepta exclusivamente HTTPS, limita las peticiones, valida tamaño y campos, y evita Issues duplicados mediante el identificador del reporte.
- Los secretos no deben añadirse a archivos del repositorio.

## Despliegue

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

## Estados

| Estado móvil | Estado del Issue |
| --- | --- |
| Enviado | Issue creado con `feedback-movil` |
| Visto | etiqueta `visto` |
| En desarrollo | etiqueta `en-desarrollo` |
| Implementado | Issue cerrado con etiqueta `implementado` |
