import { tx } from '../i18n'
import type { TranslationKey } from '../i18n/translations'

export function PageHeader({ pageLabel }: { pageLabel: string }) {
  return (
    <header className="dashboard-header compact-header">
      <div>
        <p className="eyebrow">Pablo Tablet</p>
        <p className="welcome">{tx(pageLabel as TranslationKey)}</p>
      </div>
    </header>
  )
}
