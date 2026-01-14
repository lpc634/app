import React, { useEffect, useMemo, useState } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

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

/* Yes/No pills */
.yn{ display:flex; gap:10px; align-items:center; flex-wrap:wrap }
.yn label{ display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--v3-border); border-radius:10px; background:var(--v3-bg-card); cursor:pointer; position:relative; overflow:hidden; transition: transform 120ms ease, background-color 180ms ease }
.yn label:active{ transform: scale(.97) }
.yn input{ width:16px; height:16px; accent-color: var(--v3-orange); }
@keyframes v3-ring { 0% { box-shadow: 0 0 0 0 rgba(255,106,43,.45) } 100% { box-shadow: 0 0 0 12px rgba(255,106,43,0) } }
.yn label:has(input:checked)::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; animation:v3-ring 520ms ease-out }
.yn label:has(input:checked){ background: linear-gradient(180deg, rgba(255,106,43,.15), rgba(255,106,43,0) 60%); border-color: var(--v3-border); }

/* Photo tiles */
.photo-grid{ display:grid; grid-template-columns:1fr; gap:18px }
@media (min-width:780px){ .photo-grid{ grid-template-columns:1fr 1fr } }
.photo-tile{ position:relative; border:1px dashed #383B44; background:#17181D; border-radius:14px; height:140px; display:grid; place-items:center; cursor:pointer; overflow:hidden }
.photo-tile:hover{ border-color:var(--v3-orange); box-shadow:0 0 0 3px var(--v3-orange-glow) }
.photo-thumb{ width:100%; height:100%; object-fit:cover; border-radius:12px }
.photo-remove{ position:absolute; top:6px; right:6px; padding:4px 10px; border-radius:8px; border:1px solid var(--v3-border); background:rgba(0,0,0,.75); color:#fff; line-height:1; cursor:pointer; font-size:12px }
.photo-remove:hover{ background:rgba(0,0,0,.9) }
.photo-tile--empty{ width:100%; height:100%; display:grid; place-items:center; cursor:pointer; color:var(--v3-text-muted) }

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
const schema = z.object({
  // Basic details
  client: z.string().min(1, "Client name is required"),
  address1: z.string().min(1, "Address is required"),
  address2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  date: z.string().min(1, "Date is required"),
  arrival_time: z.string().min(1, "Arrival time is required"),

  // Enforcement agents
  enforcement_manager: z.string().min(1, "Enforcement Agent Manager is required"),
  agent2: z.string().optional(),
  agent3: z.string().optional(),
  agent4: z.string().optional(),

  // Vehicle details
  vehicle_registration: z.string().min(1, "Vehicle registration is required"),
  vehicle_vin: z.string().min(1, "Vehicle VIN number is required"),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_colour: z.string().optional(),

  // Police log
  police_contacted: z.boolean().default(false),

  // Recovery and accessibility
  height_barriers: z.boolean().default(false),
  recovery_truck_access: z.boolean().default(false),

  // Bodyworn CCTV
  bodyworn_cctv: z.boolean().default(false),

  // Location and notes
  vehicle_location: z.string().optional(),
  report_notes: z.string().optional(),

  // Departure time
  departure_time: z.string().min(1, "Departure time is required"),
});

type FormData = z.infer<typeof schema>;

/** ===== RHF helpers ===== */
function YesNo({ name, label }: { name: string; label: string }) {
  const { setValue, watch } = useFormContext();
  const v = !!watch(name);
  return (
    <div style={{ marginTop: 10 }}>
      <div className="h2" style={{ fontWeight: 600, marginBottom: 8 }}>
        {label}
      </div>
      <div className="yn">
        <label aria-checked={String(v === true)}>
          <input
            type="radio"
            name={name}
            checked={v === true}
            onChange={() => setValue(name, true, { shouldDirty: true })}
          />
          <span>Yes</span>
        </label>
        <label aria-checked={String(v === false)}>
          <input
            type="radio"
            name={name}
            checked={v === false}
            onChange={() => setValue(name, false, { shouldDirty: true })}
          />
          <span>No</span>
        </label>
      </div>
    </div>
  );
}

/** ===== Photo Upload ===== */
function PhotoSection() {
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const newPhotos = [...photos];
    const newPreviews = [...previews];

    newPhotos[index] = file;
    newPreviews[index] = URL.createObjectURL(file);

    setPhotos(newPhotos);
    setPreviews(newPreviews);
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    const newPreviews = [...previews];
    
    if (newPreviews[index]) {
      URL.revokeObjectURL(newPreviews[index]);
    }
    
    newPhotos[index] = null as any;
    newPreviews[index] = "";
    
    setPhotos(newPhotos);
    setPreviews(newPreviews);
  };

  // Expose photos to parent form
  useEffect(() => {
    (window as any).__abandonedVehiclePhotos = photos.filter(Boolean);
  }, [photos]);

  const photoSlots = [
    { label: "FRONT of Vehicle (Showing registration)", required: true },
    { label: "BACK of Vehicle (Showing Registration)", required: true },
    { label: "DRIVERS SIDE of Vehicle (Showing Abandonment Notice)", required: true },
    { label: "Additional PHOTO", required: false },
    { label: "Additional PHOTO", required: false },
    { label: "Additional PHOTO", required: false },
  ];

  return (
    <div>
      <div className="h1" style={{ marginBottom: 8 }}>
        PHOTOS OF SITE/INVENTORY
      </div>
      <p className="sub" style={{ marginBottom: 24 }}>
        Upload photos of the vehicle and abandonment notice. First 3 photos are required.
      </p>
      <div className="photo-grid">
        {photoSlots.map((slot, index) => (
          <div key={index}>
            <label
              className="h2"
              style={{
                display: "block",
                fontWeight: 600,
                marginBottom: 8,
                fontSize: "0.95rem",
              }}
            >
              {slot.label} {index + 1}
              {slot.required && <span className="label-star">*</span>}
            </label>
            <div className="photo-tile">
              {previews[index] ? (
                <>
                  <img
                    src={previews[index]}
                    alt={`Preview ${index + 1}`}
                    className="photo-thumb"
                  />
                  <button
                    type="button"
                    className="photo-remove"
                    onClick={() => removePhoto(index)}
                  >
                    Remove
                  </button>
                </>
              ) : (
                <label className="photo-tile--empty" htmlFor={`photo-${index}`}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontSize: "2rem", marginBottom: 8 }}>📷</div>
                    <div style={{ fontSize: "0.85rem" }}>
                      Click to upload
                      {slot.required && <span className="label-star"> *</span>}
                    </div>
                  </div>
                  <input
                    type="file"
                    id={`photo-${index}`}
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => handleFileChange(e, index)}
                  />
                </label>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
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
  onSubmit: (data: { formData: FormData; photos: File[] }) => Promise<void>;
  onCancel: () => void;
}

export default function AbandonedVehicleForm({
  jobData,
  onSubmit,
  onCancel,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);

  const methods = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      client: jobData.title || "",
      address1: jobData.address || "",
      address2: "",
      city: "",
      postcode: "",
      date: new Date().toISOString().split("T")[0],
      arrival_time: "",
      enforcement_manager: jobData.agentName || "",
      agent2: "",
      agent3: "",
      agent4: "",
      vehicle_registration: "",
      vehicle_vin: "",
      vehicle_make: "",
      vehicle_model: "",
      vehicle_colour: "",
      police_contacted: false,
      height_barriers: false,
      recovery_truck_access: false,
      bodyworn_cctv: false,
      vehicle_location: "",
      report_notes: "",
      departure_time: "",
    },
  });

  const { register, formState: { errors }, handleSubmit: rhfHandleSubmit } = methods;

  // Calculate progress based on filled fields
  useEffect(() => {
    const subscription = methods.watch((data) => {
      const requiredFields = [
        "client",
        "address1",
        "date",
        "arrival_time",
        "enforcement_manager",
        "vehicle_registration",
        "vehicle_vin",
        "departure_time",
      ];
      
      const filled = requiredFields.filter((field) => {
        const value = data[field as keyof FormData];
        return value !== undefined && value !== "";
      }).length;
      
      setProgress((filled / requiredFields.length) * 100);
    });
    
    return () => subscription.unsubscribe();
  }, [methods]);

  const onFormSubmit = async (data: FormData) => {
    try {
      setSubmitting(true);

      // Get photos from window global
      const photos = (window as any).__abandonedVehiclePhotos || [];

      // Validate required photos
      if (photos.length < 3) {
        alert("Please upload the first 3 required photos before submitting.");
        setSubmitting(false);
        return;
      }

      await onSubmit({ formData: data, photos });
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
        style={{
          position: "sticky",
          top: 0,
          zIndex: 100,
          marginBottom: 24,
        }}
        color="var(--v3-orange)"
        speed="6s"
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h1" style={{ fontSize: "1.4rem", marginBottom: 4 }}>
              Abandoned Vehicle Report
            </div>
            <div className="sub" style={{ fontSize: "0.85rem" }}>
              {jobData.address}
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="btn-ghost"
            style={{ flexShrink: 0 }}
          >
            Cancel
          </button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div className="progress-rail">
            <motion.div
              className="progress-bar"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div
            className="sub"
            style={{ marginTop: 6, fontSize: "0.75rem", textAlign: "right" }}
          >
            {Math.round(progress)}% Complete
          </div>
        </div>
      </StarBorder>

      <FormProvider {...methods}>
        <form onSubmit={rhfHandleSubmit(onFormSubmit)}>
          <div className="page-shell">
            {/* SERVE REPORT DETAILS */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <div className="h1" style={{ marginBottom: 8 }}>
                SERVE REPORT DETAILS
              </div>
              <p className="sub" style={{ marginBottom: 24 }}>
                Basic information about the job and location
              </p>

              <div className="row">
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    CLIENT <span className="label-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    {...register("client")}
                  />
                  {errors.client && (
                    <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
                      {errors.client.message}
                    </p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                  Address attended <span className="label-star">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Address Line 1"
                  className="v3-input"
                  style={{ marginBottom: 12 }}
                  {...register("address1")}
                />
                {errors.address1 && (
                  <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: -8, marginBottom: 12 }}>
                    {errors.address1.message}
                  </p>
                )}
                <input
                  type="text"
                  placeholder="Address Line 2"
                  className="v3-input"
                  style={{ marginBottom: 12 }}
                  {...register("address2")}
                />
                <div className="row row-2">
                  <input
                    type="text"
                    placeholder="City"
                    className="v3-input"
                    {...register("city")}
                  />
                  <input
                    type="text"
                    placeholder="Postal / Zip Code"
                    className="v3-input"
                    {...register("postcode")}
                  />
                </div>
              </div>

              <div className="row row-2" style={{ marginTop: 16 }}>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    DATE <span className="label-star">*</span>
                  </label>
                  <input
                    type="date"
                    className="v3-input"
                    {...register("date")}
                  />
                  {errors.date && (
                    <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
                      {errors.date.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    TIME OF ARRIVAL <span className="label-star">*</span>
                  </label>
                  <input
                    type="time"
                    className="v3-input"
                    {...register("arrival_time")}
                  />
                  {errors.arrival_time && (
                    <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
                      {errors.arrival_time.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ENFORCEMENT AGENT/S ATTENDANCE */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <div className="h1" style={{ marginBottom: 8 }}>
                ENFORCEMENT AGENT/S ATTENDANCE
              </div>
              <p className="sub" style={{ marginBottom: 24 }}>
                Please enter your enforcement agent name/s below
              </p>

              <div className="row">
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    1. ENFORCEMENT AGENT MANAGER <span className="label-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    {...register("enforcement_manager")}
                  />
                  {errors.enforcement_manager && (
                    <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
                      {errors.enforcement_manager.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="row" style={{ marginTop: 16 }}>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    2. ENFORCEMENT AGENT
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    {...register("agent2")}
                  />
                </div>
              </div>

              <div className="row" style={{ marginTop: 16 }}>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    3. ENFORCEMENT AGENT
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    {...register("agent3")}
                  />
                </div>
              </div>

              <div className="row" style={{ marginTop: 16 }}>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    4. ENFORCEMENT AGENT
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    {...register("agent4")}
                  />
                </div>
              </div>
            </section>

            {/* VEHICLE DETAILS */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <div className="h1" style={{ marginBottom: 8 }}>
                VEHICLE DETAILS
              </div>
              <p className="sub" style={{ marginBottom: 24 }}>
                Details about the abandoned vehicle
              </p>

              <div className="row">
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    Vehicle Registrations <span className="label-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    placeholder="e.g., AB12 CDE"
                    {...register("vehicle_registration")}
                  />
                  {errors.vehicle_registration && (
                    <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
                      {errors.vehicle_registration.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="row" style={{ marginTop: 16 }}>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    Vehicle VIN Number <span className="label-star">*</span>
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    placeholder="17-character VIN"
                    {...register("vehicle_vin")}
                  />
                  {errors.vehicle_vin && (
                    <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
                      {errors.vehicle_vin.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="row row-3" style={{ marginTop: 16 }}>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    MAKE
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    placeholder="e.g., Ford"
                    {...register("vehicle_make")}
                  />
                </div>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    MODEL
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    placeholder="e.g., Focus"
                    {...register("vehicle_model")}
                  />
                </div>
                <div>
                  <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                    COLOUR
                  </label>
                  <input
                    type="text"
                    className="v3-input"
                    placeholder="e.g., Blue"
                    {...register("vehicle_colour")}
                  />
                </div>
              </div>
            </section>

            {/* POLICE LOG */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <div className="h1" style={{ marginBottom: 8 }}>
                POLICE LOG
              </div>
              <YesNo name="police_contacted" label="POLICE CONTACTED" />
            </section>

            {/* RECOVERY AND ACCESSIBILITY */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <div className="h1" style={{ marginBottom: 16 }}>
                Recovery and Accessibility
              </div>
              <YesNo name="height_barriers" label="Does the site have height barriers" />
              <div style={{ marginTop: 16 }}>
                <YesNo name="recovery_truck_access" label="Can a large recovery truck gain access" />
              </div>
            </section>

            {/* PHOTOS */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <PhotoSection />
            </section>

            {/* ADDITIONAL INFO */}
            <section className="dashboard-card" style={{ marginBottom: 32 }}>
              <YesNo name="bodyworn_cctv" label="Bodyworn CCTV Used:" />

              <div style={{ marginTop: 24 }}>
                <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                  Location of vehicle on site:
                </label>
                <textarea
                  className="v3-textarea"
                  placeholder="Describe where the vehicle is located..."
                  {...register("vehicle_location")}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                  REPORT/NOTES
                </label>
                <textarea
                  className="v3-textarea"
                  placeholder="Additional notes or observations..."
                  {...register("report_notes")}
                />
              </div>

              <div style={{ marginTop: 16 }}>
                <label className="h2" style={{ display: "block", marginBottom: 8 }}>
                  Departure time <span className="label-star">*</span>
                </label>
                <input
                  type="time"
                  className="v3-input"
                  {...register("departure_time")}
                />
                {errors.departure_time && (
                  <p style={{ color: "#ff6868", fontSize: "0.85rem", marginTop: 4 }}>
                    {errors.departure_time.message}
                  </p>
                )}
              </div>
            </section>

            {/* Submit Buttons */}
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "flex-end",
                marginTop: 32,
              }}
            >
              <button
                type="button"
                onClick={onCancel}
                className="btn-ghost"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
