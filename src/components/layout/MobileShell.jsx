import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import BottomNav from "@/components/navigation/BottomNav.jsx";
import { usePageHeaderState } from "@/components/layout/PageHeaderContext.jsx";

export default function MobileShell() {
  const { title, action } = usePageHeaderState();
  const location = useLocation();
  useEffect(() => {
    const nav = document.getElementById('bottom-nav');
    const sticky = document.getElementById('sticky-action-bar');
    if (nav) document.documentElement.style.setProperty('--bottom-nav-h', `${nav.offsetHeight}px`);
    if (sticky) document.documentElement.style.setProperty('--sticky-bar-h', `${sticky.offsetHeight}px`);
  }, [location]);

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

      <div id="app-scroll" className="pt-[56px] pb-[calc(var(--bottom-nav-h,64px)+var(--sticky-bar-h,56px)+var(--safe-bottom,0px)+16px)]">
        <Outlet key={location.key} />
      </div>

      <BottomNav />
    </div>
  );
}


