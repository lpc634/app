import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "./useAuth.jsx";

// --- 1. IMPORT THE SEARCH ICON ---
import { Menu, LogOut, Home, Users, Briefcase, BarChart3, Search, FileText } from 'lucide-react';
import logo from './assets/new_logo.png';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Vehicle Search', href: '/admin/vehicle-search', icon: Search },
  { name: 'Document Review', href: '/admin/documents', icon: FileText, adminOnly: true },
  { name: 'Agent Invoices', href: '/admin/agent-invoices', icon: FileText, adminOnly: true },
];

function NavigationItems({ onItemClick = () => {} }) {
  const location = useLocation();
  const { user } = useAuth();

  return (
    <nav className="flex-1 space-y-2 px-4">
      {navigation.map((item) => {
        // Hide admin-only items for non-admin users
        if (item.adminOnly && user?.role !== 'admin') {
          return null;
        }

        const isActive = location.pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onItemClick}
            className={`
              flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors tap-target min-w-0
              ${isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
            <span className="truncate">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const SidebarContent = ({ onItemClick = () => {} }) => (
    <div className="flex h-full flex-col bg-card safe-pt safe-pb">
      {/* Header */}
      <div className="flex min-h-[64px] items-center p-4 gap-x-4 border-b">
        <img src={logo} alt="Company Name Logo" className="h-8 w-auto max-w-full" />
        <span className="font-semibold text-2xl text-foreground truncate">V3 Services</span>
      </div>
      
      {/* Navigation */}
      <div className="flex grow flex-col gap-y-5 overflow-y-auto py-4">
        <NavigationItems onItemClick={onItemClick} />
      </div>
      
      {/* User Profile & Logout */}
      <div className="border-t p-4">
        <div className="flex items-center gap-x-3 px-2 py-2 text-sm font-semibold leading-6 mb-3 min-w-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white font-bold flex-shrink-0">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground tap-target"
          onClick={() => {
            handleLogout();
            onItemClick();
          }}
        >
          <LogOut className="mr-3 h-4 w-4 flex-shrink-0" />
          <span className="truncate">Sign out</span>
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen-ios bg-background prevent-horizontal-scroll">
      {/* Mobile Header with Menu Button and Safe Area */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 min-h-[64px] bg-card border-b flex items-center justify-between px-4 safe-pt">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground tap-target"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0 max-w-[85vw]">
            <SidebarContent onItemClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        
        {/* Mobile Header Title */}
        <div className="flex items-center gap-2 min-w-0">
          <img src={logo} alt="Company Logo" className="w-6 h-6 flex-shrink-0 max-w-full" />
          <span className="font-semibold text-foreground truncate">V3 Services</span>
        </div>
        
        {/* Mobile User Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white font-bold text-sm flex-shrink-0">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent />
      </div>

      {/* Main Content Area with Safe Area */}
      <div className="lg:pl-72 w-full max-w-full overflow-x-hidden">
        <main className="py-4 lg:py-10 safe-pb">
          {/* Add top padding on mobile to account for fixed header */}
          <div className="px-4 sm:px-6 lg:px-8 pt-20 lg:pt-0 w-full max-w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}