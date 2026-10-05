import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import { DASHBOARD_STORAGE_KEY, readAppStorageRecord, usesNativeAppStorage, writeAppStorage } from '../appStorage'
import { loadDashboardState, saveDashboardState, type DashboardState } from '../dashboardState'

interface DashboardPersistenceOptions {
  state: DashboardState
  stateRef: { current: DashboardState }
  setState: Dispatch<SetStateAction<DashboardState>>
}

export function useDashboardPersistence({ state, stateRef, setState }: DashboardPersistenceOptions) {
  const persistenceReady = useRef(!usesNativeAppStorage())
  const lastStoredUpdatedAt = useRef<number | null>(null)
  const applyingRemoteState = useRef(false)

  useEffect(() => {
    if (!usesNativeAppStorage()) return

    let cancelled = false
    const hydrateState = async () => {
      try {
        const stored = await readAppStorageRecord(DASHBOARD_STORAGE_KEY)
        const nextState = stored.value ? loadDashboardState(stored.value) : stateRef.current
        if (!stored.value) {
          const written = await writeAppStorage(DASHBOARD_STORAGE_KEY, JSON.stringify(nextState))
          lastStoredUpdatedAt.current = written.updatedAt
        } else {
          lastStoredUpdatedAt.current = stored.updatedAt
        }
        if (!cancelled) {
          persistenceReady.current = true
          stateRef.current = nextState
          setState(nextState)
        }
      } catch (error) {
        console.warn('No se pudo abrir el almacenamiento privado de Pablo Tablet.', error)
      } finally {
        if (!cancelled) persistenceReady.current = true
      }
    }
    void hydrateState()
    return () => { cancelled = true }
  }, [setState, stateRef])

  useEffect(() => {
    if (!usesNativeAppStorage()) return
    let cancelled = false
    const refreshFromMobile = async () => {
      try {
        const stored = await readAppStorageRecord(DASHBOARD_STORAGE_KEY)
        if (cancelled || !stored.value || stored.updatedAt === null || stored.updatedAt === lastStoredUpdatedAt.current) return
        lastStoredUpdatedAt.current = stored.updatedAt
        if (JSON.stringify(stateRef.current) === stored.value) return
        const nextState = loadDashboardState(stored.value)
        applyingRemoteState.current = true
        stateRef.current = nextState
        setState(nextState)
      } catch (error) {
        console.warn('No se pudo sincronizar un cambio recibido desde el móvil.', error)
      }
    }
    const interval = window.setInterval(() => void refreshFromMobile(), 1_000)
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
}
