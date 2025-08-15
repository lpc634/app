import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Calendar, Bell, Briefcase, Power, User as UserIcon, FileText as InvoiceIcon, Menu, X, Search } from 'lucide-react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import '../styles/agent-mobile.css';
import logo from '../assets/new_logo.png';

const agentNavItems = [
  { name: 'Dashboard', path: '/agent/dashboard', icon: Home },
  { name: 'Vehicle Search', path: '/agent/intelligence', icon: Search },

  { name: 'Availability', path: '/agent/availability', icon: Calendar },
  { name: 'My Invoices', path: '/agent/invoices', icon: InvoiceIcon },
  { name: 'Job Reports', path: '/agent/reports', icon: ClipboardList },
  { name: 'Notifications', path: '/agent/notifications', icon: Bell },
  { name: 'My Profile', path: '/agent/profile', icon: UserIcon },
];

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const AgentLayout = () => {
  const { logout, apiCall, user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); // <-- FIX: Added useLocation hook

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]); // <-- FIX: Now works correctly

  // Push notifications setup
  useEffect(() => {
    if (loading || !user) return;

    const setupNotifications = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return;
      
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        try {
          const vapidPublicKey = 'BCVp6sM-3kVT43iVnAUrkXYc2gVdofIMc3tB4p7Q2Qv5G2b5P2iRzBEe-s2w9i5n-8T0aHkXyGNIk2N8yA9fUo8=';
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
          });

          await apiCall('/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
          });

          toast.success("Notifications Enabled!");
        } catch (error) {
          console.error('Push notification error:', error);
        }
      }
    };
    
    setupNotifications();
  }, [apiCall, user, loading]);

  const handleMenuClick = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  // Add body class to prevent scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup on unmount
    return () => document.body.classList.remove('modal-open');
  }, [mobileMenuOpen]);

  return (
    <div className="agent-mobile-container min-h-screen-ios prevent-horizontal-scroll">
      {/* Mobile Header with Safe Area */}
      <div className="agent-mobile-header lg:hidden safe-pt">
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="agent-mobile-menu-button tap-target"
          aria-label="Open navigation menu"
        >
          <Menu size={24} />
        </button>
        <img src={logo} alt="Company Name Logo" className="h-9 w-auto mx-auto max-w-full" />
        <div className="w-11"></div>
      </div>

      {/* Mobile Menu Overlay */}
      <div className={`agent-mobile-menu-overlay lg:hidden ${mobileMenuOpen ? 'active' : ''}`}>
        <div 
          className="agent-mobile-menu-backdrop"
          onClick={() => setMobileMenuOpen(false)}
        />
        <div className={`agent-mobile-menu-panel ${mobileMenuOpen ? 'active' : ''} safe-pt safe-pb`}>
          <div className="agent-mobile-menu-header">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 bg-gradient-to-r from-v3-orange to-v3-orange-dark rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="font-bold text-white text-lg">V3</span>
              </div>
              <span className="font-semibold text-v3-text-lightest truncate">Agent Portal</span>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="agent-mobile-menu-close tap-target"
              aria-label="Close navigation menu"
            >
              <X size={24} />
            </button>
          </div>

          <div className="agent-mobile-menu-items">
            {agentNavItems.map((item, index) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.name}
                  onClick={() => handleMenuClick(item.path)}
                  className={`agent-mobile-menu-item tap-target ${isActive ? 'active' : ''}`}
                  role="menuitem"
                  tabIndex={mobileMenuOpen ? 0 : -1}
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-v3-border">
            <div className="flex items-center gap-3 mb-4 px-2 min-w-0">
              <div className="w-10 h-10 bg-v3-orange rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-v3-text-lightest truncate">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-v3-text-muted truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="agent-mobile-button agent-mobile-button-danger w-full tap-target"
            >
              <Power size={20} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Desktop Sidebar - Hidden on mobile, shown on large screens */}
      <div className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 bg-v3-bg-card border-r border-v3-border flex-col">
        <div className="h-16 flex items-center px-4 border-b border-v3-border">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="Company Name Logo" className="h-8 w-auto max-w-full" />
            <span className="font-semibold text-v3-text-lightest truncate">Agent Portal</span>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {agentNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-lg transition-all tap-target min-w-0 ${
                  isActive
                    ? 'bg-v3-orange text-white'
                    : 'text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest'
                }`
              }
            >
              <item.icon size={20} className="flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
          ))}
        </div>

        <div className="p-4 border-t border-v3-border">
          <div className="flex items-center gap-3 mb-4 px-2 min-w-0">
            <div className="w-10 h-10 bg-v3-orange rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-v3-text-lightest truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-v3-text-muted truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-900/20 tap-target min-w-0"
          >
            <Power size={20} className="flex-shrink-0" />
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </div>

      {/* Main Content with Safe Area */}
      <main className="agent-mobile-main lg:ml-64 lg:pt-0 safe-pb min-h-screen-ios w-full max-w-full overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
};

export default AgentLayout;