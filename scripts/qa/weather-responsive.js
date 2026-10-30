/* eslint-disable no-unused-expressions -- Function expression loaded by playwright-cli --filename. */
async (page) => {
  const stress = await page.evaluate(() => localStorage.getItem('qa-weather-mode') === 'stress')
  const profiles = [[360,800],[390,844],[568,320],[640,360],[720,480],[800,480],[900,600],[1024,600],[1108,635],[1280,720],[1280,800],[1366,768],[1440,900],[1600,900],[1920,1080],[1920,1200],[2560,1600],[600,1024],[708,875],[800,1280],[1000,1600]]
  const configs = stress
    ? ['original','warm','amoled','retro','glass','nordic','swiss','mediterranean','monochrome','brutalist'].flatMap(theme => ['es','en'].map(language => ({style:'labels',position:'left',theme,language})))
    : ['dock','labels','segmented','minimal'].flatMap(style => ['bottom','top','left','right'].map(position => ({style,position})))
  const chunk = await page.evaluate(() => Number(localStorage.getItem('qa-weather-chunk') || 0))
  const dates = ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05']
  const times = Array.from({ length: 12 }, (_, i) => i < 4 ? `2026-10-30T${20 + i}:00` : `2026-10-31T${String(i - 4).padStart(2, '0')}:00`)
  const payload = {
    current: { time: '2026-10-30T20:00', temperature_2m: 17, apparent_temperature: 16, relative_humidity_2m: 52, precipitation: 0, weather_code: 1, wind_speed_10m: 3, is_day: 0 },
    hourly: { time: times, temperature_2m: [17, 15, 14, 13, 13, 13, 12, 12, 12, 11, 11, 12], precipitation_probability: times.map(() => 0), weather_code: times.map(() => 1), is_day: times.map(() => 0) },
    daily: { time: dates, temperature_2m_max: [23, 21, 20, 18, 17, 15, 16], temperature_2m_min: [12, 9, 9, 7, 8, 6, 6], precipitation_probability_max: [0, 0, 0, 0, 0, 5, 9], sunrise: dates.map(date => `${date}T07:41`), sunset: dates.map(date => `${date}T18:14`), weather_code: [3, 2, 1, 3, 3, 2, 3] },
  }
  await page.unroute('https://api.open-meteo.com/**')
  await page.route('https://api.open-meteo.com/**', route => route.fulfill({ json: payload }))
  await page.evaluate(() => {
    const key = 'pablo-tablet.dashboard.v17'
    const state = JSON.parse(localStorage.getItem(key) || '{}')
    state.weatherLocations = [{ id: 'pinto', name: 'Pinto', region: 'Madrid', country: 'España', latitude: 40.24, longitude: -3.7, timezone: 'Europe/Madrid' }]
    state.homeWeatherLocationId = 'pinto'
    state.selectedWeatherLocationId = 'pinto'
    state.preferences = { ...state.preferences, language: 'es', themeId: 'glass', screensaverEnabled: false, nightModeEnabled: false, interactionSoundsEnabled: false }
    localStorage.setItem(key, JSON.stringify(state))
  })
  if(stress) {
    payload.current.weather_code=99
    payload.current.temperature_2m=-17
    payload.current.apparent_temperature=-23
    payload.current.wind_speed_10m=123
    payload.current.relative_humidity_2m=100
    payload.hourly.precipitation_probability=times.map(()=>100)
    payload.daily.weather_code=dates.map(()=>99)
  }
  const reports = []
  let screenshots = 0
  for (const config of configs.slice(chunk * 4, chunk * 4 + 4)) {
    await page.evaluate(config => {
      const key = 'pablo-tablet.dashboard.v17'
      const state = JSON.parse(localStorage.getItem(key))
      Object.assign(state.preferences, { pageNavigationStyle:config.style, pageNavigationPosition:config.position, showPageNavigationLabels:true, themeId:config.theme || 'glass', language:config.language || 'es' })
      if(config.theme) {
        state.weatherLocations = Array.from({length:4},(_,i)=>({...state.weatherLocations[0],id:`pinto-${i}`,name:i===0?'Villanueva de la Cañada y localidades próximas':`Ubicación guardada ${i}`}))
        state.homeWeatherLocationId=state.weatherLocations[0].id
        state.selectedWeatherLocationId=state.weatherLocations[0].id
      }
      localStorage.setItem(key, JSON.stringify(state))
    }, config)
    await page.reload()
    await page.getByRole('button', {name:config.language==='en'?'Go to Weather':'Ir a Tiempo',exact:true}).click()
    await page.locator('.weather-hours-panel').waitFor()
    if(stress) await page.locator('.weather-current-icon .lucide-cloud-lightning').waitFor()
    await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important}'})
    for (const [width,height] of (stress ? [[360,800],[568,320],[1108,635],[1280,800],[800,1280],[1920,1200]] : profiles)) {
      await page.setViewportSize({width,height})
      for (const fontSize of [16,20,24]) {
        await page.evaluate(fontSize => { document.documentElement.style.fontSize = `${fontSize}px`; document.querySelector('.tablet-content').scrollTop=0 }, fontSize)
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
        const result = await page.evaluate(() => {
          const viewport = document.querySelector('.tablet-content')
          const grid = document.querySelector('.weather-layout')
          const panels = [...document.querySelectorAll('.weather-current-panel,.weather-hours-panel,.weather-forecast-panel')]
          const clipped = panels.filter(element => element.scrollWidth > element.clientWidth+2 ||
            (element.scrollHeight > element.clientHeight+2 && !['auto','scroll','visible'].includes(getComputedStyle(element).overflowY))).map(element=>({class:element.className,height:element.clientHeight,scrollHeight:element.scrollHeight,width:element.clientWidth,scrollWidth:element.scrollWidth}))
          const labelsTouch = [...document.querySelectorAll('.weather-stats > div > span')].some(element => {
            const range=document.createRange(); range.selectNode(element.firstChild)
            const label=range.getBoundingClientRect(),value=element.querySelector('strong').getBoundingClientRect()
            return value.top<label.bottom-1 && value.left<label.right+2
          })
          const lastDay=document.querySelector('.daily-forecast-row:last-child').getBoundingClientRect()
          const source=document.querySelector('.weather-source-note').getBoundingClientRect()
          return {documentOverflow:document.documentElement.scrollWidth>innerWidth+2,
            gridOverflow:grid.scrollWidth>grid.clientWidth+2,clipped,labelsTouch,sourceOverlap:lastDay.bottom>source.top+2,
            missingData:document.querySelectorAll('.daily-forecast-row').length!==7 || document.querySelectorAll('.hourly-forecast > div').length!==12,
            viewportScroll:viewport.scrollHeight>viewport.clientHeight+2}
        })
        await page.locator('.tablet-content').evaluate(element=>{element.scrollTop=element.scrollHeight})
        result.footerUnreachable=await page.locator('.weather-source-note').evaluate(element=>{
          const footer=element.getBoundingClientRect(),nav=document.querySelector('.page-indicators')?.getBoundingClientRect()
          return footer.bottom>innerHeight+2 || footer.top<0 || !!(nav && footer.left<nav.right && footer.right>nav.left && footer.top<nav.bottom && footer.bottom>nav.top)
        })
        const failed=result.documentOverflow||result.gridOverflow||result.clipped.length||result.labelsTouch||result.sourceOverlap||result.missingData||result.footerUnreachable
        if(failed&&screenshots++<5) await page.screenshot({path:`output/playwright/weather33-failure-${chunk}-${config.position}-${width}x${height}-font${fontSize}.png`})
        if(config.position==='bottom'&&fontSize===16&&[[1280,800],[800,1280],[1108,635],[390,844],[1920,1200]].some(size=>size[0]===width&&size[1]===height)) {
          await page.locator('.tablet-content').evaluate(element=>{element.scrollTop=0})
          await page.screenshot({path:`output/playwright/weather33-after-${config.style}-${width}x${height}.png`})
        }
        reports.push({config,width,height,fontSize,failed:!!failed,...result})
      }
    }
  }
  await page.evaluate(({chunk,reports,stress})=>localStorage.setItem(`qa-weather-report-${stress?'stress-':''}${chunk}`,JSON.stringify(reports)),{chunk,reports,stress})
  const failures=reports.filter(report=>report.failed)
  if(failures.length) throw new Error(JSON.stringify({chunk,total:reports.length,failed:failures.length,firstFailures:failures.slice(0,8)}))
  return {mode:stress?'stress':'normal',chunk,total:reports.length,failed:0}
}
