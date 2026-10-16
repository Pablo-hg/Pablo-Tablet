export function PageHeader({ pageLabel }: { pageLabel: string }) {
  return (
    <header className="dashboard-header compact-header">
      <div>
        <p className="eyebrow">Pablo Tablet</p>
        <p className="welcome">{pageLabel}</p>
      </div>
    </header>
  )
}
