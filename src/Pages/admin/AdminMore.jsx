import { Link } from "react-router-dom";

export default function AdminMore() {
  const links = [
    { to: "/analytics", label: "Analytics" },
    { to: "/admin/vehicle-search", label: "Vehicle Search" },
    { to: "/admin/documents", label: "Document Review" },
    { to: "/admin/expenses", label: "Expenses" },
    { to: "/debug", label: "Debug" },
    { to: "/admin/communications/message-agents", label: "Message agents" },
  ];
  return (
    <div className="p-4 space-y-2">
      <h1 className="text-2xl font-semibold">More</h1>
      <div className="grid gap-2">
        {links.map(l => (
          <Link key={l.to} to={l.to} className="p-3 rounded-md border hover:bg-muted/50">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}


