import type { HTMLAttributes, ReactNode } from 'react'
import type { DashboardThemeId } from '../dashboardState'

interface AppShellProps extends Pick<HTMLAttributes<HTMLElement>, 'onPointerDown' | 'onPointerUp' | 'onPointerCancel' | 'onTouchStart' | 'onTouchEnd' | 'onTouchCancel' | 'onClickCapture' | 'onClick'> {
  themeId: DashboardThemeId
  navigationVisible: boolean
  nightModeActive: boolean
  children: ReactNode
}

export function AppShell({ themeId, navigationVisible, nightModeActive, children, ...eventHandlers }: AppShellProps) {
  return (
    <main
      className={`tablet-shell ${navigationVisible ? 'has-navigation' : ''} ${nightModeActive ? 'is-night-mode' : ''}`}
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
