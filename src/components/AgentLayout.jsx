import React, { useEffect, useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
// --- 1. IMPORT THE SEARCH ICON AND MENU ICON ---
import { Home, ClipboardList, Calendar, Bell, Briefcase, Power, User as UserIcon, FileText as InvoiceIcon, Search as SearchIcon, Menu } from 'lucide-react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';

const agentNavItems = [
  { name: 'Dashboard', path: '/agent/dashboard', icon: Home },
  // --- 2. ADD THE NEW NAVIGATION LINK HERE ---
  { name: 'Vehicle Search', path: '/agent/vehicle-search', icon: SearchIcon },
  { name: 'Available Jobs', path: '/agent/jobs', icon: Briefcase },
  { name: 'Availability', path: '/agent/availability', icon: Calendar },
  { name: 'My Invoices', path: '/agent/invoices', icon: InvoiceIcon },
  { name: 'Job Reports', path: '/agent/reports', icon: ClipboardList },
  { name: 'Notifications', path: '/agent/notifications', icon: Bell },
  { name: 'My Profile', path: '/agent/profile', icon: UserIcon },
];

// This function is required to format the VAPID key for the browser
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      return;
    }

    const subscribeToPushNotifications = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn("Push notifications are not supported by this browser.");
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log("Push notification permission not granted.");
        return;
      }
      
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (subscription === null) {
        try {
          const vapidPublicKey = 'BCVp6sM-3kVT43iVnAUrkXYc2gVdofIMc3tB4p7Q2Qv5G2b5P2iRzBEe-s2w9i5n-8T0aHkXyGNIk2N8yA9fUo8=';
          const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });

          await apiCall('/notifications/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
          });

          toast.success("Notifications Enabled!", {
            description: "You'll now receive job alerts on this device.",
          });
        } catch (error) {
          console.error('Failed to subscribe to push notifications', error);
          toast.error("Could not enable notifications.", {
            description: error.message || "An unknown error occurred.",
          });
        }
      } else {
        console.log("User is already subscribed to push notifications.");
      }
    };
    
    subscribeToPushNotifications();
  }, [apiCall, user, loading]);

  const getNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
      isActive
        ? 'bg-v3-orange text-white'
        : 'text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest'
    }`;

  const SidebarContent = ({ onItemClick = () => {} }) => (
    <div className="flex h-full flex-col bg-v3-bg-card">
      {/* Header */}
      <div className="flex h-16 items-center px-6 border-b border-v3-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-r from-v3-orange to-v3-orange-dark rounded-lg flex items-center justify-center">
            <span className="font-bold text-white text-lg">V3</span>
          </div>
          <span className="font-semibold text-v3-text-lightest">Agent Portal</span>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 space-y-2 py-4 px-4">
        {agentNavItems.map((item) => (
          <NavLink 
            key={item.name} 
            to={item.path} 
            className={getNavLinkClass}
            onClick={onItemClick}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </NavLink>
        ))}
      </nav>
      
      {/* User Profile & Logout */}
      <div className="border-t border-v3-border p-4">
        <div className="flex items-center gap-x-3 px-2 py-2 text-sm font-semibold leading-6 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-v3-orange text-white font-bold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-v3-text-lightest">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-v3-text-muted">{user?.email}</p>
          </div>
        </div>
        <button 
          onClick={() => {
            logout();
            onItemClick();
          }} 
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-500 hover:bg-red-900/20 hover:text-red-400 transition-all"
        >
          <Power className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-v3-bg-darkest font-sans">
      {/* Mobile Header with Menu Button */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-v3-bg-card border-b border-v3-border flex items-center justify-between px-4">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-v3-text-muted hover:text-v3-text-lightest"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent onItemClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        
        {/* Mobile Header Title */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-r from-v3-orange to-v3-orange-dark rounded flex items-center justify-center">
            <span className="font-bold text-white text-xs">V3</span>
          </div>
          <span className="font-semibold text-v3-text-lightest">Agent Portal</span>
        </div>
        
        {/* Mobile User Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-v3-orange text-white font-bold text-sm">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <aside className="w-64 flex-col border-r border-v3-border bg-v3-bg-card p-4 hidden md:flex fixed inset-y-0 left-0 z-30">
        <div className="flex h-16 items-center px-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-r from-v3-orange to-v3-orange-dark rounded-lg flex items-center justify-center">
              <span className="font-bold text-white text-lg">V3</span>
            </div>
            <span className="font-semibold text-v3-text-lightest">Agent Portal</span>
          </div>
        </div>
        <nav className="flex-1 space-y-2 py-4">
          {agentNavItems.map((item) => (
            <NavLink key={item.name} to={item.path} className={getNavLinkClass}>
              <item.icon className="h-4 w-4" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-red-500 hover:bg-red-900/20 hover:text-red-400 transition-all">
            <Power className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="md:pl-64">
        <div className="pt-16 md:pt-0">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AgentLayout;