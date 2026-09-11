import { NavLink, Outlet } from 'react-router-dom'
import { ProgressBar } from '../../components/ProgressBar'
import { StatusBadge } from '../../components/StatusBadge'
import { useAppState } from '../../state/useAppState'

const sections = [
  { label: 'Overview', to: '/customer/applications/nexo/overview' },
  { label: 'Business Information', to: '/customer/applications/nexo/business-information' },
  { label: 'People', to: '/customer/applications/nexo/people' },
  { label: 'Locations', to: '/customer/applications/nexo/locations' },
  { label: 'Vehicles/Equipment', to: '/customer/applications/nexo/vehicles-equipment' },
  { label: 'Current Insurance', to: '/customer/applications/nexo/current-insurance' },
  { label: 'Loss History', to: '/customer/applications/nexo/loss-history' },
  { label: 'Documents', to: '/customer/applications/nexo/documents' },
  { label: 'Review', to: '/customer/applications/nexo/review' },
]

export const CustomerLayout = () => {
  const { application } = useAppState()

  return (
    <div className="workspace-grid">
      <aside className="sidebar">
        <p className="eyebrow">Customer application</p>
        <h1>{application.customerName}</h1>
        <div className="cluster">
          <StatusBadge status={application.status} />
          <span className="muted">{application.lineOfBusiness}</span>
        </div>
        <div className="stack-sm">
          <div className="split"><span>Completion</span><strong>{application.completion}%</strong></div>
          <ProgressBar value={application.completion} />
        </div>
        <nav className="sidebar__nav" aria-label="Customer sections">
          {sections.map((section) => (
            <NavLink key={section.to} className={({ isActive }) => (isActive ? 'sidebar__link sidebar__link--active' : 'sidebar__link')} to={section.to}>
              {section.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar__note">
          <strong>Three channels → one canonical profile</strong>
          <p>Chat, documents, and the wizard all write to the same customer record with provenance.</p>
        </div>
      </aside>
      <section className="content-panel">
        <Outlet />
      </section>
    </div>
  )
}
