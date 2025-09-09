import { NavLink, useLocation } from "react-router-dom";
import { Home, Briefcase, Users, FileText, MoreHorizontal, MessageCircle } from "lucide-react";

const items = [
  { path: "/admin", label: "Dashboard", icon: Home, testid: "bottomnav-dashboard" },
  { path: "/admin/jobs", label: "Jobs", icon: Briefcase, testid: "bottomnav-jobs" },
  { path: "/admin/agents", label: "Agents", icon: Users, testid: "bottomnav-agents" },
  { path: "/admin/invoices", label: "Invoices", icon: FileText, testid: "bottomnav-invoices" },
  { path: "/admin/more", label: "More", icon: MoreHorizontal, testid: "bottomnav-more" },
];

export default function BottomNav() {
  const location = useLocation();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 safe-pb">
      <div className="mx-auto max-w-screen-sm">
        <div className="backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/95 border-t">
          <ul className="grid grid-cols-5">
            {items.map(({ path, label, icon: Icon, testid }) => {
              const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
                <li key={path}>
                  <NavLink
                    to={path}
                    aria-label={label}
                    data-testid={testid}
                    className={`flex flex-col items-center justify-center py-2 tap-target min-h-[52px] ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                    <span className="text-[11px] leading-tight mt-0.5">{label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </nav>
  );
}


