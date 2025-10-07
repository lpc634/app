import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './useAuth';
import LoginPage from './Pages/LoginPage.jsx';
import Layout from './Layout';
import AdminLayoutOutlet from './components/layout/AdminLayoutOutlet.jsx';
import { Toaster as SonnerToaster } from "./components/ui/sonner.jsx"; // Corrected import path
import Dashboard from './Pages/Dashboard';
import JobManagement from './Pages/JobManagement';
import AgentManagement from './Pages/AgentManagement';
import AdminAgentInvoices from './Pages/AdminAgentInvoices';
import AgentDashboard from './components/AgentDashboard';
import AgentNotifications from './components/AgentNotifications';
import JobReports from './Pages/JobReports';
import V3JobReports from './Pages/V3JobReports';
import DebugPage from './Pages/DebugPage';
import JobDetails from './components/JobDetails';
import AgentLayout from './components/AgentLayout';
import SignUpPage from './Pages/SignUpPage';
import AgentProfile from './components/AgentProfile.jsx';
import AgentInvoices from './components/AgentInvoices';
import CreateInvoicePage from './components/CreateInvoicePage';
import CreateInvoiceFromJobs from './components/CreateInvoiceFromJobs';
import CreateMiscInvoice from './components/CreateMiscInvoice';
import ReviewInvoicePage from './components/ReviewInvoicePage';
import AdminMore from './Pages/admin/AdminMore.jsx';
import MessageAgents from './Pages/admin/communications/MessageAgents.jsx';
import AuthorityToActManager from './Pages/admin/AuthorityToActManager.jsx';
import PublicAuthorityToActPage from './Pages/PublicAuthorityToActPage.jsx';
import Analytics from './Pages/Analytics';
import AvailabilityPage from './Pages/AvailabilityPage';
import AdminDocumentReview from './components/AdminDocumentReview';
import AdminExpenses from './Pages/AdminExpenses';
import PoliceInteractionsPage from './Pages/PoliceInteractionsPage.jsx';

import NotificationsPage from './Pages/NotificationsPage';
import ProfilePage from './Pages/ProfilePage';
import WeeklyCalendarView from './Pages/WeeklyCalendarView';
import VehicleSearchPage from './Pages/VehicleSearchPage.jsx';
import UpdateInvoicePage from './components/UpdateInvoicePage';
import VersionBadge from './components/VersionBadge';

// --- NEW: Root Redirect Component ---
// This component will handle the logic for the root path
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;

  // If the user is an agent, redirect to their dashboard
  if (user?.role === 'agent') {
    return <Navigate to="/agent/dashboard" replace />;
  }

  // If the user is an admin or manager, show the admin dashboard
  if (user?.role === 'admin' || user?.role === 'manager') {
    return <Navigate to="/admin" replace />;
  }

  // If no user, redirect to login
  return <Navigate to="/login" replace />;
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // This is where the "Access Denied" message comes from
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
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignUpPage /></PublicRoute>} />
          <Route path="/public/authority-to-act/:token" element={<PublicAuthorityToActPage />} />
          
          {/* --- UPDATED: Root Route --- */}
          {/* This route now uses the RootRedirect component */}
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
          <Route path="/debug" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><DebugPage /></Layout></ProtectedRoute>} />
          <Route path="/police-interactions" element={<ProtectedRoute allowedRoles={['admin', 'manager', 'agent']}><Layout><PoliceInteractionsPage /></Layout></ProtectedRoute>} />
          
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
        <SonnerToaster />
        <VersionBadge />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
