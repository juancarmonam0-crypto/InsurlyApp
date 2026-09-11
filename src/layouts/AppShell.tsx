import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { agencyConfig } from '../data/mock/insurly'
import { useAppState } from '../state/useAppState'

export const AppShell = () => {
  const { application } = useAppState()
  const location = useLocation()

  const isBrokerRoute = location.pathname.startsWith('/broker')

  const brokerNav = [
    { label: 'Website', to: '/' },
    { label: 'Customer Workspace', to: `/customer/applications/${application.id}/documents` },
    { label: 'Broker Portal', to: '/broker/dashboard' },
  ]

  const customerNav = [
    { label: 'Choose insurance', to: '/' },
    { label: 'Documents', to: `/customer/applications/${application.id}/documents` },
    { label: 'Smart questions', to: `/customer/applications/${application.id}/wizard` },
    { label: 'Review', to: `/customer/applications/${application.id}/review` },
  ]

  const primaryNav = isBrokerRoute ? brokerNav : customerNav

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
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? 'nav-pill nav-pill--active' : 'nav-pill')} end={item.to === '/'}>
              {item.label}
            </NavLink>
          ))}
          {!isBrokerRoute ? (
            <span className={application.customerConfirmed ? 'nav-pill nav-pill--active' : 'nav-pill'}>
              Done
            </span>
          ) : null}
        </nav>
        <div className="topbar__meta">
          {isBrokerRoute ? (
            <>
              <span>{application.customerName}</span>
              <strong>{application.completion}% complete</strong>
            </>
          ) : (
            <>
              <span>Need help?</span>
              <strong>{agencyConfig.contactEmail}</strong>
            </>
          )}
        </div>
      </header>
      <main className="page-shell">
        <Outlet />
      </main>
    </div>
  )
}
