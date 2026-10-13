# Servicio de calendarios de Pablo Tablet

Worker privado y desplegable en el plan gratuito de Cloudflare. Mantiene los tokens OAuth fuera de la tablet, cifrados en D1; la app sólo recibe una credencial opaca revocable.

## Configuración

1. Crea una base D1 y sustituye su identificador en `wrangler.jsonc`.
2. Ejecuta `npx wrangler d1 execute pablo-tablet-calendar --remote --file=schema.sql`.
3. Registra las URLs de retorno en Google Cloud y Microsoft Entra:
   - `https://pablo-tablet-calendar-relay.phghorcajada.workers.dev/oauth/google/callback`
   - `https://pablo-tablet-calendar-relay.phghorcajada.workers.dev/oauth/outlook/callback`
4. Añade los secretos con `npx wrangler secret put NOMBRE` usando los cinco nombres de `.dev.vars.example`. `TOKEN_ENCRYPTION_KEY` debe ser una cadena aleatoria larga.
5. Despliega con `npm run deploy` y compila la app con `VITE_CALENDAR_RELAY_URL=https://pablo-tablet-calendar-relay.phghorcajada.workers.dev`.

No guardes secretos reales en `.dev.vars.example`, Git ni el APK.
