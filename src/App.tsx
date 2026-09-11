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
import { AppStateProvider } from './state/AppState'
import { useAppState } from './state/useAppState'

const LandingPage = () => {
  const { application } = useAppState()

  const supportedProducts = [
    {
      title: 'Business',
      summary: 'Start a business insurance application and continue with documents or a few smart questions.',
      to: `/customer/applications/${application.id}/documents`,
      eyebrow: 'Available now',
      cta: 'Start application',
    },
  ]

  const futureProducts = [
    { title: 'Auto', summary: 'Commercial auto is coming soon.' },
    { title: 'Home', summary: 'Home coverage is coming soon.' },
  ]

  return (
    <div className="stack-xl">
      <section className="landing-hero">
        <div className="stack-lg">
          <p className="eyebrow">Insurly</p>
          <h1>What do you need to insure?</h1>
          <p className="lede">
            Start with your coverage type, upload useful documents or skip ahead, answer only what is still needed, then review and finish.
          </p>
        </div>
        <SurfaceCard title="How it works" eyebrow="Simple steps">
          <ol className="step-list">
            <li>
              <span className="step-list__number">1</span>
              <div>
                <strong>Choose insurance</strong>
                <p className="muted">Pick the application you want to complete.</p>
              </div>
            </li>
            <li>
              <span className="step-list__number">2</span>
              <div>
                <strong>Upload documents or skip</strong>
                <p className="muted">Share helpful files now, or answer questions manually.</p>
              </div>
            </li>
            <li>
              <span className="step-list__number">3</span>
              <div>
                <strong>Review and submit</strong>
                <p className="muted">Check your details and send the application for review.</p>
              </div>
            </li>
          </ol>
        </SurfaceCard>
      </section>

      <section className="grid product-grid" aria-label="Insurance choices">
        {supportedProducts.map((product) => (
          <SurfaceCard key={product.title} title={product.title} eyebrow={product.eyebrow}>
            <div className="product-choice">
              <p className="muted">{product.summary}</p>
              <Link className="button" to={product.to}>{product.cta}</Link>
            </div>
          </SurfaceCard>
        ))}
        {futureProducts.map((product) => (
          <SurfaceCard key={product.title} title={product.title} eyebrow="Coming later">
            <div className="product-choice product-choice--disabled">
              <p className="muted">{product.summary}</p>
              <button className="button button--secondary" type="button" disabled>
                Not available yet
              </button>
            </div>
          </SurfaceCard>
        ))}
      </section>
    </div>
  )
}

const StartApplicationPage = () => {
  const { application } = useAppState()

  return <Navigate to={`/customer/applications/${application.id}/documents`} replace />
}

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/start" element={<StartApplicationPage />} />
        <Route path="/customer/applications/:applicationId" element={<CustomerLayout />}>
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
        <Route path="/broker/customers/:customerId" element={<BrokerCustomerProfilePage />} />
        <Route path="/broker/applications/:applicationId" element={<BrokerApplicationPage />} />
        <Route path="/broker/applications/:applicationId/forms" element={<BrokerFormsPage />} />
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
