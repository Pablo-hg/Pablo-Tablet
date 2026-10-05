import { LockKeyhole } from 'lucide-react'

export function PageHeader({ pageLabel }: { pageLabel: string }) {
  return (
    <header className="dashboard-header compact-header">
      <div>
        <p className="eyebrow">Pablo Tablet</p>
        <p className="welcome">{pageLabel}</p>
      </div>
      <div className="badge status-pill" aria-label="Estado de la tablet">
        <LockKeyhole size={14} />
        <span>Modo hogar</span>
      </div>
    </header>
  )
}
