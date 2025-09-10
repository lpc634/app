export default function StickyActionBar({ children, className = "" }) {
  return (
    <div id="sticky-action-bar" className={`fixed left-0 right-0 md:bottom-0 bottom-20 z-[100] bg-card/95 backdrop-blur border-t p-3 flex gap-2 pointer-events-auto ${className}`} data-testid="sticky-action-bar" role="region" aria-label="Send actions">
      {children}
    </div>
  );
}


