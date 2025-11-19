import { useState, useEffect, useCallback } from 'react';
import { usePageHeader } from '@/components/layout/PageHeaderContext.jsx';
import { toast } from 'sonner';

// Import New Modular Components
import CRMAuth from '../components/crm/CRMAuth';
import CRMDashboard from '../components/crm/CRMDashboard';
import CRMToolbar from '../components/crm/CRMToolbar';
import CRMList from '../components/crm/CRMList';
import CRMKanban from '../components/crm/CRMKanban';
import CRMContactModal from '../components/crm/CRMContactModal';

export default function CRMPage() {
  const { register } = usePageHeader();

  // --- Global State ---
  const [crmUser, setCrmUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // --- Data State ---
  const [contacts, setContacts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [priorityCounts, setPriorityCounts] = useState({ urgent: 0, hot: 0, nurture: 0, routine: 0 });
  const [todayTasks, setTodayTasks] = useState([]);

  // --- View State ---
  const [view, setView] = useState('my'); // 'my' or 'team'
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'pipeline'
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'active',
    priority: 'all',
    search: ''
  });

  // --- Modal State ---
  const [selectedContact, setSelectedContact] = useState(null); // If set, opens the Detail/Edit/Files modal
  const [showAddContact, setShowAddContact] = useState(false); // If true, opens Create modal (reusing ContactModal in create mode)

  // --- Register Page Header ---
  useEffect(() => {
    register('CRM System', 'Manage eviction clients, prevention prospects, and referral partners');
  }, [register]);

  // --- Authentication Check ---
  const checkCrmAuth = useCallback(async () => {
    const token = localStorage.getItem('crm_token');
    if (!token) {
      setShowAuthModal(true);
      setIsCheckingAuth(false);
      return;
    }

    try {
      const response = await fetch('/api/crm/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const user = await response.json();
        setCrmUser(user);
        setIsCheckingAuth(false);
      } else {
        localStorage.removeItem('crm_token');
        setShowAuthModal(true);
        setIsCheckingAuth(false);
      }
    } catch (error) {
      localStorage.removeItem('crm_token');
      setShowAuthModal(true);
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkCrmAuth();
  }, [checkCrmAuth]);

  // --- Data Fetching ---
  const fetchData = useCallback(async () => {
    if (!crmUser) return;
    
    const token = localStorage.getItem('crm_token');
    if (!token) return;

    setLoading(true);
    try {
      // 1. Fetch Contacts
      const params = new URLSearchParams({ view });
      if (filters.type !== 'all') params.append('type', filters.type);
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.priority !== 'all') params.append('priority', filters.priority);
      if (filters.search) params.append('search', filters.search);

      const contactsRes = await fetch(`/api/crm/contacts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (contactsRes.ok) {
        const data = await contactsRes.json();
        setContacts(data.contacts || []);
      }

      // 2. Fetch Dashboard Stats
      const dashRes = await fetch(`/api/crm/dashboard?view=${view}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (dashRes.ok) setDashboard(await dashRes.json());

      // 3. Fetch Priority Counts
      const prioRes = await fetch('/api/crm/contacts/priority-counts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (prioRes.ok) setPriorityCounts(await prioRes.json());

      // 4. Fetch Today's Tasks
      const tasksRes = await fetch('/api/crm/tasks?filter=today', {
         headers: { 'Authorization': `Bearer ${token}` }
      });
      if (tasksRes.ok) {
        const taskData = await tasksRes.json();
        setTodayTasks(taskData.tasks || []);
      }

    } catch (error) {
      console.error("CRM Fetch Error:", error);
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  }, [crmUser, view, filters]);

  // Initial Load & Refresh on Filter Change
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers ---

  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    setCrmUser(null);
    setShowAuthModal(true);
    toast.success("Logged out");
  };

  const handleContactClick = (contact) => {
    setSelectedContact(contact);
  };

  const handleRefresh = () => {
    fetchData();
  };

  const handleAuthSuccess = (user) => {
    setCrmUser(user);
    setShowAuthModal(false);
    toast.success(`Welcome back, ${user.username}`);
  };

  // --- Render ---

  if (isCheckingAuth) {
    return <div className="page-container p-8 text-center text-v3-text-muted">Loading CRM...</div>;
  }

  return (
    <div className="page-container px-6 pb-10">
      
      {/* 1. Authentication & Settings Modals */}
      <CRMAuth 
        isOpen={showAuthModal} 
        onLoginSuccess={handleAuthSuccess}
        crmUser={crmUser}
        onLogout={handleLogout}
      />

      {/* 2. Header / User Controls (Only if logged in) */}
      {crmUser && !showAuthModal && (
        <>
          {/* Top Dashboard Widgets */}
          <CRMDashboard 
            stats={dashboard} 
            tasks={todayTasks}
            onRefresh={handleRefresh}
            crmUser={crmUser}
            onOpenSettings={() => setShowAuthModal(true)}
          />

          {/* Priority Alerts Widget */}
          {(priorityCounts.urgent > 0 || priorityCounts.hot > 0) && (
             <div className="dashboard-card !p-4 mb-4 bg-gradient-to-r from-red-500/10 to-yellow-500/10 border-l-4 border-red-500 flex justify-between items-center">
               <div className="flex gap-4 items-center">
                 <span className="text-2xl">⚠️</span>
                 <div>
                   <h3 className="font-bold text-v3-text-lightest">Attention Required</h3>
                   <p className="text-sm text-v3-text-light">
                     You have <span className="text-red-500 font-bold">{priorityCounts.urgent} Urgent</span> and <span className="text-yellow-500 font-bold">{priorityCounts.hot} Hot</span> contacts.
                   </p>
                 </div>
               </div>
               <button 
                 onClick={() => setFilters({...filters, priority: priorityCounts.urgent > 0 ? 'urgent' : 'hot'})}
                 className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
               >
                 View Priority
               </button>
             </div>
          )}

          {/* Toolbar (Search, Filter, View Toggle) */}
          <CRMToolbar 
            view={view} 
            setView={setView}
            viewMode={viewMode} 
            setViewMode={setViewMode}
            filters={filters} 
            setFilters={setFilters}
            onAddContact={() => setShowAddContact(true)}
            crmUser={crmUser}
          />

          {/* Main Content Area */}
          <div className="mt-4">
            {loading ? (
               <div className="text-center py-10 text-v3-text-muted">Loading CRM Data...</div>
            ) : viewMode === 'list' ? (
              <CRMList 
                contacts={contacts} 
                onContactClick={handleContactClick} 
              />
            ) : (
              <CRMKanban 
                contacts={contacts} 
                filters={filters}
                onContactClick={handleContactClick}
                onRefresh={handleRefresh}
              />
            )}
          </div>
        </>
      )}

      {/* 3. Unified Contact Modal (The New Feature!) */}
      {(selectedContact || showAddContact) && (
        <CRMContactModal 
          contact={selectedContact} // null if creating new
          isOpen={true} 
          onClose={() => { setSelectedContact(null); setShowAddContact(false); }}
          onRefresh={handleRefresh}
          isCreating={showAddContact}
          currentUser={crmUser}
        />
      )}

    </div>
  );
}