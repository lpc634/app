import React, { useEffect, useMemo, useState } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";

/** =====================
 *  V3 DARK THEME (matches prototype: sticky header + progress + yn pills)
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
.v3-textarea{ width:100%; background:var(--v3-bg-dark); border:1px solid var(--v3-border); color:var(--v3-text); border-radius:10px; padding:10px 12px }
.v3-textarea:focus{ outline:none; box-shadow:0 0 0 3px var(--v3-orange-glow); border-color:var(--v3-orange) }
.button-primary{ background:linear-gradient(135deg,var(--v3-orange),var(--v3-orange-dark)); color:#fff; border:0; height:42px; padding:0 16px; border-radius:10px; cursor:pointer }
.button-primary:disabled{ opacity:0.5; cursor:not-allowed }
.btn-ghost{ height:42px; padding:0 16px; border-radius:10px; border:1px solid var(--v3-border); background:var(--v3-bg-card); color:var(--v3-text); cursor:pointer }
.btn-ghost:disabled{ opacity:0.5; cursor:not-allowed }
.progress-rail{ height:10px; border-radius:999px; background:#1d1f26; border:1px solid #2A2D36 }
.progress-bar{ height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--v3-orange),var(--v3-orange-dark)) }
.label-star{ color:#ff6868; margin-left:4px }

/* Yes/No pills (prototype style) */
.yn{ display:flex; gap:10px; align-items:center; flex-wrap:wrap }
.yn label{ display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--v3-border); border-radius:10px; background:var(--v3-bg-card); cursor:pointer; position:relative; overflow:hidden; transition: transform 120ms ease, background-color 180ms ease }
.yn label:active{ transform: scale(.97) }
.yn input{ width:16px; height:16px; accent-color: var(--v3-orange); }
/* selected pill — no orange border/glow; only gentle orange wash + ripple ring */
@keyframes v3-ring { 0% { box-shadow: 0 0 0 0 rgba(255,106,43,.45) } 100% { box-shadow: 0 0 0 12px rgba(255,106,43,0) } }
.yn label:has(input:checked)::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; animation:v3-ring 520ms ease-out }
.yn label:has(input:checked){ background: linear-gradient(180deg, rgba(255,106,43,.15), rgba(255,106,43,0) 60%); border-color: var(--v3-border); }

/* Photo tiles */
.photo-grid{ display:grid; grid-template-columns:1fr; gap:18px }
@media (min-width:780px){ .photo-grid{ grid-template-columns:1fr 1fr } }
.photo-tile{ position:relative; border:1px dashed #383B44; background:#17181D; border-radius:14px; height:118px; display:grid; place-items:center; cursor:pointer; overflow:hidden }
.photo-tile:hover{ border-color:var(--v3-orange); box-shadow:0 0 0 3px var(--v3-orange-glow) }
.photo-thumb{ width:100%; height:100%; object-fit:cover; border-radius:12px }
.photo-remove{ position:absolute; top:6px; right:6px; padding:2px 8px; border-radius:8px; border:1px solid var(--v3-border); background:rgba(0,0,0,.55); color:var(--v3-text); line-height:1; cursor:pointer }
.photo-remove:hover{ background:rgba(0,0,0,.75) }
.photo-tile--empty{ width:100%; height:100%; display:grid; place-items:center; cursor:pointer; color:var(--v3-text-muted) }
`;

/** ===== Sticky StarBorder used in prototype header ===== */
function StarBorder({
  as: As = "div",
  className = "",
  color = "white",
  speed = "8s",
  thickness = 1,
  children,
  style,
  ...rest
}) {
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
  client: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  postcode: z.string().min(1),
  date: z.string().min(1),
  arrival_time: z.string().min(1),
  what3words: z.string().min(1),
  lead_agent: z.string().min(1),
  agent2: z.string().optional(),
  property_condition: z.string().min(1),
  locked_in: z.boolean().default(false),
  lock_type: z.string().optional(),
  property_damage: z.boolean().default(false),
  damage_details: z.string().optional(),
  aggressive: z.boolean().default(false),
  aggression_details: z.string().optional(),
  dogs_on_site: z.boolean().default(false),
  num_males: z.coerce.number().min(0).default(0),
  num_females: z.coerce.number().min(0).default(0),
  num_children: z.coerce.number().min(0).default(0),
  police_attendance: z.boolean().default(false),
  police_notes: z.string().optional(),
  additional_notes: z.string().optional(),
  departure_time: z.string().min(1),
  completion_date: z.string().min(1),
});

/** ===== RHF helpers (prototype pills) ===== */
function YesNo({ name, label }) {
  const { setValue, watch } = useFormContext();
  const v = !!watch(name);
  return (
    <div className="yn">
      <span className="h2" style={{ fontWeight: 600 }}>
        {label}
      </span>
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
  );
}

function CountSelect({ name }) {
  const { setValue, watch } = useFormContext();
  const v = watch(name) ?? 0;
  const opts = useMemo(() => Array.from({ length: 51 }, (_, i) => i), []);
  return (
    <select
      className="v3-input"
      value={String(v)}
      onChange={(e) =>
        setValue(name, Number(e.target.value), { shouldDirty: true })
      }
    >
      {opts.map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
  );
}

const Hours = Array.from({ length: 18 }, (_, i) => 6 + i);
const hourKey = (h) => `${String(h).padStart(2, "0")}:00`;

function TimeInput(props) {
  return <input type="time" className="v3-input" {...props} />;
}
function DateInput(props) {
  return <input type="date" className="v3-input" {...props} />;
}

function PhotoTile({ value, onChange }) {
  return (
    <label className="photo-tile">
      {value ? (
        <img
          src={URL.createObjectURL(value)}
          alt="preview"
          className="photo-thumb"
        />
      ) : (
        <div className="sub" style={{ textAlign: "center" }}>
          Click to upload or drop
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {value && (
        <button
          type="button"
          className="photo-remove"
          onClick={(e) => {
            e.preventDefault();
            onChange(null);
          }}
        >
          ×
        </button>
      )}
    </label>
  );
}

export default function SquatterServeForm({ jobData, onSubmit: parentOnSubmit, onCancel }) {
  const methods = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      client: "",
      address1: jobData?.address || "",
      address2: "",
      city: "",
      postcode: "",
      date: new Date().toISOString().split('T')[0],
      arrival_time: jobData?.arrival_time ? new Date(jobData.arrival_time).toTimeString().slice(0, 5) : "",
      what3words: "",
      lead_agent: jobData?.agentName || "",
      agent2: "",
      property_condition: "",
      locked_in: false,
      lock_type: "",
      property_damage: false,
      damage_details: "",
      aggressive: false,
      aggression_details: "",
      dogs_on_site: false,
      num_males: 0,
      num_females: 0,
      num_children: 0,
      police_attendance: false,
      police_notes: "",
      additional_notes: "",
      departure_time: "",
      completion_date: new Date().toISOString().split('T')[0],
    },
  });
  const { register, handleSubmit, watch, setValue } = methods;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // sticky header progress - uses ref to find scrollable container
  const [progress, setProgress] = useState(0);
  const formRef = React.useRef(null);

  useEffect(() => {
    // Find the scrollable parent container (the modal's overflow-y-auto div)
    const findScrollableParent = (element) => {
      if (!element) return null;
      const parent = element.parentElement;
      if (!parent) return null;

      const hasOverflow = getComputedStyle(parent).overflowY;
      if (hasOverflow === 'auto' || hasOverflow === 'scroll') {
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
        // Calculate progress for container scroll
        const scrollTop = scrollContainer.scrollTop;
        const scrollHeight = scrollContainer.scrollHeight;
        const clientHeight = scrollContainer.clientHeight;
        setProgress(scrollTop / (scrollHeight - clientHeight || 1));
      }
    };

    scrollContainer.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => scrollContainer.removeEventListener("scroll", onScroll);
  }, []);

  // photos state
  const [photos, setPhotos] = useState([null, null, null, null, null, null]);

  const lockedIn = watch("locked_in");
  const propertyDamage = watch("property_damage");
  const aggressive = watch("aggressive");
  const police = watch("police_attendance");

  const onSubmit = async (values) => {
    if (!parentOnSubmit) {
      console.log("Squatter Serve Form", values);
      alert("Submitted (demo) — check console payload.");
      return;
    }

    try {
      setIsSubmitting(true);
      // Filter out null photos and pass to parent
      const photoFiles = photos.filter(p => p !== null);
      await parentOnSubmit({
        formData: values,
        photos: photoFiles,
      });
    } catch (error) {
      console.error("Form submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormProvider {...methods}>
      <style>{THEME_CSS}</style>
      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="dark v3-root">
        {/* Sticky header with progress */}
        <div
          className="page-shell"
          style={{ position: "sticky", top: 0, zIndex: 40, paddingBottom: 14 }}
        >
          <StarBorder color="var(--v3-orange)" speed="8s" thickness={2}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
              }}
            >
              <div style={{ width: "40px" }} />
              <div className="h1" style={{ textAlign: "center", flex: 1 }}>
                Squatter Serve Report Form
              </div>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  style={{
                    width: "40px",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(239, 68, 68, 0.9)",
                    border: "1px solid rgba(239, 68, 68, 0.5)",
                    borderRadius: "10px",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "24px",
                    fontWeight: "bold",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 1)";
                    e.currentTarget.style.transform = "scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.9)";
                    e.currentTarget.style.transform = "scale(1)";
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="progress-rail" style={{ marginTop: 10 }}>
              <div
                className="progress-bar"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </StarBorder>
        </div>

        {/* Body */}
        <div className="page-shell" style={{ display: "grid", gap: 24 }}>
          {/* Eviction Report */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom: 12 }}>
              Eviction Report
            </div>
            <div className="row">
              <div>
                <label
                  className="h2"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Client:<span className="label-star">*</span>
                </label>
                <input className="v3-input" {...register("client")} />
              </div>
              <div>
                <label
                  className="h2"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Eviction Address:<span className="label-star">*</span>
                </label>
                <div className="row">
                  <input
                    className="v3-input"
                    placeholder="Address Line 1"
                    {...register("address1")}
                  />
                  <input
                    className="v3-input"
                    placeholder="Address Line 2"
                    {...register("address2")}
                  />
                  <div className="row row-2">
                    <input
                      className="v3-input"
                      placeholder="City"
                      {...register("city")}
                    />
                    <input
                      className="v3-input"
                      placeholder="Postal / Zip Code"
                      {...register("postcode")}
                    />
                  </div>
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label
                    className="h2"
                    style={{ display: "block", marginBottom: 6 }}
                  >
                    Date:<span className="label-star">*</span>
                  </label>
                  <DateInput {...register("date")} />
                </div>
                <div>
                  <label
                    className="h2"
                    style={{ display: "block", marginBottom: 6 }}
                  >
                    Arrival Time:<span className="label-star">*</span>
                  </label>
                  <TimeInput {...register("arrival_time")} />
                </div>
              </div>
              <div className="row row-2">
                <div>
                  <label
                    className="h2"
                    style={{ display: "block", marginBottom: 6 }}
                  >
                    What3Words location of entrance
                    <span className="label-star">*</span>
                  </label>
                  <input
                    className="v3-input"
                    placeholder="///word.word.word"
                    {...register("what3words")}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Agents */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom: 12 }}>
              Agents on Site
            </div>
            <div className="row row-2">
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Lead Agent:<span className="label-star">*</span>
                </div>
                <input className="v3-input" {...register("lead_agent")} />
              </div>
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Agent 2:
                </div>
                <input className="v3-input" {...register("agent2")} />
              </div>
            </div>
          </section>

          {/* Property Condition */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom: 12 }}>
              Property Condition
            </div>
            <div className="row row-2">
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Property Condition:<span className="label-star">*</span>
                </div>
                <select
                  className="v3-input"
                  {...register("property_condition")}
                >
                  <option value=""></option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Poor</option>
                </select>
              </div>
              <div />
            </div>

            <YesNo
              name="locked_in"
              label="Have the squatters locked themselves in?"
            />
            <AnimatePresence>
              {lockedIn && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div style={{ maxWidth: 280 }}>
                    <div className="h2" style={{ margin: "10px 0 6px" }}>
                      Lock Type:
                    </div>
                    <select className="v3-input" {...register("lock_type")}>
                      <option value=""></option>
                      <option>Padlock</option>
                      <option>Deadbolt</option>
                      <option>Chain</option>
                      <option>Other</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <YesNo name="property_damage" label="Property damage?" />
            <AnimatePresence>
              {propertyDamage && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div>
                    <div className="h2" style={{ margin: "10px 0 6px" }}>
                      Property Damage Details:
                    </div>
                    <textarea
                      className="v3-textarea"
                      rows={3}
                      {...register("damage_details")}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <YesNo name="aggressive" label="Are the squatters aggressive?" />
            <AnimatePresence>
              {aggressive && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div>
                    <div className="h2" style={{ margin: "10px 0 6px" }}>
                      Aggression Details:
                    </div>
                    <textarea
                      className="v3-textarea"
                      rows={3}
                      {...register("aggression_details")}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <YesNo name="dogs_on_site" label="Are there dogs on site?" />

            <div className="row row-3" style={{ marginTop: 10 }}>
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Number of Adult Males:
                </div>
                <CountSelect name="num_males" />
              </div>
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Number of Adult Females:
                </div>
                <CountSelect name="num_females" />
              </div>
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Number of children:
                </div>
                <CountSelect name="num_children" />
              </div>
            </div>
          </section>

          {/* Police Details */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom: 12 }}>
              Police Details
            </div>
            <YesNo name="police_attendance" label="Police attendance?" />
            <AnimatePresence>
              {police && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="h2" style={{ margin: "10px 0 6px" }}>
                    Additional Notes:
                  </div>
                  <textarea
                    className="v3-textarea"
                    rows={4}
                    {...register("police_notes")}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Photos */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom: 12 }}>
              Photos
            </div>
            <div className="photo-grid">
              {photos.map((f, i) => (
                <div key={i}>
                  <div className="h2" style={{ marginBottom: 6 }}>
                    {i === 0 ? "Photo of Serve:" : "Photo:"}
                    {i === 0 && <span className="label-star">*</span>}
                  </div>
                  <PhotoTile
                    value={f}
                    onChange={(file) => {
                      const next = [...photos];
                      next[i] = file;
                      setPhotos(next);
                    }}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Footer */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom: 6 }}>
              Additional Notes:
            </div>
            <textarea
              className="v3-textarea"
              rows={5}
              {...register("additional_notes")}
            />
            <div className="row row-2" style={{ marginTop: 12 }}>
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Departure Time:<span className="label-star">*</span>
                </div>
                <TimeInput {...register("departure_time")} />
              </div>
              <div>
                <div className="h2" style={{ marginBottom: 6 }}>
                  Completion Date:<span className="label-star">*</span>
                </div>
                <DateInput {...register("completion_date")} />
              </div>
            </div>
            <div
              style={{
                paddingTop: 14,
                display: "flex",
                gap: 12,
                justifyContent: "flex-end",
              }}
            >
              {onCancel && (
                <button
                  className="btn-ghost"
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
              )}
              <button
                className="button-primary"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </section>
        </div>
      </form>
    </FormProvider>
  );
}
