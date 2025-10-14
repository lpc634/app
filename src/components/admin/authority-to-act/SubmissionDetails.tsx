import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Printer, Download } from "lucide-react";
import { formatDateUK } from "@/lib/authorityToAct/formatters";
import ClientInstructionFormAuthorityToActSquatterEviction from "@/components/forms/ClientInstructionFormAuthorityToActSquatterEviction";

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!w-[85vw] !max-w-[85vw] md:!max-w-[85vw] !h-[95vh] !max-h-[95vh] overflow-hidden p-0 bg-[#0D0D0E]">
        {/* Sticky Header with Actions */}
        <div className="sticky top-0 z-10 border-b border-[#2A2A2E]" style={{background:'linear-gradient(135deg, #0D0D0E 0%, #121214 100%)'}}>
          <div className="px-6 pt-4">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">Submission Details</DialogTitle>
              <DialogDescription className="text-gray-400 text-base mt-1">
                Submitted on {formatDateUK(submission.submitted_at)}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-6 pb-4 pt-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm text-gray-300 font-medium">
              {submission.client_name || "Unnamed"} • {submission.client_email || "No email"}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={copyLink} className="border-[#2A2A2E] hover:bg-[#1C1C1E]">
                <Copy className="h-4 w-4 mr-2"/>Copy Link
              </Button>
              <Button size="sm" variant="outline" onClick={() => (onPrint ? onPrint(submission) : window.print())} className="border-[#2A2A2E] hover:bg-[#1C1C1E]">
                <Printer className="h-4 w-4 mr-2"/>Print
              </Button>
              <Button size="sm" variant="outline" onClick={downloadJson} className="border-[#2A2A2E] hover:bg-[#1C1C1E]">
                <Download className="h-4 w-4 mr-2"/>JSON
              </Button>
              {onMarkRead && (
                <Button
                  size="sm"
                  className="bg-[#FF6A2B] hover:bg-[#FF7D42] text-white border-none shadow-md"
                  onClick={() => onMarkRead(submission.id, !submission.is_read)}
                >
                  {submission.is_read ? "Mark as Unread" : "Mark as Read"}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Form Content - Scrollable */}
        <div className="overflow-y-auto h-full" style={{pointerEvents: 'none'}}>
          <style>{`
            /* Make all form inputs read-only styled */
            .v3-root input,
            .v3-root select,
            .v3-root textarea,
            .v3-root button[type="submit"],
            .v3-root button[type="button"]:not([data-allow-click]) {
              pointer-events: none !important;
              opacity: 1 !important;
              cursor: default !important;
            }
            .v3-root input:disabled,
            .v3-root select:disabled,
            .v3-root textarea:disabled {
              opacity: 1 !important;
              color: var(--v3-text) !important;
            }
            /* Hide submit button */
            .v3-root button[type="submit"] {
              display: none !important;
            }
            /* Allow links to be clickable */
            .v3-root a {
              pointer-events: auto !important;
            }
          `}</style>
          <ClientInstructionFormAuthorityToActSquatterEviction
            initialData={data}
            onSubmit={() => {}}
            readOnly={true}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
