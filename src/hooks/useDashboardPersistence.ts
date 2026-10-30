import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { DASHBOARD_STORAGE_KEY, readAppStorageRecord, usesNativeAppStorage, writeAppStorage } from '../appStorage'
import { loadDashboardState, saveDashboardState, type DashboardState } from '../dashboardState'

interface DashboardPersistenceOptions {
  state: DashboardState
  stateRef: { current: DashboardState }
  setState: Dispatch<SetStateAction<DashboardState>>
}

export function useDashboardPersistence({ state, stateRef, setState }: DashboardPersistenceOptions) {
  const persistenceReady = useRef(!usesNativeAppStorage())
  const [ready, setReady] = useState(!usesNativeAppStorage())
  const lastStoredUpdatedAt = useRef<number | null>(null)
  const applyingRemoteState = useRef(false)

  useEffect(() => {
    if (!usesNativeAppStorage()) return
    let cancelled = false
    let reading = false
    const refreshStorage = async () => {
      if (reading) return
      reading = true
      try {
        const stored = await readAppStorageRecord(DASHBOARD_STORAGE_KEY)
        if (cancelled) return
        if (!persistenceReady.current) {
          const nextState = stored.value ? loadDashboardState(stored.value) : stateRef.current
          const updatedAt = stored.value
            ? stored.updatedAt
            : (await writeAppStorage(DASHBOARD_STORAGE_KEY, JSON.stringify(nextState))).updatedAt
          if (cancelled) return
          lastStoredUpdatedAt.current = updatedAt
          applyingRemoteState.current = Boolean(stored.value)
          persistenceReady.current = true
          stateRef.current = nextState
          setState(nextState)
          setReady(true)
          return
        }
        if (!stored.value || stored.updatedAt === null || stored.updatedAt === lastStoredUpdatedAt.current) return
        lastStoredUpdatedAt.current = stored.updatedAt
        if (JSON.stringify(stateRef.current) === stored.value) return
        const nextState = loadDashboardState(stored.value)
        applyingRemoteState.current = true
        stateRef.current = nextState
        setState(nextState)
      } catch (error) {
        console.warn('No se pudo recuperar o sincronizar el almacenamiento privado de Pablo Tablet.', error)
      } finally {
        reading = false
      }
    }
    void refreshStorage()
    const interval = window.setInterval(() => void refreshStorage(), 1_000)
    return () => { cancelled = true; window.clearInterval(interval) }
  }, [setState, stateRef])

  useEffect(() => {
    stateRef.current = state
    if (!persistenceReady.current) return
    if (applyingRemoteState.current) {
      applyingRemoteState.current = false
      return
    }
    if (usesNativeAppStorage()) {
      void writeAppStorage(DASHBOARD_STORAGE_KEY, JSON.stringify(state))
        .then(({ updatedAt }) => { lastStoredUpdatedAt.current = updatedAt })
        .catch((error) => console.warn('No se pudieron guardar los datos privados de Pablo Tablet.', error))
    } else {
      saveDashboardState(state)
    }
  }, [state, stateRef])

  return ready
}
