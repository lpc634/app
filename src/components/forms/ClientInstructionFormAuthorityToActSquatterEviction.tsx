import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

/** =============================================================
 *  Client Instruction Form: Authority To Act — Squatter Eviction
 *  Professional, client-facing UI (no V3 dark styling)
 *  - Pure React + RHF + Zod (no external UI deps)
 *  - Light theme, accessible labels, mobile-first responsive grid
 *  - Inline CSS below for easy drop-in
 *  - Signature pad implemented with <canvas>
 *  ============================================================= */

const CSS = String.raw`
:root{ --brand:#2563eb; --brand-600:#1d4ed8; --ink:#111827; --muted:#4b5563; --bg:#f8fafc; --card:#ffffff; --border:#e5e7eb; --danger:#ef4444; --ok:#059669; --focus: 0 0 0 3px rgba(37,99,235,.35); }
*{box-sizing:border-box}
html,body,#root{height:100%}
body{margin:0;background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif}
.page{max-width:980px;margin:0 auto;padding:28px 16px 120px}
.header{position:sticky;top:0;z-index:20;background:linear-gradient(180deg,#fff,rgba(255,255,255,.85));backdrop-filter:saturate(180%) blur(6px);border-bottom:1px solid var(--border)}
.header-inner{max-width:980px;margin:0 auto;padding:12px 16px}
.h1{margin:0;font-weight:800;font-size:1.6rem;color:var(--ink)}
.subtle{color:var(--muted);font-size:.9rem}

.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.card + .card{margin-top:18px}
.section-title{margin:0 0 10px;font-weight:700;font-size:1.05rem}
.help{font-size:.85rem;color:var(--muted)}

.grid{display:grid;gap:12px}
@media(min-width:760px){ .g-2{grid-template-columns:1fr 1fr} .g-3{grid-template-columns:repeat(3,1fr)} .g-4{grid-template-columns:repeat(4,1fr)} }
label.form-label{display:block;font-weight:600;margin:6px 0}
.req{color:var(--danger);margin-left:4px}
.input,select.input,textarea.input{width:100%;border:1px solid var(--border);background:#fff;border-radius:10px;min-height:42px;padding:10px 12px;color:var(--ink)}
.input:focus{outline:none;box-shadow:var(--focus);border-color:var(--brand)}
textarea.input{min-height:90px;resize:vertical}

.inline{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pill{display:flex;align-items:center;gap:8px;padding:8px 12px;border:1px solid var(--border);border-radius:999px;background:#fff;cursor:pointer}
.pill input{width:16px;height:16px;accent-color:var(--brand)}

.radio-row{display:flex;gap:12px;flex-wrap:wrap}
.radio{display:flex;align-items:center;gap:8px}
.radio input{accent-color:var(--brand)}

small.error{display:block;color:var(--danger);margin-top:6px}

.divider{height:1px;background:var(--border);margin:10px 0}

.files{display:grid;gap:10px}
.file-row{display:flex;align-items:center;gap:10px}
.file-row input[type=file]{display:block}
.file-chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border:1px solid var(--border);border-radius:999px;background:#f3f4f6}
.file-chip button{border:0;background:#0000;cursor:pointer}

.counter{display:flex;gap:6px;align-items:center}
.counter select{min-width:100px}

.footer-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:16px}
.btn{appearance:none;border:1px solid var(--border);background:#fff;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer}
.btn:focus{outline:none;box-shadow:var(--focus)}
.btn.primary{background:var(--brand);border-color:var(--brand-600);color:#fff}
.btn.ghost{background:#fff}

.notice{padding:12px;border:1px solid var(--border);border-radius:12px;background:#fbfdff}

/* Signature Pad */
.sig-wrap{border:1px dashed var(--border);border-radius:10px;background:#fff}
.sig-toolbar{display:flex;justify-content:space-between;gap:8px;padding:8px;border-bottom:1px solid var(--border)}
.sig-canvas{width:100%;height:200px;display:block}
`;

/** Schema */
const addrSchema = z.object({
  line1: z.string().min(1, "Address line 1 is required"),
  line2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  region: z.string().optional(),
  postcode: z.string().min(1, "Postcode is required"),
  country: z.string().min(1, "Country is required"),
});

const schema = z.object({
  // Client details
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  company: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(5, "Enter a valid phone"),
  clientAddress: addrSchema,

  // Site details
  siteAddress: addrSchema,
  what3words: z.string().optional(),
  propertyType: z.union([z.literal("open"), z.literal("commercial"), z.literal("retail"), z.literal("other")]),
  propertyTypeOther: z.string().optional(),
  premisesOccupied: z.boolean(),
  sitePlanAvailable: z.boolean(),
  photosAvailable: z.boolean(),
  trespassDescription: z.string().optional(),
  tents: z.coerce.number().min(0),
  vehicles: z.coerce.number().min(0),
  persons: z.coerce.number().min(0),
  dogsOnSite: z.boolean(),
  livestockOnSite: z.boolean(),
  changeUndertaking: z.boolean().default(true),

  // Security & waste
  haveSecurity: z.boolean(),
  wantSecurityQuote: z.boolean(),
  wantWasteQuote: z.boolean(),

  // Ownership/authority
  authorityRole: z.union([z.literal("owner"), z.literal("agent")]),
  docsLandRegistry: z.boolean().optional(),
  docsLease: z.boolean().optional(),
  docsManagement: z.boolean().optional(),
  docsOther: z.boolean().optional(),
  attachments: z.any().optional(),
  acceptTerms: z.boolean().refine(v=>v===true,{ message:"You must accept the Schedule of Charges and Terms & Conditions" }),
  sigTitle: z.string().optional(),
  sigFirst: z.string().min(1, "Required"),
  sigLast: z.string().min(1, "Required"),
  signatureDataUrl: z.string().min(1, "Signature is required"),
  signatureDate: z.string().min(1, "Date of signature is required"),

  // Invoicing
  invoiceCompany: z.string().min(1, "Company/Name is required"),
  invoiceAddress: addrSchema,
  accountsTitle: z.string().optional(),
  accountsFirst: z.string().optional(),
  accountsLast: z.string().optional(),
  accountsEmail: z.string().email("Enter a valid email"),
  accountsPhone: z.string().min(5, "Enter a valid phone"),
  vatNumber: z.string().optional(),
  poNumber: z.string().optional(),
});

/** Reusable bits */
const countries = ["United Kingdom","Ireland","France","Germany","Spain","Italy","United States","Other"];
const titles = ["","Mr","Mrs","Miss","Ms","Mx","Dr","Prof"];

function Field({label, required=false, children, hint, error}){
  return (
    <div>
      <label className="form-label">{label}{required && <span className="req">*</span>}</label>
      {children}
      {hint && <div className="help">{hint}</div>}
      {error && <small className="error">{error}</small>}
    </div>
  );
}

function AddressFields({ path }){
  const { register, formState:{errors} } = useFormContext();
  const er = errors?.[path] || {};
  const get = (k)=> er?.[k]?.message;
  return (
    <div className="grid">
      <Field label="Address Line 1" required error={get('line1')}>
        <input className="input" {...register(`${path}.line1`)} />
      </Field>
      <Field label="Address Line 2">
        <input className="input" {...register(`${path}.line2`)} />
      </Field>
      <div className="grid g-3">
        <Field label="City" required error={get('city')}>
          <input className="input" {...register(`${path}.city`)} />
        </Field>
        <Field label="State / Province / Region" hint="Optional">
          <input className="input" {...register(`${path}.region`)} />
        </Field>
        <Field label="Postal / Zip Code" required error={get('postcode')}>
          <input className="input" {...register(`${path}.postcode`)} />
        </Field>
      </div>
      <Field label="Country" required error={get('country')}>
        <select className="input" {...register(`${path}.country`)}>
          <option value="">Select country…</option>
          {countries.map(c=> <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
    </div>
  );
}

function YesNo({name,label}){
  const { setValue, watch } = useFormContext();
  const v = !!watch(name);
  return (
    <div className="inline">
      <span className="form-label" style={{marginBottom:0}}>{label}</span>
      <label className="pill"><input type="radio" name={name} checked={v===true} onChange={()=>setValue(name,true,{shouldDirty:true})}/> Yes</label>
      <label className="pill"><input type="radio" name={name} checked={v===false} onChange={()=>setValue(name,false,{shouldDirty:true})}/> No</label>
    </div>
  );
}

function NumberSelect({name,min=0,max=50}){
  const { setValue, watch } = useFormContext();
  const v = watch(name) ?? 0;
  const opts = useMemo(()=> Array.from({length:max-min+1},(_,i)=> i+min), [min,max]);
  return (
    <select className="input" value={String(v)} onChange={(e)=>setValue(name, Number(e.target.value), {shouldDirty:true})}>
      {opts.map(n=> <option key={n} value={n}>{n}</option>)}
    </select>
  );
}

function FilePicker({ name, label }){
  const { setValue, watch } = useFormContext();
  const files = watch(name) || [];
  function onChange(e){
    const list = Array.from(e.target.files || []);
    setValue(name, [...files, ...list], { shouldDirty: true });
  }
  function removeAt(i){
    const next = [...files]; next.splice(i,1); setValue(name,next,{shouldDirty:true});
  }
  return (
    <div className="files">
      <div className="file-row">
        <input type="file" multiple onChange={onChange} />
      </div>
      <div className="inline" style={{flexWrap:'wrap'}}>
        {files.map((f,i)=> (
          <span key={i} className="file-chip">{f.name} <button type="button" onClick={()=>removeAt(i)} aria-label={`Remove ${f.name}`}>×</button></span>
        ))}
      </div>
    </div>
  );
}

function SignaturePad({ name }){
  const { setValue, watch } = useFormContext();
  const dataUrl = watch(name) || "";
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  useEffect(()=>{ setValue(name, dataUrl, { shouldDirty:false }); },[]); // init

  function getPos(e){
    const c = canvasRef.current; const rect = c.getBoundingClientRect();
    const x = (e.touches? e.touches[0].clientX : e.clientX) - rect.left;
    const y = (e.touches? e.touches[0].clientY : e.clientY) - rect.top;
    return {x,y};
  }
  function start(e){ drawing.current = true; const ctx = canvasRef.current.getContext('2d'); ctx.lineWidth=2; ctx.lineCap='round'; ctx.strokeStyle='#111827'; const {x,y}=getPos(e); ctx.beginPath(); ctx.moveTo(x,y); }
  function move(e){ if(!drawing.current) return; const ctx = canvasRef.current.getContext('2d'); const {x,y}=getPos(e); ctx.lineTo(x,y); ctx.stroke(); }
  function end(){ if(!drawing.current) return; drawing.current=false; const url = canvasRef.current.toDataURL('image/png'); setValue(name,url,{shouldDirty:true}); }
  function clear(){ const c = canvasRef.current; const ctx = c.getContext('2d'); ctx.clearRect(0,0,c.width,c.height); setValue(name,"",{shouldDirty:true}); }

  return (
    <div className="sig-wrap">
      <div className="sig-toolbar">
        <div className="help">Sign below with mouse or touch.</div>
        <div className="inline">
          <button type="button" className="btn" onClick={clear}>Clear</button>
        </div>
      </div>
      <canvas className="sig-canvas" ref={canvasRef} width={800} height={240}
        onMouseDown={start} onMouseMove={move} onMouseUp={end} onMouseLeave={end}
        onTouchStart={start} onTouchMove={move} onTouchEnd={end} />
      {dataUrl? <div className="help" style={{padding:"6px 10px"}}>Signature captured ✔</div> : <div className="help" style={{padding:"6px 10px"}}>No signature yet</div>}
    </div>
  );
}

export default function ClientAuthorityToActSquatterEviction(){
  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      clientAddress:{ country:"United Kingdom" },
      siteAddress:{ country:"United Kingdom" },
      propertyType:"open", premisesOccupied:false, sitePlanAvailable:false, photosAvailable:false,
      tents:0, vehicles:0, persons:0, dogsOnSite:false, livestockOnSite:false, changeUndertaking:true,
      haveSecurity:false, wantSecurityQuote:false, wantWasteQuote:false,
      authorityRole:"owner", acceptTerms:false,
      signatureDate: "",
      invoiceAddress:{ country:"United Kingdom" },
    }
  });
  const { register, handleSubmit, watch, formState:{errors} } = methods;

  const propertyType = watch("propertyType");
  const photosAvailable = watch("photosAvailable");
  const sitePlanAvailable = watch("sitePlanAvailable");

  const onSubmit = (values)=>{
    // Normally send to API; for demo just log
    console.log("Client Instruction — Squatter Eviction", values);
    alert("Submitted (demo) — check console for JSON payload.");
  };

  return (
    <FormProvider {...methods}>
      <style>{CSS}</style>
      <div className="header"><div className="header-inner"><h1 className="h1">Client Instruction Form: Authority To Act — Squatter Eviction</h1><div className="subtle">Please complete all required fields. Fields marked with <span className="req">*</span> are mandatory.</div></div></div>
      <main className="page">
        {/* Client Details */}
        <section className="card">
          <h2 className="section-title">Client Details</h2>
          <div className="grid g-2">
            <Field label="First Name" required error={errors.firstName?.message}><input className="input" {...register("firstName")} /></Field>
            <Field label="Last Name" required error={errors.lastName?.message}><input className="input" {...register("lastName")} /></Field>
            <Field label="Company"><input className="input" {...register("company")} /></Field>
            <Field label="Email" required error={errors.email?.message}><input className="input" type="email" {...register("email")} /></Field>
            <Field label="Phone" required error={errors.phone?.message}><input className="input" type="tel" {...register("phone")} /></Field>
          </div>
          <div className="divider" />
          <h3 className="subtle" style={{fontWeight:700,marginBottom:6}}>Client Address</h3>
          <AddressFields path="clientAddress" />
        </section>

        {/* Site Details */}
        <section className="card">
          <h2 className="section-title">Site Details</h2>
          <AddressFields path="siteAddress" />
          <div className="grid g-2" style={{marginTop:12}}>
            <Field label="What3Words location of trespass entrance" hint="Format: ///word.word.word">
              <input className="input" placeholder="///word.word.word" {...register("what3words")} />
            </Field>
            <div>
              <label className="form-label">Property Type (select one) <span className="req">*</span></label>
              <div className="radio-row">
                <label className="radio"><input type="radio" value="open" {...register("propertyType")} checked={propertyType==='open'} /> Open Land</label>
                <label className="radio"><input type="radio" value="commercial" {...register("propertyType")} checked={propertyType==='commercial'} /> Commercial Unit</label>
                <label className="radio"><input type="radio" value="retail" {...register("propertyType")} checked={propertyType==='retail'} /> Business / Retail Park</label>
                <label className="radio"><input type="radio" value="other" {...register("propertyType")} checked={propertyType==='other'} /> Other</label>
              </div>
              {errors.propertyType?.message && <small className="error">{errors.propertyType.message}</small>}
              {propertyType==='other' && (
                <div style={{marginTop:8}}>
                  <input className="input" placeholder="Please specify" {...register("propertyTypeOther")} />
                </div>
              )}
            </div>
          </div>

          <div className="grid" style={{marginTop:12}}>
            <YesNo name="premisesOccupied" label="Premises Occupied?" />
            <YesNo name="sitePlanAvailable" label="Site Plan Available?" />
            {sitePlanAvailable && <div className="notice">If you have a digital site plan, please attach it in the Supporting Documentation section below.</div>}
            <YesNo name="photosAvailable" label="Photos Available?" />
            {photosAvailable && <div className="notice">You can attach photos in the Supporting Documentation section below.</div>}
          </div>

          <Field label="Description of Trespass" hint="Forced entry, threats of violence, etc.">
            <textarea className="input" {...register("trespassDescription")} />
          </Field>

          <div className="grid g-3" style={{marginTop:12}}>
            <Field label="Number of Tents/Shelters" required error={errors.tents?.message}><NumberSelect name="tents" max={100} /></Field>
            <Field label="Number of Motor Vehicles" required error={errors.vehicles?.message}><NumberSelect name="vehicles" max={100} /></Field>
            <Field label="Number of Persons" required error={errors.persons?.message}><NumberSelect name="persons" max={500} /></Field>
          </div>

          <div className="grid" style={{marginTop:12}}>
            <YesNo name="dogsOnSite" label="Dogs on Site?" />
            <YesNo name="livestockOnSite" label="Livestock on Site?" />
          </div>

          <div className="notice" style={{marginTop:12}}>
            <label className="radio"><input type="checkbox" {...register("changeUndertaking")} defaultChecked /> I undertake to advise V3 Services Ltd if there is a change in the number of trespassers.</label>
          </div>
        </section>

        {/* Site Security & Waste */}
        <section className="card">
          <h2 className="section-title">Site Security and Waste Removal</h2>
          <div className="grid">
            <YesNo name="haveSecurity" label="Do you have security on site?" />
            <YesNo name="wantSecurityQuote" label="Would you like a quote for security?" />
            <YesNo name="wantWasteQuote" label="Post eviction, would you like a quote for fly‑tipping / waste removal?" />
          </div>
        </section>

        {/* Ownership / Authority */}
        <section className="card">
          <h2 className="section-title">Ownership / Authority Declaration</h2>
          <div className="help" style={{marginBottom:10}}>
            The Client must provide proof of ownership or legal authority before V3 Services Ltd will commence any eviction services. The property must be clearly shown on a printed map, with its boundaries marked, and that map must be attached to this instruction form.
          </div>

          <label className="form-label">I confirm that I am (select one): <span className="req">*</span></label>
          <div className="radio-row" style={{marginBottom:10}}>
            <label className="radio"><input type="radio" value="owner" {...register("authorityRole")} /> The legal owner of the property</label>
            <label className="radio"><input type="radio" value="agent" {...register("authorityRole")} /> An authorised agent/representative of the owner</label>
          </div>
          {errors.authorityRole?.message && <small className="error">{errors.authorityRole.message}</small>}

          <div className="grid g-2">
            <div>
              <label className="form-label">Supporting Documentation (tick all that apply):</label>
              <div className="grid">
                <label className="radio"><input type="checkbox" {...register("docsLandRegistry")} /> Land Registry Title</label>
                <label className="radio"><input type="checkbox" {...register("docsLease")} /> Lease Agreement</label>
                <label className="radio"><input type="checkbox" {...register("docsManagement")} /> Management Contract</label>
                <label className="radio"><input type="checkbox" {...register("docsOther")} /> Other</label>
              </div>
            </div>
            <div>
              <Field label="File Uploads" hint="Attach supporting documents, photos, and site plans (PDF, JPG, PNG, etc.)">
                <FilePicker name="attachments" />
              </Field>
            </div>
          </div>

          <div className="divider" />
          <div className="help" style={{marginBottom:10}}>
            <label className="radio"><input type="checkbox" {...register("acceptTerms")} /> <strong>Attention:</strong> I confirm that I have received, read, understood and accept the 'Schedule of Charges' and 'Terms & Conditions'. I hereby instruct V3 Services Ltd and/or their nominated agent(s) to proceed.</label>
          </div>
          {errors.acceptTerms?.message && <small className="error">{errors.acceptTerms.message}</small>}

          <div className="grid g-3">
            <Field label="Title">
              <select className="input" {...register("sigTitle")}>{titles.map(t=> <option key={t} value={t}>{t || "(none)"}</option>)}</select>
            </Field>
            <Field label="First Name" required error={errors.sigFirst?.message}><input className="input" {...register("sigFirst")} /></Field>
            <Field label="Last Name" required error={errors.sigLast?.message}><input className="input" {...register("sigLast")} /></Field>
          </div>
          <div style={{marginTop:10}}>
            <Field label="Signature" required error={errors.signatureDataUrl?.message}>
              <SignaturePad name="signatureDataUrl" />
            </Field>
          </div>
          <div className="grid g-3" style={{marginTop:10}}>
            <Field label="Date of Signature" required error={errors.signatureDate?.message}><input className="input" type="date" {...register("signatureDate")} /></Field>
          </div>
        </section>

        {/* Invoicing Details */}
        <section className="card">
          <h2 className="section-title">Invoicing Details</h2>
          <Field label="Company / Name (For Invoicing)" required error={errors.invoiceCompany?.message}><input className="input" {...register("invoiceCompany")} /></Field>
          <div className="divider" />
          <h3 className="subtle" style={{fontWeight:700,marginBottom:6}}>Invoice Address</h3>
          <AddressFields path="invoiceAddress" />
          <div className="grid g-3" style={{marginTop:12}}>
            <Field label="Accounts Contact Title"><select className="input" {...register("accountsTitle")}>{titles.map(t=> <option key={t} value={t}>{t || "(none)"}</option>)}</select></Field>
            <Field label="Accounts Contact First Name"><input className="input" {...register("accountsFirst")} /></Field>
            <Field label="Accounts Contact Last Name"><input className="input" {...register("accountsLast")} /></Field>
          </div>
          <div className="grid g-2" style={{marginTop:12}}>
            <Field label="Accounts Email Address" required error={errors.accountsEmail?.message}><input className="input" type="email" {...register("accountsEmail")} /></Field>
            <Field label="Accounts Contact Number" required error={errors.accountsPhone?.message}><input className="input" type="tel" {...register("accountsPhone")} /></Field>
          </div>
          <div className="grid g-2" style={{marginTop:12}}>
            <Field label="VAT Registration Number"><input className="input" {...register("vatNumber")} /></Field>
            <Field label="Purchase Order Number"><input className="input" {...register("poNumber")} /></Field>
          </div>
        </section>

        <section className="card">
          <div className="help" style={{textAlign:'center'}}>
            V3 Services Limited · Registered in England No. 10653477 · Registered Office: 117 Dartford Road, Dartford DA1 3EN · VAT No. 269833460 · ICO: ZA485365
          </div>
          <div className="footer-actions">
            <button type="button" className="btn ghost" onClick={()=>window.history.back()}>Cancel</button>
            <button type="button" className="btn primary" onClick={handleSubmit(onSubmit)}>Submit</button>
          </div>
        </section>
      </main>
    </FormProvider>
  );
}
