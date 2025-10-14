import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Printer, Download } from "lucide-react";
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

  // Get all fields from the data
  const allFields = Object.entries(data).filter(([key, value]) =>
    value !== undefined && value !== null && value !== ""
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!w-[90vw] !max-w-[90vw] md:!max-w-[90vw] !h-[95vh] !max-h-[95vh] overflow-hidden p-0 bg-[#0D0D0E]">
        {/* Sticky Header */}
        <div className="sticky top-0 z-10 border-b border-[#2A2A2E]" style={{background:'linear-gradient(135deg, #0D0D0E 0%, #121214 100%)'}}>
          <div className="px-6 pt-4">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">Authority to Act — Submission</DialogTitle>
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

        {/* Scrollable Content - Simple field list */}
        <div className="overflow-y-auto h-full p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {allFields.map(([key, value]) => (
              <div key={key} className="border-b border-[#2A2A2E] pb-4">
                <div className="text-sm font-semibold text-[#FF6A2B] mb-2">{prettifyKey(key)}</div>
                <div className="text-base text-white pl-4">{formatAny(key, value)}</div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
