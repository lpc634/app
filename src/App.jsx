import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './useAuth';
import { Toaster as SonnerToaster } from "./components/ui/sonner.jsx";
import { Loader2 } from 'lucide-react';

// --- Static imports (needed immediately) ---
import LoginPage from './Pages/LoginPage.jsx';
import Layout from './Layout';
import AdminLayoutOutlet from './components/layout/AdminLayoutOutlet.jsx';
import VersionBadge from './components/VersionBadge';

// --- Route import functions (used for both lazy() and preloading) ---
const routeImports = {
  Dashboard: () => import('./Pages/Dashboard'),
  JobManagement: () => import('./Pages/JobManagement'),
  AgentManagement: () => import('./Pages/AgentManagement'),
  AdminAgentInvoices: () => import('./Pages/AdminAgentInvoices'),
  AgentDashboard: () => import('./components/AgentDashboard'),
  JobReports: () => import('./Pages/JobReports'),
  V3JobReports: () => import('./Pages/V3JobReports'),
  DebugPage: () => import('./Pages/DebugPage'),
  JobDetails: () => import('./components/JobDetails'),
  AgentLayout: () => import('./components/AgentLayout'),
  SignUpPage: () => import('./Pages/SignUpPage'),
  AgentProfile: () => import('./components/AgentProfile.jsx'),
  AgentInvoices: () => import('./components/AgentInvoices'),
  CreateInvoicePage: () => import('./components/CreateInvoicePage'),
  CreateInvoiceFromJobs: () => import('./components/CreateInvoiceFromJobs'),
  CreateMiscInvoice: () => import('./components/CreateMiscInvoice'),
  ReviewInvoicePage: () => import('./components/ReviewInvoicePage'),
  AdminMore: () => import('./Pages/admin/AdminMore.jsx'),
  MessageAgents: () => import('./Pages/admin/communications/MessageAgents.jsx'),
  AuthorityToActManager: () => import('./Pages/admin/AuthorityToActManager.jsx'),
  PublicAuthorityToActPage: () => import('./Pages/PublicAuthorityToActPage.jsx'),
  EFlyerPage: () => import('./Pages/EFlyerPage.jsx'),
  EFlyerRedirect: () => import('./Pages/EFlyerRedirect.jsx'),
  ContactFormPage: () => import('./Pages/ContactFormPage.jsx'),
  Analytics: () => import('./Pages/Analytics'),
  AvailabilityPage: () => import('./Pages/AvailabilityPage'),
  AdminDocumentReview: () => import('./components/AdminDocumentReview'),
  AdminExpenses: () => import('./Pages/AdminExpenses'),
  PoliceInteractionsPage: () => import('./Pages/PoliceInteractionsPage.jsx'),
  AdminContactForms: () => import('./Pages/AdminContactForms.jsx'),
  CRMPage: () => import('./Pages/CRMPage.jsx'),
  PublicReportPage: () => import('./Pages/PublicReportPage.jsx'),
  NotificationsPage: () => import('./Pages/NotificationsPage'),
  VehicleSearchPage: () => import('./Pages/VehicleSearchPage.jsx'),
  UpdateInvoicePage: () => import('./components/UpdateInvoicePage'),
};

// --- Lazy loaded pages ---
const Dashboard = lazy(routeImports.Dashboard);
const JobManagement = lazy(routeImports.JobManagement);
const AgentManagement = lazy(routeImports.AgentManagement);
const AdminAgentInvoices = lazy(routeImports.AdminAgentInvoices);
const AgentDashboard = lazy(routeImports.AgentDashboard);
const JobReports = lazy(routeImports.JobReports);
const V3JobReports = lazy(routeImports.V3JobReports);
const DebugPage = lazy(routeImports.DebugPage);
const JobDetails = lazy(routeImports.JobDetails);
const AgentLayout = lazy(routeImports.AgentLayout);
const SignUpPage = lazy(routeImports.SignUpPage);
const AgentProfile = lazy(routeImports.AgentProfile);
const AgentInvoices = lazy(routeImports.AgentInvoices);
const CreateInvoicePage = lazy(routeImports.CreateInvoicePage);
const CreateInvoiceFromJobs = lazy(routeImports.CreateInvoiceFromJobs);
const CreateMiscInvoice = lazy(routeImports.CreateMiscInvoice);
const ReviewInvoicePage = lazy(routeImports.ReviewInvoicePage);
const AdminMore = lazy(routeImports.AdminMore);
const MessageAgents = lazy(routeImports.MessageAgents);
const AuthorityToActManager = lazy(routeImports.AuthorityToActManager);
const PublicAuthorityToActPage = lazy(routeImports.PublicAuthorityToActPage);
const EFlyerPage = lazy(routeImports.EFlyerPage);
const EFlyerRedirect = lazy(routeImports.EFlyerRedirect);
const ContactFormPage = lazy(routeImports.ContactFormPage);
const Analytics = lazy(routeImports.Analytics);
const AvailabilityPage = lazy(routeImports.AvailabilityPage);
const AdminDocumentReview = lazy(routeImports.AdminDocumentReview);
const AdminExpenses = lazy(routeImports.AdminExpenses);
const PoliceInteractionsPage = lazy(routeImports.PoliceInteractionsPage);
const AdminContactForms = lazy(routeImports.AdminContactForms);
const CRMPage = lazy(routeImports.CRMPage);
const PublicReportPage = lazy(routeImports.PublicReportPage);
const NotificationsPage = lazy(routeImports.NotificationsPage);
const VehicleSearchPage = lazy(routeImports.VehicleSearchPage);
const UpdateInvoicePage = lazy(routeImports.UpdateInvoicePage);

// --- Preload all route chunks in background after login ---
function usePreloadRoutes() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
    idle(() => {
      Object.values(routeImports).forEach((importFn) => {
        importFn().catch(() => {});
      });
    });
  }, [user]);
}

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

function AppRoutes() {
  usePreloadRoutes();
  return (
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
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <SonnerToaster />
        <VersionBadge />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
