export default function StickyActionBar({ children, className = "" }) {
  return (
    <div id="sticky-action-bar" className={`fixed inset-x-0 bottom-0 z-[100] bg-[var(--v3-bg-darkest,#0d0f12)]/95 backdrop-blur border-t border-white/10 px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] flex gap-2 pointer-events-auto ${className}`} data-testid="sticky-action-bar" role="region" aria-label="Send actions">
      {children}
    </div>
  );
}


