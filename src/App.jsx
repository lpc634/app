import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth, AuthProvider } from './useAuth';
import LoginPage from './Pages/LoginPage.jsx';
import Layout from './Layout';
import { Toaster as SonnerToaster } from "./components/ui/toaster.jsx";
import Dashboard from './Pages/Dashboard';
import CreateJob from './Pages/CreateJob';
import AgentDashboard from './components/AgentDashboard';
import AgentNotifications from './components/AgentNotifications';
import JobReports from './Pages/JobReports'; 
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
import AgentManagement from './Pages/AgentManagement';
import Analytics from './Pages/Analytics';
import AvailabilityPage from './Pages/AvailabilityPage';
import JobManagement from './Pages/JobManagement';
import JobsPage from './Pages/JobsPage';
import NotificationsPage from './Pages/NotificationsPage';
import ProfilePage from './Pages/ProfilePage';
import WeeklyCalendarView from './Pages/WeeklyCalendarView';
// --- 1. IMPORT THE NEW PAGE COMPONENT ---
import VehicleSearchPage from './Pages/VehicleSearchPage.jsx';

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <div>Access Denied</div>;
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
          
          {/* Admin Routes */}
          <Route path="/" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><Dashboard /></Layout></ProtectedRoute>} />
          <Route path="/agents" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><AgentManagement /></Layout></ProtectedRoute>} />
          <Route path="/jobs" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><CreateJob /></Layout></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><Analytics /></Layout></ProtectedRoute>} />
          <Route path="/debug" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><DebugPage /></Layout></ProtectedRoute>} />
          <Route path="/job-management" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><JobManagement /></Layout></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><NotificationsPage /></Layout></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><ProfilePage /></Layout></ProtectedRoute>} />
          <Route path="/weekly-calendar" element={<ProtectedRoute allowedRoles={['admin', 'manager']}><Layout><WeeklyCalendarView /></Layout></ProtectedRoute>} />
          
          {/* Agent Routes */}
          {/* Admins also have access to this layout, so the route goes here */}
          <Route element={<ProtectedRoute allowedRoles={['agent', 'admin', 'manager']}><AgentLayout /></ProtectedRoute>}>
            <Route path="/agent/dashboard" element={<AgentDashboard />} />
            {/* --- 2. ADD THE NEW ROUTE HERE --- */}
            <Route path="/agent/vehicle-search" element={<VehicleSearchPage />} />
            <Route path="/agent/jobs" element={<JobsPage />} />
            <Route path="/agent/jobs/:jobId" element={<JobDetails />} />
            <Route path="/agent/availability" element={<AvailabilityPage />} />
            <Route path="/agent/invoices" element={<AgentInvoices />} />
            <Route path="/agent/invoices/new" element={<CreateInvoicePage />} />
            <Route path="/agent/invoices/new/from-jobs" element={<CreateInvoiceFromJobs />} />
            <Route path="/agent/invoices/new/misc" element={<CreateMiscInvoice />} />
            <Route path="/agent/invoices/review" element={<ReviewInvoicePage />} />
            <Route path="/agent/reports" element={<JobReports />} />
            <Route path="/agent/notifications" element={<NotificationsPage />} />
            <Route path="/agent/profile" element={<AgentProfile />} />
          </Route>
          
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <SonnerToaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;