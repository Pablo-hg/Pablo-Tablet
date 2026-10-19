import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
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
  const navigationRef = useRef<HTMLElement>(null)
  const previousIndexRef = useRef(screen === 'settings' ? enabledPages.length : activePageIndex)
  const transitionTimerRef = useRef<number | null>(null)
  const [indicatorStyle, setIndicatorStyle] = useState<CSSProperties | undefined>()
  const [adjacentTransition, setAdjacentTransition] = useState(false)
  const currentIndex = screen === 'settings' ? enabledPages.length : activePageIndex

  useLayoutEffect(() => {
    const navigation = navigationRef.current
    const activeButton = navigation?.querySelector<HTMLButtonElement>(`button[data-navigation-index="${currentIndex}"]`)
    if (!navigation || !activeButton) return
    const navigationRect = navigation.getBoundingClientRect()
    const buttonRect = activeButton.getBoundingClientRect()
    const vertical = pageNavigationPosition === 'left' || pageNavigationPosition === 'right'
    const minimal = pageNavigationStyle === 'minimal'
    const nextStyle: CSSProperties = minimal
      ? vertical
        ? {
            left: pageNavigationPosition === 'left' ? buttonRect.right - navigationRect.left - 4 : buttonRect.left - navigationRect.left + 1,
            top: buttonRect.top - navigationRect.top + (buttonRect.height - 24) / 2,
            width: 3,
            height: 24,
          }
        : {
            left: buttonRect.left - navigationRect.left + (buttonRect.width - 24) / 2,
            top: pageNavigationPosition === 'top' ? buttonRect.top - navigationRect.top - 4 : buttonRect.bottom - navigationRect.top + 1,
            width: 24,
            height: 3,
          }
      : {
          left: buttonRect.left - navigationRect.left,
          top: buttonRect.top - navigationRect.top,
          width: buttonRect.width,
          height: buttonRect.height,
        }
    const isAdjacent = Math.abs(currentIndex - previousIndexRef.current) === 1
    setAdjacentTransition(isAdjacent)
    setIndicatorStyle(nextStyle)
    previousIndexRef.current = currentIndex
    if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
    transitionTimerRef.current = window.setTimeout(() => setAdjacentTransition(false), 360)

    const updateWithoutAnimation = () => {
      const nextNavigationRect = navigation.getBoundingClientRect()
      const nextButtonRect = activeButton.getBoundingClientRect()
      setAdjacentTransition(false)
      setIndicatorStyle(minimal
        ? vertical
          ? { left: pageNavigationPosition === 'left' ? nextButtonRect.right - nextNavigationRect.left - 4 : nextButtonRect.left - nextNavigationRect.left + 1, top: nextButtonRect.top - nextNavigationRect.top + (nextButtonRect.height - 24) / 2, width: 3, height: 24 }
          : { left: nextButtonRect.left - nextNavigationRect.left + (nextButtonRect.width - 24) / 2, top: pageNavigationPosition === 'top' ? nextButtonRect.top - nextNavigationRect.top - 4 : nextButtonRect.bottom - nextNavigationRect.top + 1, width: 24, height: 3 }
        : { left: nextButtonRect.left - nextNavigationRect.left, top: nextButtonRect.top - nextNavigationRect.top, width: nextButtonRect.width, height: nextButtonRect.height })
    }
    window.addEventListener('resize', updateWithoutAnimation)
    return () => {
      window.removeEventListener('resize', updateWithoutAnimation)
      if (transitionTimerRef.current !== null) window.clearTimeout(transitionTimerRef.current)
    }
  }, [currentIndex, enabledPages.length, pageNavigationPosition, pageNavigationStyle, showPageNavigationLabels])

  return (
    <nav ref={navigationRef} className={`page-indicators page-indicators--${pageNavigationStyle} is-position-${pageNavigationPosition} has-page-indicator ${adjacentTransition ? 'is-adjacent-transition' : 'is-direct-transition'} ${showPageNavigationLabels ? 'show-labels' : 'hide-labels'}`} aria-label="Páginas del dashboard">
      <i className="page-indicator-glider" style={indicatorStyle} aria-hidden="true" />
      {enabledPages.map((page, index) => {
        const PageIcon = PAGE_ICONS[page.id]
        const isActive = screen === 'home' && index === activePageIndex
        return <button
          key={page.id}
          data-navigation-index={index}
          type="button"
          className={isActive ? 'is-active' : ''}
          aria-label={`Ir a ${page.label}`}
          aria-current={isActive ? 'page' : undefined}
          onPointerDown={stopPointerPropagation}
          onClick={() => onMoveToPage(index)}
        ><PageIcon size={17} strokeWidth={2.25} aria-hidden="true" /><span>{page.label}</span></button>
      })}
      <button
        data-navigation-index={enabledPages.length}
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
