import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, MapPin } from "lucide-react";
import { prettifyKey } from "@/lib/authorityToAct/labelMap";
import { formatAny, formatDateUK } from "@/lib/authorityToAct/formatters";
import LocationPicker from "@/components/LocationPicker";

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
  const [showMap, setShowMap] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const hasLocation = data.location_lat && data.location_lng;

  // Helper components matching the form structure
  const FormCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="form-card">
      <h2 className="form-section-title">{title}</h2>
      {children}
    </div>
  );

  const Field = ({ label, value, required = false }: { label: string; value: any; required?: boolean }) => (
    <div className="form-field">
      <label className="form-label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <div className="form-value">{value || '-'}</div>
    </div>
  );

  const YesNoField = ({ label, value }: { label: string; value: any }) => (
    <div className="form-field">
      <label className="form-label">{label}</label>
      <div className="form-value">{formatAny('boolean', value)}</div>
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!w-[95vw] !max-w-[95vw] md:!max-w-[95vw] !h-[98vh] !max-h-[98vh] overflow-hidden p-0 bg-[#0D0D0E]">
        {/* Print Styles */}
        <style>{`
          /* Screen styles - V3 Dark Theme */
          .form-card {
            background: var(--v3-bg-card, #15161A);
            border: 1px solid var(--v3-border, #2B2D33);
            border-radius: 16px;
            padding: 18px;
            box-shadow: inset 0 0 0 1px rgba(255, 106, 43, 0.3);
            margin-bottom: 18px;
          }
          .form-section-title {
            margin: 0 0 16px;
            font-weight: 700;
            font-size: 1.05rem;
            color: var(--v3-text-strong, #F8F8FA);
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .form-field {
            margin-bottom: 12px;
          }
          .form-label {
            display: block;
            font-weight: 600;
            margin: 6px 0;
            color: var(--v3-text, #E6E6EA);
            font-size: 0.9rem;
          }
          .form-value {
            background: var(--v3-bg-dark, #141416);
            border: 1px solid var(--v3-border, #2B2D33);
            border-radius: 10px;
            min-height: 42px;
            padding: 10px 12px;
            color: var(--v3-text, #E6E6EA);
          }
          .form-grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .form-grid-3 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
          }

          /* Print styles - Clean black & white */
          @media print {
            @page { margin: 0.5in; }
            body { background: white !important; }
            .dialog-overlay, .print-hide { display: none !important; }
            .form-card {
              background: white !important;
              border: 2px solid #333 !important;
              border-radius: 8px !important;
              padding: 16px !important;
              box-shadow: none !important;
              margin-bottom: 16px !important;
              page-break-inside: avoid;
            }
            .form-section-title {
              color: #000 !important;
              border-bottom: 2px solid #333;
              padding-bottom: 8px;
              margin-bottom: 12px;
            }
            .form-label {
              color: #333 !important;
              font-size: 0.85rem !important;
            }
            .form-value {
              background: white !important;
              border: 1px solid #666 !important;
              color: #000 !important;
              min-height: auto !important;
              padding: 6px 8px !important;
            }
            .form-header-print {
              display: block !important;
              text-align: center;
              margin-bottom: 20px;
              padding-bottom: 16px;
              border-bottom: 3px solid #000;
            }
            .form-header-print h1 {
              margin: 0;
              font-size: 24px;
              color: #000;
            }
            .form-header-print .subtitle {
              margin: 8px 0 0;
              font-size: 14px;
              color: #333;
            }
          }
          .form-header-print { display: none; }
        `}</style>

        {/* Sticky Header - Hidden on print */}
        <div className="print-hide sticky top-0 z-10 border-b border-[#2A2A2E]" style={{background:'linear-gradient(135deg, #0D0D0E 0%, #121214 100%)'}}>
          <div className="px-6 pt-4 pb-4">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold text-white">Client Instruction Form: Authority To Act — Squatter Eviction</DialogTitle>
              <DialogDescription className="text-gray-400 text-base mt-1">
                Submitted on {formatDateUK(submission.submitted_at)} by {submission.client_name || data.firstName + ' ' + data.lastName || "Unknown"}
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 flex-wrap mt-4">
              {hasLocation && (
                <Button size="sm" variant="outline" onClick={() => setShowMap(true)} className="border-[#2A2A2E] hover:bg-[#1C1C1E]">
                  <MapPin className="h-4 w-4 mr-2"/>View on Map
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handlePrint} className="border-[#2A2A2E] hover:bg-[#1C1C1E]">
                <Printer className="h-4 w-4 mr-2"/>Print / Download PDF
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

        {/* Form Content - Matches original form layout */}
        <div className="overflow-y-auto h-full p-6" style={{maxWidth: '1100px', margin: '0 auto'}}>
          {/* Print Header */}
          <div className="form-header-print">
            <h1>Client Instruction Form: Authority To Act — Squatter Eviction</h1>
            <div className="subtitle">Submitted on {formatDateUK(submission.submitted_at)}</div>
          </div>

          {/* CLIENT DETAILS */}
          <FormCard title="CLIENT DETAILS">
            <div className="form-grid-2">
              <Field label="First Name" value={data.firstName} required />
              <Field label="Last Name" value={data.lastName} required />
            </div>
            <div className="form-grid-2">
              <Field label="Company" value={data.company} />
              <Field label="Email" value={formatAny('email', data.email)} required />
            </div>
            <Field label="Phone" value={formatAny('phone', data.phone)} required />

            <h3 style={{marginTop: '16px', marginBottom: '8px', fontWeight: 600}}>Client Address</h3>
            <Field label="Address Line 1" value={data.clientAddress?.line1} required />
            <Field label="Address Line 2" value={data.clientAddress?.line2} />
            <div className="form-grid-3">
              <Field label="City" value={data.clientAddress?.city} required />
              <Field label="State / Province / Region" value={data.clientAddress?.region} />
              <Field label="Postal / Zip Code" value={data.clientAddress?.postcode} required />
            </div>
            <Field label="Country" value={data.clientAddress?.country} required />
          </FormCard>

          {/* SITE DETAILS */}
          <FormCard title="SITE DETAILS">
            <Field label="Address Line 1" value={data.siteAddress?.line1} required />
            <Field label="Address Line 2" value={data.siteAddress?.line2} />
            <div className="form-grid-3">
              <Field label="City" value={data.siteAddress?.city} required />
              <Field label="State / Province / Region" value={data.siteAddress?.region} />
              <Field label="Postal / Zip Code" value={data.siteAddress?.postcode} required />
            </div>
            <Field label="Country" value={data.siteAddress?.country} required />

            {(data.location_lat && data.location_lng) && (
              <div className="form-field">
                <label className="form-label">Location of site entrance</label>
                <div className="form-value">
                  {data.location_lat.toFixed(6)}, {data.location_lng.toFixed(6)}
                  {data.maps_link && <> — <a href={data.maps_link} target="_blank" rel="noreferrer">View on Map</a></>}
                </div>
              </div>
            )}

            <div className="form-grid-2" style={{marginTop: '12px'}}>
              <Field label="Property Type (select one)" value={formatAny('propertyType', data.propertyType)} required />
              <YesNoField label="Premises Occupied?" value={data.premisesOccupied} />
            </div>
            <div className="form-grid-2">
              <YesNoField label="Site Plan Available?" value={data.sitePlanAvailable} />
              <YesNoField label="Photos Available?" value={data.photosAvailable} />
            </div>

            {data.trespassDescription && (
              <Field label="Description of Trespass" value={data.trespassDescription} />
            )}

            <div className="form-grid-3" style={{marginTop: '12px'}}>
              <Field label="Number of Tents/Shelters" value={data.tents ?? 0} required />
              <Field label="Number of Motor Vehicles" value={data.vehicles ?? 0} required />
              <Field label="Number of Persons" value={data.persons ?? 0} required />
            </div>

            <div className="form-grid-2">
              <YesNoField label="Dogs on Site?" value={data.dogsOnSite} />
              <YesNoField label="Livestock on Site?" value={data.livestockOnSite} />
            </div>

            {data.changeUndertaking !== undefined && (
              <div className="form-field" style={{marginTop: '12px'}}>
                <label className="form-label">
                  <input type="checkbox" checked={data.changeUndertaking} disabled style={{marginRight: '8px'}} />
                  I undertake to advise V3 Services Ltd if there is a change in the number of trespassers.
                </label>
              </div>
            )}
          </FormCard>

          {/* SITE SECURITY AND WASTE REMOVAL */}
          {(data.haveSecurity !== undefined || data.wantSecurityQuote !== undefined || data.wantWasteQuote !== undefined) && (
            <FormCard title="SITE SECURITY AND WASTE REMOVAL">
              {data.haveSecurity !== undefined && <YesNoField label="Do you have security on site?" value={data.haveSecurity} />}
              {data.wantSecurityQuote !== undefined && <YesNoField label="Would you like a quote for security?" value={data.wantSecurityQuote} />}
              {data.wantWasteQuote !== undefined && <YesNoField label="Post eviction, would you like a quote for fly-tipping / waste removal?" value={data.wantWasteQuote} />}
            </FormCard>
          )}

          {/* OWNERSHIP / AUTHORITY DECLARATION */}
          <FormCard title="OWNERSHIP / AUTHORITY DECLARATION">
            <Field label="I confirm that I am (select one)" value={formatAny('authorityRole', data.authorityRole)} required />

            <h3 style={{marginTop: '16px', marginBottom: '8px', fontWeight: 600}}>Supporting Documentation (tick all that apply):</h3>
            {[
              {key: 'docsLandRegistry', label: 'Land Registry Title'},
              {key: 'docsLease', label: 'Lease Agreement'},
              {key: 'docsManagement', label: 'Management Contract'},
              {key: 'docsOther', label: 'Other'}
            ].map(doc => data[doc.key] !== undefined && (
              <div key={doc.key} className="form-field">
                <label className="form-label">
                  <input type="checkbox" checked={!!data[doc.key]} disabled style={{marginRight: '8px'}} />
                  {doc.label}
                </label>
              </div>
            ))}

            <div className="form-field" style={{marginTop: '16px'}}>
              <label className="form-label">
                <input type="checkbox" checked={data.acceptTerms} disabled style={{marginRight: '8px'}} />
                I confirm that I have received, read, understood and accept the 'Schedule of Charges' and 'Terms & Conditions'.
              </label>
            </div>

            <div className="form-grid-3" style={{marginTop: '16px'}}>
              {data.sigTitle && <Field label="Title" value={data.sigTitle} />}
              <Field label="First Name" value={data.sigFirst} required />
              <Field label="Last Name" value={data.sigLast} required />
            </div>

            {data.signatureDataUrl && (
              <div className="form-field">
                <label className="form-label">Signature</label>
                <div className="form-value">{formatAny('signature', data.signatureDataUrl)}</div>
              </div>
            )}

            {data.signatureDate && (
              <Field label="Date of Signature" value={formatAny('date', data.signatureDate)} required />
            )}
          </FormCard>

          {/* INVOICING DETAILS */}
          <FormCard title="INVOICING DETAILS">
            <Field label="Company / Name (For Invoicing)" value={data.invoiceCompany} required />

            <h3 style={{marginTop: '16px', marginBottom: '8px', fontWeight: 600}}>Invoice Address</h3>
            <Field label="Address Line 1" value={data.invoiceAddress?.line1} required />
            <Field label="Address Line 2" value={data.invoiceAddress?.line2} />
            <div className="form-grid-3">
              <Field label="City" value={data.invoiceAddress?.city} required />
              <Field label="State / Province / Region" value={data.invoiceAddress?.region} />
              <Field label="Postal / Zip Code" value={data.invoiceAddress?.postcode} required />
            </div>
            <Field label="Country" value={data.invoiceAddress?.country} required />

            <div className="form-grid-3" style={{marginTop: '16px'}}>
              {data.accountsTitle && <Field label="Accounts Contact Title" value={data.accountsTitle} />}
              {data.accountsFirst && <Field label="Accounts Contact First Name" value={data.accountsFirst} />}
              {data.accountsLast && <Field label="Accounts Contact Last Name" value={data.accountsLast} />}
            </div>

            <div className="form-grid-2">
              <Field label="Accounts Email Address" value={formatAny('email', data.accountsEmail)} required />
              <Field label="Accounts Contact Number" value={formatAny('phone', data.accountsPhone)} required />
            </div>

            <div className="form-grid-2">
              {data.vatNumber && <Field label="VAT Registration Number" value={data.vatNumber} />}
              {data.poNumber && <Field label="Purchase Order Number" value={data.poNumber} />}
            </div>
          </FormCard>

          {/* Footer */}
          <div style={{textAlign: 'center', padding: '20px', color: '#9CA3AF', fontSize: '0.85rem'}}>
            V3 Services Limited · Registered in England No. 10653477 · Registered Office: 117 Dartford Road, Dartford DA1 3EN · VAT No. 269833460 · ICO: ZA485365
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Map Viewer - Outside Dialog to avoid z-index conflicts */}
    {hasLocation && (
      <LocationPicker
        isOpen={showMap}
        onConfirm={() => setShowMap(false)}
        onCancel={() => setShowMap(false)}
        address={[
          data.siteAddress?.line1,
          data.siteAddress?.line2,
          data.siteAddress?.city,
          data.siteAddress?.region,
          data.siteAddress?.postcode,
          data.siteAddress?.country
        ].filter(Boolean).join(', ')}
        postcode={data.siteAddress?.postcode || ''}
        value={{
          lat: data.location_lat,
          lng: data.location_lng,
          maps_link: data.maps_link || `https://www.google.com/maps?q=${data.location_lat},${data.location_lng}`
        }}
        onChange={() => {}} // Read-only mode
      />
    )}
    </>
  );
}
