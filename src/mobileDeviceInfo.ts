export function mobileDeviceInfo(userAgent: string) {
  const browserMatch = ['EdgA', 'EdgiOS', 'Edg', 'OPR', 'SamsungBrowser', 'Firefox', 'FxiOS', 'CriOS', 'Chrome', 'Version'].map((name) => new RegExp(`(${name})/([\\d]+)`).exec(userAgent)).find(Boolean)
  const browsers: Record<string, string> = { EdgA: 'Edge', EdgiOS: 'Edge', Edg: 'Edge', OPR: 'Opera', SamsungBrowser: 'Samsung Internet', Firefox: 'Firefox', FxiOS: 'Firefox', CriOS: 'Chrome', Chrome: 'Chrome', Version: 'Safari' }
  // Chromium-based browsers may deliberately identify themselves as Chrome.
  const browser = browserMatch ? `${browsers[browserMatch[1]]} ${browserMatch[2]}` : 'Navegador'
  const platform = /Android/i.test(userAgent) ? 'Android' : /iPhone/i.test(userAgent) ? 'iPhone' : /iPad/i.test(userAgent) ? 'iPad' : /Windows/i.test(userAgent) ? 'Windows' : /Macintosh/i.test(userAgent) ? 'macOS' : /Linux/i.test(userAgent) ? 'Linux' : ''
  const device: 'Móvil Android' | 'Tablet Android' | 'iPhone' | 'iPad' | 'Dispositivo' = platform === 'Android' ? (/Mobile/i.test(userAgent) ? 'Móvil Android' : 'Tablet Android') : platform === 'iPhone' || platform === 'iPad' ? platform : 'Dispositivo'
  return { browser, platform, device }
}
