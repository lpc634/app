import { useEffect } from 'react';

export default function EFlyerRedirect() {
  useEffect(() => {
    // Immediately redirect to the PDF
    window.location.href = '/static/V3-E-flyer.pdf';
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-v3-bg-darkest">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-v3-orange mx-auto"></div>
        <p className="mt-4 text-v3-text">Redirecting to V3 E-Flyer...</p>
      </div>
    </div>
  );
}
