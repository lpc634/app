export default function StickyActionBar({ children, className = "" }) {
  return (
    <div className={`fixed left-0 right-0 md:bottom-0 bottom-[64px] z-50 safe-pb bg-card/95 backdrop-blur border-t p-3 flex gap-2 ${className}`} data-testid="sticky-action-bar">
      {children}
    </div>
  );
}


