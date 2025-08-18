import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, ClipboardList, Calendar, Bell, Power, User as UserIcon, FileText as InvoiceIcon, Search, X } from 'lucide-react';
import { useAuth } from '../useAuth';
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

export function Sidebar({ onNavigate, onClose, isMobile = false }) {
  const { logout, user } = useAuth();
  const location = useLocation();

  const handleNavClick = () => {
    onNavigate?.();
  };

  const handleSignOut = () => {
    logout();
    onNavigate?.();
  };

  return (
    <div className="h-full flex flex-col bg-v3-bg-card border-r border-v3-border">
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-v3-border safe-pt lg:safe-pt-0">
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="Company Name Logo" className="h-8 w-auto max-w-full" />
          <span className="font-semibold text-v3-text-lightest truncate">Agent Portal</span>
        </div>
        {isMobile && onClose && (
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-v3-bg-dark tap-target"
            aria-label="Close navigation menu"
          >
            <X size={24} className="text-v3-text-muted" />
          </button>
        )}
      </div>

      {/* Navigation Items */}
      <div className="flex-1 p-4 space-y-2 overflow-y-auto">
        {agentNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={handleNavClick}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all tap-target min-w-0 ${
                isActive
                  ? 'bg-v3-orange text-white'
                  : 'text-v3-text-muted hover:bg-v3-bg-dark hover:text-v3-text-lightest'
              }`}
            >
              <item.icon size={20} className="flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </NavLink>
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
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-500 hover:bg-red-900/20 tap-target min-w-0"
        >
          <Power size={20} className="flex-shrink-0" />
          <span className="truncate">Sign Out</span>
        </button>
      </div>
    </div>
  );
}