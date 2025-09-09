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
    <nav id="bottom-nav" className="md:hidden fixed inset-x-0 bottom-0 z-[50] h-16 pb-[env(safe-area-inset-bottom)] pointer-events-auto">
      <div className="mx-auto max-w-screen-sm h-full">
        <div className="backdrop-blur supports-[backdrop-filter]:bg-background/70 bg-background/95 border-t h-full">
          <ul className="grid grid-cols-5 h-full">
            {items.map(({ path, label, icon: Icon, testid }) => {
              const isActive = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
                <li key={path}>
                  <NavLink
                    to={path}
                    aria-label={label}
                    data-testid={testid}
                    className={`flex flex-col items-center justify-center tap-target h-16 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
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


