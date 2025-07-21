import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "./useAuth.jsx";

// --- 1. IMPORT THE SEARCH ICON ---
import { Menu, LogOut, Home, Users, Briefcase, BarChart3, Search } from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Agents', href: '/agents', icon: Users },
  { name: 'Jobs', href: '/jobs', icon: Briefcase },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  // --- 2. ADD THE NEW NAVIGATION LINK HERE ---
  { name: 'Vehicle Search', href: '/agent/vehicle-search', icon: Search },
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
              flex items-center px-3 py-2 rounded-md text-sm font-medium
              ${isActive
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground'
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
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center px-6">
        {/* The <img> tag that used the logo has been removed from here */}
      </div>
      <div className="flex grow flex-col gap-y-5 overflow-y-auto">
        <NavigationItems onItemClick={onItemClick} />
      </div>
      <div className="border-t p-4">
        <div className="flex items-center gap-x-3 px-2 py-2 text-sm font-semibold leading-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-white font-bold">
            {user?.first_name?.[0]}{user?.last_name?.[0]}
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-v3-text-lightest">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-v3-text-muted">{user?.email}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-primary mt-2"
          onClick={handleLogout}
        >
          <LogOut className="mr-3 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div>
      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden fixed top-4 left-4 z-50 text-muted-foreground"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open sidebar</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SidebarContent onItemClick={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <SidebarContent />
      </div>

      {/* Main Content Area */}
      <div className="lg:pl-72">
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}