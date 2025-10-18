import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { useAuth } from '@/useAuth';

export default function InvoicePdfViewer({ invoice, onClose, onTogglePaid }) {
  const { apiCall } = useAuth();
  const [embedUrl, setEmbedUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function resolveUrl() {
      if (!invoice) return;
      setLoading(true);
      setError(null);
      setEmbedUrl(null);
      try {
        if (invoice.pdf_url) {
          if (!cancelled) setEmbedUrl(invoice.pdf_url);
        } else {
          // Use unified invoices route (accepts id or ref) for a signed iframe URL
          const idOrRef = invoice.idOrRef || invoice.invoice_number || invoice.id;
          const data = await apiCall(`/invoices/${idOrRef}/pdf_url`);
          if (!cancelled) setEmbedUrl(data?.url || null);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    resolveUrl();
    return () => { cancelled = true; };
  }, [invoice, apiCall]);

  if (!invoice) return null;

  const handleDownload = () => {
    if (!embedUrl) return;
    window.open(embedUrl, '_blank');
  };

  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent
        className="!max-w-[98vw] w-[98vw] h-[95vh] p-0 bg-[var(--v3-bg-darker)] border-[var(--v3-border)]"
        showCloseButton={false}
      >
        {/* Close button - positioned absolutely in top right corner */}
        <button
          aria-label="Close"
          onClick={onClose}
          className="absolute top-4 right-4 z-50 p-2 rounded-lg transition-colors"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            color: 'var(--v3-text-lightest)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'}
        >
          <X size={24} />
        </button>

        {/* Hidden header for accessibility */}
        <div className="sr-only">
          <DialogTitle>Invoice #{invoice.invoice_number || invoice.id}</DialogTitle>
          <DialogDescription>{invoice.agent_name || 'Unknown Agent'}</DialogDescription>
        </div>

        {/* PDF Viewer */}
        <div className="absolute inset-0" style={{ top: '0', bottom: '60px' }}>
          {error ? (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--v3-orange)' }}>
              {error}
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--v3-text-muted)' }}>
              Loading PDF…
            </div>
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              title={`Invoice ${invoice.invoice_number || invoice.id}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full" style={{ color: 'var(--v3-text-muted)' }}>
              No PDF available
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-6 py-3 border-t border-[var(--v3-border)] bg-[var(--v3-bg-dark)] z-40">
          <Button
            onClick={handleDownload}
            disabled={!embedUrl}
            className="bg-[var(--v3-orange)] hover:bg-[var(--v3-orange-dark)] text-white"
          >
            Download PDF
          </Button>
          {onTogglePaid && (
            <Button
              variant="outline"
              onClick={() => onTogglePaid(invoice)}
              className="border-[var(--v3-border)]"
              style={{ color: 'var(--v3-text-lightest)' }}
            >
              {invoice.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


