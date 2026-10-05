import { useCallback, useEffect, useState } from 'react'
import { usesNativeAppStorage } from '../appStorage'
import { fetchWeatherForecast, hydrateCachedWeatherForecasts, loadCachedWeatherForecasts, type WeatherForecast, type WeatherLocation } from '../weather'

export function useWeatherForecasts(homeLocation: WeatherLocation | null, selectedLocation: WeatherLocation | null) {
  const [forecasts, setForecasts] = useState<Record<string, WeatherForecast>>(loadCachedWeatherForecasts)
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const refresh = useCallback(async (location: WeatherLocation, signal?: AbortSignal) => {
    setLoading((current) => ({ ...current, [location.id]: true }))
    setErrors((current) => ({ ...current, [location.id]: '' }))
    try {
      const forecast = await fetchWeatherForecast(location, signal)
      setForecasts((current) => ({ ...current, [location.id]: forecast }))
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setErrors((current) => ({ ...current, [location.id]: error instanceof Error ? error.message : 'No se pudo actualizar la previsión.' }))
    } finally {
      if (!signal?.aborted) setLoading((current) => ({ ...current, [location.id]: false }))
    }
  }, [])

  useEffect(() => {
    if (!usesNativeAppStorage()) return
    let cancelled = false
    void hydrateCachedWeatherForecasts().then((cached) => {
      if (!cancelled) setForecasts((current) => ({ ...cached, ...current }))
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const locations = [homeLocation, selectedLocation]
      .filter((location): location is WeatherLocation => Boolean(location))
      .filter((location, index, all) => all.findIndex((candidate) => candidate.id === location.id) === index)
    if (locations.length === 0) return
    const controller = new AbortController()
    const update = () => locations.forEach((location) => void refresh(location, controller.signal))
    update()
    const interval = window.setInterval(update, 30 * 60 * 1_000)
    return () => {
      controller.abort()
      window.clearInterval(interval)
    }
  }, [homeLocation, selectedLocation, refresh])

  return { forecasts, loading, errors, refresh }
}
