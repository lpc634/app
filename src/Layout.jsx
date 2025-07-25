import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "./useAuth.jsx";

// --- 1. IMPORT THE SEARCH ICON ---
import { Menu, LogOut, Home, Users, Briefcase, BarChart3, Search } from 'lucide-react';
import logo from './assets/new_logo.png';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Vehicle Search', href: '/admin/vehicle-search', icon: Search },
];

function NavigationItems({ onItemClick = () => {} }) {
  const location = useLocation();

  return (
    <nav className="flex-1 space-y-2 px-4">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onItemClick}
            className={`
              flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors
              ${isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            <Icon className="mr-3 h-5 w-5" />
            {item.name}
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
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex h-20 items-center p-4 gap-x-4 border-b">
        <img src={logo} alt="Company Name Logo" className="h-8 w-auto" />
        <span className="font-semibold text-2xl text-foreground">V3 Services</span>
      </div>
      
      {/* Navigation */}
      <div className="flex grow flex-col gap-y-5 overflow-y-auto py-4">
        <NavigationItems onItemClick={onItemClick} />
      </div>
      
      {/* User Profile & Logout */}
      <div className="border-t p-4">
        <div className="flex items-center gap-x-3 px-2 py-2 text-sm font-semibold leading-6 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white font-bold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => {
            handleLogout();
            onItemClick();
          }}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header with Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-16 bg-card border-b flex items-center justify-between px-4">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-6 w-6" />
              <span className="sr-only">Open sidebar</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SidebarContent onItemClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        
        {/* Mobile Header Title */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-orange-600 rounded flex items-center justify-center">
            <span className="font-bold text-white text-xs">V3</span>
          </div>
          <span className="font-semibold text-foreground">V3 Services</span>
        </div>
        
        {/* Mobile User Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white font-bold text-sm">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent />
      </div>

      {/* Main Content Area */}
      <div className="lg:pl-72">
        <main className="py-4 lg:py-10">
          {/* Add top padding on mobile to account for fixed header */}
          <div className="px-4 sm:px-6 lg:px-8 pt-16 lg:pt-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}