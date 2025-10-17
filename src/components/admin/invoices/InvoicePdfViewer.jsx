import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { getInvoicePdf } from '@/api/invoices';

export default function InvoicePdfViewer({ invoice, onClose, onTogglePaid }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let currentBlobUrl = null;

    async function fetchPdfBlob() {
      if (!invoice) return;

      console.log('[Invoice] Fetching PDF for invoice:', invoice.id || invoice.invoice_number);
      setLoading(true);
      setError(null);
      setBlobUrl(null);

      try {
        const idOrRef = invoice.idOrRef || invoice.invoice_number || invoice.id;
        const blob = await getInvoicePdf(String(idOrRef));

        console.log('[Invoice] Blob received', { size: blob.size, type: blob.type });

        if (!cancelled) {
          const url = URL.createObjectURL(blob);
          console.log('[Invoice] Object URL created:', url);
          currentBlobUrl = url;
          setBlobUrl(url);
        }
      } catch (e) {
        console.error('[Invoice] Failed to fetch PDF:', e);
        if (!cancelled) setError(e?.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPdfBlob();

    return () => {
      cancelled = true;
      // Clean up blob URL when component unmounts or invoice changes
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [invoice]);

  if (!invoice) return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `invoice-${invoice.invoice_number || invoice.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent className="max-w-[98vw] w-[98vw] h-[95vh] p-0">
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
            ) : blobUrl ? (
              <iframe
                src={blobUrl}
                className="w-full h-full"
                title={`Invoice ${invoice.invoice_number || invoice.id}`}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">No PDF available</div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 p-3 border-t">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleDownload} disabled={!blobUrl}>
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


