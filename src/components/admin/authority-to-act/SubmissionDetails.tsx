import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Printer, CheckCircle2, Circle, Download } from "lucide-react";
import { prettifyKey } from "@/lib/authorityToAct/labelMap";
import { formatAny, formatDateUK } from "@/lib/authorityToAct/formatters";

type Props = {
  submission: any;
  open: boolean;
  onClose: () => void;
  onMarkRead?: (id: number, next?: boolean) => void;
  onPrint?: (sub?: any) => void;
};

export default function SubmissionDetails({ submission, open, onClose, onMarkRead, onPrint }: Props) {
  if (!submission) return null;
  const data = submission.submission_data || {};

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(submission, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `authority-to-act-${submission.id}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  const copyLink = async () => {
    const link = submission.public_url || window.location.origin + `/admin/authority-to-act/submissions/${submission.id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {}
  };

  const rows = Object.entries(data).filter(([k, v]) => v !== undefined && v !== null && v !== "");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between w-full">
            <span>Submission Details</span>
            <span className="flex items-center gap-2 text-sm">
              {submission.is_read ? (
                <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3"/> Read</Badge>
              ) : (
                <Badge variant="secondary" className="gap-1"><Circle className="h-3 w-3"/> Unread</Badge>
              )}
            </span>
          </DialogTitle>
          <DialogDescription>Submitted on {formatDateUK(submission.submitted_at)}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="text-sm text-muted-foreground">
            {submission.client_name || "Unnamed"} • {submission.client_email || "No email"}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={copyLink}><Copy className="h-4 w-4 mr-2"/>Copy Link</Button>
            <Button size="sm" variant="outline" onClick={() => (onPrint ? onPrint(submission) : window.print())}><Printer className="h-4 w-4 mr-2"/>Print</Button>
            <Button size="sm" variant="outline" onClick={downloadJson}><Download className="h-4 w-4 mr-2"/>JSON</Button>
            {onMarkRead && (
              <Button size="sm" onClick={() => onMarkRead(submission.id, !submission.is_read)}>
                {submission.is_read ? "Mark as Unread" : "Mark as Read"}
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Client Information */}
          <section className="rounded-2xl border p-4">
            <h3 className="text-xs uppercase tracking-wide mb-3 border-l-2 pl-3" style={{borderColor:'var(--v3-orange)'}}>Client Information</h3>
            <div className="space-y-2 text-sm">
              <div>
                <div className="text-muted-foreground">Name</div>
                <div className="font-medium">{submission.client_name || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Email</div>
                <div className="font-medium">{submission.client_email || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Phone</div>
                <div className="font-medium">{data.client_phone || '-'}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Company</div>
                <div className="font-medium">{data.company || '-'}</div>
              </div>
            </div>
          </section>

          {/* Address */}
          <section className="rounded-2xl border p-4">
            <h3 className="text-xs uppercase tracking-wide mb-3 border-l-2 pl-3" style={{borderColor:'var(--v3-orange)'}}>Property Address</h3>
            <div className="text-sm">
              {formatAny('property_address', submission.property_address || data.siteAddress || data.property_address)}
            </div>
          </section>

          {/* Form Details */}
          <section className="rounded-2xl border p-4 md:col-span-2">
            <h3 className="text-xs uppercase tracking-wide mb-3 border-l-2 pl-3" style={{borderColor:'var(--v3-orange)'}}>Form Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rows.map(([key, value]) => {
                if (["client_name","client_email","client_phone","company","property_address","siteAddress"].includes(key)) return null;
                return (
                  <div key={key} className="space-y-1">
                    <div className="text-xs text-muted-foreground">{prettifyKey(key)}</div>
                    <div className="text-sm break-words">{formatAny(key, value)}</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Attachments */}
          {Array.isArray(data.attachments) && data.attachments.length > 0 && (
            <section className="rounded-2xl border p-4 md:col-span-2">
              <h3 className="text-xs uppercase tracking-wide mb-3 border-l-2 pl-3" style={{borderColor:'var(--v3-orange)'}}>Attachments</h3>
              <div className="flex flex-wrap gap-2 text-sm">
                {data.attachments.map((f: any, i: number) => (
                  <a key={i} href={f?.url || '#'} target="_blank" rel="noreferrer" className="px-2 py-1 rounded border hover:bg-muted">
                    {f?.name || f?.url || `File ${i+1}`}
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


