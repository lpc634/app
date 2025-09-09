export default function StickyActionBar({ children, className = "" }) {
  return (
    <div id="sticky-action-bar" className={`fixed left-0 right-0 md:bottom-0 bottom-[calc(var(--bottom-nav-h,64px)+var(--safe-bottom,0px))] z-[60] bg-card/95 backdrop-blur border-t p-3 flex gap-2 ${className}`} data-testid="sticky-action-bar" role="region" aria-label="Send actions">
      {children}
    </div>
  );
}


