import type { PointerEvent as ReactPointerEvent } from 'react'
import { CalendarDays, Clock3, CloudSun, FileText, Home, Images, Settings, Sparkles } from 'lucide-react'
import type { DashboardPageDefinition, PageNavigationPosition, PageNavigationStyle } from '../dashboardState'

export type AppScreen = 'home' | 'settings'

interface AppNavigationProps {
  screen: AppScreen
  enabledPages: DashboardPageDefinition[]
  activePageIndex: number
  pageNavigationStyle: PageNavigationStyle
  pageNavigationPosition: PageNavigationPosition
  showPageNavigationLabels: boolean
  onMoveToPage: (index: number) => void
  onGoSettings: () => void
}

function stopPointerPropagation(event: ReactPointerEvent<HTMLElement>) {
  event.stopPropagation()
}

const PAGE_ICONS = {
  dashboard: Home,
  assistant: Sparkles,
  calendar: CalendarDays,
  clock: Clock3,
  weather: CloudSun,
  notes: FileText,
  gallery: Images,
}

export function AppNavigation({ screen, enabledPages, activePageIndex, pageNavigationStyle, pageNavigationPosition, showPageNavigationLabels, onMoveToPage, onGoSettings }: AppNavigationProps) {
  return (
    <nav className={`page-indicators page-indicators--${pageNavigationStyle} is-position-${pageNavigationPosition} ${showPageNavigationLabels ? 'show-labels' : 'hide-labels'}`} aria-label="Páginas del dashboard">
      {enabledPages.map((page, index) => {
        const PageIcon = PAGE_ICONS[page.id]
        const isActive = screen === 'home' && index === activePageIndex
        return <button
          key={page.id}
          type="button"
          className={isActive ? 'is-active' : ''}
          aria-label={`Ir a ${page.label}`}
          aria-current={isActive ? 'page' : undefined}
          onPointerDown={stopPointerPropagation}
          onClick={() => onMoveToPage(index)}
        ><PageIcon size={17} strokeWidth={2.25} aria-hidden="true" /><span>{page.label}</span></button>
      })}
      <button
        className={screen === 'settings' ? 'is-active page-settings-button' : 'page-settings-button'}
        type="button"
        aria-label="Ir a Ajustes"
        aria-current={screen === 'settings' ? 'page' : undefined}
        onPointerDown={stopPointerPropagation}
        onClick={onGoSettings}
      >
        <Settings size={17} strokeWidth={2.25} aria-hidden="true" />
        <span>Ajustes</span>
      </button>
    </nav>
  )
}
