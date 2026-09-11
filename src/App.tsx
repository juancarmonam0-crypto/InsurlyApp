import { BrowserRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import './App.css'
import { AppShell } from './layouts/AppShell'
import { CustomerLayout } from './features/customer/CustomerLayout'
import { BrokerApplicationPage, BrokerDashboardPage, BrokerFormsPage } from './features/broker/BrokerPages'
import { BrokerCustomerProfilePage } from './features/broker/BrokerCustomerProfilePage'
import {
  CustomerOverviewPage,
  CustomerReviewPage,
  DocumentIntakePage,
  SmartWizardPage,
} from './features/customer/CustomerPages'
import { SurfaceCard } from './components/SurfaceCard'
import { StatusBadge } from './components/StatusBadge'
import { AppStateProvider } from './state/AppState'
import { useAppState } from './state/useAppState'

const LandingPage = () => {
  const { resetDemo } = useAppState()

  return (
    <div className="stack-xl">
      <section className="landing-hero">
        <div className="stack-lg">
          <p className="eyebrow">White-label AI-first insurance broker platform</p>
          <h1>Insurance for what matters.</h1>
          <p className="lede">Insurly unifies chat intake, document extraction, and smart forms into one canonical customer profile so nobody has to enter the same information twice.</p>
          <div className="button-row">
            <Link className="button" to="/start">Start Your Application</Link>
            <button className="button button--secondary" type="button" onClick={resetDemo}>Reset demo</button>
          </div>
        </div>
        <SurfaceCard title="Three channels → One canonical profile" eyebrow="How Insurly works">
          <div className="channel-diagram">
            <span>ChatGPT</span>
            <span>Document Upload</span>
            <span>Smart Wizard</span>
            <strong>Canonical customer profile</strong>
          </div>
        </SurfaceCard>
      </section>
      <section className="surface-card">
        <div className="surface-card__header">
          <div>
            <p className="eyebrow">Application states</p>
            <h3>Supported workflow lifecycle</h3>
          </div>
        </div>
        <div className="pill-row">
          {['draft', 'collecting_information', 'customer_review', 'broker_review', 'ready_to_submit', 'submitted', 'quoted', 'bound', 'declined', 'closed'].map((state) => (
            <StatusBadge key={state} status={state as never} />
          ))}
        </div>
      </section>
      <section className="grid categories-grid">
        {['Auto', 'Home', 'Business', 'Life', 'Health', 'More'].map((category) => (
          <SurfaceCard key={category} title={category}>
            <p className="muted">Fictional demo coverage workflow for {category.toLowerCase()} programs.</p>
          </SurfaceCard>
        ))}
      </section>
    </div>
  )
}

const StartApplicationPage = () => (
  <div className="stack-lg">
    <div className="page-header">
      <div>
        <p className="eyebrow">Start your application</p>
        <h1>Choose the channel that matches the customer</h1>
        <p className="lede">All three experiences feed the same normalized profile, missing-info engine, and broker workflow.</p>
      </div>
    </div>
    <div className="grid three-up">
      <SurfaceCard title="Continue with ChatGPT" eyebrow="Placeholder experience">
        <p className="muted">Conversational intake will plug into future LLM services behind a stable service interface.</p>
        <Link className="button button--secondary" to="/customer/applications/nexo/overview">Open workspace</Link>
      </SurfaceCard>
      <SurfaceCard title="Upload Documents" eyebrow="Fastest path for renewals">
        <p className="muted">Current policy, prior ACORDs, loss runs, business docs, and schedules feed document extraction services later.</p>
        <Link className="button" to="/customer/applications/nexo/documents">Upload CurrentPolicy.pdf</Link>
      </SurfaceCard>
      <SurfaceCard title="Step-by-Step Assistant" eyebrow="Smart Wizard">
        <p className="muted">DB-driven question metadata supports conditional logic, save/resume, and field skipping.</p>
        <Link className="button button--secondary" to="/customer/applications/nexo/wizard">Start wizard</Link>
      </SurfaceCard>
    </div>
  </div>
)

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/start" element={<StartApplicationPage />} />
        <Route path="/customer/applications/nexo" element={<CustomerLayout />}>
          <Route path="overview" element={<CustomerOverviewPage />} />
          <Route path="business-information" element={<CustomerOverviewPage />} />
          <Route path="people" element={<CustomerOverviewPage />} />
          <Route path="locations" element={<CustomerOverviewPage />} />
          <Route path="vehicles-equipment" element={<CustomerOverviewPage />} />
          <Route path="current-insurance" element={<CustomerOverviewPage />} />
          <Route path="loss-history" element={<CustomerOverviewPage />} />
          <Route path="documents" element={<DocumentIntakePage />} />
          <Route path="wizard" element={<SmartWizardPage />} />
          <Route path="review" element={<CustomerReviewPage />} />
        </Route>
        <Route path="/broker/dashboard" element={<BrokerDashboardPage />} />
        <Route path="/broker/customers/nexo" element={<BrokerCustomerProfilePage />} />
        <Route path="/broker/applications/nexo" element={<BrokerApplicationPage />} />
        <Route path="/broker/applications/nexo/forms" element={<BrokerFormsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  </BrowserRouter>
)

function App() {
  return (
    <AppStateProvider>
      <AppRoutes />
    </AppStateProvider>
  )
}

export default App
