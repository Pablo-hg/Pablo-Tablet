import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWeatherForecast, searchWeatherLocations, weatherDescription, type WeatherLocation } from '../weather'

const madrid: WeatherLocation = {
  id: 'madrid',
  name: 'Madrid',
  region: 'Comunidad de Madrid',
  country: 'España',
  latitude: 40.4168,
  longitude: -3.7038,
  timezone: 'Europe/Madrid',
}

function response(payload: unknown, ok = true) {
  return { ok, json: async () => payload } as Response
}

describe('meteorología', () => {
  beforeEach(() => vi.unstubAllGlobals())

  it('busca ubicaciones y descarta resultados sin coordenadas válidas', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ results: [
      { id: 1, name: 'Madrid', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid', country: 'España', admin1: 'Comunidad de Madrid' },
      { id: 2, name: 'Inválida', latitude: Number.NaN, longitude: 0 },
    ] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(searchWeatherLocations('Madrid')).resolves.toEqual([{
      id: 'open-meteo-1',
      name: 'Madrid',
      region: 'Comunidad de Madrid',
      country: 'España',
      latitude: 40.4168,
      longitude: -3.7038,
      timezone: 'Europe/Madrid',
    }])
    expect(String(fetchMock.mock.calls[0][0])).toContain('language=es')
  })

  it('transforma la respuesta actual, horaria y diaria de Open-Meteo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({
      current: { time: '2026-10-04T10:00', temperature_2m: 21.4, apparent_temperature: 20.8, relative_humidity_2m: 55, precipitation: 0, weather_code: 2, wind_speed_10m: 9, is_day: 1 },
      hourly: {
        time: ['2026-10-04T09:00', '2026-10-04T10:00', '2026-10-04T11:00'],
        temperature_2m: [19, 21.4, 22],
        precipitation_probability: [0, 5, 10],
        weather_code: [1, 2, 3],
      },
      daily: {
        time: ['2026-10-04', '2026-10-05'],
        temperature_2m_max: [24, 23],
        temperature_2m_min: [14, 13],
        precipitation_probability_max: [10, 20],
        sunrise: ['2026-10-04T08:10', '2026-10-05T08:11'],
        sunset: ['2026-10-04T19:50', '2026-10-05T19:48'],
        weather_code: [2, 3],
      },
    })))

    const forecast = await fetchWeatherForecast(madrid)

    expect(forecast.locationId).toBe('madrid')
    expect(forecast.current).toMatchObject({ temperature: 21.4, apparentTemperature: 20.8, humidity: 55, weatherCode: 2, isDay: true })
    expect(forecast.hourly.map((hour) => hour.time)).toEqual(['2026-10-04T10:00', '2026-10-04T11:00'])
    expect(forecast.daily).toHaveLength(2)
    expect(weatherDescription(forecast.current.weatherCode)).toBe('Parcialmente nublado')
  })

  it('informa de respuestas fallidas o incompletas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, false)))
    await expect(fetchWeatherForecast(madrid)).rejects.toThrow('No se pudo actualizar la previsión.')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ current: {}, hourly: {}, daily: {} })))
    await expect(fetchWeatherForecast(madrid)).rejects.toThrow('La previsión recibida está incompleta.')
  })
})
