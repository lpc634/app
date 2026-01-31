import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './useAuth';
import { Toaster as SonnerToaster } from "./components/ui/sonner.jsx";
import { Loader2 } from 'lucide-react';

// --- Static imports (needed immediately) ---
import LoginPage from './Pages/LoginPage.jsx';
import Layout from './Layout';
import AdminLayoutOutlet from './components/layout/AdminLayoutOutlet.jsx';
import VersionBadge from './components/VersionBadge';

// --- Lazy loaded pages ---
const Dashboard = lazy(() => import('./Pages/Dashboard'));
const JobManagement = lazy(() => import('./Pages/JobManagement'));
const AgentManagement = lazy(() => import('./Pages/AgentManagement'));
const AdminAgentInvoices = lazy(() => import('./Pages/AdminAgentInvoices'));
const AgentDashboard = lazy(() => import('./components/AgentDashboard'));
const JobReports = lazy(() => import('./Pages/JobReports'));
const V3JobReports = lazy(() => import('./Pages/V3JobReports'));
const DebugPage = lazy(() => import('./Pages/DebugPage'));
const JobDetails = lazy(() => import('./components/JobDetails'));
const AgentLayout = lazy(() => import('./components/AgentLayout'));
const SignUpPage = lazy(() => import('./Pages/SignUpPage'));
const AgentProfile = lazy(() => import('./components/AgentProfile.jsx'));
const AgentInvoices = lazy(() => import('./components/AgentInvoices'));
const CreateInvoicePage = lazy(() => import('./components/CreateInvoicePage'));
const CreateInvoiceFromJobs = lazy(() => import('./components/CreateInvoiceFromJobs'));
const CreateMiscInvoice = lazy(() => import('./components/CreateMiscInvoice'));
const ReviewInvoicePage = lazy(() => import('./components/ReviewInvoicePage'));
const AdminMore = lazy(() => import('./Pages/admin/AdminMore.jsx'));
const MessageAgents = lazy(() => import('./Pages/admin/communications/MessageAgents.jsx'));
const AuthorityToActManager = lazy(() => import('./Pages/admin/AuthorityToActManager.jsx'));
const PublicAuthorityToActPage = lazy(() => import('./Pages/PublicAuthorityToActPage.jsx'));
const EFlyerPage = lazy(() => import('./Pages/EFlyerPage.jsx'));
const EFlyerRedirect = lazy(() => import('./Pages/EFlyerRedirect.jsx'));
const ContactFormPage = lazy(() => import('./Pages/ContactFormPage.jsx'));
const Analytics = lazy(() => import('./Pages/Analytics'));
const AvailabilityPage = lazy(() => import('./Pages/AvailabilityPage'));
const AdminDocumentReview = lazy(() => import('./components/AdminDocumentReview'));
const AdminExpenses = lazy(() => import('./Pages/AdminExpenses'));
const PoliceInteractionsPage = lazy(() => import('./Pages/PoliceInteractionsPage.jsx'));
const AdminContactForms = lazy(() => import('./Pages/AdminContactForms.jsx'));
const CRMPage = lazy(() => import('./Pages/CRMPage.jsx'));
const PublicReportPage = lazy(() => import('./Pages/PublicReportPage.jsx'));
const NotificationsPage = lazy(() => import('./Pages/NotificationsPage'));
const VehicleSearchPage = lazy(() => import('./Pages/VehicleSearchPage.jsx'));
const UpdateInvoicePage = lazy(() => import('./components/UpdateInvoicePage'));

// --- Loading fallback ---
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

// --- Root Redirect Component ---
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;

  if (user?.role === 'agent') {
    return <Navigate to="/agent/dashboard" replace />;
  }

  if (user?.role === 'admin' || user?.role === 'manager') {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/login" replace />;
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <div className="p-4 text-red-500">Access Denied</div>;
  }
  return children;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (user) {
    return user.role === 'agent' ? <Navigate to="/agent/dashboard" replace /> : <Navigate to="/" replace />;
  }
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
            <Route path="/form/:token" element={<PublicAuthorityToActPage />} />
            <Route path="/report/:token" element={<PublicReportPage />} />
            <Route path="/eflyer" element={<EFlyerRedirect />} />
            <Route path="/contact" element={<ContactFormPage />} />

            {/* Root Route */}
            <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'agent']}><RootRedirect /></ProtectedRoute>} />

            {/* Admin Routes (mobile shell + bottom nav) */}
            <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']}><AdminLayoutOutlet /></ProtectedRoute>}>
              <Route path="/admin" element={<Dashboard />} />
              <Route path="/admin/jobs" element={<JobManagement />} />
              <Route path="/admin/agents" element={<AgentManagement />} />
              <Route path="/admin/invoices" element={<AdminAgentInvoices />} />
              <Route path="/admin/more" element={<AdminMore />} />
              <Route path="/admin/communications/message-agents" element={<MessageAgents />} />
              <Route path="/admin/authority-to-act" element={<AuthorityToActManager />} />
            </Route>

            {/* Legacy Admin Paths (back-compat) */}
            <Route path="/agents" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><AgentManagement /></Layout></ProtectedRoute>} />
            <Route path="/jobs" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><JobManagement /></Layout></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><Analytics /></Layout></ProtectedRoute>} />
            <Route path="/admin/vehicle-search" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><VehicleSearchPage /></Layout></ProtectedRoute>} />
            <Route path="/admin/documents" element={<ProtectedRoute allowedRoles={['admin']}><Layout><AdminDocumentReview /></Layout></ProtectedRoute>} />
            <Route path="/admin/agent-invoices" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><AdminAgentInvoices /></Layout></ProtectedRoute>} />
            <Route path="/admin/expenses" element={<ProtectedRoute allowedRoles={['admin']}><Layout><AdminExpenses /></Layout></ProtectedRoute>} />
            <Route path="/admin/v3-reports" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><V3JobReports /></Layout></ProtectedRoute>} />
            <Route path="/admin/eflyer" element={<ProtectedRoute allowedRoles={['admin']}><Layout><EFlyerPage /></Layout></ProtectedRoute>} />
            <Route path="/debug" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><DebugPage /></Layout></ProtectedRoute>} />
            <Route path="/police-interactions" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'agent']}><Layout><PoliceInteractionsPage /></Layout></ProtectedRoute>} />
            <Route path="/admin/contact-forms" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><AdminContactForms /></Layout></ProtectedRoute>} />
            <Route path="/admin/crm" element={<ProtectedRoute allowedRoles={['admin']}><Layout><CRMPage /></Layout></ProtectedRoute>} />

            {/* Agent Routes */}
            <Route element={<ProtectedRoute allowedRoles={['agent', 'admin', 'manager']}><AgentLayout /></ProtectedRoute>}>
              <Route path="/agent/dashboard" element={<AgentDashboard />} />
              <Route path="/agent/intelligence" element={<VehicleSearchPage />} />
              <Route path="/agent/jobs/:jobId" element={<JobDetails />} />
              <Route path="/agent/availability" element={<AvailabilityPage />} />
              <Route path="/agent/invoices" element={<AgentInvoices />} />
              <Route path="/agent/invoices/new" element={<CreateInvoicePage />} />
              <Route path="/agent/invoices/new/from-jobs" element={<CreateInvoiceFromJobs />} />
              <Route path="/agent/invoices/new/misc" element={<CreateMiscInvoice />} />
              <Route path="/agent/invoices/update/:invoiceId" element={<UpdateInvoicePage />} />
              <Route path="/agent/invoices/review/:invoiceId" element={<ReviewInvoicePage />} />
              <Route path="/agent/invoices/review" element={<ReviewInvoicePage />} />
              <Route path="/agent/reports" element={<JobReports />} />
              <Route path="/agent/v3-reports" element={<V3JobReports />} />
              <Route path="/agent/notifications" element={<NotificationsPage />} />
              <Route path="/agent/police-interactions" element={<PoliceInteractionsPage />} />
              <Route path="/agent/profile" element={<AgentProfile />} />
            </Route>

            <Route path="*" element={<div className="p-4">Page Not Found</div>} />
          </Routes>
        </Suspense>
        <SonnerToaster />
        <VersionBadge />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
