import { Outlet, useLocation } from "react-router-dom";
import BottomNav from "@/components/navigation/BottomNav.jsx";
import { usePageHeaderState } from "@/components/layout/PageHeaderContext.jsx";

export default function MobileShell() {
  const { title, action } = usePageHeaderState();
  const location = useLocation();

  return (
    <div className="md:hidden">
      <div className="fixed top-0 left-0 right-0 z-40 min-h-[56px] safe-pt bg-card border-b flex items-center justify-between px-4">
        <div className="font-semibold truncate text-foreground" data-testid="mobile-header-title">
          {title || "Admin"}
        </div>
        <div className="shrink-0" data-testid="mobile-header-action">
          {action || null}
        </div>
      </div>

      <div className="pt-[56px] pb-[64px]">
        <Outlet key={location.key} />
      </div>

      <BottomNav />
    </div>
  );
}


