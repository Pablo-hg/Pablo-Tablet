import type { HTMLAttributes, ReactNode } from 'react'
import type { DashboardThemeId, PageNavigationPosition, PageNavigationStyle } from '../dashboardState'

interface AppShellProps extends Pick<HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onTouchStart' | 'onTouchEnd' | 'onTouchCancel' | 'onClickCapture' | 'onClick'> {
  themeId: DashboardThemeId
  nightModeActive: boolean
  pageNavigationStyle: PageNavigationStyle
  pageNavigationPosition: PageNavigationPosition
  showPageNavigationLabels: boolean
  children: ReactNode
}

export function AppShell({ themeId, nightModeActive, pageNavigationStyle, pageNavigationPosition, showPageNavigationLabels, children, ...eventHandlers }: AppShellProps) {
  return (
    <main
      className={`tablet-shell ${nightModeActive ? 'is-night-mode' : ''} page-nav-style-${pageNavigationStyle} page-nav-position-${pageNavigationPosition} ${showPageNavigationLabels ? 'page-nav-has-labels' : ''}`}
      data-theme={themeId}
      {...eventHandlers}
    >
      <div className="wallpaper" aria-hidden="true">
        <span className="orb orb-one" />
        <span className="orb orb-two" />
        <span className="grid-glow" />
      </div>
      {children}
    </main>
  )
}
