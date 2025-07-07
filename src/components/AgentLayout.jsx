import React, { useEffect } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, ClipboardList, Calendar, Bell, Briefcase, Power, User as UserIcon, FileText as InvoiceIcon } from 'lucide-react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';

const agentNavItems = [
  { name: 'Dashboard', path: '/agent/dashboard', icon: Home },
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
  // --- MODIFIED: Get user and loading state ---
  const { logout, apiCall, user, loading } = useAuth();

  // useEffect hook to handle push subscription
  useEffect(() => {
    // --- MODIFIED: Wait for auth to be ready ---
    if (loading || !user) {
      return; // Do nothing if auth is loading or there's no user
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
          // Using the known-good test key
          const vapidPublicKey = 'BCVp6sM-3kVT43iVnAUrkXYc2gVdofIMc3tB4p7Q2Qv5G2b5P2iRzBEe-s2w9i5n-8T0aHkXyGNIk2N8yA9fUo8=';
          const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: applicationServerKey
          });

          // Send the new subscription to the backend
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
  // --- MODIFIED: Add user and loading to dependencies ---
  }, [apiCall, user, loading]);

  const getNavLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
      isActive
        ? 'bg-v3-orange text-white'
        : 'text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest'
    }`;

  return (
    <div className="flex min-h-screen bg-v3-bg-darkest font-sans">
      <aside className="w-64 flex-col border-r border-v3-border bg-v3-bg-card p-4 hidden md:flex">
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

      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default AgentLayout;