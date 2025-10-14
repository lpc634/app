import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Printer, Download, MapPin, FileText, Image as ImageIcon } from "lucide-react";
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

  const Field = ({ label, value, span = false }: { label: string; value: any; span?: boolean }) => (
    <div className={span ? "col-span-full" : ""}>
      <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">{label}</div>
      <div className="text-base text-white">{value || '-'}</div>
    </div>
  );

  const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="rounded-xl border border-[#2A2A2E] bg-[#15161A] p-6 shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.2)'}}>
      <h2 className="text-lg font-bold text-white mb-5 pb-3 border-b border-[#2A2A2E]">{title}</h2>
      {children}
    </div>
  );

  // Check for photos and files
  const hasPhotos = data.attachments && Array.isArray(data.attachments);
  const photos = hasPhotos ? data.attachments.filter((f: any) => {
    const url = f?.url || f;
    return typeof url === 'string' && (url.startsWith('data:image/') || url.match(/\.(jpg|jpeg|png|gif|webp)$/i));
  }) : [];

  const files = hasPhotos ? data.attachments.filter((f: any) => {
    const url = f?.url || f;
    return typeof url === 'string' && !url.startsWith('data:image/') && !url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
  }) : [];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!w-[85vw] !max-w-[85vw] md:!max-w-[85vw] !h-[95vh] !max-h-[95vh] overflow-hidden p-0 bg-[#0D0D0E]">
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

        {/* Scrollable Content */}
        <div className="overflow-y-auto h-full p-6 space-y-5">
          {/* Client Details */}
          <Card title="Client Details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="First Name" value={data.firstName} />
              <Field label="Last Name" value={data.lastName} />
              <Field label="Company" value={data.company} />
              <Field label="Email" value={formatAny('email', data.email)} />
              <Field label="Phone" value={formatAny('phone', data.phone)} />
            </div>
            <div className="mt-6 pt-6 border-t border-[#2A2A2E]">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Client Address</div>
              <div className="text-base text-white">{formatAny('address', data.clientAddress)}</div>
            </div>
          </Card>

          {/* Site Details */}
          <Card title="Site Details">
            <div className="mb-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Site Address</div>
              <div className="text-base text-white">{formatAny('address', data.siteAddress)}</div>
            </div>
            {(data.location_lat && data.location_lng) && (
              <div className="mb-6 p-4 bg-[#1C1C1E] rounded-lg border border-[#2A2A2E]">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Site Entrance Location</div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#FF6A2B]" />
                  <a href={data.maps_link || `https://www.google.com/maps?q=${data.location_lat},${data.location_lng}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                    {data.location_lat.toFixed(6)}, {data.location_lng.toFixed(6)} - View on Map
                  </a>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Property Type" value={formatAny('propertyType', data.propertyType)} />
              <Field label="Premises Occupied" value={formatAny('premisesOccupied', data.premisesOccupied)} />
              <Field label="Site Plan Available" value={formatAny('sitePlanAvailable', data.sitePlanAvailable)} />
              <Field label="Photos Available" value={formatAny('photosAvailable', data.photosAvailable)} />
            </div>
            {data.trespassDescription && (
              <div className="mt-6">
                <Field label="Trespass Description" value={data.trespassDescription} span />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <Field label="Tents/Shelters" value={data.tents ?? 0} />
              <Field label="Motor Vehicles" value={data.vehicles ?? 0} />
              <Field label="Persons" value={data.persons ?? 0} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Field label="Dogs on Site" value={formatAny('dogsOnSite', data.dogsOnSite)} />
              <Field label="Livestock on Site" value={formatAny('livestockOnSite', data.livestockOnSite)} />
            </div>
          </Card>

          {/* Authority Declaration */}
          <Card title="Ownership / Authority Declaration">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Authority Role" value={formatAny('authorityRole', data.authorityRole)} />
              <Field label="Accept Terms" value={formatAny('acceptTerms', data.acceptTerms)} />
              <Field label="Signatory First Name" value={data.sigFirst} />
              <Field label="Signatory Last Name" value={data.sigLast} />
              {data.sigTitle && <Field label="Signatory Title" value={data.sigTitle} />}
              {data.signatureDate && <Field label="Date of Signature" value={formatAny('date', data.signatureDate)} />}
            </div>
            {data.signatureDataUrl && (
              <div className="mt-6 pt-6 border-t border-[#2A2A2E]">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Signature</div>
                {formatAny('signature', data.signatureDataUrl)}
              </div>
            )}
          </Card>

          {/* Invoicing Details */}
          <Card title="Invoicing Details">
            <div className="mb-6">
              <Field label="Invoice Company/Name" value={data.invoiceCompany} span />
            </div>
            <div className="mb-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Invoice Address</div>
              <div className="text-base text-white">{formatAny('address', data.invoiceAddress)}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.accountsTitle && <Field label="Accounts Title" value={data.accountsTitle} />}
              {data.accountsFirst && <Field label="Accounts First Name" value={data.accountsFirst} />}
              {data.accountsLast && <Field label="Accounts Last Name" value={data.accountsLast} />}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <Field label="Accounts Email" value={formatAny('email', data.accountsEmail)} />
              <Field label="Accounts Phone" value={formatAny('phone', data.accountsPhone)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {data.vatNumber && <Field label="VAT Number" value={data.vatNumber} />}
              {data.poNumber && <Field label="PO Number" value={data.poNumber} />}
            </div>
          </Card>

          {/* Photos */}
          {photos.length > 0 && (
            <Card title={`Photos (${photos.length})`}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {photos.map((photo: any, idx: number) => {
                  const url = photo?.url || photo;
                  const name = photo?.name || `Photo ${idx + 1}`;
                  return (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="group">
                      <div className="border-2 border-[#2A2A2E] rounded-lg overflow-hidden bg-white hover:border-[#FF6A2B] transition-all">
                        <img src={url} alt={name} className="w-full h-48 object-cover" />
                      </div>
                      <div className="text-xs text-gray-400 text-center mt-2 group-hover:text-[#FF6A2B] truncate">{name}</div>
                    </a>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Files */}
          {files.length > 0 && (
            <Card title={`Files & Attachments (${files.length})`}>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {files.map((file: any, idx: number) => {
                  const url = file?.url || file;
                  const name = file?.name || `File ${idx + 1}`;
                  return (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="group">
                      <div className="border-2 border-[#2A2A2E] rounded-lg p-4 bg-[#1C1C1E] hover:bg-[#252528] hover:border-[#FF6A2B] transition-all h-48 flex flex-col items-center justify-center gap-3">
                        <FileText className="h-10 w-10 text-gray-400 group-hover:text-[#FF6A2B] transition-colors" />
                        <Download className="h-4 w-4 text-gray-500 group-hover:text-[#FF6A2B] transition-colors" />
                      </div>
                      <div className="text-xs text-gray-400 text-center mt-2 group-hover:text-[#FF6A2B] truncate">{name}</div>
                    </a>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
