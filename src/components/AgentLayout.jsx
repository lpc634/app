import React, { useEffect, useState, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Calendar, Bell, Briefcase, Power, User as UserIcon, FileText as InvoiceIcon, Menu, X, Search } from 'lucide-react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import '../styles/agent-mobile.css';
import '../styles/agent-grid-fixes.css';
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
  const location = useLocation();
  const triggerRef = useRef(null); // hamburger button ref

  // Close mobile menu when route changes with focus return
  useEffect(() => {
    if (mobileMenuOpen) {
      setMobileMenuOpen(false);
      // return focus to hamburger for accessibility
      setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, [location.pathname]);

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

  // ESC key to close drawer
  useEffect(() => {
    function onKey(e) { 
      if (e.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileMenuOpen]);

  // Body scroll-lock when menu is open
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", mobileMenuOpen);
    return () => document.body.classList.remove("overflow-hidden");
  }, [mobileMenuOpen]);

  return (
    <div className="agent-shell">
      {/* Mobile Header with Safe Area */}
      <div className="agent-mobile-header lg:hidden safe-pt">
        <button 
          ref={triggerRef}
          onClick={() => setMobileMenuOpen(true)}
          className="agent-mobile-menu-button tap-target"
          aria-label="Open navigation menu"
        >
          <Menu size={24} />
        </button>
        <img src={logo} alt="Company Name Logo" className="h-9 w-auto mx-auto max-w-full" />
        <div className="w-11"></div>
      </div>

      {/* Backdrop (mobile only) */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity lg:hidden ${
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileMenuOpen(false)}
        aria-hidden
      />

      {/* Drawer sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[320px] max-w-[85vw] bg-v3-bg-card transition-transform duration-300 will-change-transform transform-none lg:static lg:translate-x-0 lg:w-[var(--sidebar-w)] ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        } lg:flex lg:flex-col`}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        style={{ '--sidebar-w': '256px' }}
      >
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-v3-border safe-pt lg:safe-pt-0">
          <div className="flex items-center gap-2 min-w-0">
            <img src={logo} alt="Company Name Logo" className="h-8 w-auto max-w-full" />
            <span className="font-semibold text-v3-text-lightest truncate">Agent Portal</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 rounded-lg hover:bg-v3-bg-dark tap-target lg:hidden"
            aria-label="Close navigation menu"
          >
            <X size={24} className="text-v3-text-muted" />
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 p-4 space-y-2 overflow-y-auto">
          {agentNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.name}
                onClick={() => handleMenuClick(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all tap-target min-w-0 ${
                  isActive
                    ? 'bg-v3-orange text-white'
                    : 'text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest'
                }`}
                role="menuitem"
                tabIndex={mobileMenuOpen ? 0 : -1}
              >
                <item.icon size={20} className="flex-shrink-0" />
                <span className="truncate">{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* User Profile Section */}
        <div className="p-4 border-t border-v3-border safe-pb lg:safe-pb-0">
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
      </aside>


      {/* Main Content */}
      <main className="agent-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AgentLayout;