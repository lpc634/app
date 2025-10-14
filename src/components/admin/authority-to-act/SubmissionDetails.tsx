import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Printer, CheckCircle2, Circle, Download, FileText, Image as ImageIcon } from "lucide-react";
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

  // Helper to check if a value is an image URL or base64
  const isImage = (value: any) => {
    if (typeof value !== 'string') return false;
    return value.startsWith('data:image/') ||
           value.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
           value.includes('/uploads/') ||
           value.includes('cloudinary') ||
           value.includes('s3.amazonaws.com');
  };

  // Helper to check if a field contains images (but NOT signatures)
  const isImageField = (key: string, value: any) => {
    const lower = key.toLowerCase();
    // Exclude signatures - they should stay in form details
    if (lower.includes('signature')) {
      return false;
    }
    if (lower.includes('photo') || lower.includes('image') || lower.includes('picture')) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.some(v => typeof v === 'string' && isImage(v));
    }
    return isImage(value);
  };

  // Collect all photos/images from the data
  const photos: Array<{key: string, url: string, label: string}> = [];
  rows.forEach(([key, value]) => {
    if (isImageField(key, value)) {
      if (Array.isArray(value)) {
        value.forEach((url, idx) => {
          if (typeof url === 'string' && isImage(url)) {
            photos.push({ key: `${key}_${idx}`, url, label: `${prettifyKey(key)} ${idx + 1}` });
          }
        });
      } else if (typeof value === 'string' && isImage(value)) {
        photos.push({ key, url: value, label: prettifyKey(key) });
      }
    }
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!w-[65vw] !max-w-[65vw] md:!max-w-[65vw] !h-[90vh] !max-h-[90vh] overflow-y-auto p-0 bg-[#0D0D0E]">
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

        {/* Main Content */}
        <div className="p-6 space-y-6">
          {/* Top Row - Client Info & Property Address */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Client Information Card */}
            <section className="rounded-lg border border-[#2A2A2E] p-5 bg-[#15161A] shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 pb-2 border-b border-[#2A2A2E] text-gray-200 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF6A2B] rounded-full"></div>
                Client Information
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
                  <div className="text-xs text-gray-500 uppercase tracking-wide pt-0.5">Name</div>
                  <div className="font-semibold text-white text-base">{submission.client_name || '-'}</div>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
                  <div className="text-xs text-gray-500 uppercase tracking-wide pt-0.5">Email</div>
                  <div className="font-medium text-blue-400 text-base">{submission.client_email || '-'}</div>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
                  <div className="text-xs text-gray-500 uppercase tracking-wide pt-0.5">Phone</div>
                  <div className="font-medium text-gray-200 text-base">{data.client_phone || '-'}</div>
                </div>
                <div className="grid grid-cols-[110px_1fr] gap-2 items-start">
                  <div className="text-xs text-gray-500 uppercase tracking-wide pt-0.5">Company</div>
                  <div className="font-medium text-gray-200 text-base">{data.company || '-'}</div>
                </div>
              </div>
            </section>

            {/* Property Address Card */}
            <section className="rounded-lg border border-[#2A2A2E] p-5 bg-[#15161A] shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 pb-2 border-b border-[#2A2A2E] text-gray-200 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF6A2B] rounded-full"></div>
                Property Address
              </h3>
              <div className="text-base text-gray-200 leading-7 font-medium whitespace-pre-line">
                {formatAny('property_address', submission.property_address || data.siteAddress || data.property_address)}
              </div>
            </section>
          </div>

          {/* Form Details - Full Width */}
          <section className="rounded-lg border border-[#2A2A2E] p-5 bg-[#15161A] shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
            <h3 className="text-sm font-bold uppercase tracking-wider mb-4 pb-2 border-b border-[#2A2A2E] text-gray-200 flex items-center gap-2">
              <div className="w-1 h-4 bg-[#FF6A2B] rounded-full"></div>
              Form Details
            </h3>

            {(() => {
              // Filter out fields we don't want to show here
              const excludedFields = ["client_name","client_email","client_phone","company","property_address","siteAddress","attachments"];
              const filteredRows = rows.filter(([key, value]) => {
                if (excludedFields.includes(key)) return false;
                if (isImageField(key, value)) return false;
                return true;
              });

              // Organize fields into categories
              const categories = {
                accounts: [] as Array<[string, any]>,
                authority: [] as Array<[string, any]>,
                site: [] as Array<[string, any]>,
                signatory: [] as Array<[string, any]>,
                other: [] as Array<[string, any]>,
              };

              filteredRows.forEach(([key, value]) => {
                const lower = key.toLowerCase();
                if (lower.includes('account') || lower.includes('invoice') || lower.includes('vat') || lower.includes('po')) {
                  categories.accounts.push([key, value]);
                } else if (lower.includes('authority') || lower.includes('lease') || lower.includes('land') || lower.includes('management') || lower.includes('docs') || lower.includes('undertaking')) {
                  categories.authority.push([key, value]);
                } else if (lower.includes('property') || lower.includes('premises') || lower.includes('site') || lower.includes('trespass') || lower.includes('tent') || lower.includes('vehicle') || lower.includes('person') || lower.includes('dog') || lower.includes('livestock') || lower.includes('occupied')) {
                  categories.site.push([key, value]);
                } else if (lower.includes('sig') || lower.includes('signature')) {
                  categories.signatory.push([key, value]);
                } else {
                  categories.other.push([key, value]);
                }
              });

              return (
                <div className="space-y-6">
                  {/* Accounts & Billing */}
                  {categories.accounts.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FF6A2B] mb-3">Accounts & Billing</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
                        {categories.accounts.map(([key, value]) => (
                          <div key={key} className="space-y-1.5 min-w-0">
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{prettifyKey(key)}</div>
                            <div className="text-base text-gray-200 break-words leading-6 font-medium">{formatAny(key, value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Authority & Documentation */}
                  {categories.authority.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FF6A2B] mb-3">Authority & Documentation</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
                        {categories.authority.map(([key, value]) => (
                          <div key={key} className="space-y-1.5 min-w-0">
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{prettifyKey(key)}</div>
                            <div className="text-base text-gray-200 break-words leading-6 font-medium">{formatAny(key, value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Site Information */}
                  {categories.site.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FF6A2B] mb-3">Site Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
                        {categories.site.map(([key, value]) => (
                          <div key={key} className="space-y-1.5 min-w-0">
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{prettifyKey(key)}</div>
                            <div className="text-base text-gray-200 break-words leading-6 font-medium">{formatAny(key, value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Signatory */}
                  {categories.signatory.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FF6A2B] mb-3">Signatory</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
                        {categories.signatory.map(([key, value]) => (
                          <div key={key} className="space-y-1.5 min-w-0">
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{prettifyKey(key)}</div>
                            <div className="text-base text-gray-200 break-words leading-6 font-medium">{formatAny(key, value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other Fields */}
                  {categories.other.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-[#FF6A2B] mb-3">Additional Information</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-4">
                        {categories.other.map(([key, value]) => (
                          <div key={key} className="space-y-1.5 min-w-0">
                            <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{prettifyKey(key)}</div>
                            <div className="text-base text-gray-200 break-words leading-6 font-medium">{formatAny(key, value)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* Photos Section */}
          {photos.length > 0 && (
            <section className="rounded-lg border border-[#2A2A2E] p-5 bg-[#15161A] shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 pb-2 border-b border-[#2A2A2E] text-gray-200 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF6A2B] rounded-full"></div>
                Photos ({photos.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo) => (
                  <div key={photo.key} className="space-y-2">
                    <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                      <div className="border border-[#2A2A2E] rounded-lg overflow-hidden bg-white hover:border-[#FF6A2B] transition-all">
                        <img
                          src={photo.url}
                          alt={photo.label}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                    </a>
                    <div className="text-xs text-gray-400 text-center">{photo.label}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Attachments */}
          {Array.isArray(data.attachments) && data.attachments.length > 0 && (
            <section className="rounded-lg border border-[#2A2A2E] p-5 bg-[#15161A] shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-4 pb-2 border-b border-[#2A2A2E] text-gray-200 flex items-center gap-2">
                <div className="w-1 h-4 bg-[#FF6A2B] rounded-full"></div>
                Files & Attachments ({data.attachments.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {data.attachments.map((f: any, i: number) => {
                  const url = f?.url || f;
                  const name = f?.name || `File ${i+1}`;
                  const isImageFile = typeof url === 'string' && isImage(url);

                  return (
                    <a
                      key={i}
                      href={url || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="block group"
                    >
                      {isImageFile ? (
                        <div className="space-y-2">
                          <div className="border border-[#2A2A2E] rounded-lg overflow-hidden bg-white hover:border-[#FF6A2B] transition-all">
                            <img
                              src={url}
                              alt={name}
                              className="w-full h-48 object-cover"
                            />
                          </div>
                          <div className="text-xs text-gray-400 text-center truncate px-1">{name}</div>
                        </div>
                      ) : (
                        <div className="border border-[#2A2A2E] rounded-lg p-4 bg-[#1C1C1E] hover:bg-[#252528] hover:border-[#FF6A2B] transition-all h-48 flex flex-col items-center justify-center gap-3">
                          <FileText className="h-12 w-12 text-gray-400 group-hover:text-[#FF6A2B] transition-colors" />
                          <div className="text-xs text-gray-400 text-center break-words px-2 line-clamp-3">{name}</div>
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}


