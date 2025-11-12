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

  // Telegram link state
  const [telegramLinkCode, setTelegramLinkCode] = useState(null);
  const [telegramBotUsername, setTelegramBotUsername] = useState('V3JobsBot');
  const [telegramLinked, setTelegramLinked] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });
  const [passwordError, setPasswordError] = useState('');

  // Email setup state (for existing users without IMAP)
  const [showEmailSetup, setShowEmailSetup] = useState(false);
  const [emailSetupForm, setEmailSetupForm] = useState({
    imap_server: 'mail.nebula.galaxywebsolutions.com',
    imap_port: '993',
    imap_email: '',
    imap_password: '',
    imap_use_ssl: true
  });
  const [emailSetupError, setEmailSetupError] = useState('');

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

  // Email sync states
  const [syncingEmails, setSyncingEmails] = useState(false);
  const [showEmailsModal, setShowEmailsModal] = useState(false);
  const [selectedContactEmails, setSelectedContactEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);

  // Task states
  const [tasks, setTasks] = useState([]);
  const [todayTasks, setTodayTasks] = useState([]);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    task_type: 'call',
    title: '',
    due_date: '',
    notes: ''
  });
  const [selectedTask, setSelectedTask] = useState(null);

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

  // Quick Actions state
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [showQuickNoteModal, setShowQuickNoteModal] = useState(false);
  const [showStageDropdown, setShowStageDropdown] = useState(false);
  const [logCallFormData, setLogCallFormData] = useState({
    outcome: 'Connected - Positive',
    duration: '',
    notes: '',
    createFollowup: false
  });
  const [quickNoteFormData, setQuickNoteFormData] = useState({
    note_type: 'general',
    content: ''
  });

  // Register page header
  useEffect(() => {
    register('CRM System', 'Manage eviction clients, prevention prospects, and referral partners');
  }, [register]);

  // Close stage dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStageDropdown && !event.target.closest('.stage-dropdown-container')) {
        setShowStageDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showStageDropdown]);

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
          const user = await response.json();
          setCrmUser(user);

          // Check if user needs to set up email
          if (!user.has_email_configured) {
            setShowEmailSetup(true);
          }

          // Check Telegram status
          checkTelegramStatus();

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
      fetchTodayTasks();
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

        // Check Telegram status after login
        checkTelegramStatus();

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

  // Email setup handler (for existing users)
  const handleEmailSetup = async (e) => {
    e.preventDefault();
    setEmailSetupError('');

    const token = localStorage.getItem('crm_token');

    try {
      const response = await fetch('/api/crm/auth/email-settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          imap_server: emailSetupForm.imap_server,
          imap_port: parseInt(emailSetupForm.imap_port),
          imap_email: emailSetupForm.imap_email,
          imap_password: emailSetupForm.imap_password,
          imap_use_ssl: emailSetupForm.imap_use_ssl
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCrmUser(data.user);
        setShowEmailSetup(false);
        toast.success('Email settings saved successfully! You can now sync emails.');
      } else {
        const error = await response.json();
        setEmailSetupError(error.error || 'Failed to save settings');
      }
    } catch (error) {
      setEmailSetupError('Network error - please try again');
    }
  };

  const handleSkipEmailSetup = () => {
    if (confirm('You can set up email tracking later in Settings. Continue without email sync?')) {
      setShowEmailSetup(false);
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
        // Fetch tasks for this contact
        const contactTasks = await fetchContactTasks(contactId);
        setTasks(contactTasks);
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

  // Quick Actions handlers
  const handleLogCall = async () => {
    if (!logCallFormData.notes.trim()) {
      toast.error('Please enter call notes');
      return;
    }

    try {
      const token = localStorage.getItem('crm_token');

      // Create a note with phone_call type and structured content
      const noteContent = `Outcome: ${logCallFormData.outcome}\n${logCallFormData.duration ? `Duration: ${logCallFormData.duration} minutes\n` : ''}Notes: ${logCallFormData.notes}`;

      const response = await fetch(`/api/crm/contacts/${selectedContact.id}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: noteContent,
          note_type: 'call'
        })
      });

      if (response.ok) {
        toast.success('Call logged successfully');
        setShowLogCallModal(false);
        setLogCallFormData({
          outcome: 'Connected - Positive',
          duration: '',
          notes: '',
          createFollowup: false
        });
        fetchContactDetails(selectedContact.id);

        // If user wants to create follow-up task, open task modal
        if (logCallFormData.createFollowup) {
          setShowTaskModal(true);
          setTaskFormData({
            task_type: 'follow_up',
            title: 'Follow-up from call',
            due_date: '',
            notes: `Follow-up from call: ${logCallFormData.outcome}`
          });
        }
      } else {
        toast.error('Failed to log call');
      }
    } catch (error) {
      toast.error('Failed to log call');
    }
  };

  const handleQuickNote = async () => {
    if (!quickNoteFormData.content.trim()) {
      toast.error('Please enter note content');
      return;
    }

    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/contacts/${selectedContact.id}/notes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: quickNoteFormData.content,
          note_type: quickNoteFormData.note_type
        })
      });

      if (response.ok) {
        toast.success('Note added successfully');
        setShowQuickNoteModal(false);
        setQuickNoteFormData({
          note_type: 'general',
          content: ''
        });
        fetchContactDetails(selectedContact.id);
      } else {
        toast.error('Failed to add note');
      }
    } catch (error) {
      toast.error('Failed to add note');
    }
  };

  const handleChangeStage = async (newStage) => {
    try {
      const token = localStorage.getItem('crm_token');
      const response = await fetch(`/api/crm/contacts/${selectedContact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...selectedContact,
          current_stage: newStage
        })
      });

      if (response.ok) {
        toast.success(`Stage changed to ${newStage}`);
        setShowStageDropdown(false);

        // Add a note about the stage change
        await fetch(`/api/crm/contacts/${selectedContact.id}/notes`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            content: `Stage changed to: ${newStage}`,
            note_type: 'internal'
          })
        });

        fetchContactDetails(selectedContact.id);
        fetchContacts();
        fetchDashboard();
      } else {
        toast.error('Failed to change stage');
      }
    } catch (error) {
      toast.error('Failed to change stage');
    }
  };

  // Email sync handlers
  const handleSyncEmails = async (contactId) => {
    const token = localStorage.getItem('crm_token');
    setSyncingEmails(true);

    try {
      const response = await fetch(`/api/crm/contacts/${contactId}/sync-emails`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Sync failed');
      }

      const data = await response.json();
      toast.success(data.message);

      // If emails modal is open, reload emails
      if (showEmailsModal) {
        loadContactEmails(contactId);
      }
    } catch (error) {
      toast.error(`Email sync failed: ${error.message}`);
    } finally {
      setSyncingEmails(false);
    }
  };

  const loadContactEmails = async (contactId) => {
    const token = localStorage.getItem('crm_token');

    try {
      const response = await fetch(`/api/crm/contacts/${contactId}/emails`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error('Failed to load emails');

      const data = await response.json();
      setSelectedContactEmails(data.emails);
    } catch (error) {
      console.error('Error loading emails:', error);
      setSelectedContactEmails([]);
    }
  };

  const handleShowEmails = async (contact) => {
    setSelectedContact(contact);
    setShowEmailsModal(true);
    await loadContactEmails(contact.id);
  };

  // Task handlers
  const fetchTodayTasks = async () => {
    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch('/api/crm/tasks?filter=today', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setTodayTasks(data.tasks);
      }
    } catch (error) {
      console.error('Error fetching today tasks:', error);
    }
  };

  const fetchContactTasks = async (contactId) => {
    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch(`/api/crm/contacts/${contactId}/tasks`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data.tasks;
      }
    } catch (error) {
      console.error('Error fetching contact tasks:', error);
    }
    return [];
  };

  const handleAddTask = (contact) => {
    setSelectedContact(contact);
    setTaskFormData({
      task_type: 'call',
      title: '',
      due_date: '',
      notes: ''
    });
    setSelectedTask(null);
    setShowTaskModal(true);
  };

  const handleSaveTask = async () => {
    if (!taskFormData.title || !taskFormData.due_date) {
      toast.error('Please fill in title and due date');
      return;
    }

    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch('/api/crm/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contact_id: selectedContact.id,
          ...taskFormData
        })
      });

      if (response.ok) {
        toast.success('Task created successfully');
        setShowTaskModal(false);
        fetchTodayTasks();
        fetchContacts(); // Refresh contact list to update task counts
        if (showDetailsModal) {
          // Refresh task list in detail modal
          const tasks = await fetchContactTasks(selectedContact.id);
          setTasks(tasks);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create task');
      }
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleCompleteTask = async (taskId) => {
    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch(`/api/crm/tasks/${taskId}/complete`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      if (response.ok) {
        toast.success('Task completed!');
        fetchTodayTasks();
        fetchContacts(); // Refresh contact list to update task counts
        if (selectedContact) {
          const tasks = await fetchContactTasks(selectedContact.id);
          setTasks(tasks);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to complete task');
        console.error('Complete task error:', error);
      }
    } catch (error) {
      toast.error('Failed to complete task');
      console.error('Complete task exception:', error);
    }
  };

  const handleSnoozeTask = async (taskId, duration) => {
    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch(`/api/crm/tasks/${taskId}/snooze`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ duration })
      });

      if (response.ok) {
        toast.success('Task snoozed');
        fetchTodayTasks();
        fetchContacts(); // Refresh contact list to update task counts
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to snooze task');
        console.error('Snooze task error:', error);
      }
    } catch (error) {
      toast.error('Failed to snooze task');
      console.error('Snooze task exception:', error);
    }
  };

  // Telegram linking functions
  const handleLinkTelegram = async () => {
    const token = localStorage.getItem('crm_token');
    if (!token) {
      toast.error('Please create your account first, then link Telegram');
      return;
    }

    try {
      console.log('Requesting Telegram link code...');
      const response = await fetch('/api/crm/telegram/link/start', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok) {
        setTelegramLinkCode(data.code);
        setTelegramBotUsername(data.bot_username || 'V3JobsBot');

        // Try to open Telegram automatically
        const deepLink = `tg://resolve?domain=${data.bot_username}&start=${data.code}`;

        // Try opening with a small delay
        setTimeout(() => {
          window.location.href = deepLink;
        }, 100);

        toast.success(`Code generated: ${data.code}`);
      } else {
        toast.error(data.error || 'Failed to generate link code');
      }
    } catch (error) {
      console.error('Telegram link error:', error);
      toast.error('Failed to link Telegram: ' + error.message);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');

    // Validate passwords
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('New passwords do not match');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch('/api/crm/auth/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          current_password: passwordForm.current_password,
          new_password: passwordForm.new_password
        })
      });

      if (response.ok) {
        toast.success('Password changed successfully!');
        setPasswordForm({
          current_password: '',
          new_password: '',
          confirm_password: ''
        });
        setShowPasswordChange(false);
      } else {
        const data = await response.json();
        setPasswordError(data.error || 'Failed to change password');
      }
    } catch (error) {
      setPasswordError('Error changing password');
    }
  };

  const checkTelegramStatus = async (showSuccessToast = false) => {
    const token = localStorage.getItem('crm_token');
    try {
      const response = await fetch('/api/crm/telegram/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTelegramLinked(data.linked);
        if (data.linked) {
          setTelegramLinkCode(null);
          if (showSuccessToast) {
            toast.success('Telegram successfully linked!');
          }
        }
      }
    } catch (error) {
      console.error('Failed to check Telegram status');
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
                    onChange={(e) => {
                      const email = e.target.value;
                      setRegisterForm({...registerForm, email: email, imap_email: email});
                    }}
                    className="v3-input w-full"
                    placeholder="john@v3-services.com"
                    required
                  />
                  <p className="text-xs text-v3-text-muted mt-1">Used for login and email sync</p>
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

                <div className="mt-4">
                  <label className="block text-sm font-medium text-v3-text-light mb-2">Email Password *</label>
                  <input
                    type="password"
                    value={registerForm.imap_password}
                    onChange={(e) => setRegisterForm({...registerForm, imap_password: e.target.value})}
                    className="v3-input w-full"
                    placeholder="Your email password"
                    required
                  />
                  <p className="text-xs text-v3-text-muted mt-1">Password for {registerForm.email || 'your email'}</p>
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

              {/* Telegram Notifications Section */}
              <div className="border-t border-gray-700 pt-4 mt-4">
                <h3 className="font-medium text-v3-text-lightest mb-2">Telegram Notifications (Optional)</h3>
                <p className="text-xs text-v3-text-muted mb-3">
                  Receive task reminders via Telegram
                </p>

                {!telegramLinked && !telegramLinkCode && (
                  <button
                    type="button"
                    onClick={handleLinkTelegram}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Link Telegram Account
                  </button>
                )}

                {telegramLinkCode && !telegramLinked && (
                  <div className="p-3 bg-v3-bg-darker rounded border border-blue-600/30">
                    <p className="text-xs text-v3-text-light mb-2">
                      Code: <span className="font-mono font-bold text-blue-400 text-base">{telegramLinkCode}</span>
                    </p>
                    <p className="text-xs text-v3-text-muted mb-2">
                      Open Telegram and send: <span className="font-mono">/start {telegramLinkCode}</span> to @{telegramBotUsername}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <a
                        href={`tg://resolve?domain=${telegramBotUsername}&start=${telegramLinkCode}`}
                        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Open App
                      </a>
                      <a
                        href={`https://t.me/${telegramBotUsername}?start=${telegramLinkCode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs bg-gray-700 text-white rounded hover:bg-gray-600"
                      >
                        Web
                      </a>
                      <button
                        type="button"
                        onClick={checkTelegramStatus}
                        className="px-3 py-1.5 text-xs bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker border border-gray-600"
                      >
                        Check Status
                      </button>
                    </div>
                  </div>
                )}

                {telegramLinked && (
                  <div className="flex items-center gap-2 p-2 bg-green-600/20 border border-green-600/30 rounded">
                    <span className="text-green-400 text-sm">✓</span>
                    <span className="text-xs text-green-400">Linked successfully!</span>
                  </div>
                )}
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

  // Show email setup modal for existing users without IMAP
  if (showEmailSetup) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="dashboard-card max-w-2xl w-full">
          <h2 className="text-2xl font-bold text-v3-text-lightest mb-2">Email Configuration Required</h2>
          <p className="text-v3-text-muted mb-6">
            Set up your email to track conversations with contacts
          </p>

          <form onSubmit={handleEmailSetup} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Server *</label>
                <input
                  type="text"
                  value={emailSetupForm.imap_server}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_server: e.target.value})}
                  className="v3-input w-full"
                  placeholder="mail.yourserver.com"
                  required
                />
                <p className="text-xs text-v3-text-muted mt-1">Usually mail.yourcompany.com</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">IMAP Port *</label>
                <input
                  type="number"
                  value={emailSetupForm.imap_port}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_port: e.target.value})}
                  className="v3-input w-full"
                  placeholder="993"
                  required
                />
                <p className="text-xs text-v3-text-muted mt-1">Usually 993 (SSL) or 143</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Your Email Address *</label>
                <input
                  type="email"
                  value={emailSetupForm.imap_email}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_email: e.target.value})}
                  className="v3-input w-full"
                  placeholder={`${crmUser?.username}@v3-services.com`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-v3-text-light mb-2">Email Password *</label>
                <input
                  type="password"
                  value={emailSetupForm.imap_password}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_password: e.target.value})}
                  className="v3-input w-full"
                  placeholder="Your email password"
                  required
                />
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={emailSetupForm.imap_use_ssl}
                  onChange={(e) => setEmailSetupForm({...emailSetupForm, imap_use_ssl: e.target.checked})}
                  className="w-4 h-4"
                />
                <span className="text-sm text-v3-text-light">Use SSL/TLS (recommended)</span>
              </label>
            </div>

            {emailSetupError && (
              <div className="p-3 bg-red-500/20 border border-red-500 rounded text-red-400 text-sm">
                {emailSetupError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 button-refresh"
              >
                Save Email Settings
              </button>

              <button
                type="button"
                onClick={handleSkipEmailSetup}
                className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker transition-colors"
              >
                Skip for Now
              </button>
            </div>

            <p className="text-xs text-v3-text-muted text-center">
              Your credentials are securely stored. You can update these later in Settings.
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container px-6">
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
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowSettingsModal(true);
                checkTelegramStatus();
              }}
              className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker transition-colors"
            >
              Settings
            </button>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      )}

      {/* Dashboard Stats */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <div className="dashboard-card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-xs mb-1">Follow-ups Today</p>
                <p className="text-xl font-bold text-v3-brand">{dashboard.followups_today}</p>
              </div>
              <Calendar className="h-6 w-6 text-v3-brand opacity-50" />
            </div>
          </div>

          <div className="dashboard-card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-xs mb-1">Overdue Follow-ups</p>
                <p className="text-xl font-bold text-red-600">{dashboard.overdue_followups}</p>
              </div>
              <AlertCircle className="h-6 w-6 text-red-600 opacity-50" />
            </div>
          </div>

          <div className="dashboard-card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-xs mb-1">Quotes Pending</p>
                <p className="text-xl font-bold text-yellow-600">{dashboard.quotes_pending}</p>
              </div>
              <FileText className="h-6 w-6 text-yellow-600 opacity-50" />
            </div>
          </div>

          <div className="dashboard-card !p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-v3-text-muted text-xs mb-1">Potential Revenue</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dashboard.potential_revenue)}</p>
              </div>
              <DollarSign className="h-6 w-6 text-green-600 opacity-50" />
            </div>
          </div>
        </div>
      )}

      {/* My Tasks Today Widget */}
      {todayTasks.length > 0 && (
        <div className="dashboard-card mb-6">
          <h3 className="text-lg font-semibold text-v3-text-lightest mb-4">⏰ My Tasks Today ({todayTasks.length})</h3>
          <div className="space-y-2">
            {todayTasks.slice(0, 5).map((task) => (
              <div key={task.id} className="flex items-center justify-between p-3 bg-v3-bg-darker rounded">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs rounded ${task.is_overdue ? 'bg-red-600/20 text-red-400' : 'bg-yellow-600/20 text-yellow-400'}`}>
                      {task.task_type}
                    </span>
                    <span className="text-v3-text-lightest">{task.title}</span>
                  </div>
                  <p className="text-sm text-v3-text-muted mt-1">{task.contact_name} • Due: {new Date(task.due_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCompleteTask(task.id)}
                    className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    ✓ Complete
                  </button>
                  <button
                    onClick={() => handleSnoozeTask(task.id, '1hour')}
                    className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                  >
                    Snooze 1h
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="dashboard-card !p-3 mb-4">
        <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setView('my')}
              className={`px-3 py-1.5 text-sm rounded ${view === 'my' ? 'bg-v3-brand text-white' : 'bg-v3-bg-darker text-v3-text-light'}`}
            >
              My Contacts
            </button>
            {crmUser?.is_super_admin && (
              <button
                onClick={() => setView('team')}
                className={`px-3 py-1.5 text-sm rounded ${view === 'team' ? 'bg-v3-brand text-white' : 'bg-v3-bg-darker text-v3-text-light'}`}
              >
                Team View
              </button>
            )}
          </div>

          <div className="flex flex-wrap gap-2 flex-1 justify-end">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="v3-input text-sm py-1.5"
            >
              <option value="all">All Types</option>
              {Object.entries(CONTACT_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="v3-input text-sm py-1.5"
            >
              <option value="all">Active</option>
              {CONTACT_STATUS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-v3-text-muted" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="v3-input text-sm py-1.5 pl-8 w-48"
              />
            </div>

            <button
              onClick={() => setShowContactModal(true)}
              className="px-3 py-1.5 text-sm bg-v3-brand text-white rounded hover:bg-v3-brand/80 flex items-center gap-1.5 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Contact
            </button>
          </div>
        </div>
      </div>

      {/* Contacts List */}
      <div className="dashboard-card !p-4">
        {loading ? (
          <p className="text-center text-v3-text-muted py-6">Loading contacts...</p>
        ) : contacts.length === 0 ? (
          <p className="text-center text-v3-text-muted py-6">No contacts found</p>
        ) : (
          <div className="space-y-3">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => fetchContactDetails(contact.id)}
                className="p-5 bg-v3-bg-card rounded-lg hover:bg-v3-bg-darker cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-lg font-semibold text-v3-text-lightest">{contact.name}</h3>
                      <span className="px-2.5 py-1 bg-v3-brand/20 text-v3-brand text-xs rounded font-medium">
                        {CONTACT_TYPES[contact.contact_type]}
                      </span>
                      <span className={`px-2.5 py-1 text-xs rounded font-medium ${getStatusColor(contact.status)}`}>
                        {contact.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-v3-text-light mb-4">
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 flex-shrink-0" />
                          <span>{contact.phone}</span>
                        </div>
                      )}
                      {contact.company_name && (
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{contact.company_name}</span>
                        </div>
                      )}
                      {contact.next_followup_date && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 flex-shrink-0" />
                          <span>Follow-up: {formatDate(contact.next_followup_date)}</span>
                        </div>
                      )}
                    </div>

                    {contact.potential_value && (
                      <div className="mb-4 text-sm">
                        <span className="text-v3-text-muted">Potential: </span>
                        <span className="font-semibold text-green-600">{formatCurrency(contact.potential_value)}</span>
                      </div>
                    )}

                    {/* Email sync buttons */}
                    <div className="flex gap-3 mt-5 pt-4 border-t border-gray-700">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSyncEmails(contact.id);
                        }}
                        disabled={syncingEmails || !crmUser?.has_email_configured}
                        className="flex-1 px-4 py-2.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {syncingEmails ? 'Syncing...' : '📧 Sync Emails'}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShowEmails(contact);
                        }}
                        className="flex-1 px-4 py-2.5 text-sm font-medium bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        📨 View Emails ({contact.email_count || 0})
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddTask(contact);
                        }}
                        className="flex-1 px-4 py-2.5 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        ⏰ Add Task {contact.task_count > 0 && `(${contact.task_count})`}
                      </button>
                    </div>
                  </div>

                  <Eye className="h-5 w-5 text-v3-text-muted flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="dashboard-card max-w-2xl w-full my-8">
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
          <div className="dashboard-card max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-v3-text-lightest">{selectedContact.name}</h2>
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
                {/* Quick Actions Bar */}
                <div className="sticky top-0 bg-v3-bg-card border-b border-v3-bg-darker p-4 -mx-6 mb-6 z-10">
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={() => setShowLogCallModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      <Phone className="h-4 w-4" />
                      Log Call
                    </button>
                    <button
                      onClick={() => handleAddTask(selectedContact)}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Add Task
                    </button>
                    <button
                      onClick={() => setShowQuickNoteModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <FileText className="h-4 w-4" />
                      Quick Note
                    </button>
                    <div className="relative stage-dropdown-container">
                      <button
                        onClick={() => setShowStageDropdown(!showStageDropdown)}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
                      >
                        <TrendingUp className="h-4 w-4" />
                        Change Stage
                      </button>
                      {showStageDropdown && (
                        <div className="absolute top-full mt-1 left-0 bg-v3-bg-darker border border-v3-bg-card rounded shadow-lg z-20 min-w-[200px]">
                          <div className="p-2 border-b border-v3-bg-card text-xs text-v3-text-muted">
                            Current: {selectedContact.current_stage}
                          </div>
                          <div className="max-h-64 overflow-y-auto">
                            {(selectedContact.contact_type === 'eviction_client' ? EVICTION_STAGES : PREVENTION_STAGES).map((stage) => (
                              <button
                                key={stage.value}
                                onClick={() => handleChangeStage(stage.value)}
                                className={`w-full text-left px-4 py-2 hover:bg-v3-bg-card text-sm ${
                                  selectedContact.current_stage === stage.value
                                    ? 'text-v3-brand font-semibold'
                                    : 'text-v3-text-light'
                                }`}
                              >
                                {stage.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

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

                {/* Tasks Section */}
                <div className="border-t border-v3-bg-card pt-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-v3-text-lightest">Tasks</h3>
                    <button
                      onClick={() => handleAddTask(selectedContact)}
                      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
                    >
                      + Add Task
                    </button>
                  </div>

                  <div className="space-y-2 mb-6">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-v3-text-muted text-center py-4">No tasks for this contact</p>
                    ) : (
                      tasks.map((task) => (
                        <div key={task.id} className="p-3 bg-v3-bg-card rounded">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2 py-0.5 text-xs rounded ${
                                  task.status === 'completed'
                                    ? 'bg-green-600/20 text-green-400'
                                    : task.is_overdue
                                    ? 'bg-red-600/20 text-red-400'
                                    : 'bg-blue-600/20 text-blue-400'
                                }`}>
                                  {task.task_type}
                                </span>
                                <span className="text-sm font-semibold text-v3-text-lightest">{task.title}</span>
                                {task.status === 'completed' && (
                                  <span className="text-xs text-green-400">✓ Completed</span>
                                )}
                              </div>
                              <p className="text-xs text-v3-text-muted">
                                Due: {new Date(task.due_date).toLocaleString()}
                              </p>
                              {task.notes && (
                                <p className="text-xs text-v3-text-light mt-1">{task.notes}</p>
                              )}
                            </div>
                            {task.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleCompleteTask(task.id)}
                                  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  Complete
                                </button>
                                <button
                                  onClick={() => handleSnoozeTask(task.id, '1hour')}
                                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                                >
                                  Snooze
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
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

      {/* Emails Modal */}
      {showEmailsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="dashboard-card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-v3-text-lightest">
                Emails - {selectedContact?.name}
              </h2>
              <button onClick={() => {
                setShowEmailsModal(false);
                setSelectedEmail(null);
              }}>
                <X className="h-6 w-6 text-v3-text-muted" />
              </button>
            </div>

            {/* Sync button */}
            <div className="mb-4">
              <button
                onClick={() => handleSyncEmails(selectedContact.id)}
                disabled={syncingEmails}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {syncingEmails ? 'Syncing...' : '🔄 Sync Now'}
              </button>
            </div>

            {selectedEmail ? (
              /* Email detail view */
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="text-v3-brand hover:underline mb-4"
                >
                  ← Back to list
                </button>

                <div className="bg-v3-bg-card p-4 rounded space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-v3-text-lightest">
                      {selectedEmail.subject}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded ${
                      selectedEmail.is_sent
                        ? 'bg-green-600/20 text-green-400'
                        : 'bg-blue-600/20 text-blue-400'
                    }`}>
                      {selectedEmail.is_sent ? 'Sent' : 'Received'}
                    </span>
                  </div>

                  <div className="text-sm text-v3-text-light space-y-1">
                    <div><strong>From:</strong> {selectedEmail.sender}</div>
                    <div><strong>To:</strong> {selectedEmail.recipient}</div>
                    <div><strong>Date:</strong> {new Date(selectedEmail.date).toLocaleString()}</div>
                  </div>

                  <div className="border-t border-v3-bg-darker pt-4">
                    {selectedEmail.body_html ? (
                      <div
                        className="prose prose-invert max-w-none"
                        dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                      />
                    ) : (
                      <pre className="whitespace-pre-wrap text-v3-text-light font-sans">
                        {selectedEmail.body_text || '(No content)'}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Email list view */
              <div className="space-y-2">
                {selectedContactEmails.length === 0 ? (
                  <p className="text-center text-v3-text-muted py-8">
                    No emails found. Click "Sync Now" to fetch emails.
                  </p>
                ) : (
                  selectedContactEmails.map((email) => (
                    <div
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className="p-4 bg-v3-bg-card rounded hover:bg-v3-bg-darker cursor-pointer transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`px-2 py-1 text-xs rounded ${
                              email.is_sent
                                ? 'bg-green-600/20 text-green-400'
                                : 'bg-blue-600/20 text-blue-400'
                            }`}>
                              {email.is_sent ? 'Sent' : 'Received'}
                            </span>
                            <h4 className="font-semibold text-v3-text-lightest">
                              {email.subject}
                            </h4>
                          </div>
                          <div className="text-sm text-v3-text-muted">
                            {email.is_sent ? `To: ${email.recipient}` : `From: ${email.sender}`}
                          </div>
                          <p className="text-sm text-v3-text-light mt-2 line-clamp-2">
                            {email.preview}
                          </p>
                        </div>
                        <div className="text-xs text-v3-text-muted whitespace-nowrap">
                          {new Date(email.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="dashboard-card max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-v3-text-lightest">
                Add Task for {selectedContact.name}
              </h2>
              <button onClick={() => setShowTaskModal(false)}>
                <X className="h-6 w-6 text-v3-text-muted" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Task Type *</label>
                <select
                  value={taskFormData.task_type}
                  onChange={(e) => setTaskFormData({ ...taskFormData, task_type: e.target.value })}
                  className="v3-input w-full"
                >
                  <option value="call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="send_docs">Send Documents</option>
                  <option value="site_visit">Site Visit</option>
                  <option value="follow_up">Follow-up</option>
                  <option value="general">General Task</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-v3-text-light mb-1">Title *</label>
                <input
                  type="text"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder="e.g., Call about quote follow-up"
                  className="v3-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-v3-text-light mb-1">Due Date & Time *</label>
                <input
                  type="datetime-local"
                  value={taskFormData.due_date}
                  onChange={(e) => setTaskFormData({ ...taskFormData, due_date: e.target.value })}
                  className="v3-input w-full"
                />
              </div>

              <div>
                <label className="block text-sm text-v3-text-light mb-1">Notes</label>
                <textarea
                  value={taskFormData.notes}
                  onChange={(e) => setTaskFormData({ ...taskFormData, notes: e.target.value })}
                  placeholder="Additional details..."
                  className="v3-input w-full"
                  rows="4"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTask}
                  className="button-refresh"
                >
                  Create Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      {showLogCallModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="dashboard-card max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-v3-text-lightest">
                Log Call - {selectedContact.name}
              </h2>
              <button onClick={() => setShowLogCallModal(false)}>
                <X className="h-6 w-6 text-v3-text-muted" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Call Outcome *</label>
                <select
                  value={logCallFormData.outcome}
                  onChange={(e) => setLogCallFormData({ ...logCallFormData, outcome: e.target.value })}
                  className="v3-input w-full"
                >
                  <option value="Connected - Positive">Connected - Positive</option>
                  <option value="Connected - Needs follow-up">Connected - Needs follow-up</option>
                  <option value="Voicemail left">Voicemail left</option>
                  <option value="No answer">No answer</option>
                  <option value="Wrong number">Wrong number</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-v3-text-light mb-1">Duration (minutes)</label>
                <input
                  type="number"
                  value={logCallFormData.duration}
                  onChange={(e) => setLogCallFormData({ ...logCallFormData, duration: e.target.value })}
                  placeholder="Optional"
                  className="v3-input w-full"
                  min="0"
                />
              </div>

              <div>
                <label className="block text-sm text-v3-text-light mb-1">Call Notes *</label>
                <textarea
                  value={logCallFormData.notes}
                  onChange={(e) => setLogCallFormData({ ...logCallFormData, notes: e.target.value })}
                  placeholder="What was discussed..."
                  className="v3-input w-full"
                  rows="5"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="createFollowup"
                  checked={logCallFormData.createFollowup}
                  onChange={(e) => setLogCallFormData({ ...logCallFormData, createFollowup: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="createFollowup" className="text-sm text-v3-text-light cursor-pointer">
                  Create follow-up task after saving
                </label>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowLogCallModal(false)}
                  className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLogCall}
                  className="button-refresh"
                >
                  Save Call Log
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Note Modal */}
      {showQuickNoteModal && selectedContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="dashboard-card max-w-2xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-v3-text-lightest">
                Quick Note - {selectedContact.name}
              </h2>
              <button onClick={() => setShowQuickNoteModal(false)}>
                <X className="h-6 w-6 text-v3-text-muted" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-v3-text-light mb-1">Note Type *</label>
                <select
                  value={quickNoteFormData.note_type}
                  onChange={(e) => setQuickNoteFormData({ ...quickNoteFormData, note_type: e.target.value })}
                  className="v3-input w-full"
                >
                  <option value="general">General</option>
                  <option value="call">Phone Call</option>
                  <option value="email">Email</option>
                  <option value="meeting">Meeting</option>
                  <option value="internal">Internal Note</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-v3-text-light mb-1">Note Content *</label>
                <textarea
                  value={quickNoteFormData.content}
                  onChange={(e) => setQuickNoteFormData({ ...quickNoteFormData, content: e.target.value })}
                  placeholder="Enter your note here..."
                  className="v3-input w-full"
                  rows="8"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowQuickNoteModal(false)}
                  className="px-4 py-2 bg-v3-bg-card text-v3-text-light rounded hover:bg-v3-bg-darker"
                >
                  Cancel
                </button>
                <button
                  onClick={handleQuickNote}
                  className="button-refresh"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.7)'}}>
          <div className="dashboard-card max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-v3-text-lightest">CRM Settings</h2>
              <button
                onClick={() => {
                  setShowSettingsModal(false);
                  setTelegramLinkCode(null);
                }}
                className="text-v3-text-muted hover:text-v3-text-lightest"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Telegram Settings Section */}
              <div>
                <h3 className="font-medium text-v3-text-lightest mb-2">Telegram Notifications</h3>
                <p className="text-xs text-v3-text-muted mb-4">
                  Receive task reminders and updates via Telegram
                </p>

                {telegramLinked ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-400 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      <span>Telegram account linked</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          const token = localStorage.getItem('crm_token');
                          const response = await fetch('/api/crm/telegram/test', {
                            method: 'POST',
                            headers: {
                              'Authorization': `Bearer ${token}`,
                              'Content-Type': 'application/json'
                            }
                          });

                          if (response.ok) {
                            toast.success('Test notification sent!');
                          } else {
                            toast.error('Failed to send test notification');
                          }
                        }}
                        className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Send Test Notification
                      </button>

                      <button
                        onClick={async () => {
                          if (confirm('Are you sure you want to disconnect Telegram?')) {
                            const token = localStorage.getItem('crm_token');
                            const response = await fetch('/api/crm/telegram/disconnect', {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json'
                              }
                            });

                            if (response.ok) {
                              setTelegramLinked(false);
                              toast.success('Telegram disconnected');
                            } else {
                              toast.error('Failed to disconnect Telegram');
                            }
                          }
                        }}
                        className="px-3 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                ) : telegramLinkCode ? (
                  <div className="space-y-3">
                    <div className="bg-v3-bg-darker p-4 rounded">
                      <p className="text-sm text-v3-text-light mb-2">Your linking code:</p>
                      <p className="text-3xl font-bold text-v3-brand text-center tracking-wider">{telegramLinkCode}</p>
                    </div>

                    <div className="text-sm text-v3-text-muted">
                      <p className="mb-2">To link your Telegram account:</p>
                      <ol className="list-decimal list-inside space-y-1 text-xs">
                        <li>Open Telegram and search for <span className="text-v3-brand font-mono">@{telegramBotUsername}</span></li>
                        <li>Send the message: <span className="text-v3-brand font-mono">/link {telegramLinkCode}</span></li>
                        <li>Wait for confirmation</li>
                      </ol>
                    </div>

                    <button
                      onClick={() => {
                        window.open(`tg://resolve?domain=${telegramBotUsername}&start=link_${telegramLinkCode}`, '_blank');
                      }}
                      className="w-full px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Open in Telegram
                    </button>

                    <button
                      onClick={() => {
                        checkTelegramStatus(true);
                      }}
                      className="w-full px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Check if Linked
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleLinkTelegram}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Link Telegram Account
                  </button>
                )}
              </div>

              {/* Email Settings Section */}
              <div className="pt-4 border-t border-v3-bg-card">
                <h3 className="font-medium text-v3-text-lightest mb-2">Email Sync Settings</h3>
                <p className="text-xs text-v3-text-muted mb-4">
                  Configure IMAP to sync emails with your contacts
                </p>
                <button
                  onClick={() => {
                    setShowSettingsModal(false);
                    setShowEmailSetup(true);
                  }}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  {crmUser?.has_email_configured ? 'Update Email Settings' : 'Setup Email Sync'}
                </button>
              </div>

              {/* Password Change Section */}
              <div className="pt-4 border-t border-v3-bg-card">
                <h3 className="font-medium text-v3-text-lightest mb-2">Change Password</h3>
                <p className="text-xs text-v3-text-muted mb-4">
                  Update your account password
                </p>

                {!showPasswordChange ? (
                  <button
                    onClick={() => {
                      setShowPasswordChange(true);
                      setPasswordError('');
                    }}
                    className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                  >
                    Change Password
                  </button>
                ) : (
                  <form onSubmit={handleChangePassword} className="space-y-3">
                    <div>
                      <label className="block text-xs text-v3-text-light mb-1">Current Password *</label>
                      <input
                        type="password"
                        value={passwordForm.current_password}
                        onChange={(e) => setPasswordForm({...passwordForm, current_password: e.target.value})}
                        className="v3-input w-full text-sm"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-v3-text-light mb-1">New Password *</label>
                      <input
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm({...passwordForm, new_password: e.target.value})}
                        className="v3-input w-full text-sm"
                        placeholder="Min 8 characters"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-v3-text-light mb-1">Confirm New Password *</label>
                      <input
                        type="password"
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm({...passwordForm, confirm_password: e.target.value})}
                        className="v3-input w-full text-sm"
                        required
                      />
                    </div>

                    {passwordError && (
                      <p className="text-red-400 text-xs">{passwordError}</p>
                    )}

                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                      >
                        Update Password
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowPasswordChange(false);
                          setPasswordForm({
                            current_password: '',
                            new_password: '',
                            confirm_password: ''
                          });
                          setPasswordError('');
                        }}
                        className="px-4 py-2 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Account Info Section */}
              <div className="pt-4 border-t border-v3-bg-card">
                <h3 className="font-medium text-v3-text-lightest mb-2">Account Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-v3-text-muted">Username:</span>
                    <span className="text-v3-text-light">{crmUser?.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-v3-text-muted">Email:</span>
                    <span className="text-v3-text-light">{crmUser?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-v3-text-muted">Role:</span>
                    <span className="text-v3-text-light">{crmUser?.is_super_admin ? 'Super Admin' : 'User'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
