import { readAppStorage, usesNativeAppStorage, WEATHER_STORAGE_KEY, writeAppStorage } from './appStorage'

export interface WeatherLocation {
  id: string
  name: string
  region: string
  country: string
  latitude: number
  longitude: number
  timezone: string
}

export interface WeatherHour {
  time: string
  temperature: number
  precipitationProbability: number
  weatherCode: number
}

export interface WeatherDay {
  date: string
  temperatureMax: number
  temperatureMin: number
  precipitationProbability: number
  sunrise: string
  sunset: string
  weatherCode: number
}

export interface WeatherForecast {
  locationId: string
  fetchedAt: string
  current: {
    time: string
    temperature: number
    apparentTemperature: number
    humidity: number
    precipitation: number
    windSpeed: number
    weatherCode: number
    isDay: boolean
  }
  hourly: WeatherHour[]
  daily: WeatherDay[]
}

interface OpenMeteoSearchResponse {
  results?: Array<{
    id: number
    name: string
    latitude: number
    longitude: number
    timezone?: string
    country?: string
    admin1?: string
  }>
}

interface OpenMeteoForecastResponse {
  current?: {
    time?: string
    temperature_2m?: number
    apparent_temperature?: number
    relative_humidity_2m?: number
    precipitation?: number
    weather_code?: number
    wind_speed_10m?: number
    is_day?: number
  }
  hourly?: {
    time?: string[]
    temperature_2m?: number[]
    precipitation_probability?: number[]
    weather_code?: number[]
  }
  daily?: {
    time?: string[]
    temperature_2m_max?: number[]
    temperature_2m_min?: number[]
    precipitation_probability_max?: number[]
    sunrise?: string[]
    sunset?: string[]
    weather_code?: number[]
  }
}

function finiteNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export async function searchWeatherLocations(query: string, signal?: AbortSignal): Promise<WeatherLocation[]> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) return []

  const url = new URL('https://geocoding-api.open-meteo.com/v1/search')
  url.searchParams.set('name', normalizedQuery)
  url.searchParams.set('count', '8')
  url.searchParams.set('language', 'es')
  url.searchParams.set('format', 'json')
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('No se pudo buscar la ubicación.')
  const payload = await response.json() as OpenMeteoSearchResponse

  return (payload.results ?? []).flatMap((result): WeatherLocation[] => {
    if (!Number.isFinite(result.latitude) || !Number.isFinite(result.longitude) || !result.name) return []
    return [{
      id: `open-meteo-${result.id}`,
      name: result.name,
      region: result.admin1 ?? '',
      country: result.country ?? '',
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone ?? 'auto',
    }]
  })
}

export async function fetchWeatherForecast(location: WeatherLocation, signal?: AbortSignal): Promise<WeatherForecast> {
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(location.latitude))
  url.searchParams.set('longitude', String(location.longitude))
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,is_day')
  url.searchParams.set('hourly', 'temperature_2m,precipitation_probability,weather_code')
  url.searchParams.set('daily', 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset')
  url.searchParams.set('timezone', location.timezone || 'auto')
  url.searchParams.set('forecast_days', '7')

  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('No se pudo actualizar la previsión.')
  const payload = await response.json() as OpenMeteoForecastResponse
  if (!payload.current?.time || !payload.hourly?.time?.length || !payload.daily?.time?.length) {
    throw new Error('La previsión recibida está incompleta.')
  }

  const hourly = payload.hourly.time.map((time, index) => ({
    time,
    temperature: finiteNumber(payload.hourly?.temperature_2m?.[index]),
    precipitationProbability: finiteNumber(payload.hourly?.precipitation_probability?.[index]),
    weatherCode: finiteNumber(payload.hourly?.weather_code?.[index]),
  }))
  const firstUpcomingHour = Math.max(0, hourly.findIndex((hour) => hour.time >= payload.current!.time!))

  const forecast: WeatherForecast = {
    locationId: location.id,
    fetchedAt: new Date().toISOString(),
    current: {
      time: payload.current.time,
      temperature: finiteNumber(payload.current.temperature_2m),
      apparentTemperature: finiteNumber(payload.current.apparent_temperature),
      humidity: finiteNumber(payload.current.relative_humidity_2m),
      precipitation: finiteNumber(payload.current.precipitation),
      windSpeed: finiteNumber(payload.current.wind_speed_10m),
      weatherCode: finiteNumber(payload.current.weather_code),
      isDay: payload.current.is_day !== 0,
    },
    hourly: hourly.slice(firstUpcomingHour, firstUpcomingHour + 12),
    daily: payload.daily.time.map((date, index) => ({
      date,
      temperatureMax: finiteNumber(payload.daily?.temperature_2m_max?.[index]),
      temperatureMin: finiteNumber(payload.daily?.temperature_2m_min?.[index]),
      precipitationProbability: finiteNumber(payload.daily?.precipitation_probability_max?.[index]),
      sunrise: payload.daily?.sunrise?.[index] ?? '',
      sunset: payload.daily?.sunset?.[index] ?? '',
      weatherCode: finiteNumber(payload.daily?.weather_code?.[index]),
    })),
  }

  void saveCachedWeatherForecast(forecast)
  return forecast
}

export function loadCachedWeatherForecasts(): Record<string, WeatherForecast> {
  try {
    const raw = window.localStorage.getItem(WEATHER_STORAGE_KEY)
    if (!raw) return {}
    return parseCachedWeatherForecasts(raw)
  } catch {
    return {}
  }
}

export async function hydrateCachedWeatherForecasts(): Promise<Record<string, WeatherForecast>> {
  if (!usesNativeAppStorage()) return loadCachedWeatherForecasts()
  try {
    const stored = await readAppStorage(WEATHER_STORAGE_KEY)
    if (stored) return parseCachedWeatherForecasts(stored)
    const legacyCache = loadCachedWeatherForecasts()
    if (Object.keys(legacyCache).length > 0) {
      await writeAppStorage(WEATHER_STORAGE_KEY, JSON.stringify(legacyCache))
    }
    return legacyCache
  } catch {
    return loadCachedWeatherForecasts()
  }
}

function parseCachedWeatherForecasts(raw: string): Record<string, WeatherForecast> {
  const parsed = JSON.parse(raw) as Record<string, WeatherForecast>
  return parsed && typeof parsed === 'object' ? parsed : {}
}

async function saveCachedWeatherForecast(forecast: WeatherForecast) {
  try {
    const stored = await readAppStorage(WEATHER_STORAGE_KEY)
    const cached = stored ? parseCachedWeatherForecasts(stored) : loadCachedWeatherForecasts()
    cached[forecast.locationId] = forecast
    await writeAppStorage(WEATHER_STORAGE_KEY, JSON.stringify(cached))
  } catch {
    // El tiempo sigue funcionando aunque el almacenamiento esté lleno o deshabilitado.
  }
}

export function weatherDescription(code: number) {
  if (code === 0) return 'Despejado'
  if (code === 1) return 'Mayormente despejado'
  if (code === 2) return 'Parcialmente nublado'
  if (code === 3) return 'Nublado'
  if (code === 45 || code === 48) return 'Niebla'
  if (code >= 51 && code <= 57) return 'Llovizna'
  if (code >= 61 && code <= 67) return 'Lluvia'
  if (code >= 71 && code <= 77) return 'Nieve'
  if (code >= 80 && code <= 82) return 'Chubascos'
  if (code >= 85 && code <= 86) return 'Chubascos de nieve'
  if (code >= 95) return 'Tormenta'
  return 'Tiempo variable'
}
