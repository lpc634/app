import React, { useEffect, useState, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Portal } from './ui/Portal';
import { Sidebar } from './Sidebar';
import '../styles/agent-mobile.css';
import '../styles/agent-grid-fixes.css';
import logo from '../assets/new_logo.png';

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
  const { apiCall, user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const triggerRef = useRef(null);
  const location = useLocation();

  // Close on route change and restore focus
  useEffect(() => {
    if (sidebarOpen) {
      setSidebarOpen(false);
      setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, [location.pathname]);

  // ESC key to close & body scroll-lock
  useEffect(() => {
    function onKey(e) { 
      if (e.key === "Escape" && sidebarOpen) {
        setSidebarOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", sidebarOpen);
    return () => document.body.classList.remove("overflow-hidden");
  }, [sidebarOpen]);

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

  return (
    <div className="agent-shell min-h-screen-ios w-full">
      {/* Mobile TopBar */}
      <header className="agent-mobile-header lg:hidden safe-pt">
        <button 
          ref={triggerRef}
          onClick={() => setSidebarOpen(true)}
          className="agent-mobile-menu-button tap-target"
          aria-label="Open navigation menu"
          aria-controls="mobile-nav"
          aria-expanded={sidebarOpen}
        >
          <Menu size={24} />
        </button>
        <img src={logo} alt="Company Name Logo" className="h-9 w-auto mx-auto max-w-full" />
        <div className="w-11"></div>
      </header>

      {/* Static desktop sidebar */}
      <aside className="hidden lg:block w-[var(--sidebar-w)] flex-shrink-0" style={{ '--sidebar-w': '256px' }}>
        <Sidebar />
      </aside>

      {/* Main content */}
      <main className="agent-main w-full min-w-0 flex-1">
        <Outlet />
      </main>

      {/* MOBILE DRAWER IN PORTAL */}
      <Portal>
        {/* Backdrop */}
        <div
          className={`fixed inset-0 z-[90] bg-black/50 transition-opacity lg:hidden ${
            sidebarOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden
        />
        
        {/* Drawer */}
        <aside
          id="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation"
          className={`fixed inset-y-0 left-0 z-[100] lg:hidden transform-none w-[var(--sidebar-w)] max-w-[85vw] 
                      transition-transform duration-300 will-change-transform ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          style={{ '--sidebar-w': '320px' }}
        >
          <Sidebar 
            onNavigate={() => setSidebarOpen(false)} 
            onClose={() => setSidebarOpen(false)}
            isMobile={true}
          />
        </aside>
      </Portal>
    </div>
  );
};

export default AgentLayout;