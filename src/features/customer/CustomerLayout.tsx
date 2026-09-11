import { Link, NavLink, Outlet } from 'react-router-dom'
import { ProgressBar } from '../../components/ProgressBar'
import { StatusBadge } from '../../components/StatusBadge'
import { useAppState } from '../../state/useAppState'

export const CustomerLayout = () => {
  const { application } = useAppState()

  const sections = [
    { label: 'Documents', to: `/customer/applications/${application.id}/documents` },
    { label: 'Smart Questions', to: `/customer/applications/${application.id}/wizard` },
    { label: 'Review', to: `/customer/applications/${application.id}/review` },
  ]

  return (
    <div className="workspace-grid">
      <aside className="sidebar">
        <p className="eyebrow">Your application</p>
        <h1>{application.customerName}</h1>
        <p className="muted">Complete the steps below and we will prepare your application for review.</p>
        <div className="cluster">
          <StatusBadge status={application.status} />
          <span className="muted">{application.lineOfBusiness}</span>
        </div>
        <div className="stack-sm">
          <div className="split"><span>Progress</span><strong>{application.completion}%</strong></div>
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
          <strong>{application.customerConfirmed ? 'Done' : 'Optional documents'}</strong>
          <p>
            {application.customerConfirmed
              ? 'Your application has been received and is ready for review.'
              : 'You can upload helpful documents first or skip ahead to answer questions.'}
          </p>
        </div>
        <Link className="button button--secondary" to="/">
          Back to insurance choices
        </Link>
      </aside>
      <section className="content-panel">
        <Outlet />
      </section>
    </div>
  )
}
