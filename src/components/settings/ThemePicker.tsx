import { Check } from 'lucide-react'
import { DASHBOARD_THEMES, type DashboardThemeId } from '../../dashboardState'

export function ThemePicker({ value, onChange }: { value: DashboardThemeId; onChange: (themeId: DashboardThemeId) => void }) {
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Tema visual">
      {DASHBOARD_THEMES.map((theme, index) => (
        <button
          key={theme.id}
          type="button"
          className={`btn theme-option ${value === theme.id ? 'is-selected' : ''}`}
          role="radio"
          aria-checked={value === theme.id}
          aria-label={`${index + 1}. ${theme.label}: ${theme.detail}`}
          onClick={() => onChange(theme.id)}
        >
          <span className="theme-option-preview" data-preview-theme={theme.id} aria-hidden="true">
            <span /><span /><span />
          </span>
          <span className="theme-option-copy"><strong>{index + 1}. {theme.label}</strong><small>{theme.detail}</small></span>
          <span className="theme-option-check" aria-hidden="true">{value === theme.id ? <Check size={14} /> : null}</span>
        </button>
      ))}
    </div>
  )
}
