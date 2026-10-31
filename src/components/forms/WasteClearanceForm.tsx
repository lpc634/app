import React, { useEffect, useState } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import PhotoPicker from "./PhotoPicker";

/** =====================
 *  V3 DARK THEME (matches existing forms)
 *  ===================== */
const THEME_CSS = String.raw`
:root, .dark {
  --v3-orange:#FF6A2B; --v3-orange-dark:#D84E17; --v3-orange-glow:rgba(255,106,43,.45);
  --v3-bg-darkest:#0D0D0E; --v3-bg-dark:#141416; --v3-bg:#111114; --v3-bg-card:#15161A; --v3-border:#2B2D33;
  --v3-text-strong:#F8F8FA; --v3-text:#E6E6EA; --v3-text-muted:#9CA3AF;
}
.dark, .v3-root { background:var(--v3-bg-darkest); color:var(--v3-text); font-family:Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Arial; }
.v3-root, .v3-root * , .v3-root *::before, .v3-root *::after { box-sizing: border-box }
.page-shell{ max-width:1100px; margin:0 auto; padding:28px 18px 120px; }
.h1{ font-size:1.8rem; font-weight:800; color:var(--v3-text-strong) }
.h2{ font-size:1.05rem; font-weight:700; color:var(--v3-text-strong) }
.sub{ font-size:.9rem; color:var(--v3-text-muted) }
.dashboard-card{ background:var(--v3-bg-card); border:1px solid var(--v3-border); border-radius:16px; box-shadow: inset 0 0 0 1px var(--v3-orange), 0 10px 28px rgba(0,0,0,.35); padding:24px }

.row{ display:grid; grid-template-columns:1fr; gap:12px }
@media (min-width:780px){ .row-2{ grid-template-columns:1fr 1fr } .row-3{ grid-template-columns:repeat(3,1fr) } .row-4{ grid-template-columns:repeat(4,1fr) } }
.v3-input{ width:100%; background:var(--v3-bg-dark); border:1px solid var(--v3-border); color:var(--v3-text); height:42px; border-radius:10px; padding:0 12px }
.v3-input:focus{ outline:none; box-shadow:0 0 0 3px var(--v3-orange-glow); border-color:var(--v3-orange) }
.v3-textarea{ width:100%; background:var(--v3-bg-dark); border:1px solid var(--v3-border); color:var(--v3-text); border-radius:10px; padding:10px 12px; min-height:100px }
.v3-textarea:focus{ outline:none; box-shadow:0 0 0 3px var(--v3-orange-glow); border-color:var(--v3-orange) }
.button-primary{ background:linear-gradient(135deg,var(--v3-orange),var(--v3-orange-dark)); color:#fff; border:0; height:42px; padding:0 16px; border-radius:10px; cursor:pointer; font-weight:600 }
.button-primary:disabled{ opacity:0.5; cursor:not-allowed }
.btn-ghost{ height:42px; padding:0 16px; border-radius:10px; border:1px solid var(--v3-border); background:var(--v3-bg-card); color:var(--v3-text); cursor:pointer }
.btn-ghost:disabled{ opacity:0.5; cursor:not-allowed }
.progress-rail{ height:10px; border-radius:999px; background:#1d1f26; border:1px solid #2A2D36 }
.progress-bar{ height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--v3-orange),var(--v3-orange-dark)) }
.label-star{ color:#ff6868; margin-left:4px }

/* Yes/No pills, and the tick boxes for the types of waste */
.yn{ display:flex; gap:10px; align-items:center; flex-wrap:wrap }
.yn label{ display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--v3-border); border-radius:10px; background:var(--v3-bg-card); cursor:pointer; position:relative; overflow:hidden; transition: transform 120ms ease, background-color 180ms ease }
.yn label:active{ transform: scale(.97) }
.yn input{ width:16px; height:16px; accent-color: var(--v3-orange); }
@keyframes v3-ring { 0% { box-shadow: 0 0 0 0 rgba(255,106,43,.45) } 100% { box-shadow: 0 0 0 12px rgba(255,106,43,0) } }
.yn label:has(input:checked)::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; animation:v3-ring 520ms ease-out }
.yn label:has(input:checked){ background: linear-gradient(180deg, rgba(255,106,43,.15), rgba(255,106,43,0) 60%); border-color: var(--v3-border); }

/* Photo tiles */
.photo-tile{ position:relative; border:1px dashed #383B44; background:#17181D; border-radius:14px; height:140px; display:grid; place-items:center; cursor:pointer; overflow:hidden }
.photo-tile:hover{ border-color:var(--v3-orange); box-shadow:0 0 0 3px var(--v3-orange-glow) }
.photo-thumb{ width:100%; height:100%; object-fit:cover; border-radius:12px }
.photo-remove{ position:absolute; top:6px; right:6px; padding:4px 10px; border-radius:8px; border:1px solid var(--v3-border); background:rgba(0,0,0,.75); color:#fff; line-height:1; cursor:pointer; font-size:12px }
.photo-remove:hover{ background:rgba(0,0,0,.9) }

/* StarBorder */
.star-border-container{ display:block; position:relative; border-radius:20px; overflow:hidden; width:100% }
.border-gradient-bottom{ position:absolute; width:300%; height:50%; opacity:.7; bottom:-12px; right:-250%; border-radius:50%; animation:star-movement-bottom linear infinite alternate; z-index:0 }
.border-gradient-top{ position:absolute; width:300%; height:50%; opacity:.7; top:-12px; left:-250%; border-radius:50%; animation:star-movement-top linear infinite alternate; z-index:0 }
.inner-content{ position:relative; border:1px solid var(--v3-border); background:rgba(17,17,20,.6); backdrop-filter:blur(8px); color:var(--v3-text); font-size:16px; padding:12px 14px; border-radius:20px; z-index:1 }
.star-border-container .inner-content{ box-shadow: inset 0 0 0 1px var(--v3-orange) }
@keyframes star-movement-bottom{ 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(-100%,0);opacity:0} }
@keyframes star-movement-top{ 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(100%,0);opacity:0} }
`;

/** ===== Sticky StarBorder ===== */
function StarBorder({
  as: As = "div",
  className = "",
  color = "white",
  speed = "8s",
  thickness = 1,
  children,
  style,
  ...rest
}: any) {
  return (
    <As
      className={`star-border-container ${className}`}
      style={{ padding: `${thickness}px 0`, ...(style || {}) }}
      {...rest}
    >
      <div
        className="border-gradient-bottom"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="border-gradient-top"
        style={{
          background: `radial-gradient(circle, ${color}, transparent 10%)`,
          animationDuration: speed,
        }}
      />
      <div
        className="inner-content"
        style={{
          border: "1px solid var(--v3-border)",
          background: "rgba(17,17,20,.6)",
          backdropFilter: "blur(8px)",
          borderRadius: 20,
          boxShadow: "inset 0 0 0 1px var(--v3-orange)",
          padding: 12,
        }}
      >
        {children}
      </div>
    </As>
  );
}

/** ========= Schema ========= */
const WASTE_TYPES = [
  "General / household",
  "Building rubble",
  "Garden waste",
  "Furniture / mattresses",
  "Fridges / white goods",
  "Tyres",
  "Vehicle parts",
  "Other",
];

const yesNo = z.enum(["Yes", "No"], { error: "Please choose Yes or No" });

// Boxes that open, and must be filled in, only for the answer that needs explaining
const FOLLOW_UPS = [
  { question: "hazardous_waste", answer: "Yes", details: "hazardous_waste_details", message: "Please describe the hazardous waste" },
  { question: "site_fully_cleared", answer: "No", details: "waste_remaining_details", message: "Please say what was left and why" },
  { question: "site_damage", answer: "Yes", details: "site_damage_details", message: "Please describe the damage" },
] as const;

const schema = z
  .object({
    // Job details
    client: z.string().min(1, "Client is required"),
    address1: z.string().min(1, "Site address is required"),
    date: z.string().min(1, "Date is required"),
    arrival_time: z.string().min(1, "Arrival time is required"),

    // Agents on site
    agent_1: z.string().min(1, "Lead agent is required"),
    agent_2: z.string().optional(),
    agent_3: z.string().optional(),
    agent_4: z.string().optional(),

    // Waste details
    waste_types: z.array(z.string()).min(1, "Please tick at least one type of waste"),
    waste_details: z.string().optional(),
    amount_cleared: z.string().min(1, "Amount cleared is required"),
    hazardous_waste: yesNo,
    hazardous_waste_details: z.string().optional(),

    // Waste disposal
    waste_carrier: z.string().optional(),
    carrier_licence_number: z.string().optional(),
    carrier_vehicle_registration: z.string().optional(),
    disposal_site: z.string().optional(),
    waste_transfer_note_number: z.string().optional(),

    // Completion
    site_fully_cleared: yesNo,
    waste_remaining_details: z.string().optional(),
    site_secured: yesNo,
    site_damage: yesNo,
    site_damage_details: z.string().optional(),
    additional_notes: z.string().optional(),
    departure_time: z.string().min(1, "Departure time is required"),
    completion_date: z.string().min(1, "Completion date is required"),
  })
  .superRefine((values, ctx) => {
    FOLLOW_UPS.forEach(({ question, answer, details, message }) => {
      if (values[question] === answer && !values[details]?.trim()) {
        ctx.addIssue({ code: "custom", path: [details], message });
      }
    });
  });

type FormData = z.infer<typeof schema>;

/** ===== RHF helpers ===== */
function Field({ name, label, required, children }: any) {
  const { formState: { errors } } = useFormContext();
  const error = errors[name]?.message;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="h2" style={{ marginBottom: 8 }}>
        {label}
        {required && <span className="label-star">*</span>}
      </div>
      {children}
      {error && (
        <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
          {String(error)}
        </p>
      )}
    </div>
  );
}

function TextField({ name, label, required, type = "text", placeholder }: any) {
  const { register } = useFormContext();
  return (
    <Field name={name} label={label} required={required}>
      <input type={type} className="v3-input" placeholder={placeholder} {...register(name)} />
    </Field>
  );
}

function NotesField({ name, label, required, placeholder }: any) {
  const { register } = useFormContext();
  return (
    <Field name={name} label={label} required={required}>
      <textarea className="v3-textarea" placeholder={placeholder} {...register(name)} />
    </Field>
  );
}

function YesNo({ name, label }: { name: string; label: string }) {
  const { register } = useFormContext();
  return (
    <Field name={name} label={label} required>
      <div className="yn">
        {["Yes", "No"].map((answer) => (
          <label key={answer}>
            <input type="radio" value={answer} {...register(name)} />
            <span>{answer}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

function WasteTypes() {
  const { register } = useFormContext();
  return (
    <Field name="waste_types" label="Type of waste (tick all that apply)" required>
      <div className="yn">
        {WASTE_TYPES.map((type) => (
          <label key={type}>
            <input type="checkbox" value={type} {...register("waste_types")} />
            <span>{type}</span>
          </label>
        ))}
      </div>
    </Field>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <>
      <div className="h1" style={{ marginBottom: 8 }}>
        {title}
      </div>
      {hint && <p className="sub">{hint}</p>}
    </>
  );
}

/** ===== Main Component ===== */
interface Props {
  jobData: {
    id: number;
    title: string;
    address: string;
    arrival_time: string;
    agentName: string;
  };
  onSubmit: (data: { formData: any; photos: File[] }) => Promise<void>;
  onCancel: () => void;
}

export default function WasteClearanceForm({ jobData, onSubmit, onCancel }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [photos, setPhotos] = useState<File[]>([]);
  const formRef = React.useRef<HTMLFormElement>(null);

  const today = new Date().toISOString().split("T")[0];
  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      client: "",
      address1: jobData.address || "",
      date: today,
      arrival_time: "",
      agent_1: jobData.agentName || "",
      agent_2: "",
      agent_3: "",
      agent_4: "",
      waste_types: [],
      waste_details: "",
      amount_cleared: "",
      hazardous_waste_details: "",
      waste_carrier: "",
      carrier_licence_number: "",
      carrier_vehicle_registration: "",
      disposal_site: "",
      waste_transfer_note_number: "",
      waste_remaining_details: "",
      site_damage_details: "",
      additional_notes: "",
      departure_time: "",
      completion_date: today,
    },
  });

  const { watch, handleSubmit: rhfHandleSubmit } = methods;

  // Calculate progress based on scroll position (matches other forms)
  useEffect(() => {
    // Find the scrollable parent container (the modal's overflow-y-auto div)
    const findScrollableParent = (element: any): any => {
      if (!element) return null;
      const parent = element.parentElement;
      if (!parent) return null;

      const hasOverflow = getComputedStyle(parent).overflowY;
      if (hasOverflow === "auto" || hasOverflow === "scroll") {
        return parent;
      }
      return findScrollableParent(parent);
    };

    const scrollContainer = findScrollableParent(formRef.current) || window;

    const onScroll = () => {
      if (scrollContainer === window) {
        const d = document.documentElement;
        setProgress(window.scrollY / (d.scrollHeight - window.innerHeight || 1));
      } else {
        const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
        setProgress(scrollTop / (scrollHeight - clientHeight || 1));
      }
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scrollContainer.removeEventListener("scroll", onScroll);
  }, []);

  const onFormSubmit = async (data: FormData) => {
    if (photos.length === 0) {
      alert("Please add your before and after photos before submitting.");
      return;
    }

    try {
      setSubmitting(true);

      const formData: any = { ...data, waste_types: data.waste_types.join(", ") };
      // A box that was filled in, then closed by changing the answer, must not reach the report
      FOLLOW_UPS.forEach(({ question, answer, details }) => {
        if (data[question] !== answer) formData[details] = "";
      });

      await onSubmit({ formData, photos });
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="v3-root dark">
      <style>{THEME_CSS}</style>

      {/* Sticky Header */}
      <StarBorder
        style={{ position: "sticky", top: 0, zIndex: 100, marginBottom: 24 }}
        color="var(--v3-orange)"
        speed="6s"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h1" style={{ fontSize: "1.4rem", marginBottom: 4 }}>
              Waste Clearance Report
            </div>
            <div className="sub" style={{ fontSize: "0.85rem" }}>
              {jobData.address}
            </div>
          </div>
          <button type="button" onClick={onCancel} className="btn-ghost" style={{ flexShrink: 0 }}>
            Cancel
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="progress-rail">
            <motion.div
              className="progress-bar"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="sub" style={{ marginTop: 6, fontSize: "0.75rem", textAlign: "right" }}>
            {Math.round(progress * 100)}% Complete
          </div>
        </div>
      </StarBorder>

      <FormProvider {...methods}>
        <form ref={formRef} onSubmit={rhfHandleSubmit(onFormSubmit)}>
          <div className="page-shell">
            {/* JOB DETAILS */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <SectionHeading title="JOB DETAILS" hint="Basic information about the job and location" />
              <TextField name="client" label="Client" required />
              <TextField name="address1" label="Site address" required />
              <div className="row row-2">
                <TextField name="date" label="Date" type="date" required />
                <TextField name="arrival_time" label="Time of arrival" type="time" required />
              </div>
            </section>

            {/* AGENTS ON SITE */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <SectionHeading title="AGENTS ON SITE" />
              <TextField name="agent_1" label="1. Lead agent" required />
              <TextField name="agent_2" label="2. Agent" />
              <TextField name="agent_3" label="3. Agent" />
              <TextField name="agent_4" label="4. Agent" />
            </section>

            {/* WASTE DETAILS */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <SectionHeading title="WASTE DETAILS" hint="What was on site and how much was cleared" />
              <WasteTypes />
              <NotesField
                name="waste_details"
                label="Description of waste"
                placeholder="Describe the waste and where it was on site..."
              />
              <TextField
                name="amount_cleared"
                label="Amount cleared"
                required
                placeholder="e.g., 2 x 8 yard skips, 3 van loads"
              />
              <YesNo name="hazardous_waste" label="Hazardous waste found (asbestos, needles, chemicals, gas bottles)" />
              {watch("hazardous_waste") === "Yes" && (
                <NotesField
                  name="hazardous_waste_details"
                  label="Hazardous waste details"
                  required
                  placeholder="What was found and how it was dealt with..."
                />
              )}
            </section>

            {/* WASTE DISPOSAL */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <SectionHeading title="WASTE DISPOSAL" hint="Who took the waste away and where it went" />
              <TextField name="waste_carrier" label="Waste carrier" placeholder="Company that took the waste" />
              <div className="row row-2">
                <TextField name="carrier_licence_number" label="Carrier licence number" placeholder="e.g., CBDU123456" />
                <TextField name="carrier_vehicle_registration" label="Vehicle registration" placeholder="e.g., AB12 CDE" />
              </div>
              <div className="row row-2">
                <TextField name="disposal_site" label="Disposal site" placeholder="Tip or transfer station" />
                <TextField name="waste_transfer_note_number" label="Waste transfer note number" />
              </div>
            </section>

            {/* PHOTOS */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <SectionHeading
                title="PHOTOS"
                hint="Add photos of the site before and after the clearance, and of the waste transfer note if you have one."
              />
              <div style={{ marginTop: 16 }}>
                <PhotoPicker photos={photos} onChange={setPhotos} />
              </div>
            </section>

            {/* COMPLETION */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <SectionHeading title="COMPLETION" />
              <YesNo name="site_fully_cleared" label="Site fully cleared" />
              {watch("site_fully_cleared") === "No" && (
                <NotesField
                  name="waste_remaining_details"
                  label="What was left and why"
                  required
                  placeholder="Describe any waste still on site..."
                />
              )}
              <YesNo name="site_secured" label="Site secure on departure" />
              <YesNo name="site_damage" label="Any damage found or caused" />
              {watch("site_damage") === "Yes" && (
                <NotesField
                  name="site_damage_details"
                  label="Damage details"
                  required
                  placeholder="Describe the damage..."
                />
              )}
              <NotesField
                name="additional_notes"
                label="Report / notes"
                placeholder="Additional notes or observations..."
              />
              <div className="row row-2">
                <TextField name="departure_time" label="Departure time" type="time" required />
                <TextField name="completion_date" label="Completion date" type="date" required />
              </div>
            </section>

            {/* Submit Buttons */}
            <div style={{ display: "flex", gap: 16, justifyContent: "flex-end", marginTop: 32 }}>
              <button type="button" onClick={onCancel} className="btn-ghost" disabled={submitting}>
                Cancel
              </button>
              <button type="submit" className="button-primary" disabled={submitting}>
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
