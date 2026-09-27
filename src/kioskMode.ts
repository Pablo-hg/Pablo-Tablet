import { Capacitor, registerPlugin } from '@capacitor/core'

interface KioskPlugin {
  exitApp(): Promise<void>
}

const Kiosk = registerPlugin<KioskPlugin>('Kiosk')

export async function exitTabletApp() {
  if (Capacitor.isNativePlatform()) {
    await Kiosk.exitApp()
    return
  }

  window.close()
}
