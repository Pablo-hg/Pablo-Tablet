import type { CapacitorConfig } from '@capacitor/cli'

// Live Reload solo si lo activa scripts/android-dev/cli.mjs (variante dev + URL loopback).
// Sin esas variables de entorno la configuración es idéntica a la de producción.
const liveUrl = process.env.PABLO_ANDROID_VARIANT === 'dev' ? process.env.PABLO_DEV_LIVE_URL : undefined
if (liveUrl && !/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(liveUrl)) {
  throw new Error(`PABLO_DEV_LIVE_URL solo puede apuntar a localhost; recibido: ${liveUrl}`)
}

const config: CapacitorConfig = {
  appId: 'com.pablohorcajada.tablet',
  appName: 'Pablo Tablet',
  webDir: 'dist',
  server: liveUrl ? { androidScheme: 'https', url: liveUrl, cleartext: true } : { androidScheme: 'https' },
}

export default config
