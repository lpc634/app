import { useState, useEffect } from 'react';
import { usePageHeader } from '@/components/layout/PageHeaderContext.jsx';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  Users,
  TrendingUp,
  Calendar,
  DollarSign,
  Phone,
  Mail,
  Building,
  MapPin,
  Clock,
  FileText,
  Trash2,
  Edit2,
  Eye,
  X,
  CheckCircle,
  XCircle,
  AlertCircle,
  Upload,
  Download
} from 'lucide-react';
import '../v3-services-theme.css';

const CONTACT_TYPES = {
  eviction_client: 'Eviction Client',
  prevention_prospect: 'Prevention Prospect',
  referral_partner: 'Referral Partner'
};

const EVICTION_STAGES = [
  { value: 'new_inquiry', label: 'New Inquiry' },
  { value: 'client_pack_sent', label: 'Client Pack Sent' },
  { value: 'awaiting_instruction', label: 'Awaiting Instruction Form' },
  { value: 'job_booked', label: 'Job Booked' },
  { value: 'job_in_progress', label: 'Job In Progress' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' }
];

const PREVENTION_STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'first_contact', label: 'First Contact Made' },
  { value: 'in_discussion', label: 'In Discussion' },
  { value: 'quote_sent', label: 'Quote Sent' },
  { value: 'thinking_about_it', label: 'Thinking About It' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' }
];

const CONTACT_STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
  { value: 'dormant', label: 'Dormant' }
];

export default function CRMPage() {
  const { register } = usePageHeader();

  // CRM Authentication State
  const [crmUser, setCrmUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [registerForm, setRegisterForm] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    imap_server: 'mail.nebula.galaxywebsolutions.com',
    imap_port: '993',
    imap_email: '',
    imap_password: '',
    imap_use_ssl: true
  });
  const [registerError, setRegisterError] = useState('');
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // State
  const [contacts, setContacts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('my'); // 'my' or 'team'
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal states
  const [showContactModal, setShowContactModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company_name: '',
    contact_type: 'eviction_client',
    how_found_us: '',
    referral_partner_name: '',
    property_address: '',
    service_type: '',
    urgency_level: 'medium',
    current_stage: 'new_inquiry',
    status: 'active',
    next_followup_date: '',
    potential_value: ''
  });

  // Notes state
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('internal');

  // Register page header
  useEffect(() => {
    register('CRM System', 'Manage eviction clients, prevention prospects, and referral partners');
  }, [register]);

  // Check CRM authentication on mount
  useEffect(() => {
    const checkCrmAuth = async () => {
      const token = localStorage.getItem('crm_token');

      if (!token) {
        setShowLoginModal(true);
        setIsCheckingAuth(false);
        return;
      }

      try {
        const response = await fetch('/api/crm/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const data = await response.json();
          setCrmUser(data);
          setIsCheckingAuth(false);
        } else {
          // Token invalid, remove it and show login
          localStorage.removeItem('crm_token');
          setShowLoginModal(true);
          setIsCheckingAuth(false);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('crm_token');
        setShowLoginModal(true);
        setIsCheckingAuth(false);
      }
    };

    checkCrmAuth();
  }, []);

  // Load data
  useEffect(() => {
    if (crmUser) {
      fetchDashboard();
      fetchContacts();
    }
  }, [view, typeFilter, statusFilter, crmUser]);

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');

    try {
      const response = await fetch('/api/crm/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('crm_token', data.access_token);
        setCrmUser(data.user);
        setShowLoginModal(false);
        setLoginForm({ username: '', password: '' });
        toast.success('Logged in successfully');
      } else {
        const error = await response.json();
        setLoginError(error.error || 'Login failed');
      }
    } catch (error) {
      setLoginError('Network error - please try again');
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('crm_token');
    setCrmUser(null);
    setShowLoginModal(true);
    toast.success('Logged out');
  };

  // Registration handler
  const handleRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');

    // Validate passwords match
    if (registerForm.password !== registerForm.confirmPassword) {
      setRegisterError('Passwords do not match');
      return;
    }

    // Validate password strength
    if (registerForm.password.length < 8) {
      setRegisterError('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await fetch('/api/crm/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: registerForm.username,
          email: registerForm.email,
          password: registerForm.password,
          imap_server: registerForm.imap_server,
          imap_port: parseInt(registerForm.imap_port),
          imap_email: registerForm.imap_email,
          imap_password: registerForm.imap_password,
          imap_use_ssl: registerForm.imap_use_ssl
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('crm_token', data.access_token);
        setCrmUser(data.user);
        setShowLoginModal(false);
        setShowRegister(false);
        toast.success('Account created successfully! Welcome to CRM.');
      } else {
        const error = await response.json();
        setRegisterError(error.error || 'Registration failed');
      }
    } catch (error) {
      setRegisterError('Network error - please try again');
    }
  };

  // API Calls
  const fetchDashboard = async () => {
    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/dashboard?view=${view}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      } else if (response.status === 403 || response.status === 401) {
        // Not authorized or token expired
        localStorage.removeItem('crm_token');
        setCrmUser(null);
        setShowLoginModal(true);
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ view });
      if (typeFilter !== 'all') params.append('type', typeFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);

      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/contacts?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts || []);
      } else if (response.status === 403 || response.status === 401) {
        localStorage.removeItem('crm_token');
        setCrmUser(null);
        setShowLoginModal(true);
      } else {
        toast.error('Failed to load contacts');
      }
    } catch (error) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const fetchContactDetails = async (contactId) => {
    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/contacts/${contactId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSelectedContact(data);
        setNotes(data.notes || []);
        setShowDetailsModal(true);
      } else {
        toast.error('Failed to load contact details');
      }
    } catch (error) {
      toast.error('Failed to load contact details');
    }
  };

  const createContact = async () => {
    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Contact created successfully');
        setShowContactModal(false);
        resetForm();
        fetchContacts();
        fetchDashboard();
      } else {
        toast.error('Failed to create contact');
      }
    } catch (error) {
      toast.error('Failed to create contact');
    }
  };

  const updateContact = async () => {
    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/contacts/${selectedContact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success('Contact updated successfully');
        setEditMode(false);
        fetchContactDetails(selectedContact.id);
        fetchContacts();
        fetchDashboard();
      } else {
        toast.error('Failed to update contact');
      }
    } catch (error) {
      toast.error('Failed to update contact');
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/contacts/${selectedContact.id}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newNote,
          note_type: noteType
        })
      });

      if (response.ok) {
        toast.success('Note added');
        setNewNote('');
        fetchContactDetails(selectedContact.id);
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const deleteContact = async (contactId) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/contacts/${contactId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success('Contact deleted');
        setShowDetailsModal(false);
        fetchContacts();
        fetchDashboard();
      } else {
        toast.error('Failed to delete contact');
      }
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  // Helpers
  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      company_name: '',
      contact_type: 'eviction_client',
      how_found_us: '',
      referral_partner_name: '',
      property_address: '',
      service_type: '',
      urgency_level: 'medium',
      current_stage: 'new_inquiry',
      status: 'active',
      next_followup_date: '',
      potential_value: ''
    });
  };

  const openEditMode = () => {
    setFormData({ ...selectedContact });
    setEditMode(true);
  };

  const getStagesForType = (type) => {
    if (type === 'eviction_client') return EVICTION_STAGES;
    if (type === 'prevention_prospect') return PREVENTION_STAGES;
    return [];
  };

  const formatCurrency = (value) => {
    if (!value) return '£0';
    return `£${parseFloat(value).toLocaleString()}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const getUrgencyColor = (level) => {
    const colors = {
      low: 'text-green-600',
      medium: 'text-yellow-600',
      high: 'text-orange-600',
      urgent: 'text-red-600'
    };
    return colors[level] || 'text-gray-600';
  };

  const getStatusColor = (status) => {
    const colors = {
      active: 'text-blue-600',
      won: 'text-green-600',
      lost: 'text-red-600',
      dormant: 'text-gray-600'
    };
    return colors[status] || 'text-gray-600';
  };

  // Show login/register modal if not authenticated
  if (showLoginModal) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="dashboard-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold text-v3-text-lightest mb-2">CRM Access</h2>
          <p className="text-v3-text-muted mb-6">
            {showRegister ? 'Create your personal CRM account' : 'Log in with your CRM account'}
          </p>

          {/* Tab Buttons */}
          <div className="flex gap-2 mb-6 border-b border-v3-bg-card">
            <button
              onClick={() => { setShowRegister(false); setLoginError(''); setRegisterError(''); }}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                !showRegister
                  ? 'border-v3-brand text-v3-brand'
                  : 'border-transparent text-v3-text-muted hover:text-v3-text-light'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => { setShowRegister(true); setLoginError(''); setRegisterError(''); }}
              className={`px-4 py-2 font-medium border-b-2 transition-colors ${
                showRegister
                  ? 'border-v3-brand text-v3-brand'
                  : 'border-transparent text-v3-text-muted hover:text-v3-text-light'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Login Form */}
          {!showRegister && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Username</label>
                <input
                  type="text"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
                  className="v3-input w-full"
                  placeholder="lance or tom"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Password</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                  className="v3-input w-full"
                  placeholder="Your CRM password"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {loginError}
                </div>
              )}

              <button type="submit" className="button-refresh w-full">
                Login to CRM
              </button>
            </form>
          )}

          {/* Registration Form */}
          {showRegister && (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Username *</label>
                  <input
                    type="text"
                    value={registerForm.username}
                    onChange={(e) => setRegisterForm({...registerForm, username: e.target.value})}
                    className="v3-input w-full"
                    placeholder="john_smith"
                    required
                    autoFocus
                  />
                  <p className="text-xs text-v3-text-muted mt-1">3-50 characters, letters and numbers only</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Email Address *</label>
                  <input
                    type="email"
                    value={registerForm.email}
                    onChange={(e) => setRegisterForm({...registerForm, email: e.target.value})}
                    className="v3-input w-full"
                    placeholder="john@v3-services.com"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">CRM Password *</label>
                  <input
                    type="password"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({...registerForm, password: e.target.value})}
                    className="v3-input w-full"
                    placeholder="Minimum 8 characters"
                    required
                    minLength={8}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Confirm Password *</label>
                  <input
                    type="password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({...registerForm, confirmPassword: e.target.value})}
                    className="v3-input w-full"
                    placeholder="Re-enter password"
                    required
                    minLength={8}
                  />
                </div>
              </div>

              <div className="border-t border-v3-bg-card pt-4 mt-4">
                <h3 className="font-medium text-v3-text-lightest mb-3">Email Configuration (for email tracking)</h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Server *</label>
                    <input
                      type="text"
                      value={registerForm.imap_server}
                      onChange={(e) => setRegisterForm({...registerForm, imap_server: e.target.value})}
                      className="v3-input w-full"
                      placeholder="mail.yourserver.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Port *</label>
                    <input
                      type="number"
                      value={registerForm.imap_port}
                      onChange={(e) => setRegisterForm({...registerForm, imap_port: e.target.value})}
                      className="v3-input w-full"
                      placeholder="993"
                      required
                    />
                    <p className="text-xs text-v3-text-muted mt-1">Usually 993 (SSL) or 143</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-v3-text-light mb-2">Your Email Address *</label>
                    <input
                      type="email"
                      value={registerForm.imap_email}
                      onChange={(e) => setRegisterForm({...registerForm, imap_email: e.target.value})}
                      className="v3-input w-full"
                      placeholder="john@v3-services.com"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-v3-text-light mb-2">Email Password *</label>
                    <input
                      type="password"
                      value={registerForm.imap_password}
                      onChange={(e) => setRegisterForm({...registerForm, imap_password: e.target.value})}
                      className="v3-input w-full"
                      placeholder="Your email password"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={registerForm.imap_use_ssl}
                      onChange={(e) => setRegisterForm({...registerForm, imap_use_ssl: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-v3-text-light">Use SSL/TLS (recommended)</span>
                  </label>
                </div>
              </div>

              {registerError && (
                <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                  {registerError}
                </div>
              )}

              <button type="submit" className="button-refresh w-full">
                Create CRM Account
              </button>

              <p className="text-xs text-v3-text-muted text-center">
                By creating an account, your email credentials are securely stored for email tracking purposes only.
              </p>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Show loading state while checking auth
  if (isCheckingAuth) {
    return (
      <div className="page-container">
        <p className="text-center text-v3-text-muted py-8">Checking authentication...</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      {/* User info and logout */}
      {crmUser && (
        <div className="dashboard-card mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-v3-text-light">Logged in as:</span>
            <span className="font-semibold text-v3-text-lightest">{crmUser.username}</span>
            {crmUser.is_super_admin && (
              <span className="px-2 py-1 bg-v3-brand/20 text-v3-brand text-xs rounded">
                Super Admin
              </span>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker transition-colors"
          >
            Logout
          </button>
        </div>
      )}

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="dashboard-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-sm">Follow-ups Today</p>
                <p className="text-2xl font-bold text-v3-brand">{dashboard.followups_today}</p>
              </div>
              <Calendar className="h-8 w-8 text-v3-brand opacity-50" />
            </div>
          </div>

          <div className="dashboard-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-sm">Overdue Follow-ups</p>
                <p className="text-2xl font-bold text-red-600">{dashboard.overdue_followups}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600 opacity-50" />
            </div>
          </div>

          <div className="dashboard-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-sm">Quotes Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{dashboard.quotes_pending}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-600 opacity-50" />
            </div>
          </div>

          <div className="dashboard-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-sm">Potential Revenue</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(dashboard.potential_revenue)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="dashboard-card mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('my')}
              className={`px-4 py-2 rounded ${view === 'my' ? 'bg-v3-brand text-white' : 'bg-v3-bg-card text-v3-text-light'}`}
            >
              My Contacts
            </button>
            {crmUser?.is_super_admin && (
              <button
                onClick={() => setView('team')}
                className={`px-4 py-2 rounded ${view === 'team' ? 'bg-v3-brand text-white' : 'bg-v3-bg-card text-v3-text-light'}`}
              >
                Team View
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="v3-input"
            >
              <option value="all">All Types</option>
              {Object.entries(CONTACT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="v3-input"
            >
              <option value="all">All Statuses</option>
              {CONTACT_STATUS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-v3-text-muted" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="v3-input pl-10"
              />
            </div>

            <button
              onClick={() => setShowContactModal(true)}
              className="button-refresh flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Add Contact
            </button>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="dashboard-card">
        {loading ? (
          <p className="text-center text-v3-text-muted py-8">Loading contacts...</p>
        ) : contacts.length === 0 ? (
          <p className="text-center text-v3-text-muted py-8">No contacts found</p>
        ) : (
          <div className="space-y-4">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => fetchContactDetails(contact.id)}
                className="p-4 bg-v3-bg-card rounded hover:bg-v3-bg-darker cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-v3-text-lightest">{contact.name}</h3>
                      <span className="px-2 py-1 bg-v3-brand/20 text-v3-brand text-xs rounded">
                        {CONTACT_TYPES[contact.contact_type]}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${getStatusColor(contact.status)}`}>
                        {contact.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-sm text-v3-text-light">
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          {contact.email}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          {contact.phone}
                        </div>
                      )}
                      {contact.company_name && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4" />
                          {contact.company_name}
                        </div>
                      )}
                      {contact.next_followup_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          Follow-up: {formatDate(contact.next_followup_date)}
                        </div>
                      )}
                    </div>

                    {contact.potential_value && (
                      <div className="mt-2 text-sm">
                        <span className="text-v3-text-muted">Potential: </span>
                        <span className="font-semibold text-green-600">{formatCurrency(contact.potential_value)}</span>
                      </div>
                    )}
                  </div>

                  <Eye className="h-5 w-5 text-v3-text-muted" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="dashboard-card max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-v3-text-lightest">Add New Contact</h2>
              <button onClick={() => setShowContactModal(false)}>
                <X className="h-6 w-6 text-v3-text-muted" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="v3-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="v3-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Phone</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="v3-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Company Name</label>
                  <input
                    type="text"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    className="v3-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Contact Type *</label>
                  <select
                    value={formData.contact_type}
                    onChange={(e) => setFormData({ ...formData, contact_type: e.target.value })}
                    className="v3-input w-full"
                  >
                    {Object.entries(CONTACT_TYPES).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Current Stage</label>
                  <select
                    value={formData.current_stage}
                    onChange={(e) => setFormData({ ...formData, current_stage: e.target.value })}
                    className="v3-input w-full"
                  >
                    {getStagesForType(formData.contact_type).map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Next Follow-up</label>
                  <input
                    type="date"
                    value={formData.next_followup_date}
                    onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })}
                    className="v3-input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm text-v3-text-light mb-1">Potential Value (£)</label>
                  <input
                    type="number"
                    value={formData.potential_value}
                    onChange={(e) => setFormData({ ...formData, potential_value: e.target.value })}
                    className="v3-input w-full"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-v3-text-light mb-1">Property Address</label>
                <textarea
                  value={formData.property_address}
                  onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                  className="v3-input w-full"
                  rows="3"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                >
                  Cancel
                </button>
                <button
                  onClick={createContact}
                  className="button-refresh"
                >
                  Create Contact
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Contact Details Modal */}
      {showDetailsModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="dashboard-card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-v3-text-lightest">{selectedContact.name}</h2>
              <div className="flex gap-2">
                {!editMode && (
                  <>
                    <button onClick={openEditMode} className="p-2 hover:bg-v3-bg-darker rounded">
                      <Edit2 className="h-5 w-5 text-v3-text-light" />
                    </button>
                    <button onClick={() => deleteContact(selectedContact.id)} className="p-2 hover:bg-v3-bg-darker rounded">
                      <Trash2 className="h-5 w-5 text-red-600" />
                    </button>
                  </>
                )}
                <button onClick={() => setShowDetailsModal(false)}>
                  <X className="h-6 w-6 text-v3-text-muted" />
                </button>
              </div>
            </div>

            {editMode ? (
              <div className="space-y-4">
                {/* Edit form - same as create */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-v3-text-light mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="v3-input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-v3-text-light mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="v3-input w-full"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                  <button
                    onClick={() => setEditMode(false)}
                    className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={updateContact}
                    className="button-refresh"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Contact Details View */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-v3-text-muted uppercase mb-3">Contact Info</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-v3-text-muted" />
                        <span className="text-v3-text-light">{selectedContact.email}</span>
                      </div>
                      {selectedContact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-v3-text-muted" />
                          <span className="text-v3-text-light">{selectedContact.phone}</span>
                        </div>
                      )}
                      {selectedContact.company_name && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-v3-text-muted" />
                          <span className="text-v3-text-light">{selectedContact.company_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-v3-text-muted uppercase mb-3">Sales Info</h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-v3-text-muted">Type: </span>
                        <span className="text-v3-text-light">{CONTACT_TYPES[selectedContact.contact_type]}</span>
                      </div>
                      <div>
                        <span className="text-v3-text-muted">Stage: </span>
                        <span className="text-v3-text-light">{selectedContact.current_stage}</span>
                      </div>
                      <div>
                        <span className="text-v3-text-muted">Status: </span>
                        <span className={getStatusColor(selectedContact.status)}>{selectedContact.status}</span>
                      </div>
                      {selectedContact.next_followup_date && (
                        <div>
                          <span className="text-v3-text-muted">Follow-up: </span>
                          <span className="text-v3-text-light">{formatDate(selectedContact.next_followup_date)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes Section */}
                <div className="border-t border-v3-bg-card pt-6">
                  <h3 className="text-lg font-semibold text-v3-text-lightest mb-4">Notes & History</h3>

                  <div className="mb-4">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="v3-input w-full"
                      rows="3"
                    />
                    <div className="flex justify-between mt-2">
                      <select
                        value={noteType}
                        onChange={(e) => setNoteType(e.target.value)}
                        className="v3-input"
                      >
                        <option value="internal">Internal Note</option>
                        <option value="call">Phone Call</option>
                        <option value="email">Email</option>
                        <option value="meeting">Meeting</option>
                        <option value="quote_sent">Quote Sent</option>
                      </select>
                      <button onClick={addNote} className="button-refresh">
                        Add Note
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 mt-4">
                    {notes.map((note) => (
                      <div key={note.id} className="p-3 bg-v3-bg-card rounded">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs text-v3-brand uppercase">{note.note_type}</span>
                          <span className="text-xs text-v3-text-muted">{formatDate(note.created_at)}</span>
                        </div>
                        <p className="text-sm text-v3-text-light whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-v3-text-muted mt-1">by {note.creator_name}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
