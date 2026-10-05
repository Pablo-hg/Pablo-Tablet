import type { PointerEvent as ReactPointerEvent } from 'react'
import { Home, Menu, Settings, X } from 'lucide-react'
import type { DashboardPageDefinition } from '../dashboardState'

export type AppScreen = 'home' | 'settings'

interface AppNavigationProps {
  screen: AppScreen
  enabledPages: DashboardPageDefinition[]
  activePageIndex: number
  navigationVisible: boolean
  onMoveToPage: (index: number) => void
  onToggleNavigation: () => void
  onGoHome: () => void
  onGoSettings: () => void
}

function stopPointerPropagation(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation()
}

export function AppNavigation({ screen, enabledPages, activePageIndex, navigationVisible, onMoveToPage, onToggleNavigation, onGoHome, onGoSettings }: AppNavigationProps) {
  return (
    <>
      {screen === 'home' && enabledPages.length > 1 ? (
        <nav className="page-indicators" aria-label="Páginas del dashboard">
          {enabledPages.map((page, index) => (
            <button
              key={page.id}
              type="button"
              className={`${index === activePageIndex ? 'is-active' : ''} ${page.id === 'dashboard' ? 'is-home' : ''}`}
              aria-label={`Ir a ${page.label}`}
              aria-current={index === activePageIndex ? 'page' : undefined}
              onPointerDown={stopPointerPropagation}
              onClick={() => onMoveToPage(index)}
            >{page.id === 'dashboard' ? <Home size={12} strokeWidth={2.5} /> : null}</button>
          ))}
        </nav>
      ) : null}

      <button className="navigation-reveal" type="button" onPointerDown={stopPointerPropagation} onClick={onToggleNavigation} aria-label={navigationVisible ? 'Ocultar navegación' : 'Mostrar navegación'}>
        {navigationVisible ? <X size={20} /> : <Menu size={20} />}
      </button>

      <nav className={`bottom-navigation ${navigationVisible ? 'is-visible' : ''}`} aria-label="Navegación principal">
        <button type="button" className={screen === 'home' ? 'is-active' : ''} onPointerDown={stopPointerPropagation} onClick={onGoHome}>
          <Home size={21} strokeWidth={2.25} />
          <span>Inicio</span>
        </button>
        <button type="button" className={screen === 'settings' ? 'is-active' : ''} onPointerDown={stopPointerPropagation} onClick={onGoSettings}>
          <Settings size={21} strokeWidth={2.25} />
          <span>Ajustes</span>
        </button>
      </nav>
    </>
  )
}
