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
      <DialogContent className="!max-w-[98vw] w-[98vw] h-[95vh] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DialogHeader className="p-0">
            <DialogTitle>
              {`Invoice #${invoice.invoice_number || invoice.id} – ${invoice.agent_name || ''}`}
            </DialogTitle>
            <DialogDescription>
              Preview the original PDF submitted by the agent.
            </DialogDescription>
          </DialogHeader>
          <button
            aria-label="Close"
            className="p-2 rounded hover:bg-muted"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col h-[calc(100%-56px)]">
          <div className="flex-1">
            {error ? (
              <div className="flex items-center justify-center h-full text-red-400">{error}</div>
            ) : loading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">Loading PDF…</div>
            ) : embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                title={`Invoice ${invoice.invoice_number || invoice.id}`}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No PDF available</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 p-3 border-t">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleDownload} disabled={!embedUrl}>
                Download PDF
              </Button>
            </div>
            <div className="flex items-center gap-2">
              {onTogglePaid && (
                <Button variant="outline" onClick={() => onTogglePaid(invoice)}>
                  {invoice.status === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


