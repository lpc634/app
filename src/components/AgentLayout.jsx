import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Calendar, Bell, Power, User as UserIcon, FileText as InvoiceIcon, Menu, X, Search, Shield, FileEdit } from 'lucide-react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import '../styles/agent-mobile.css';
import '../styles/agent-grid-fixes.css';
import logo from '../assets/new_logo.png';

const agentNavItems = [
  { name: 'Dashboard', path: '/agent/dashboard', icon: Home },
  { name: 'Vehicle Search', path: '/agent/intelligence', icon: Search },
  { name: 'Availability', path: '/agent/availability', icon: Calendar },
  { name: 'My Invoices', path: '/agent/invoices', icon: InvoiceIcon },
  { name: 'Police Interactions', path: '/agent/police-interactions', icon: Shield },
  { name: 'Job Reports', path: '/agent/reports', icon: ClipboardList },
  { name: 'V3 Job Reports', path: '/agent/v3-reports', icon: FileEdit, badge: 'NEW' },
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
  const location = useLocation();

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
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

  // Body scroll lock
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const handleMenuClick = () => {
    // Small delay to ensure navigation happens first
    setTimeout(() => {
      setMobileMenuOpen(false);
    }, 100);
  };

  return (
    <div className="agent-shell">
      {/* Mobile Header */}
      <div className="agent-mobile-header lg:hidden safe-pt">
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <button 
              className="agent-mobile-menu-button tap-target"
              aria-label="Open navigation menu"
            >
              <Menu size={24} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 max-w-[85vw] p-0 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-v3-border">
              <div className="flex items-center gap-2 min-w-0">
                <img src={logo} alt="Company Name Logo" className="h-8 w-auto max-w-full" />
                <span className="font-semibold text-v3-text-lightest truncate">Agent Portal</span>
              </div>
            </div>

            <div className="flex-1 p-4 space-y-2 overflow-y-auto">
              {agentNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <NavLink
                    key={item.name}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg transition-all tap-target min-w-0 ${
                      isActive
                        ? 'bg-v3-orange text-white'
                        : 'text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest'
                    }`}
                  >
                    <item.icon size={20} className="flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-v3-orange text-white rounded-md flex-shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
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
                onClick={() => { logout(); setMobileMenuOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-900/20 tap-target min-w-0"
              >
                <Power size={20} className="flex-shrink-0" />
                <span className="truncate">Sign Out</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
        <img src={logo} alt="Company Name Logo" className="h-9 w-auto mx-auto max-w-full" />
        <div className="w-11"></div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="agent-sidebar hidden lg:flex">
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
              {item.badge && (
                <span className="ml-auto px-2 py-0.5 text-xs font-semibold bg-v3-orange text-white rounded-md flex-shrink-0">
                  {item.badge}
                </span>
              )}
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
      </aside>

      {/* Main Content */}
      <main className="agent-main">
        <Outlet />
      </main>
    </div>
  );
};

export default AgentLayout;
