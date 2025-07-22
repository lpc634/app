import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, ClipboardList, Calendar, Bell, Briefcase, Power, User as UserIcon, FileText as InvoiceIcon, Menu, X, Search } from 'lucide-react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';

const agentNavItems = [
  { name: 'Dashboard', path: '/agent/dashboard', icon: Home },
  { name: 'Vehicle Search', path: '/agent/intelligence', icon: Search },
  { name: 'Available Jobs', path: '/agent/jobs', icon: Briefcase },
  { name: 'Availability', path: '/agent/availability', icon: Calendar },
  { name: 'My Invoices', path: '/agent/invoices', icon: InvoiceIcon },
  { name: 'Job Reports', path: '/agent/reports', icon: ClipboardList },
  { name: 'Notifications', path: '/agent/notifications', icon: Bell },
  { name: 'My Profile', path: '/agent/profile', icon: UserIcon },
];

// VAPID function
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

  const handleMenuClick = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-v3-bg-darkest">
      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 bg-v3-bg-card border-b border-v3-border z-50 h-16 flex items-center px-4">
        <button 
          onClick={() => setMobileMenuOpen(true)}
          className="text-v3-text-lightest"
        >
          <Menu size={24} />
        </button>
        <div className="flex-1 text-center text-v3-text-lightest font-semibold">
          V3 Agent Portal
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-80 bg-v3-bg-card border-r border-v3-border">
            {/* Mobile Menu Header */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-v3-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-v3-orange to-v3-orange-dark rounded-lg flex items-center justify-center">
                  <span className="font-bold text-white text-lg">V3</span>
                </div>
                <span className="font-semibold text-v3-text-lightest">Agent Portal</span>
              </div>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="text-v3-text-muted"
              >
                <X size={24} />
              </button>
            </div>

            {/* Mobile Menu Items */}
            <div className="p-4 space-y-2">
              {agentNavItems.map((item) => (
                <button
                  key={item.name}
                  onClick={() => handleMenuClick(item.path)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest transition-all"
                >
                  <item.icon size={20} />
                  {item.name}
                </button>
              ))}
            </div>

            {/* Mobile User Section */}
            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-v3-border">
              <div className="flex items-center gap-3 mb-4 px-2">
                <div className="w-10 h-10 bg-v3-orange rounded-full flex items-center justify-center text-white font-bold">
                  {user?.first_name?.[0]}{user?.last_name?.[0]}
                </div>
                <div>
                  <p className="text-sm font-medium text-v3-text-lightest">{user?.first_name} {user?.last_name}</p>
                  <p className="text-xs text-v3-text-muted">{user?.email}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-900/20"
              >
                <Power size={20} />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden md:block fixed left-0 top-0 bottom-0 w-64 bg-v3-bg-card border-r border-v3-border">
        <div className="h-16 flex items-center px-4 border-b border-v3-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-v3-orange to-v3-orange-dark rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-lg">V3</span>
            </div>
            <span className="font-semibold text-v3-text-lightest">Agent Portal</span>
          </div>
        </div>

        <div className="p-4 space-y-2">
          {agentNavItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-v3-orange text-white'
                    : 'text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest'
                }`
              }
            >
              <item.icon size={20} />
              {item.name}
            </NavLink>
          ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-v3-border">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-10 h-10 bg-v3-orange rounded-full flex items-center justify-center text-white font-bold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div>
              <p className="text-sm font-medium text-v3-text-lightest">{user?.first_name} {user?.last_name}</p>
              <p className="text-xs text-v3-text-muted">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-900/20"
          >
            <Power size={20} />
            Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="md:ml-64 pt-16 md:pt-0">
        <Outlet />
      </div>
    </div>
  );
};

export default AgentLayout;