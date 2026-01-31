import { Outlet, useLocation, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import BottomNav from "@/components/navigation/BottomNav.jsx";
import { usePageHeaderState } from "@/components/layout/PageHeaderContext.jsx";
import { useAuth } from "@/useAuth.jsx";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, LogOut, Home, Users, Briefcase, BarChart3, Search, FileText, DollarSign, MessageCircle, FileEdit, FileSignature, Mail, MessageSquare, UserCheck, Shield } from "lucide-react";
import logo from "@/assets/new_logo.png";

const navigation = [
  { name: 'Dashboard', href: '/admin', icon: Home },
  { name: 'Jobs', href: '/admin/jobs', icon: Briefcase },
  { name: 'Agents', href: '/admin/agents', icon: Users },
  { name: 'Invoices', href: '/admin/invoices', icon: FileText },
  { name: 'CRM', href: '/admin/crm', icon: UserCheck, adminOnly: true },
  { name: 'Vehicle Search', href: '/admin/vehicle-search', icon: Search },
  { name: 'Police Interactions', href: '/police-interactions', icon: Shield },
  { name: 'V3 Job Reports', href: '/admin/v3-reports', icon: FileEdit },
  { name: 'Authority to Act', href: '/admin/authority-to-act', icon: FileSignature, adminOnly: true },
  { name: 'Contact Forms', href: '/admin/contact-forms', icon: MessageSquare, adminOnly: true },
  { name: 'E-Flyer', href: '/admin/eflyer', icon: Mail, adminOnly: true },
  { name: 'Communications', href: '/admin/communications/message-agents', icon: MessageCircle, adminOnly: true },
  { name: 'Document Review', href: '/admin/documents', icon: FileText, adminOnly: true },
  { name: 'Expenses', href: '/admin/expenses', icon: DollarSign, adminOnly: true },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export default function MobileShell() {
  const { title, action } = usePageHeaderState();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hideBottomNav = location.pathname.startsWith('/admin/communications');

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const nav = document.getElementById('bottom-nav');
    const sticky = document.getElementById('sticky-action-bar');
    if (hideBottomNav) {
      document.documentElement.style.setProperty('--bottom-nav-h', `0px`);
    } else if (nav) {
      document.documentElement.style.setProperty('--bottom-nav-h', `${nav.offsetHeight}px`);
    }
    if (sticky) document.documentElement.style.setProperty('--sticky-bar-h', `${sticky.offsetHeight}px`);
  }, [location, hideBottomNav]);

  return (
    <div className="md:hidden">
      <div className="fixed top-0 left-0 right-0 z-40 min-h-[56px] safe-pt bg-card border-b flex items-center justify-between px-4">
        {/* Hamburger Menu */}
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground tap-target flex-shrink-0"
              aria-label="Open navigation menu"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 max-w-[85vw] p-0 flex flex-col">
            {/* Sidebar Header */}
            <div className="flex min-h-[64px] items-center p-4 gap-x-4 border-b">
              <img src={logo} alt="Company Name Logo" className="h-8 w-auto max-w-full" />
              <span className="font-semibold text-xl text-foreground truncate">V3 Services</span>
            </div>

            {/* Navigation Links */}
            <div className="flex-1 overflow-y-auto py-4">
              <nav className="space-y-1 px-4">
                {navigation.map((item) => {
                  if (item.adminOnly && user?.role !== 'admin') return null;
                  const isActive = location.pathname === item.href || (item.href !== '/admin' && location.pathname.startsWith(item.href + '/'));
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center px-3 py-3 rounded-lg text-sm font-medium transition-colors tap-target min-w-0 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
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
                className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-red-900/20 tap-target"
                onClick={() => {
                  logout();
                  setSidebarOpen(false);
                }}
              >
                <LogOut className="mr-3 h-4 w-4 flex-shrink-0" />
                <span className="truncate">Sign Out</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Title */}
        <div className="font-semibold truncate text-foreground flex-1 text-center" data-testid="mobile-header-title">
          {title || "Admin"}
        </div>

        {/* Action / User Avatar */}
        <div className="shrink-0 flex items-center gap-2" data-testid="mobile-header-action">
          {action || (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-white font-bold text-sm flex-shrink-0">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
          )}
        </div>
      </div>

      <div id="app-scroll" className="pt-[56px] pb-[calc(var(--bottom-nav-h,64px)+var(--sticky-bar-h,56px)+var(--safe-bottom,0px)+16px)] px-3 overflow-x-hidden">
        <Outlet key={location.key} />
      </div>

      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
