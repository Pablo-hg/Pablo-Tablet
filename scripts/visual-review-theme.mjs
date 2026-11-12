// Run one theme at a time in a disposable Playwright browser. No Vitest, APK or user profile.
// PABLO_PLAYWRIGHT_MODULE=/tmp/.../playwright/index.mjs PABLO_CHROMIUM=/path/to/chrome node scripts/visual-review-theme.mjs
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createHash } from 'node:crypto'

const { chromium } = await import(process.env.PABLO_PLAYWRIGHT_MODULE || 'playwright')
const theme = process.env.PABLO_VISUAL_THEME || 'warm'
const authorizedThemes = {
  warm: /^1\. (Cálido|Warm)/, amoled: /^2\. AMOLED/, retro: /^3\. Retro/,
  glass: /^4\. (Cristal|Glass)/, original: /^5\. Original/, nordic: /^6\. (Nórdico|Nordic)/,
  swiss: /^7\. (Suizo|Swiss)/, mediterranean: /^8\. (Mediterráneo|Mediterranean)/,
  monochrome: /^9\. (Monocromo|Monochrome)/, brutalist: /^10\. (Brutalista|Brutalist)/,
}
if (!authorizedThemes[theme]) throw new Error(`Unknown theme: ${theme}`)
const quick = process.env.PABLO_VISUAL_QUICK === '1'
const languages = (process.env.PABLO_VISUAL_LANGUAGES || 'es').split(',')
const compact = process.env.PABLO_VISUAL_COMPACT === '1'
const requestedPages = process.env.PABLO_VISUAL_PAGES?.split(',')
const output = resolve(process.env.PABLO_VISUAL_OUTPUT || `output/playwright/issue72-${theme}`)
await mkdir(output, { recursive: true })
const fixedTime = new Date('2026-11-11T10:30:00Z')
const pages = [
  ['dashboard', 'Inicio', 'Home', '.dashboard-page'], ['assistant', 'Asistente', 'Assistant', '.assistant-page'],
  ['calendar', 'Calendario', 'Calendar', '.calendar-page'], ['clock', 'Reloj', 'Clock', '.clock-page'],
  ['weather', 'Tiempo', 'Weather', '.weather-page'], ['notes', 'Notas', 'Notes', '.notes-page'],
  ['gallery', 'Galería', 'Gallery', '.gallery-page'], ['settings', 'Ajustes', 'Settings', '.settings-page'],
]
const browser = await chromium.launch({ headless: true, executablePath: process.env.PABLO_CHROMIUM || undefined, args: ['--disable-dev-shm-usage'] })
const report = { theme, browser: browser.version(), fixedTime: fixedTime.toISOString(), fixture: 'fictional, isolated storage, stubbed weather', captures: [], errors: [], measurements: [] }
const sources = ['src/themes.css', 'src/appearanceSystem.css', 'src/components/ClockStyles.css', 'src/dashboardVisual.css', 'src/pages/WeatherPage.css', 'src/pages/AssistantPage.tsx', 'src/App.tsx']
report.sourceHashes = {}
for (const source of sources) {
  try { report.sourceHashes[source] = createHash('sha256').update(await readFile(source)).digest('hex') } catch { /* optional old path */ }
}

const position = (x, y, width, height) => ({ x, y, width, height })
function fixture(language) {
  const en = language === 'en'
  const note = (id, type, title, content, color) => ({ id, type, title, content, color, pinned: true, archived: false, reminderAt: null, drawing: [], drawingVisible: true, drawingPosition: 'below', createdAt: fixedTime.toISOString(), updatedAt: fixedTime.toISOString() })
  const drawing = note('drawing', 'drawing', en ? 'Saved drawing' : 'Dibujo guardado', '', 'mint')
  drawing.drawing = [{ color: '#f4f7ff', width: 6, points: [{ x: 30, y: 500 }, { x: 200, y: 120 }, { x: 430, y: 440 }, { x: 700, y: 80 }, { x: 950, y: 480 }] }]
  const photo = index => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${index === 2 ? 600 : 1000}" height="${index === 2 ? 1000 : 600}" viewBox="0 0 1000 600"><rect width="1000" height="600" fill="#d5e4e9"/><circle cx="740" cy="140" r="65" fill="#d8b66d"/><path d="M0 600 350 180 650 500 820 300 1000 600Z" fill="#56786e"/><text x="60" y="90" font-size="40" font-family="sans-serif" fill="#203b38">QA ${index}</text></svg>`)
  return {
    preferences: { language, assistantLanguage: language, themeId: 'original', clockWidgetStyle: 'digital', screensaverEnabled: false, nightModeEnabled: false, assistantReadAloud: false, interactionSoundsEnabled: false, pageNavigationStyle: 'dock', pageNavigationPosition: 'bottom', enabledPageIds: pages.filter(p => p[0] !== 'settings').map(p => p[0]) },
    widgets: [
      { id: 'agenda', visible: true, layouts: { landscape: position(0, 0, 2, 3), portrait: position(0, 0, 2, 3) } },
      { id: 'clock', visible: true, layouts: { landscape: position(2, 0, 2, 1), portrait: position(2, 0, 1, 2) } },
      { id: 'weather', visible: true, layouts: { landscape: position(3, 1, 1, 2), portrait: position(2, 2, 1, 2) } },
      { id: 'notes', visible: true, layouts: { landscape: position(2, 1, 1, 2), portrait: position(0, 3, 2, 1) } },
      { id: 'assistant', visible: false, layouts: { landscape: position(0, 0, 1, 1), portrait: position(0, 0, 1, 1) } },
    ],
    notes: [note('long-text', 'text', en ? 'Ideas for the weekend and activities at home' : 'Ideas para el fin de semana y actividades en casa', (en ? 'A long note to check reading, line wrapping and the visible exit from the editor.\n' : 'Una nota larga para revisar la lectura, el salto de línea y la salida visible del editor.\n').repeat(14), 'coral'), drawing, note('checklist', 'list', en ? 'Home checklist' : 'Lista de casa', '- [ ] Preparar la mochila\n- [x] Revisar la agenda\n- [ ] Comprar fruta', 'sun')],
    alarms: [{ id: 'evening', label: en ? 'Evening reminder with a long label' : 'Recordatorio de la tarde con etiqueta larga', time: '18:30', enabled: true, weekdays: [1, 2, 3, 4, 5, 6, 7], soundName: 'Sonido predeterminado', soundUri: null, createdAt: fixedTime.toISOString() }],
    timers: [{ id: 'paused', label: en ? 'Reading timer' : 'Temporizador de lectura', durationSeconds: 600, remainingSeconds: 245, endsAt: null, soundName: 'Sonido predeterminado', soundUri: null, createdAt: fixedTime.toISOString() }],
    calendarEvents: Array.from({ length: 5 }, (_, i) => ({ id: `event-${i}`, source: 'local', accountId: null, calendarId: null, externalId: null, externalVersion: null, syncStatus: 'local', type: i === 3 ? 'task' : 'event', recurrence: 'none', completed: false, title: (en ? ['Team meeting and project review', 'Walk', 'Dentist', 'Shopping and errands', 'Family lunch'] : ['Reunión de equipo y revisión del proyecto', 'Paseo', 'Dentista', 'Compras y recados', 'Comida familiar'])[i], date: i < 2 ? '2026-11-11' : `2026-11-${10 + i}`, endDate: i < 2 ? '2026-11-11' : `2026-11-${10 + i}`, startTime: `${18 + i % 3}:00`, endTime: `${19 + i % 3}:00`, allDay: false, timeZone: 'Europe/Madrid', location: '', notes: '', color: ['blue', 'mint', 'coral', 'sun', 'mint'][i], reminders: [], createdAt: fixedTime.toISOString(), updatedAt: fixedTime.toISOString() })),
    weatherLocations: [{ id: 'qa-madrid', name: 'Madrid', region: 'Comunidad de Madrid', country: 'España', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid' }], homeWeatherLocationId: 'qa-madrid', selectedWeatherLocationId: 'qa-madrid',
    galleryPhotos: [1, 2, 3].map(i => ({ id: `qa-photo-${i}`, name: `Ejemplo ${i}`, uri: photo(i), createdAt: fixedTime.toISOString(), deletedAt: null })),
  }
}
function weather() {
  const times = Array.from({ length: 48 }, (_, i) => new Date(Date.UTC(2026, 10, 11, i)).toISOString().slice(0, 16))
  const dates = Array.from({ length: 7 }, (_, i) => `2026-11-${11 + i}`)
  return { current: { time: '2026-11-11T11:30', temperature_2m: 18.4, apparent_temperature: 17.9, relative_humidity_2m: 55, precipitation: 0, weather_code: 2, wind_speed_10m: 8, is_day: 1 }, hourly: { time: times, temperature_2m: times.map((_, i) => process.env.PABLO_VISUAL_WEATHER_CASE === 'flat' ? -2 : process.env.PABLO_VISUAL_WEATHER_CASE === 'negative' ? -8 + i % 7 : 14 + i % 7), precipitation_probability: times.map(() => 10), weather_code: times.map(() => 2), is_day: times.map((_, i) => i % 24 > 7 && i % 24 < 19 ? 1 : 0) }, daily: { time: dates, temperature_2m_max: dates.map((_, i) => 20 - i % 3), temperature_2m_min: dates.map((_, i) => 11 - i % 3), precipitation_probability_max: dates.map(() => 15), sunrise: dates.map(d => `${d}T07:50`), sunset: dates.map(d => `${d}T18:10`), weather_code: dates.map(() => 2) } }
}

async function measure(page, label) {
  const value = await page.evaluate(() => {
    const box = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, bottom: r.bottom, right: r.right } }
    const textInside = (selector, parent) => [...document.querySelectorAll(selector)].filter(el => el.getClientRects().length).map(el => {
      const p = el.closest(parent), r = el.getBoundingClientRect(), b = p?.getBoundingClientRect()
      return { text: el.textContent, selector, box: box(el), parent: b ? box(p) : null, contained: !b || (r.top >= b.top - 1 && r.left >= b.left - 1 && r.right <= b.right + 1 && r.bottom <= b.bottom + 1) }
    })
    const doc = document.querySelector('.tablet-content')
    const parse = css => {
      if (css.startsWith('rgb')) { const v = css.match(/[\d.]+/g).map(Number); return [v[0], v[1], v[2], v[3] ?? 1] }
      if (css.startsWith('color(srgb ')) { const v = css.slice(11, -1).split(/[ /]+/).map(Number); return [v[0] * 255, v[1] * 255, v[2] * 255, v[3] ?? 1] }
      return null
    }
    const blend = (a, b) => a.slice(0, 3).map((v, i) => v * a[3] + b[i] * (1 - a[3]))
    const luminance = rgb => rgb.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0)
    const contrastFindings = []
    const walker = document.createTreeWalker(document.querySelector('.tablet-content'), NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.textContent.trim()) continue
      const el = node.parentElement
      if (!el || el.closest('script,style,svg,.gallery-thumbnail,.gallery-viewer,:disabled,[aria-disabled="true"],.is-disabled')) continue
      const style = getComputedStyle(el), range = document.createRange()
      range.selectNodeContents(node)
      const bounds = range.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0 || bounds.bottom < 0 || bounds.top > innerHeight || bounds.right < 0 || bounds.left > innerWidth) continue
      let fg = parse(style.color), bg = [255, 255, 255], opacity = 1
      const ancestors = []; for (let a = el; a; a = a.parentElement) ancestors.push(a)
      for (const a of ancestors.reverse()) {
        const s = getComputedStyle(a), color = parse(s.backgroundColor)
        if (color) bg = blend(color, bg)
        opacity *= Number(s.opacity)
      }
      if (!fg || opacity < .01) continue
      fg[3] *= opacity
      const levels = [luminance(blend(fg, bg)), luminance(bg)].sort((a, b) => a - b)
      const ratio = (levels[1] + .05) / (levels[0] + .05)
      const required = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.667 && Number(style.fontWeight) >= 700) ? 3 : 4.5
      if (ratio + .02 < required) contrastFindings.push({ text: node.textContent.trim().slice(0, 85), class: el.className, color: style.color, ratio: Number(ratio.toFixed(2)), required })
    }
    for (const el of document.querySelectorAll('input[placeholder],textarea[placeholder]')) {
      if (el.value || el.disabled || !el.getClientRects().length) continue
      const bounds = el.getBoundingClientRect()
      if (bounds.bottom < 0 || bounds.top > innerHeight) continue
      const style = getComputedStyle(el, '::placeholder'), fg = parse(style.color)
      if (!fg) continue
      let bg = [255, 255, 255]
      const ancestors = []; for (let a = el; a; a = a.parentElement) ancestors.push(a)
      for (const a of ancestors.reverse()) { const color = parse(getComputedStyle(a).backgroundColor); if (color) bg = blend(color, bg) }
      fg[3] *= Number(style.opacity)
      const levels = [luminance(blend(fg, bg)), luminance(bg)].sort((a, b) => a - b)
      const ratio = (levels[1] + .05) / (levels[0] + .05)
      if (ratio + .02 < 4.5) contrastFindings.push({ text: el.placeholder, class: `${el.className}::placeholder`, color: style.color, ratio: Number(ratio.toFixed(2)), required: 4.5 })
    }
    const blueFindings = []
    for (const el of document.querySelectorAll('.tablet-content :is(svg,button,a,span,strong,small,p,label)')) {
      if (el.closest('.gallery-thumbnail,.gallery-viewer,:disabled,[aria-disabled="true"],.is-disabled')) continue
      const bounds = el.getBoundingClientRect(), style = getComputedStyle(el), fg = parse(style.color)
      if (!fg || fg[2] < fg[0] + 18 || fg[2] < fg[1] + 8 || bounds.width <= 0 || bounds.height <= 0 || bounds.bottom < 0 || bounds.top > innerHeight || bounds.right < 0 || bounds.left > innerWidth) continue
      let bg = [255, 255, 255], opacity = 1
      const ancestors = []; for (let a = el; a; a = a.parentElement) ancestors.push(a)
      for (const a of ancestors.reverse()) { const s = getComputedStyle(a), color = parse(s.backgroundColor); if (color) bg = blend(color, bg); opacity *= Number(s.opacity) }
      fg[3] *= opacity
      const levels = [luminance(blend(fg, bg)), luminance(bg)].sort((a, b) => a - b), ratio = (levels[1] + .05) / (levels[0] + .05)
      const required = el.tagName.toLowerCase() === 'svg' ? 3 : 4.5
      if (ratio + .02 < required) blueFindings.push({ text: el.textContent?.slice(0, 90), class: el.getAttribute('class'), parent: el.parentElement.getAttribute('class'), color: style.color, ratio: Number(ratio.toFixed(2)), required })
    }
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, theme: document.querySelector('.tablet-shell')?.dataset.theme,
      document: { clientWidth: doc.clientWidth, scrollWidth: doc.scrollWidth, clientHeight: doc.clientHeight, scrollHeight: doc.scrollHeight, scrollTop: doc.scrollTop, paddingBottom: getComputedStyle(doc).paddingBottom },
      navigation: box(document.querySelector('.page-indicators')),
      criticalText: [...textInside('.focus-clock > time, .focus-clock > p', '.focus-clock'), ...textInside('.clock-style-name, .clock-style-preview', '.clock-style-option'), ...textInside('.widget-size-indicator strong, .widget-size-indicator small', '.widget-size-indicator'), ...textInside('.weather-trend-extreme', '.weather-temperature-trend')],
      widgets: [...document.querySelectorAll('[data-widget-id]')].map(el => ({ id: el.dataset.widgetId, ...box(el) })),
      selectedStyles: [...document.querySelectorAll('.clock-style-option')].map(el => ({ name: el.textContent, ...box(el) })),
      panels: [...document.querySelectorAll('.clock-workspace > *, .clock-management > *')].map(el => ({ class: el.className, ...box(el) })),
      contrastFindings,
      blueFindings,
      weatherChart: document.querySelector('.weather-temperature-trend') ? { chart: box(document.querySelector('.weather-temperature-trend')), cards: [...document.querySelectorAll('.hourly-forecast > div')].map(box), temperatures: [...document.querySelectorAll('.hourly-forecast > div > strong')].map(el => parseFloat(el.textContent)), annotations: [...document.querySelectorAll('.weather-trend-extreme strong')].map(el => el.textContent), annotationValues: [...document.querySelectorAll('.weather-trend-extreme strong')].map(el => Number(el.textContent.match(/-?\d+/)[0])) } : null,
      surfaces: [...document.querySelectorAll('.weather-current-panel,.weather-hours-panel,.weather-forecast-panel,.calendar-month-panel,.calendar-three-day-panel,.settings-section,.notes-workspace,.gallery-panel,.focus-clock,.alarm-panel,.timer-panel')].map(el => ({ class: el.className, shadow: getComputedStyle(el).boxShadow, radius: getComputedStyle(el).borderRadius, ...box(el) })),
    }
  })
  report.measurements.push({ label, ...value })
  if (value.theme !== theme) report.errors.push({ label, type: 'wrong-theme', actual: value.theme })
  if (value.document.scrollWidth > value.document.clientWidth + 1) report.errors.push({ label, type: 'horizontal-page-overflow', ...value.document })
  for (const text of value.criticalText) if (!text.contained) report.errors.push({ label, type: 'critical-text-outside-card', ...text })
  if (value.weatherChart) {
    const w = value.weatherChart, expected = [...new Set([Math.min(...w.temperatures), Math.max(...w.temperatures)])].sort((a, b) => a - b)
    if (JSON.stringify([...new Set(w.annotationValues)].sort((a, b) => a - b)) !== JSON.stringify(expected)) report.errors.push({ label, type: 'wrong-chart-extremes', expected, actual: w.annotationValues })
    if (w.chart.height < 119 || w.cards.some(card => card.height >= w.chart.height)) report.errors.push({ label, type: 'weather-chart-too-small', chart: w.chart, cards: w.cards })
  }
}
async function capture(page, label) {
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(350)
  const file = `${label}.png`
  await page.screenshot({ path: join(output, file), animations: 'disabled' })
  report.captures.push(file)
  await measure(page, label)
  console.log(`captured ${label}`)
}

try {
  for (const language of languages) {
    const sizes = process.env.PABLO_VISUAL_LARGE === '1' ? [{ name: 'large-landscape', width: 1920, height: 1200 }, { name: 'large-portrait', width: 1200, height: 1920 }] : compact ? [{ name: 'compact-landscape', width: 1024, height: 640 }, { name: 'compact-portrait', width: 600, height: 960 }] : [{ name: 'landscape', width: 1280, height: 800 }, { name: 'portrait', width: 800, height: 1280 }]
    for (const size of sizes) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 1, hasTouch: process.env.PABLO_VISUAL_CALENDAR_FEEDBACK === '1', locale: language === 'es' ? 'es-ES' : 'en-GB', timezoneId: 'Europe/Madrid' })
      const state = fixture(language)
      if (process.env.PABLO_VISUAL_EMPTY === '1') {
        for (const key of ['notes', 'alarms', 'timers', 'calendarEvents', 'galleryPhotos', 'weatherLocations']) state[key] = []
        state.homeWeatherLocationId = null
        state.selectedWeatherLocationId = null
      }
      await context.addInitScript(state => { if (!localStorage.getItem('pablo-tablet.dashboard.v17')) localStorage.setItem('pablo-tablet.dashboard.v17', JSON.stringify(state)) }, state)
      await context.route('https://api.open-meteo.com/**', route => route.fulfill({ json: weather() }))
      const page = await context.newPage()
      page.on('pageerror', error => report.errors.push({ label: `${language}-${size.name}`, type: 'pageerror', message: error.message }))
      await page.clock.setFixedTime(fixedTime)
      await page.goto(process.env.PABLO_VISUAL_URL || 'http://127.0.0.1:5173/', { waitUntil: 'networkidle' })
      const go = async id => {
        const entry = pages.find(p => p[0] === id)
        await page.getByRole('button', { name: `${language === 'es' ? 'Ir a' : 'Go to'} ${entry[language === 'es' ? 1 : 2]}`, exact: true }).click()
        await page.locator(entry[3]).waitFor({ state: 'visible' })
        await page.locator('.tablet-content').evaluate(el => el.scrollTop = 0)
      }
      await go('settings')
      await page.getByRole('radio', { name: authorizedThemes[theme] }).click()
      // No theme loop: each theme is selected explicitly after Pablo asks.
      for (const [id] of pages) {
        if (requestedPages && !requestedPages.includes(id)) continue
        if (compact && !requestedPages && !['dashboard', 'clock', 'settings'].includes(id)) continue
        await go(id)
        await capture(page, `${theme}-${language}-${size.name}-${id}`)
        if (id === 'assistant' && process.env.PABLO_VISUAL_CALENDAR_FEEDBACK === '1') {
          const phrase = language === 'es' ? 'Escribe o dicta una petición' : 'Type or dictate a request'
          if (await page.getByRole('textbox', { name: phrase, exact: true }).getAttribute('placeholder') !== phrase || await page.locator('.assistant-composer > label').count()) {
            report.errors.push({ type: 'assistant-placeholder', language, size: size.name })
          }
        }
        if (id === 'calendar' && process.env.PABLO_VISUAL_CALENDAR_FEEDBACK === '1') {
          if (await page.locator('.calendar-day-panel').count()) report.errors.push({ type: 'daily-panel-not-removed', language, size: size.name })
          const newButton = page.locator('.calendar-toolbar .primary-action')
          const newBox = await newButton.boundingBox(), hideBox = await page.locator('.calendar-hide-completed').boundingBox()
          if (newBox.x + newBox.width > hideBox.x + 1 || Math.abs(newBox.y - hideBox.y) > 1) report.errors.push({ type: 'new-not-left-of-hide', language, size: size.name })
          const day = page.locator('.calendar-month-grid > button').filter({ has: page.locator('strong', { hasText: /^13$/ }) })
          await day.click()
          await page.locator('.calendar-three-day-panel').waitFor({ timeout: 3000 })
          await capture(page, `${theme}-${language}-${size.name}-calendar-hours`)
          await page.locator('.calendar-three-day-scroll').evaluate(el => el.scrollTop = 17 * 64)
          await capture(page, `${theme}-${language}-${size.name}-calendar-hours-events`)
          await page.getByRole('button', { name: language === 'es' ? 'Volver al mes' : 'Back to month', exact: true }).click()
          await page.locator('.calendar-month-grid').waitFor({ timeout: 3000 })
          await capture(page, `${theme}-${language}-${size.name}-calendar-return`)
          await day.tap()
          await page.locator('.calendar-three-day-panel').waitFor({ timeout: 3000 })
          await capture(page, `${theme}-${language}-${size.name}-calendar-hours-touch`)
          await page.locator('.calendar-back-to-month').tap()
          await day.focus()
          await day.press('Enter')
          await page.locator('.calendar-three-day-panel').waitFor({ timeout: 3000 })
          await page.locator('.calendar-back-to-month').click()
          await newButton.click()
          await page.getByRole('dialog').waitFor({ timeout: 3000 })
          await page.getByRole('dialog').getByRole('button', { name: language === 'es' ? 'Cerrar' : 'Close', exact: true }).click()
          const b = await day.boundingBox()
          await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
          await page.mouse.down()
          await page.mouse.move(b.x + b.width / 2 - 100, b.y + b.height / 2, { steps: 10 })
          await page.mouse.up()
          await page.locator('.clock-page').waitFor({ timeout: 3000 })
          await go('calendar')
        }
        if (id === 'gallery') {
          const ratios = await page.locator('.gallery-thumbnail').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return r.width / r.height }))
          if (ratios.some(ratio => Math.abs(ratio - 4 / 3) > .03)) report.errors.push({ label: `${language}-${size.name}`, type: 'gallery-thumbnail-ratio', ratios })
        }
        if (process.env.PABLO_VISUAL_STATES === '1') {
          const prefix = `${theme}-${language}-${size.name}`
          if (id === 'settings') {
            const count = await page.locator('.tablet-content').evaluate(el => Math.ceil(el.scrollHeight / (el.clientHeight * .8)))
            for (let n = 1; n < count; n++) {
              await page.locator('.tablet-content').evaluate((el, n) => el.scrollTop = el.clientHeight * .8 * n, n)
              await capture(page, `${prefix}-settings-section-${n}`)
            }
            await page.locator('.tablet-content').evaluate(el => el.scrollTop = 0)
          }
          if (id === 'notes') {
            await page.locator('.notes-sidebar-header .icon-button').click()
            await capture(page, `${prefix}-note-formats`)
            await page.locator('.notes-sidebar-header .icon-button').click()
          }
          if (id === 'clock') {
            await page.getByRole('button', { name: language === 'es' ? 'Nueva alarma' : 'New alarm', exact: true }).click()
            await capture(page, `${prefix}-alarm-editor`)
            await page.getByRole('dialog').locator('.editor-close').click()
            await page.locator('.utility-heading .text-action').click()
            await capture(page, `${prefix}-timer-editor`)
            await page.getByRole('dialog').locator('.editor-close').click()
          }
        }
        const scroller = page.locator('.tablet-content')
        const scrollable = await scroller.evaluate(el => el.scrollHeight > el.clientHeight + 2)
        if (scrollable && ['calendar', 'clock', 'settings', 'weather'].includes(id)) {
          await scroller.evaluate(el => el.scrollTop = el.scrollHeight)
          await capture(page, `${theme}-${language}-${size.name}-${id}-bottom`)
          await scroller.evaluate(el => el.scrollTop = 0)
        }
        if (id === 'dashboard' && !quick) {
          const before = await page.locator('[data-widget-id]').evaluateAll(els => els.map(el => ({ id: el.dataset.widgetId, r: el.getBoundingClientRect().toJSON() })))
          const area = await page.locator('[data-widget-id="clock"] .widget-label').boundingBox()
          await page.mouse.move(area.x + 8, area.y + 6)
          await page.mouse.down()
          await page.waitForTimeout(1000)
          await page.mouse.up()
          await page.getByRole('button', { name: language === 'es' ? 'Listo' : 'Done', exact: true }).waitFor()
          await capture(page, `${theme}-${language}-${size.name}-dashboard-edit`)
          const after = await page.locator('[data-widget-id]').evaluateAll(els => els.map(el => ({ id: el.dataset.widgetId, r: el.getBoundingClientRect().toJSON() })))
          for (const b of before) for (const key of ['x', 'y', 'width', 'height']) {
            const a = after.find(item => item.id === b.id)
            if (Math.abs(a.r[key] - b.r[key]) > 1) report.errors.push({ type: 'edit-geometry', language, size: size.name, widget: b.id, key, before: b.r[key], after: a.r[key] })
          }
          await page.getByRole('button', { name: language === 'es' ? 'Listo' : 'Done', exact: true }).click()
        }
      }
      if (process.env.PABLO_VISUAL_DETAILS === '1' && !compact) {
        const prefix = `${theme}-${language}-${size.name}`
        for (const [id, es, en] of [['digital-blocks', 'Digital en bloques', 'Block digital'], ['analog', 'Analógico con números', 'Analog with numbers'], ['analog-minimal', 'Analógico minimalista', 'Minimal analog']]) {
          await go('clock')
          await page.getByRole('radio', { name: language === 'es' ? es : en, exact: true }).click()
          await go('dashboard')
          await capture(page, `${prefix}-widget-${id}`)
          const fits = await page.locator('[data-widget-id="clock"] .clock-face').evaluate(el => {
            const r = el.getBoundingClientRect(), p = el.closest('.clock-card').getBoundingClientRect()
            return r.left >= p.left && r.right <= p.right + 1 && r.top >= p.top && r.bottom <= p.bottom + 1
          })
          if (!fits) report.errors.push({ label: prefix, type: 'clock-face-outside-widget', style: id })
        }
        await go('clock')
        await page.getByRole('tab', { name: language === 'es' ? 'Cronómetro' : 'Stopwatch', exact: true }).click()
        await capture(page, `${prefix}-stopwatch`)
        await go('calendar')
        await page.getByRole('button', { name: language === 'es' ? 'Nuevo' : 'New', exact: true }).click()
        await page.getByRole('dialog').waitFor()
        await capture(page, `${prefix}-calendar-dialog`)
        const done = page.getByRole('dialog').locator('.alarm-done')
        await done.scrollIntoViewIfNeeded()
        await capture(page, `${prefix}-calendar-dialog-footer`)
        await page.getByRole('dialog').getByRole('button', { name: language === 'es' ? 'Cerrar' : 'Close', exact: true }).click()
        await go('notes')
        await page.locator('.note-list-item').filter({ hasText: language === 'es' ? 'Dibujo guardado' : 'Saved drawing' }).click()
        await capture(page, `${prefix}-drawing`)
        const storedDrawing = await page.evaluate(() => JSON.parse(localStorage.getItem('pablo-tablet.dashboard.v17')).notes.find(note => note.id === 'drawing').drawing)
        await page.locator('.note-drawing-expand').click()
        await capture(page, `${prefix}-drawing-expanded`)
        await page.locator('.note-drawing-expand').click()
        const restoredDrawing = await page.evaluate(() => JSON.parse(localStorage.getItem('pablo-tablet.dashboard.v17')).notes.find(note => note.id === 'drawing').drawing)
        if (JSON.stringify(storedDrawing) !== JSON.stringify(restoredDrawing)) report.errors.push({ label: prefix, type: 'drawing-changed-by-expansion' })
        await go('gallery')
        const loaded = await page.locator('.gallery-thumbnail img').evaluateAll(images => images.every(img => img.complete && img.naturalWidth > 0))
        if (!loaded) report.errors.push({ label: prefix, type: 'gallery-image-not-loaded' })
        await page.getByRole('button', { name: `${language === 'es' ? 'Abrir' : 'Open'} Ejemplo 1`, exact: true }).click()
        await capture(page, `${prefix}-gallery-viewer`)
        await page.getByRole('button', { name: language === 'es' ? 'Cerrar foto' : 'Close photo', exact: true }).click()
        await go('assistant')
        await page.locator('.assistant-composer textarea').fill(language === 'es' ? '¿Qué tengo hoy?' : 'What do I have today?')
        await page.locator('.assistant-composer .assistant-send').click()
        await page.locator('.assistant-message.is-user').waitFor()
        await page.locator('.assistant-message.is-processing').waitFor({ state: 'detached' })
        await capture(page, `${prefix}-assistant-conversation`)
        await go('weather')
        await context.route('https://api.open-meteo.com/**', route => route.fulfill({ status: 503, json: { error: 'QA offline' } }))
        const offline = page.waitForResponse(response => response.url().includes('api.open-meteo.com') && response.status() === 503)
        await page.locator('.weather-page .weather-refresh').click()
        await offline
        await capture(page, `${prefix}-weather-error-with-cache`)
      }
      await context.close()
    }
  }
} catch (error) {
  report.errors.push({ type: 'runner', message: error.stack })
  console.error(error)
} finally {
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2))
  await browser.close()
  console.log(JSON.stringify({ captures: report.captures.length, errors: report.errors.length, output }))
  if (report.errors.length) process.exitCode = 1
}
