import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Printer, CheckCircle2, Circle, Download, FileText, Image as ImageIcon, MapPin } from "lucide-react";
import { prettifyKey } from "@/lib/authorityToAct/labelMap";
import { formatAny, formatDateUK } from "@/lib/authorityToAct/formatters";

const CARD_CLASS = "rounded-xl border border-[#2A2A2E] bg-[#15161A] p-6 shadow-lg";
const SECTION_TITLE_CLASS = "text-lg font-bold text-white mb-4 pb-3 border-b border-[#2A2A2E]";
const FIELD_CLASS = "space-y-2";
const LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider text-gray-400";
const VALUE_CLASS = "text-base text-white font-medium";

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

  // Debug logging
  console.log('Submission data:', data);
  console.log('Attachments:', data.attachments);

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

  console.log('Photos found:', photos);
  console.log('Photos length:', photos.length);

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
        <div className="p-6 space-y-5">
          {/* Client Details Card */}
          <section className={CARD_CLASS} style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
            <h2 className={SECTION_TITLE_CLASS}>Client Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>First Name</div>
                <div className={VALUE_CLASS}>{data.firstName || data.client_name?.split(' ')[0] || '-'}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Last Name</div>
                <div className={VALUE_CLASS}>{data.lastName || data.client_name?.split(' ').slice(1).join(' ') || '-'}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Company</div>
                <div className={VALUE_CLASS}>{data.company || '-'}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Email</div>
                <div className={VALUE_CLASS}>{formatAny('email', submission.client_email || data.email)}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Phone</div>
                <div className={VALUE_CLASS}>{formatAny('phone', data.phone || data.client_phone)}</div>
              </div>
            </div>
            <div className="mt-6 pt-6 border-t border-[#2A2A2E]">
              <h3 className="text-sm font-semibold text-gray-400 mb-4">Client Address</h3>
              <div className={VALUE_CLASS}>{formatAny('address', data.clientAddress)}</div>
            </div>
          </section>

          {/* Site Details Card */}
          <section className={CARD_CLASS} style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
            <h2 className={SECTION_TITLE_CLASS}>Site Details</h2>
            <div className={FIELD_CLASS + " mb-6"}>
              <div className={LABEL_CLASS}>Site Address</div>
              <div className={VALUE_CLASS}>{formatAny('address', submission.property_address || data.siteAddress)}</div>
            </div>
            {(data.location_lat && data.location_lng) && (
              <div className={FIELD_CLASS + " mb-6"}>
                <div className={LABEL_CLASS}>Location of Site Entrance</div>
                <div className="flex items-center gap-2 mt-2">
                  <MapPin className="h-4 w-4 text-[#FF6A2B]" />
                  <a href={data.maps_link || `https://www.google.com/maps?q=${data.location_lat},${data.location_lng}`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm">
                    {data.location_lat.toFixed(6)}, {data.location_lng.toFixed(6)}
                  </a>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Property Type</div>
                <div className={VALUE_CLASS}>{formatAny('propertyType', data.propertyType)}</div>
              </div>
              {data.propertyTypeOther && (
                <div className={FIELD_CLASS}>
                  <div className={LABEL_CLASS}>Property Type (Other)</div>
                  <div className={VALUE_CLASS}>{data.propertyTypeOther}</div>
                </div>
              )}
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Premises Occupied?</div>
                <div className={VALUE_CLASS}>{formatAny('premisesOccupied', data.premisesOccupied)}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Site Plan Available?</div>
                <div className={VALUE_CLASS}>{formatAny('sitePlanAvailable', data.sitePlanAvailable)}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Photos Available?</div>
                <div className={VALUE_CLASS}>{formatAny('photosAvailable', data.photosAvailable)}</div>
              </div>
            </div>
            {data.trespassDescription && (
              <div className={FIELD_CLASS + " mt-6"}>
                <div className={LABEL_CLASS}>Description of Trespass</div>
                <div className={VALUE_CLASS}>{data.trespassDescription}</div>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Number of Tents/Shelters</div>
                <div className={VALUE_CLASS}>{data.tents ?? '-'}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Number of Motor Vehicles</div>
                <div className={VALUE_CLASS}>{data.vehicles ?? '-'}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Number of Persons</div>
                <div className={VALUE_CLASS}>{data.persons ?? '-'}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Dogs on Site?</div>
                <div className={VALUE_CLASS}>{formatAny('dogsOnSite', data.dogsOnSite)}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Livestock on Site?</div>
                <div className={VALUE_CLASS}>{formatAny('livestockOnSite', data.livestockOnSite)}</div>
              </div>
            </div>
            {data.changeUndertaking !== undefined && (
              <div className={FIELD_CLASS + " mt-6"}>
                <div className={LABEL_CLASS}>Change Undertaking</div>
                <div className={VALUE_CLASS}>{formatAny('changeUndertaking', data.changeUndertaking)}</div>
              </div>
            )}
          </section>

          {/* Site Security and Waste Removal Card */}
          {(data.haveSecurity !== undefined || data.wantSecurityQuote !== undefined || data.wantWasteQuote !== undefined) && (
            <section className={CARD_CLASS} style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
              <h2 className={SECTION_TITLE_CLASS}>Site Security and Waste Removal</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {data.haveSecurity !== undefined && (
                  <div className={FIELD_CLASS}>
                    <div className={LABEL_CLASS}>Do you have security on site?</div>
                    <div className={VALUE_CLASS}>{formatAny('haveSecurity', data.haveSecurity)}</div>
                  </div>
                )}
                {data.wantSecurityQuote !== undefined && (
                  <div className={FIELD_CLASS}>
                    <div className={LABEL_CLASS}>Would you like a quote for security?</div>
                    <div className={VALUE_CLASS}>{formatAny('wantSecurityQuote', data.wantSecurityQuote)}</div>
                  </div>
                )}
                {data.wantWasteQuote !== undefined && (
                  <div className={FIELD_CLASS}>
                    <div className={LABEL_CLASS}>Would you like a quote for waste removal?</div>
                    <div className={VALUE_CLASS}>{formatAny('wantWasteQuote', data.wantWasteQuote)}</div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Ownership / Authority Declaration Card */}
          <section className={CARD_CLASS} style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
            <h2 className={SECTION_TITLE_CLASS}>Ownership / Authority Declaration</h2>
            <div className={FIELD_CLASS + " mb-6"}>
              <div className={LABEL_CLASS}>Authority Role</div>
              <div className={VALUE_CLASS}>{formatAny('authorityRole', data.authorityRole)}</div>
            </div>
            <div className="mb-6">
              <div className={LABEL_CLASS + " mb-3"}>Supporting Documentation</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data.docsLandRegistry !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className={VALUE_CLASS}>{formatAny('docsLandRegistry', data.docsLandRegistry)}</span>
                    <span className="text-gray-400 text-sm">Land Registry</span>
                  </div>
                )}
                {data.docsLease !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className={VALUE_CLASS}>{formatAny('docsLease', data.docsLease)}</span>
                    <span className="text-gray-400 text-sm">Lease Agreement</span>
                  </div>
                )}
                {data.docsManagement !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className={VALUE_CLASS}>{formatAny('docsManagement', data.docsManagement)}</span>
                    <span className="text-gray-400 text-sm">Management Contract</span>
                  </div>
                )}
                {data.docsOther !== undefined && (
                  <div className="flex items-center gap-2">
                    <span className={VALUE_CLASS}>{formatAny('docsOther', data.docsOther)}</span>
                    <span className="text-gray-400 text-sm">Other</span>
                  </div>
                )}
              </div>
            </div>
            <div className={FIELD_CLASS + " mb-6"}>
              <div className={LABEL_CLASS}>Accept Terms & Conditions</div>
              <div className={VALUE_CLASS}>{formatAny('acceptTerms', data.acceptTerms)}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              {data.sigTitle && (
                <div className={FIELD_CLASS}>
                  <div className={LABEL_CLASS}>Title</div>
                  <div className={VALUE_CLASS}>{data.sigTitle}</div>
                </div>
              )}
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>First Name</div>
                <div className={VALUE_CLASS}>{data.sigFirst || '-'}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Last Name</div>
                <div className={VALUE_CLASS}>{data.sigLast || '-'}</div>
              </div>
            </div>
            {data.signatureDataUrl && (
              <div className={FIELD_CLASS + " mb-6"}>
                <div className={LABEL_CLASS}>Signature</div>
                <div className="mt-2">{formatAny('signature', data.signatureDataUrl)}</div>
              </div>
            )}
            {data.signatureDate && (
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Date of Signature</div>
                <div className={VALUE_CLASS}>{formatAny('date', data.signatureDate)}</div>
              </div>
            )}
          </section>

          {/* Invoicing Details Card */}
          <section className={CARD_CLASS} style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
            <h2 className={SECTION_TITLE_CLASS}>Invoicing Details</h2>
            <div className={FIELD_CLASS + " mb-6"}>
              <div className={LABEL_CLASS}>Company / Name (For Invoicing)</div>
              <div className={VALUE_CLASS}>{data.invoiceCompany || '-'}</div>
            </div>
            <div className="mb-6">
              <div className={LABEL_CLASS + " mb-3"}>Invoice Address</div>
              <div className={VALUE_CLASS}>{formatAny('address', data.invoiceAddress)}</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {data.accountsTitle && (
                <div className={FIELD_CLASS}>
                  <div className={LABEL_CLASS}>Accounts Contact Title</div>
                  <div className={VALUE_CLASS}>{data.accountsTitle}</div>
                </div>
              )}
              {data.accountsFirst && (
                <div className={FIELD_CLASS}>
                  <div className={LABEL_CLASS}>Accounts Contact First Name</div>
                  <div className={VALUE_CLASS}>{data.accountsFirst}</div>
                </div>
              )}
              {data.accountsLast && (
                <div className={FIELD_CLASS}>
                  <div className={LABEL_CLASS}>Accounts Contact Last Name</div>
                  <div className={VALUE_CLASS}>{data.accountsLast}</div>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Accounts Email Address</div>
                <div className={VALUE_CLASS}>{formatAny('email', data.accountsEmail)}</div>
              </div>
              <div className={FIELD_CLASS}>
                <div className={LABEL_CLASS}>Accounts Contact Number</div>
                <div className={VALUE_CLASS}>{formatAny('phone', data.accountsPhone)}</div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              {data.vatNumber && (
                <div className={FIELD_CLASS}>
                  <div className={LABEL_CLASS}>VAT Registration Number</div>
                  <div className={VALUE_CLASS}>{data.vatNumber}</div>
                </div>
              )}
              {data.poNumber && (
                <div className={FIELD_CLASS}>
                  <div className={LABEL_CLASS}>Purchase Order Number</div>
                  <div className={VALUE_CLASS}>{data.poNumber}</div>
                </div>
              )}
            </div>
          </section>

          {/* Photos Section */}
          {photos.length > 0 && (
            <section className="rounded-lg border border-[#2A2A2E] p-6 bg-[#15161A] shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-[#2A2A2E]">
                <ImageIcon className="h-5 w-5 text-[#FF6A2B]" />
                <h3 className="text-base font-bold uppercase tracking-wider text-gray-200">
                  Photos
                </h3>
                <span className="text-sm text-gray-400">({photos.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {photos.map((photo) => (
                  <div key={photo.key} className="group">
                    <a href={photo.url} target="_blank" rel="noreferrer" className="block">
                      <div className="border-2 border-[#2A2A2E] rounded-lg overflow-hidden bg-white hover:border-[#FF6A2B] transition-all shadow-md hover:shadow-xl">
                        <img
                          src={photo.url}
                          alt={photo.label}
                          className="w-full h-40 object-cover"
                        />
                      </div>
                      <div className="text-xs text-gray-400 text-center mt-2 group-hover:text-[#FF6A2B] transition-colors truncate px-1">
                        {photo.label}
                      </div>
                    </a>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Files & Attachments Section */}
          {Array.isArray(data.attachments) && data.attachments.length > 0 && (
            <section className="rounded-lg border border-[#2A2A2E] p-6 bg-[#15161A] shadow-lg" style={{boxShadow:'inset 0 0 0 1px rgba(255, 106, 43, 0.15)'}}>
              <div className="flex items-center gap-3 mb-5 pb-3 border-b border-[#2A2A2E]">
                <FileText className="h-5 w-5 text-[#FF6A2B]" />
                <h3 className="text-base font-bold uppercase tracking-wider text-gray-200">
                  Files & Attachments
                </h3>
                <span className="text-sm text-gray-400">({data.attachments.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {data.attachments.map((f: any, i: number) => {
                  const url = f?.url || f;
                  const name = f?.name || f?.filename || `File ${i+1}`;
                  const isImageFile = typeof url === 'string' && isImage(url);

                  return (
                    <div key={i} className="group">
                      <a
                        href={url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="block"
                      >
                        {isImageFile ? (
                          <>
                            <div className="border-2 border-[#2A2A2E] rounded-lg overflow-hidden bg-white hover:border-[#FF6A2B] transition-all shadow-md hover:shadow-xl">
                              <img
                                src={url}
                                alt={name}
                                className="w-full h-40 object-cover"
                              />
                            </div>
                            <div className="text-xs text-gray-400 text-center mt-2 group-hover:text-[#FF6A2B] transition-colors truncate px-1">
                              {name}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="border-2 border-[#2A2A2E] rounded-lg p-4 bg-[#1C1C1E] hover:bg-[#252528] hover:border-[#FF6A2B] transition-all h-40 flex flex-col items-center justify-center gap-3 shadow-md hover:shadow-xl">
                              <FileText className="h-10 w-10 text-gray-400 group-hover:text-[#FF6A2B] transition-colors" />
                              <Download className="h-4 w-4 text-gray-500 group-hover:text-[#FF6A2B] transition-colors" />
                            </div>
                            <div className="text-xs text-gray-400 text-center mt-2 group-hover:text-[#FF6A2B] transition-colors truncate px-1">
                              {name}
                            </div>
                          </>
                        )}
                      </a>
                    </div>
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


