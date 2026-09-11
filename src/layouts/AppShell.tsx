import { Link, NavLink, Outlet } from 'react-router-dom'
import { agencyConfig } from '../data/mock/insurly'
import { useAppState } from '../state/useAppState'

export const AppShell = () => {
  const { application } = useAppState()

  const primaryNav = [
    { label: 'Website', to: '/' },
    { label: 'Customer Workspace', to: `/customer/applications/${application.id}/overview` },
    { label: 'Broker Portal', to: '/broker/dashboard' },
  ]

  return (
    <div className="app-shell" style={{ ['--brand' as string]: agencyConfig.primaryColor, ['--brand-tint' as string]: agencyConfig.primaryTint }}>
      <header className="topbar">
        <div>
          <Link className="brand" to="/">
            <span className="brand__mark">{agencyConfig.logoText.slice(0, 2)}</span>
            <span>
              <strong>{agencyConfig.name}</strong>
              <small>{agencyConfig.customDomain}</small>
            </span>
          </Link>
        </div>
        <nav className="topbar__nav" aria-label="Primary">
          {primaryNav.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-pill nav-pill--active' : 'nav-pill')}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="topbar__meta">
          <span>{application.customerName}</span>
          <strong>{application.completion}% complete</strong>
        </div>
      </header>
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}
