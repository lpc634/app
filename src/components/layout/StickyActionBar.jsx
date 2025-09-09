export default function StickyActionBar({ children, className = "" }) {
  return (
    <div className={`md:hidden fixed bottom-16 left-0 right-0 z-40 safe-pb bg-card/95 backdrop-blur border-t p-3 flex gap-2 ${className}`} data-testid="sticky-action-bar">
      {children}
    </div>
  );
}


