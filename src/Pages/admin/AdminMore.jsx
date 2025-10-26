import { Link } from "react-router-dom";
import { BarChart3, Search, FileText, DollarSign, Bug, MessageCircle, FileEdit, FileSignature, Mail, Shield } from "lucide-react";

export default function AdminMore() {
  const links = [
    { to: "/admin/vehicle-search", label: "Vehicle Search", icon: Search, description: "Search vehicle registration data" },
    { to: "/police-interactions", label: "Police Interactions", icon: Shield, description: "Log and view police reports" },
    { to: "/admin/v3-reports", label: "V3 Job Reports", icon: FileEdit, description: "View and manage job reports" },
    { to: "/admin/authority-to-act", label: "Authority to Act", icon: FileSignature, description: "Client authorization forms" },
    { to: "/admin/eflyer", label: "E-Flyer", icon: Mail, description: "Marketing materials" },
    { to: "/admin/communications/message-agents", label: "Communications", icon: MessageCircle, description: "Message agents" },
    { to: "/admin/documents", label: "Document Review", icon: FileText, description: "Review agent documents" },
    { to: "/admin/expenses", label: "Expenses", icon: DollarSign, description: "Manage expenses" },
    { to: "/analytics", label: "Analytics", icon: BarChart3, description: "View statistics and metrics" },
    { to: "/debug", label: "Debug", icon: Bug, description: "Development tools" },
  ];

  return (
    <div className="p-4 space-y-4 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">More Options</h1>
        <p className="text-sm text-muted-foreground mt-1">Additional admin tools and features</p>
      </div>

      <div className="grid gap-3">
        {links.map(l => {
          const Icon = l.icon;
          return (
            <Link
              key={l.to}
              to={l.to}
              className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors tap-target"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-foreground">{l.label}</div>
                <div className="text-sm text-muted-foreground mt-0.5">{l.description}</div>
              </div>
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}


