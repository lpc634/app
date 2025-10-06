import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export default function InvoicePdfViewer({ invoice, onClose, onTogglePaid }) {
  if (!invoice) return null;

  const handleDownload = () => {
    if (!invoice.pdf_url) return;
    window.open(invoice.pdf_url, '_blank');
  };

  return (
    <Dialog open={!!invoice} onOpenChange={onClose}>
      <DialogContent className="max-w-[90vw] w-[90vw] h-[90vh] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <DialogHeader className="p-0">
            <DialogTitle>
              {`Invoice #${invoice.invoice_number || invoice.id}  ${invoice.agent_name || ''}`}
            </DialogTitle>
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
            {invoice.pdf_url ? (
              <iframe
                src={invoice.pdf_url}
                className="w-full h-full"
                title={`Invoice ${invoice.invoice_number || invoice.id}`}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No PDF available
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 p-3 border-t">
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={handleDownload} disabled={!invoice.pdf_url}>
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


