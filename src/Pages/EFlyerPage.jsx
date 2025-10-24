import { useState } from 'react';
import { FileText, Download, Share2, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function EFlyerPage() {
  const [loading, setLoading] = useState(true);
  const pdfUrl = '/static/V3-E-flyer.pdf';

  const handleCopyLink = () => {
    const link = `${window.location.origin}/eflyer`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard', {
      description: 'You can now paste this link in your email campaigns'
    });
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = pdfUrl;
    a.download = 'V3-Services-E-Flyer.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('Download started');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-v3-text-lightest">
              E-Flyer
            </h1>
            <span className="px-2 py-1 text-xs font-semibold bg-v3-orange text-white rounded-md">
              MARKETING
            </span>
          </div>
          <p className="text-muted-foreground">
            Share this link in your email outreach campaigns to showcase V3 Services
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleCopyLink}
            className="button-refresh flex items-center gap-2"
          >
            <Share2 className="h-4 w-4" />
            Copy Link
          </button>
          <button
            onClick={handleDownload}
            className="btn-ghost flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Public Link Info Card */}
      <div className="dashboard-card">
        <div className="flex items-start gap-3">
          <Mail className="h-5 w-5 text-v3-orange mt-1 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-v3-text-lightest mb-1">
              Public E-Flyer Link
            </h3>
            <p className="text-sm text-v3-text-muted mb-3">
              Use this link in your email campaigns. Recipients can view the flyer without logging in.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 bg-v3-bg-dark border border-v3-border rounded-md text-sm text-v3-text-lightest font-mono break-all">
                {window.location.origin}/eflyer
              </code>
              <button
                onClick={handleCopyLink}
                className="button-refresh whitespace-nowrap"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="dashboard-card p-0 overflow-hidden">
        <div className="bg-v3-bg-dark border-b border-v3-border p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-v3-orange" />
            <h2 className="font-semibold text-v3-text-lightest">
              V3 Services E-Flyer Preview
            </h2>
          </div>
          {loading && (
            <div className="text-sm text-v3-text-muted">Loading PDF...</div>
          )}
        </div>
        <div className="relative w-full bg-v3-bg-darkest" style={{ height: 'calc(100vh - 400px)', minHeight: '600px' }}>
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="V3 Services E-Flyer"
            onLoad={() => setLoading(false)}
          />
        </div>
      </div>

      {/* Usage Tips */}
      <div className="dashboard-card bg-v3-bg-dark/50">
        <h3 className="font-semibold text-v3-text-lightest mb-3 flex items-center gap-2">
          <Mail className="h-4 w-4 text-v3-orange" />
          Email Campaign Tips
        </h3>
        <ul className="space-y-2 text-sm text-v3-text-muted">
          <li className="flex items-start gap-2">
            <span className="text-v3-orange mt-0.5">•</span>
            <span>Include the link in your email signature or campaign body</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-v3-orange mt-0.5">•</span>
            <span>Use a call-to-action like "View our services" or "Learn more about V3"</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-v3-orange mt-0.5">•</span>
            <span>The link opens in the browser, no download required for recipients</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-v3-orange mt-0.5">•</span>
            <span>Recipients don't need to log in to view the flyer</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
