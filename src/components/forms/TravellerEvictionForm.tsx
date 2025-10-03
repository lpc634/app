import React, { useEffect, useMemo, useRef, useState } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";

/** ===== THEME (dark V3; no blue anywhere) ===== */
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
.dashboard-card{ background:var(--v3-bg-card); border:1px solid var(--v3-border); border-radius:16px; box-shadow: inset 0 0 0 1px var(--v3-orange), 0 10px 28px rgba(0,0,0,.35) }

.row{ display:grid; grid-template-columns:1fr; gap:12px }
@media (min-width:780px){ .row-2{ grid-template-columns:1fr 1fr } .row-3{ grid-template-columns:repeat(3,1fr) } .row-4{ grid-template-columns:repeat(4,1fr) } }
.v3-input{ width:100%; background:var(--v3-bg-dark); border:1px solid var(--v3-border); color:var(--v3-text); height:42px; border-radius:10px; padding:0 12px }
.v3-input:focus{ outline:none; box-shadow:0 0 0 3px var(--v3-orange-glow); border-color:var(--v3-orange) }
.v3-textarea{ width:100%; background:var(--v3-bg-dark); border:1px solid var(--v3-border); color:var(--v3-text); border-radius:10px; padding:10px 12px }
.v3-textarea:focus{ outline:none; box-shadow:0 0 0 3px var(--v3-orange-glow); border-color:var(--v3-orange) }
.button-primary{ background:linear-gradient(135deg,var(--v3-orange),var(--v3-orange-dark)); color:#fff; border:0; height:40px; padding:0 14px; border-radius:10px; cursor:pointer }
.btn-ghost{ height:40px; padding:0 14px; border-radius:10px; border:1px solid var(--v3-border); background:var(--v3-bg-card); color:var(--v3-text); cursor:pointer }
.progress-rail{ height:10px; border-radius:999px; background:#1d1f26; border:1px solid #2A2D36 }
.progress-bar{ height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--v3-orange),var(--v3-orange-dark)) }
.label-star{ color:#ff6868; margin-left:4px }
/* no blue anywhere */
:root, .dark { --primary:16 95% 56%; --ring:16 95% 56%; }
.v3-root, .v3-root * { accent-color:var(--v3-orange) !important }
[class*="text-blue-"], [class*="text-sky-"], [class*="text-indigo-"], .text-primary { color:var(--v3-text) !important }

/* Yes/No pills */
.yn{ display:flex; gap:10px; align-items:center; flex-wrap:wrap }
.yn label{ display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--v3-border); border-radius:10px; background:var(--v3-bg-card); cursor:pointer }
.yn input{ width:16px; height:16px }
/* selected pill — no orange border */
.yn label[aria-checked='true']{ border-color:var(--v3-border); box-shadow:none }

/* === Polished micro-interactions === */

/* Ripple ring when a pill is selected (not persistent, keeps “no orange border” look) */
@keyframes v3-ring { 
  0% { box-shadow: 0 0 0 0 rgba(255,106,43,.45) } 
  100% { box-shadow: 0 0 0 12px rgba(255,106,43,0) } 
}
.yn label{ position:relative; overflow:hidden; transition: transform 120ms ease, background-color 180ms ease, border-color 180ms ease; }
.yn label:active{ transform: scale(.97) }
/* play ripple only when the radio inside is checked */
.yn label:has(input:checked)::after{
  content:"";
  position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  animation: v3-ring 520ms ease-out;
}

/* optional: a gentle selected background (no border change) */
.yn label:has(input:checked){
  background: linear-gradient(180deg, rgba(255,106,43,.10), rgba(255,106,43,0) 60%);
}

/* micro interaction: subtle press on pills */
.yn label{ transition: transform 120ms ease, background-color 180ms ease, border-color 180ms ease }
.yn label:active{ transform: scale(.97) }

/* Photo tiles */
.photo-grid{ display:grid; grid-template-columns:1fr; gap:18px }
@media (min-width:780px){ .photo-grid{ grid-template-columns:1fr 1fr } }
.photo-tile{ position:relative; border:1px dashed #383B44; background:#17181D; border-radius:14px; height:118px; display:grid; place-items:center; cursor:pointer; overflow:hidden }
.photo-tile:hover{ border-color:var(--v3-orange); box-shadow:0 0 0 3px var(--v3-orange-glow) }
.photo-thumb{ width:100%; height:100%; object-fit:cover; border-radius:12px }
.photo-remove{ position:absolute; top:6px; right:6px; padding:2px 8px; border-radius:8px; border:1px solid var(--v3-border); background:rgba(0,0,0,.55); color:var(--v3-text); line-height:1; cursor:pointer }
.photo-remove:hover{ background:rgba(0,0,0,.75) }
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

/** ===== Schema ===== */
const Hours = Array.from({ length: 18 }, (_, i) => 6 + i);
const hourKey = (h) => `${String(h).padStart(2, "0")}:00`;

const ReportSchema = z.object({
  client: z.string().min(1),
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().optional(),
  postal_zip: z.string().optional(),
  date: z.string().min(1),
  arrival_time: z.string().min(1),

  lead_agent: z.string().min(1),
  a2: z.string().optional(),
  a3: z.string().optional(),
  a4: z.string().optional(),
  a5: z.string().optional(),
  a6: z.string().optional(),
  a7: z.string().optional(),
  a8: z.string().optional(),
  a9: z.string().optional(),
  a10: z.string().optional(),
  a11: z.string().optional(),
  a12: z.string().optional(),
  a13: z.string().optional(),
  a14: z.string().optional(),
  a15: z.string().optional(),
  a16: z.string().optional(),
  a17: z.string().optional(),
  a18: z.string().optional(),
  a19: z.string().optional(),
  a20: z.string().optional(),
  more_than_10: z.boolean().default(false),

  notice_prior: z.boolean().default(false),
  locked_in: z.boolean().default(false),
  lock_type: z.string().optional(),
  property_type: z.string().optional(),
  field_type: z.string().optional(),
  car_park_type: z.string().optional(),
  commercial_property_type: z.string().optional(),
  property_condition: z.string().optional(),
  fly_tipping: z.boolean().default(false),
  fly_tipping_details: z.string().optional(),
  property_damage: z.boolean().default(false),
  property_damage_details: z.string().optional(),
  travellers_agressive: z.boolean().default(false), // misspelling kept intentionally
  aggression_details: z.string().optional(),
  dogs_on_site: z.boolean().default(false),
  dog_details: z.string().optional(),

  caravans: z.coerce.number().min(0),
  adult_males: z.coerce.number().optional(),
  adult_females: z.coerce.number().optional(),
  children: z.coerce.number().optional(),

  timeline_day1: z.record(z.string().optional()),
  day2_enabled: z.boolean().default(false),
  day2_same_agents: z.boolean().default(false),
  day2_lead_agent: z.string().optional(),
  day2_a2: z.string().optional(),
  day2_a3: z.string().optional(),
  day2_a4: z.string().optional(),
  day2_a5: z.string().optional(),
  day2_a6: z.string().optional(),
  day2_a7: z.string().optional(),
  day2_a8: z.string().optional(),
  day2_a9: z.string().optional(),
  day2_a10: z.string().optional(),
  day2_attending_agents: z.string().optional(),
  timeline_day2: z.record(z.string().optional()).optional(),

  day3: z.boolean().default(false),
  day3_same_agents: z.boolean().default(false),
  day3_lead_agent: z.string().optional(),
  day3_a2: z.string().optional(),
  day3_a3: z.string().optional(),
  day3_a4: z.string().optional(),
  day3_a5: z.string().optional(),
  day3_a6: z.string().optional(),
  day3_a7: z.string().optional(),
  day3_a8: z.string().optional(),
  day3_a9: z.string().optional(),
  day3_a10: z.string().optional(),
  timeline_day3: z.record(z.string().optional()).optional(),

  day4: z.boolean().default(false),
  day4_same_agents: z.boolean().default(false),
  day4_lead_agent: z.string().optional(),
  day4_a2: z.string().optional(),
  day4_a3: z.string().optional(),
  day4_a4: z.string().optional(),
  day4_a5: z.string().optional(),
  day4_a6: z.string().optional(),
  day4_a7: z.string().optional(),
  day4_a8: z.string().optional(),
  day4_a9: z.string().optional(),
  day4_a10: z.string().optional(),
  timeline_day4: z.record(z.string().optional()).optional(),

  day5: z.boolean().default(false),
  day5_same_agents: z.boolean().default(false),
  day5_lead_agent: z.string().optional(),
  day5_a2: z.string().optional(),
  day5_a3: z.string().optional(),
  day5_a4: z.string().optional(),
  day5_a5: z.string().optional(),
  day5_a6: z.string().optional(),
  day5_a7: z.string().optional(),
  day5_a8: z.string().optional(),
  day5_a9: z.string().optional(),
  day5_a10: z.string().optional(),
  timeline_day5: z.record(z.string().optional()).optional(),

  day6: z.boolean().default(false),
  day6_same_agents: z.boolean().default(false),
  day6_lead_agent: z.string().optional(),
  day6_a2: z.string().optional(),
  day6_a3: z.string().optional(),
  day6_a4: z.string().optional(),
  day6_a5: z.string().optional(),
  day6_a6: z.string().optional(),
  day6_a7: z.string().optional(),
  day6_a8: z.string().optional(),
  day6_a9: z.string().optional(),
  day6_a10: z.string().optional(),
  timeline_day6: z.record(z.string().optional()).optional(),

  day7: z.boolean().default(false),
  day7_same_agents: z.boolean().default(false),
  day7_lead_agent: z.string().optional(),
  day7_a2: z.string().optional(),
  day7_a3: z.string().optional(),
  day7_a4: z.string().optional(),
  day7_a5: z.string().optional(),
  day7_a6: z.string().optional(),
  day7_a7: z.string().optional(),
  day7_a8: z.string().optional(),
  day7_a9: z.string().optional(),
  day7_a10: z.string().optional(),
  timeline_day7: z.record(z.string().optional()).optional(),

  police_attendance: z.boolean().default(false),
  police_cad: z.string().optional(),
  police_force: z.string().optional(),
  police_notes: z.string().optional(),

  extra_photos_1: z.boolean().default(false),
  extra_photos_2: z.boolean().default(false),
  extra_photos_3: z.boolean().default(false),
  extra_photos_4: z.boolean().default(false),
  additional_notes: z.string().optional(),

  departure_time: z.string().min(1),
  completion_date: z.string().min(1),
});

type ReportValues = z.infer<typeof ReportSchema>;

/** ===== Small reusable StarBorder ===== */
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
      <div className="inner-content">{children}</div>
    </As>
  );
}

/** ===== RHF helpers ===== */
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

function CountSelect({ name, label, required = false }) {
  const { setValue, watch } = useFormContext();
  const v = watch(name) ?? 0;
  const opts = useMemo(() => Array.from({ length: 51 }, (_, i) => i), []);
  return (
    <div>
      <div className="h2" style={{ fontWeight: 600, marginBottom: 4 }}>
        {label}
        {required && <span className="label-star">*</span>}
      </div>
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
    </div>
  );
}

/** ===== Main component ===== */
export default function TravellerEvictionForm({ jobData, onSubmit: parentOnSubmit, onCancel }) {
  const form = useForm<ReportValues>({
    // resolver: zodResolver(ReportSchema),
    defaultValues: {
      client: "",
      address1: "",
      address2: "",
      city: "",
      postal_zip: "",
      date: new Date().toISOString().split('T')[0],
      arrival_time: "",
      lead_agent: "",
      a2: "",
      a3: "",
      a4: "",
      a5: "",
      a6: "",
      a7: "",
      a8: "",
      a9: "",
      a10: "",
      a11: "",
      a12: "",
      a13: "",
      a14: "",
      a15: "",
      a16: "",
      a17: "",
      a18: "",
      a19: "",
      a20: "",
      more_than_10: false,
      notice_prior: false,
      locked_in: false,
      lock_type: "",
      property_type: "",
      field_type: "",
      car_park_type: "",
      commercial_property_type: "",
      property_condition: "",
      fly_tipping: false,
      fly_tipping_details: "",
      property_damage: false,
      property_damage_details: "",
      travellers_agressive: false,
      aggression_details: "",
      dogs_on_site: false,
      dog_details: "",
      caravans: 0,
      adult_males: 0,
      adult_females: 0,
      children: 0,
      timeline_day1: Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [hourKey(6 + i), ""])
      ),
      day2_enabled: false,
      day2_same_agents: false,
      day2_lead_agent: "",
      day2_a2: "",
      day2_a3: "",
      day2_a4: "",
      day2_a5: "",
      day2_a6: "",
      day2_a7: "",
      day2_a8: "",
      day2_a9: "",
      day2_a10: "",
      day2_attending_agents: "",
      timeline_day2: Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [hourKey(6 + i), ""])
      ),
      day3: false,
      day3_same_agents: false,
      day3_lead_agent: "",
      day3_a2: "",
      day3_a3: "",
      day3_a4: "",
      day3_a5: "",
      day3_a6: "",
      day3_a7: "",
      day3_a8: "",
      day3_a9: "",
      day3_a10: "",
      timeline_day3: Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [hourKey(6 + i), ""])
      ),
      day4: false,
      day4_same_agents: false,
      day4_lead_agent: "",
      day4_a2: "",
      day4_a3: "",
      day4_a4: "",
      day4_a5: "",
      day4_a6: "",
      day4_a7: "",
      day4_a8: "",
      day4_a9: "",
      day4_a10: "",
      timeline_day4: Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [hourKey(6 + i), ""])
      ),
      day5: false,
      day5_same_agents: false,
      day5_lead_agent: "",
      day5_a2: "",
      day5_a3: "",
      day5_a4: "",
      day5_a5: "",
      day5_a6: "",
      day5_a7: "",
      day5_a8: "",
      day5_a9: "",
      day5_a10: "",
      timeline_day5: Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [hourKey(6 + i), ""])
      ),
      day6: false,
      day6_same_agents: false,
      day6_lead_agent: "",
      day6_a2: "",
      day6_a3: "",
      day6_a4: "",
      day6_a5: "",
      day6_a6: "",
      day6_a7: "",
      day6_a8: "",
      day6_a9: "",
      day6_a10: "",
      timeline_day6: Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [hourKey(6 + i), ""])
      ),
      day7: false,
      day7_same_agents: false,
      day7_lead_agent: "",
      day7_a2: "",
      day7_a3: "",
      day7_a4: "",
      day7_a5: "",
      day7_a6: "",
      day7_a7: "",
      day7_a8: "",
      day7_a9: "",
      day7_a10: "",
      timeline_day7: Object.fromEntries(
        Array.from({ length: 18 }, (_, i) => [hourKey(6 + i), ""])
      ),
      police_attendance: false,
      police_cad: "",
      police_force: "",
      police_notes: "",
      extra_photos_1: false,
      extra_photos_2: false,
      extra_photos_3: false,
      extra_photos_4: false,
      additional_notes: "",
      departure_time: "",
      completion_date: "",
    },
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = form;

  // photo tiles
  const [photosA, setPhotosA] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [photosB, setPhotosB] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [photosC, setPhotosC] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [photosD, setPhotosD] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [photosE, setPhotosE] = useState<(File | null)[]>([
    null,
    null,
    null,
    null,
  ]);
  const [damagePhotos, setDamagePhotos] = useState<(string | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  function handleDamagePick(idx: number, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setDamagePhotos((arr) => {
        const next = arr.slice();
        next[idx] = String(reader.result || "");
        return next;
      });
    };
    reader.readAsDataURL(file);
  }

  function removeDamagePhoto(idx: number) {
    setDamagePhotos((arr) => {
      const next = arr.slice();
      next[idx] = null;
      return next;
    });
  }

  // scroll progress
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  function getScrollParent(el: Element | null): Element | null {
    let node: any = el;
    while (node && node !== document.body) {
      const style = window.getComputedStyle(node);
      const overflowY = style.overflowY;
      const isScrollable =
        (overflowY === "auto" || overflowY === "scroll") &&
        node.scrollHeight > node.clientHeight;
      if (isScrollable) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  useEffect(() => {
    let frame = 0;
    const rootEl = rootRef.current;
    const scroller = getScrollParent(rootEl) as
      | (Element & { scrollTop?: number; scrollHeight?: number; clientHeight?: number })
      | null;

    const compute = () => {
      if (!scroller) {
        // fallback safety
        setProgress(0);
        return;
      }
      const isDoc =
        scroller === document.documentElement ||
        scroller === document.body ||
        scroller === document.scrollingElement;

      const scrollTop = isDoc ? window.scrollY : (scroller as any).scrollTop || 0;
      const total = isDoc
        ? (document.documentElement.scrollHeight - window.innerHeight)
        : ((scroller!.scrollHeight ?? 0) - (scroller!.clientHeight ?? 0));

      const denom = total > 0 ? total : 1;
      const p = Math.max(0, Math.min(1, scrollTop / denom));
      setProgress(p);
    };

    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        compute();
      });
    };

    const onResize = onScroll;

    const target: any = scroller ?? window;
    target.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    // Initial calculation
    compute();

    return () => {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const onSubmit = async (data) => {
    console.log("SUBMIT CALLED", data);
    try {
      // Collect all photos from all photo states
      const allPhotos: File[] = [];

      // Collect from photosA through photosE
      [photosA, photosB, photosC, photosD, photosE].forEach(photoArray => {
        photoArray.forEach(photo => {
          if (photo instanceof File) {
            allPhotos.push(photo);
          }
        });
      });

      console.log("Collected photos:", allPhotos.length);

      // Pass both form data and photos to parent
      await parentOnSubmit({ formData: data, photos: allPhotos });
      console.log("Form submitted successfully");
    } catch (error) {
      console.error("Form submission error:", error);
      alert("Failed to submit report. Please try again.");
    }
  };

  const onError = (errors) => {
    console.log("VALIDATION ERRORS:", errors);
    alert("Please fill in all required fields");
  };

  // toggles
  const more10 = watch("more_than_10");
  const day2 = watch("day2_enabled");
  const d2 = day2;
  const d3 = watch("day3");
  const d4 = watch("day4");
  const d5 = watch("day5");
  const d6 = watch("day6");
  const d7 = watch("day7");
  const police = watch("police_attendance");
  const extraPhotos1 = watch("extra_photos_1");
  const extraPhotos2 = watch("extra_photos_2");
  const extraPhotos3 = watch("extra_photos_3");
  const extraPhotos4 = watch("extra_photos_4");

  // auto-reset hidden values
  const noticePrior = watch("notice_prior");
  const lockedIn = watch("locked_in");
  const propertyType = watch("property_type");

  useEffect(() => {
    // if notice not explicitly No, force locked_in back to false
    if (noticePrior !== false) {
      setValue("locked_in", false, { shouldDirty: true });
    }
    // if lock type dropdown is hidden, clear its value
    if (!(noticePrior === false && lockedIn === true)) {
      setValue("lock_type", "", { shouldDirty: true });
    }
  }, [noticePrior, lockedIn, setValue]);

  useEffect(() => {
    if (propertyType !== "Open Land") {
      setValue("field_type", "", { shouldDirty: true });
    }
    if (propertyType !== "Car Park") {
      setValue("car_park_type", "", { shouldDirty: true });
    }
    if (propertyType !== "Commercial Property") {
      setValue("commercial_property_type", "", { shouldDirty: true });
    }
  }, [propertyType, setValue]);

  const pc = watch("property_condition");
  useEffect(() => {
    const allowed = new Set(["", "Good", "Fair", "Poor"]);
    if (!allowed.has(pc || "")) {
      setValue("property_condition", "", { shouldDirty: true });
    }
  }, [pc, setValue]);

  const fly = watch("fly_tipping");
  const dmg = watch("property_damage");
  const agg = watch("travellers_agressive");
  const dogs = watch("dogs_on_site");

  useEffect(() => {
    if (!fly) setValue("fly_tipping_details", "", { shouldDirty: true });
  }, [fly, setValue]);

  useEffect(() => {
    if (!dmg) {
      setValue("property_damage_details", "", { shouldDirty: true });
      setDamagePhotos([null, null, null, null]);
    }
  }, [dmg, setValue]);

  useEffect(() => {
    if (!agg) setValue("aggression_details", "", { shouldDirty: true });
  }, [agg, setValue]);

  useEffect(() => {
    if (!dogs) setValue("dog_details", "", { shouldDirty: true });
  }, [dogs, setValue]);

  // Helper functions for clearing day fields
  const clearDayAgents = (prefix) => {
    const keys = [
      `${prefix}_lead_agent`,
      `${prefix}_a2`,
      `${prefix}_a3`,
      `${prefix}_a4`,
      `${prefix}_a5`,
      `${prefix}_a6`,
      `${prefix}_a7`,
      `${prefix}_a8`,
      `${prefix}_a9`,
      `${prefix}_a10`,
    ];
    keys.forEach((k) => setValue(k, "", { shouldDirty: true }));
  };

  const forceOffDay = (prefix) => {
    setValue(prefix, false, { shouldDirty: true });
    setValue(`${prefix}_same_agents`, false, { shouldDirty: true });
    clearDayAgents(prefix);
  };

  const day2Same = watch("day2_same_agents");
  const d3Same = watch("day3_same_agents");
  const d4Same = watch("day4_same_agents");
  const d5Same = watch("day5_same_agents");
  const d6Same = watch("day6_same_agents");
  const d7Same = watch("day7_same_agents");

  // Clear agents when SAME = true
  useEffect(() => {
    if (day2Same) clearDayAgents("day2");
  }, [day2Same]);

  useEffect(() => {
    if (d3Same) clearDayAgents("day3");
  }, [d3Same]);

  useEffect(() => {
    if (d4Same) clearDayAgents("day4");
  }, [d4Same]);

  useEffect(() => {
    if (d5Same) clearDayAgents("day5");
  }, [d5Same]);

  useEffect(() => {
    if (d6Same) clearDayAgents("day6");
  }, [d6Same]);

  useEffect(() => {
    if (d7Same) clearDayAgents("day7");
  }, [d7Same]);

  // Cascade effects: turn off later days when a prior day turns off
  useEffect(() => {
    if (!d2) {
      forceOffDay("day3");
      forceOffDay("day4");
      forceOffDay("day5");
      forceOffDay("day6");
      forceOffDay("day7");
    }
  }, [d2]);

  useEffect(() => {
    if (!d3) {
      forceOffDay("day4");
      forceOffDay("day5");
      forceOffDay("day6");
      forceOffDay("day7");
    }
  }, [d3]);

  useEffect(() => {
    if (!d4) {
      forceOffDay("day5");
      forceOffDay("day6");
      forceOffDay("day7");
    }
  }, [d4]);

  useEffect(() => {
    if (!d5) {
      forceOffDay("day6");
      forceOffDay("day7");
    }
  }, [d5]);

  useEffect(() => {
    if (!d6) {
      forceOffDay("day7");
    }
  }, [d6]);

  // Clear day's fields when that day itself flips to false
  useEffect(() => {
    if (!d3) clearDayAgents("day3");
  }, [d3]);

  useEffect(() => {
    if (!d4) clearDayAgents("day4");
  }, [d4]);

  useEffect(() => {
    if (!d5) clearDayAgents("day5");
  }, [d5]);

  useEffect(() => {
    if (!d6) clearDayAgents("day6");
  }, [d6]);

  useEffect(() => {
    if (!d7) clearDayAgents("day7");
  }, [d7]);

  // Simple text inputs for date and time - manual entry
  const DateInput = (props) => (
    <input
      {...props}
      type="text"
      placeholder="dd/mm/yyyy"
      className={`v3-input ${props.className || ""}`}
    />
  );

  const TimeInput = (props) => (
    <input
      {...props}
      type="text"
      placeholder="HH:MM"
      className={`v3-input ${props.className || ""}`}
    />
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit, onError)}>
      <div ref={rootRef} className="dark v3-root min-h-screen">
        <style>{THEME_CSS}</style>

        {/* Sticky header */}
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
                position: "relative",
              }}
            >
              <div style={{ width: "40px" }} />
              <div className="h1" style={{ textAlign: "center", flex: 1 }}>
                Traveller Eviction Form
              </div>
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
            </div>
            <div className="progress-rail" style={{ marginTop: 10 }}>
              <div
                className="progress-bar"
                style={{ width: `${Math.max(0, Math.min(100, Math.round(progress * 100)))}%` }}
              />
            </div>
          </StarBorder>
        </div>

        {/* Body */}
        <div className="page-shell" style={{ display: "grid", gap: 24 }}>
          {/* Eviction Report */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 12 }}>
              Eviction Report:
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
                {errors.client && (
                  <p style={{ color: "#fda4af", fontSize: 12, marginTop: 6 }}>
                    Client is required
                  </p>
                )}
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
                      {...register("postal_zip")}
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
            </div>
          </section>

          {/* Agents on Site */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 12 }}>
              Agents on Site:
            </div>
            <div className="row row-2">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <div key={n}>
                  <label
                    className="h2"
                    style={{ display: "block", marginBottom: 6 }}
                  >
                    {n === 1 ? "1. Lead Agent:" : `${n}. Agent:`}
                    {n === 1 && <span className="label-star">*</span>}
                  </label>
                  <input
                    className="v3-input"
                    {...register(n === 1 ? "lead_agent" : `a${n}`)}
                  />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              <YesNo name="more_than_10" label="More Than 10 Agents?" />
              <AnimatePresence initial={false} mode="wait">
                {more10 && (
                  <motion.div
                    className="row row-2"
                    style={{ marginTop: 10 }}
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    layout
                  >
                    {Array.from({ length: 10 }, (_, i) => 11 + i).map((n) => (
                      <div key={`agent-${n}`}>
                        <label
                          className="h2"
                          style={{ display: "block", marginBottom: 6 }}
                        >
                          {n}. Agent:
                        </label>
                        <input
                          className="v3-input"
                          {...(register as any)(`a${n}`)}
                        />
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </section>

          {/* Property Details */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 12 }}>
              Property Details:
            </div>
            <div className="row" style={{ gap: 16 }}>
              <YesNo
                name="notice_prior"
                label="Has the notice been served prior to your arrival?"
              />

              {watch("notice_prior") === false && (
                <YesNo
                  name="locked_in"
                  label="Have the travellers locked themselves in?"
                />
              )}

              {/* Lock Type — compact width */}
              {watch("notice_prior") === false &&
                watch("locked_in") === true && (
                  <div style={{ maxWidth: 280 }}>
                    <div className="h2" style={{ marginBottom: 6 }}>
                      Lock Type:
                    </div>
                    <select
                      className="v3-input"
                      style={{ width: 240 }}
                      value={watch("lock_type") || ""}
                      onChange={(e) =>
                        setValue("lock_type", e.target.value as any, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <option value=""></option>
                      <option value="Chained">Chained</option>
                      <option value="Padlock">Padlock</option>
                      <option value="Yale">Yale</option>
                      <option value="Mortice">Mortice</option>
                      <option value="Barrel">Barrel</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                )}

              <div className="row row-2">
                {/* Left column: Property Type + Property Condition underneath */}
                <div>
                  <div className="h2" style={{ marginBottom: 6 }}>
                    Property Type:
                  </div>
                  <select
                    className="v3-input"
                    value={watch("property_type") || ""}
                    onChange={(e) =>
                      setValue("property_type", e.target.value as any, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <option value=""></option>
                    <option value="Car Park">Car Park</option>
                    <option value="Open Land">Open Land</option>
                    <option value="Commercial Property">
                      Commercial Property
                    </option>
                  </select>

                  <div className="h2" style={{ margin: "10px 0 6px" }}>
                    Property Condition:
                  </div>
                  <select
                    className="v3-input"
                    value={watch("property_condition") || ""}
                    onChange={(e) =>
                      setValue("property_condition", e.target.value as any, {
                        shouldDirty: true,
                      })
                    }
                  >
                    <option value=""></option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Poor">Poor</option>
                  </select>
                </div>

                {/* Right column: one conditional select based on Property Type */}
                <div>
                  {/* Open Land → Field Type */}
                  {watch("property_type") === "Open Land" && (
                    <div>
                      <div className="h2" style={{ marginBottom: 6 }}>
                        Field Type:
                      </div>
                      <select
                        className="v3-input"
                        value={watch("field_type") || ""}
                        onChange={(e) =>
                          setValue("field_type", e.target.value as any, {
                            shouldDirty: true,
                          })
                        }
                      >
                        <option value=""></option>
                        <option value="Farm Land">Farm Land</option>
                        <option value="Council Land">Council Land</option>
                        <option value="Park">Park</option>
                      </select>
                    </div>
                  )}

                  {/* Car Park → Car park Type */}
                  {watch("property_type") === "Car Park" && (
                    <div>
                      <div className="h2" style={{ marginBottom: 6 }}>
                        Car park Type:
                      </div>
                      <select
                        className="v3-input"
                        value={watch("car_park_type") || ""}
                        onChange={(e) =>
                          setValue("car_park_type", e.target.value as any, {
                            shouldDirty: true,
                          })
                        }
                      >
                        <option value=""></option>
                        <option value="Retail Car Park">Retail Car Park</option>
                        <option value="Business Car Park">
                          Business Car Park
                        </option>
                        <option value="Trading estate">Trading estate</option>
                      </select>
                    </div>
                  )}

                  {/* Commercial Property → Commercial Property Type */}
                  {watch("property_type") === "Commercial Property" && (
                    <div>
                      <div className="h2" style={{ marginBottom: 6 }}>
                        Commercial Property Type:
                      </div>
                      <select
                        className="v3-input"
                        value={watch("commercial_property_type") || ""}
                        onChange={(e) =>
                          setValue(
                            "commercial_property_type",
                            e.target.value as any,
                            { shouldDirty: true }
                          )
                        }
                      >
                        <option value=""></option>
                        <option value="Shop">Shop</option>
                        <option value="Warehouse">Warehouse</option>
                        <option value="Office">Office</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <YesNo name="fly_tipping" label="Fly Tipping?" />
              {watch("fly_tipping") === true && (
                <div>
                  <div className="h2" style={{ marginBottom: 6 }}>
                    Fly Tipping Details:
                  </div>
                  <textarea
                    className="v3-textarea"
                    value={watch("fly_tipping_details") || ""}
                    onChange={(e) =>
                      setValue("fly_tipping_details", e.target.value, {
                        shouldDirty: true,
                      })
                    }
                    rows={3}
                    placeholder=""
                  />
                </div>
              )}

              <YesNo name="property_damage" label="Property Damage?" />
              {watch("property_damage") === true && (
                <>
                  <div>
                    <div className="h2" style={{ marginBottom: 6 }}>
                      Property Damage Details:
                    </div>
                    <textarea
                      className="v3-textarea"
                      value={watch("property_damage_details") || ""}
                      onChange={(e) =>
                        setValue("property_damage_details", e.target.value, {
                          shouldDirty: true,
                        })
                      }
                      rows={3}
                      placeholder=""
                    />
                  </div>

                  <div>
                    <div className="h2" style={{ margin: "10px 0 6px" }}>
                      Pictures of Property Damage
                    </div>
                    <div className="photo-grid">
                      {damagePhotos.map((src, i) => (
                        <div className="photo-tile" key={`damage-${i}`}>
                          {src ? (
                            <>
                              <img
                                className="photo-thumb"
                                src={src}
                                alt={`Damage ${i + 1}`}
                              />
                              <button
                                type="button"
                                className="photo-remove"
                                onClick={() => removeDamagePhoto(i)}
                                aria-label="Remove photo"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            <label className="photo-tile--empty">
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: "none" }}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleDamagePick(i, f);
                                  e.currentTarget.value = "";
                                }}
                              />
                              <span>Add Photo</span>
                            </label>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <YesNo
                name="travellers_agressive"
                label="Are the Travellers Agressive?"
              />
              {watch("travellers_agressive") === true && (
                <div>
                  <div className="h2" style={{ marginBottom: 6 }}>
                    Aggression Details:
                  </div>
                  <textarea
                    className="v3-textarea"
                    value={watch("aggression_details") || ""}
                    onChange={(e) =>
                      setValue("aggression_details", e.target.value, {
                        shouldDirty: true,
                      })
                    }
                    rows={3}
                    placeholder=""
                  />
                </div>
              )}

              <YesNo name="dogs_on_site" label="Are there Dogs on Site?" />
              {watch("dogs_on_site") === true && (
                <div>
                  <div className="h2" style={{ marginBottom: 6 }}>
                    Dog Details:
                  </div>
                  <textarea
                    className="v3-textarea"
                    value={watch("dog_details") || ""}
                    onChange={(e) =>
                      setValue("dog_details", e.target.value, {
                        shouldDirty: true,
                      })
                    }
                    rows={3}
                    placeholder=""
                  />
                </div>
              )}

              <div className="row row-4">
                <CountSelect
                  name="caravans"
                  label="Number Of Caravans:"
                  required
                />
                <CountSelect
                  name="adult_males"
                  label="Number of Adult Males:"
                />
                <CountSelect
                  name="adult_females"
                  label="Number of Adult Females:"
                />
                <CountSelect name="children" label="Number of children:" />
              </div>
            </div>
          </section>

          {/* Eviction Timeline */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2">Eviction Timeline:</div>
            <p className="sub" style={{ marginBottom: 12 }}>
              Please use this section to keep a diary of what happened
              throughout the day.
            </p>
            <div className="row row-2">
              {Hours.map((h) => (
                <div
                  key={`d1-${h}`}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <div
                    style={{
                      width: 52,
                      fontSize: 12,
                      color: "var(--v3-text-muted)",
                      paddingTop: 8,
                    }}
                  >
                    {hourKey(h)}
                  </div>
                  <textarea
                    className="v3-textarea"
                    rows={3}
                    {...register(`timeline_day1.${hourKey(h)}`)}
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Day 2? */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 8 }}>
              Day 2?
            </div>
            <div style={{ marginBottom: 12 }}>
              <YesNo name="day2_enabled" label="Yes/No" />
            </div>
            <AnimatePresence initial={false} mode="wait">
              {day2 && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: -8,
                    scale: 0.98,
                    filter: "blur(4px)",
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(3px)" }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  layout
                >
                  <div style={{ marginBottom: 12 }}>
                    <YesNo
                      name="day2_same_agents"
                      label="Are agents the same as Day 1?"
                    />
                  </div>

                  {watch("day2_same_agents") === false && (
                    <>
                      <div className="h2" style={{ marginBottom: 8 }}>
                        Attending Agents:
                      </div>

                      <div
                        className="row row-2"
                        style={{ gap: 12, marginBottom: 12 }}
                      >
                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            1. Lead Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_lead_agent") || ""}
                            onChange={(e) =>
                              setValue("day2_lead_agent", e.target.value, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            2. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a2") || ""}
                            onChange={(e) =>
                              setValue("day2_a2", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            3. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a3") || ""}
                            onChange={(e) =>
                              setValue("day2_a3", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            4. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a4") || ""}
                            onChange={(e) =>
                              setValue("day2_a4", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            5. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a5") || ""}
                            onChange={(e) =>
                              setValue("day2_a5", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            6. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a6") || ""}
                            onChange={(e) =>
                              setValue("day2_a6", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            7. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a7") || ""}
                            onChange={(e) =>
                              setValue("day2_a7", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            8. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a8") || ""}
                            onChange={(e) =>
                              setValue("day2_a8", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            9. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a9") || ""}
                            onChange={(e) =>
                              setValue("day2_a9", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>

                        <div>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            10. Agent
                          </div>
                          <input
                            className="v3-input"
                            value={watch("day2_a10") || ""}
                            onChange={(e) =>
                              setValue("day2_a10", e.target.value as any, {
                                shouldDirty: true,
                              })
                            }
                          />
                        </div>
                      </div>
                    </>
                  )}

                  <div className="row row-2">
                    {Hours.map((h) => (
                      <div
                        key={`d2-${h}`}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            width: 52,
                            fontSize: 12,
                            color: "var(--v3-text-muted)",
                            paddingTop: 8,
                          }}
                        >
                          {hourKey(h)}
                        </div>
                        <textarea
                          className="v3-textarea"
                          rows={3}
                          {...register(`timeline_day2.${hourKey(h)}`)}
                        />
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Day 3? - only visible if Day 2 is enabled */}
          {d2 === true && (
            <section className="dashboard-card" style={{ padding: 24 }}>
              <div className="h2" style={{ marginBottom: 8 }}>
                Day 3?
              </div>
              <div style={{ marginBottom: 12 }}>
                <YesNo name="day3" label="Yes/No" />
              </div>
              <AnimatePresence initial={false} mode="wait">
                {d3 && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    layout
                  >
                    <div style={{ marginBottom: 12 }}>
                      <YesNo
                        name="day3_same_agents"
                        label="Are agents the same as Day 2?"
                      />
                    </div>

                    {watch("day3_same_agents") === false && (
                      <>
                        <div className="h2" style={{ marginBottom: 8 }}>
                          Attending Agents:
                        </div>

                        <div
                          className="row row-2"
                          style={{ gap: 12, marginBottom: 12 }}
                        >
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              1. Lead Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_lead_agent") || ""}
                              onChange={(e) =>
                                setValue(
                                  "day3_lead_agent",
                                  e.target.value as any,
                                  { shouldDirty: true }
                                )
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              2. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a2") || ""}
                              onChange={(e) =>
                                setValue("day3_a2", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              3. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a3") || ""}
                              onChange={(e) =>
                                setValue("day3_a3", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              4. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a4") || ""}
                              onChange={(e) =>
                                setValue("day3_a4", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              5. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a5") || ""}
                              onChange={(e) =>
                                setValue("day3_a5", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              6. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a6") || ""}
                              onChange={(e) =>
                                setValue("day3_a6", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              7. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a7") || ""}
                              onChange={(e) =>
                                setValue("day3_a7", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              8. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a8") || ""}
                              onChange={(e) =>
                                setValue("day3_a8", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              9. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a9") || ""}
                              onChange={(e) =>
                                setValue("day3_a9", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              10. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day3_a10") || ""}
                              onChange={(e) =>
                                setValue("day3_a10", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="row row-2">
                      {Hours.map((h) => (
                        <div
                          key={`d3-${h}`}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              fontSize: 12,
                              color: "var(--v3-text-muted)",
                              paddingTop: 8,
                            }}
                          >
                            {hourKey(h)}
                          </div>
                          <textarea
                            className="v3-textarea"
                            rows={3}
                            {...register(`timeline_day3.${hourKey(h)}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Day 4? - only visible if Day 3 is enabled */}
          {d3 === true && (
            <section className="dashboard-card" style={{ padding: 24 }}>
              <div className="h2" style={{ marginBottom: 8 }}>
                Day 4?
              </div>
              <div style={{ marginBottom: 12 }}>
                <YesNo name="day4" label="Yes/No" />
              </div>
              <AnimatePresence initial={false} mode="wait">
                {d4 && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    layout
                  >
                    <div style={{ marginBottom: 12 }}>
                      <YesNo
                        name="day4_same_agents"
                        label="Are agents the same as Day 3?"
                      />
                    </div>
                    {watch("day4_same_agents") === false && (
                      <>
                        <div className="h2" style={{ marginBottom: 8 }}>
                          Attending Agents:
                        </div>
                        <div
                          className="row row-2"
                          style={{ gap: 12, marginBottom: 12 }}
                        >
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              1. Lead Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_lead_agent") || ""}
                              onChange={(e) =>
                                setValue(
                                  "day4_lead_agent",
                                  e.target.value as any,
                                  { shouldDirty: true }
                                )
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              2. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a2") || ""}
                              onChange={(e) =>
                                setValue("day4_a2", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              3. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a3") || ""}
                              onChange={(e) =>
                                setValue("day4_a3", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              4. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a4") || ""}
                              onChange={(e) =>
                                setValue("day4_a4", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              5. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a5") || ""}
                              onChange={(e) =>
                                setValue("day4_a5", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              6. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a6") || ""}
                              onChange={(e) =>
                                setValue("day4_a6", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              7. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a7") || ""}
                              onChange={(e) =>
                                setValue("day4_a7", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              8. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a8") || ""}
                              onChange={(e) =>
                                setValue("day4_a8", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              9. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a9") || ""}
                              onChange={(e) =>
                                setValue("day4_a9", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              10. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day4_a10") || ""}
                              onChange={(e) =>
                                setValue("day4_a10", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <div className="row row-2">
                      {Hours.map((h) => (
                        <div
                          key={`d4-${h}`}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              fontSize: 12,
                              color: "var(--v3-text-muted)",
                              paddingTop: 8,
                            }}
                          >
                            {hourKey(h)}
                          </div>
                          <textarea
                            className="v3-textarea"
                            rows={3}
                            {...register(`timeline_day4.${hourKey(h)}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Day 5? - only visible if Day 4 is enabled */}
          {d4 === true && (
            <section className="dashboard-card" style={{ padding: 24 }}>
              <div className="h2" style={{ marginBottom: 8 }}>
                Day 5?
              </div>
              <div style={{ marginBottom: 12 }}>
                <YesNo name="day5" label="Yes/No" />
              </div>
              <AnimatePresence initial={false} mode="wait">
                {d5 && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    layout
                  >
                    <div style={{ marginBottom: 12 }}>
                      <YesNo
                        name="day5_same_agents"
                        label="Are agents the same as Day 4?"
                      />
                    </div>
                    {watch("day5_same_agents") === false && (
                      <>
                        <div className="h2" style={{ marginBottom: 8 }}>
                          Attending Agents:
                        </div>
                        <div
                          className="row row-2"
                          style={{ gap: 12, marginBottom: 12 }}
                        >
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              1. Lead Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_lead_agent") || ""}
                              onChange={(e) =>
                                setValue(
                                  "day5_lead_agent",
                                  e.target.value as any,
                                  { shouldDirty: true }
                                )
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              2. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a2") || ""}
                              onChange={(e) =>
                                setValue("day5_a2", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              3. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a3") || ""}
                              onChange={(e) =>
                                setValue("day5_a3", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              4. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a4") || ""}
                              onChange={(e) =>
                                setValue("day5_a4", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              5. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a5") || ""}
                              onChange={(e) =>
                                setValue("day5_a5", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              6. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a6") || ""}
                              onChange={(e) =>
                                setValue("day5_a6", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              7. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a7") || ""}
                              onChange={(e) =>
                                setValue("day5_a7", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              8. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a8") || ""}
                              onChange={(e) =>
                                setValue("day5_a8", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              9. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a9") || ""}
                              onChange={(e) =>
                                setValue("day5_a9", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              10. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day5_a10") || ""}
                              onChange={(e) =>
                                setValue("day5_a10", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <div className="row row-2">
                      {Hours.map((h) => (
                        <div
                          key={`d5-${h}`}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              fontSize: 12,
                              color: "var(--v3-text-muted)",
                              paddingTop: 8,
                            }}
                          >
                            {hourKey(h)}
                          </div>
                          <textarea
                            className="v3-textarea"
                            rows={3}
                            {...register(`timeline_day5.${hourKey(h)}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Day 6? - only visible if Day 5 is enabled */}
          {d5 === true && (
            <section className="dashboard-card" style={{ padding: 24 }}>
              <div className="h2" style={{ marginBottom: 8 }}>
                Day 6?
              </div>
              <div style={{ marginBottom: 12 }}>
                <YesNo name="day6" label="Yes/No" />
              </div>
              <AnimatePresence initial={false} mode="wait">
                {d6 && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    layout
                  >
                    <div style={{ marginBottom: 12 }}>
                      <YesNo
                        name="day6_same_agents"
                        label="Are agents the same as Day 5?"
                      />
                    </div>
                    {watch("day6_same_agents") === false && (
                      <>
                        <div className="h2" style={{ marginBottom: 8 }}>
                          Attending Agents:
                        </div>
                        <div
                          className="row row-2"
                          style={{ gap: 12, marginBottom: 12 }}
                        >
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              1. Lead Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_lead_agent") || ""}
                              onChange={(e) =>
                                setValue(
                                  "day6_lead_agent",
                                  e.target.value as any,
                                  { shouldDirty: true }
                                )
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              2. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a2") || ""}
                              onChange={(e) =>
                                setValue("day6_a2", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              3. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a3") || ""}
                              onChange={(e) =>
                                setValue("day6_a3", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              4. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a4") || ""}
                              onChange={(e) =>
                                setValue("day6_a4", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              5. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a5") || ""}
                              onChange={(e) =>
                                setValue("day6_a5", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              6. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a6") || ""}
                              onChange={(e) =>
                                setValue("day6_a6", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              7. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a7") || ""}
                              onChange={(e) =>
                                setValue("day6_a7", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              8. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a8") || ""}
                              onChange={(e) =>
                                setValue("day6_a8", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              9. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a9") || ""}
                              onChange={(e) =>
                                setValue("day6_a9", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              10. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day6_a10") || ""}
                              onChange={(e) =>
                                setValue("day6_a10", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <div className="row row-2">
                      {Hours.map((h) => (
                        <div
                          key={`d6-${h}`}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              fontSize: 12,
                              color: "var(--v3-text-muted)",
                              paddingTop: 8,
                            }}
                          >
                            {hourKey(h)}
                          </div>
                          <textarea
                            className="v3-textarea"
                            rows={3}
                            {...register(`timeline_day6.${hourKey(h)}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Day 7? - only visible if Day 6 is enabled */}
          {d6 === true && (
            <section className="dashboard-card" style={{ padding: 24 }}>
              <div className="h2" style={{ marginBottom: 8 }}>
                Day 7?
              </div>
              <div style={{ marginBottom: 12 }}>
                <YesNo name="day7" label="Yes/No" />
              </div>
              <AnimatePresence initial={false} mode="wait">
                {d7 && (
                  <motion.div
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    layout
                  >
                    <div style={{ marginBottom: 12 }}>
                      <YesNo
                        name="day7_same_agents"
                        label="Are agents the same as Day 6?"
                      />
                    </div>
                    {watch("day7_same_agents") === false && (
                      <>
                        <div className="h2" style={{ marginBottom: 8 }}>
                          Attending Agents:
                        </div>
                        <div
                          className="row row-2"
                          style={{ gap: 12, marginBottom: 12 }}
                        >
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              1. Lead Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_lead_agent") || ""}
                              onChange={(e) =>
                                setValue(
                                  "day7_lead_agent",
                                  e.target.value as any,
                                  { shouldDirty: true }
                                )
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              2. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a2") || ""}
                              onChange={(e) =>
                                setValue("day7_a2", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              3. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a3") || ""}
                              onChange={(e) =>
                                setValue("day7_a3", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              4. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a4") || ""}
                              onChange={(e) =>
                                setValue("day7_a4", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              5. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a5") || ""}
                              onChange={(e) =>
                                setValue("day7_a5", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              6. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a6") || ""}
                              onChange={(e) =>
                                setValue("day7_a6", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              7. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a7") || ""}
                              onChange={(e) =>
                                setValue("day7_a7", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              8. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a8") || ""}
                              onChange={(e) =>
                                setValue("day7_a8", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              9. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a9") || ""}
                              onChange={(e) =>
                                setValue("day7_a9", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                          <div>
                            <div className="h2" style={{ marginBottom: 6 }}>
                              10. Agent
                            </div>
                            <input
                              className="v3-input"
                              value={watch("day7_a10") || ""}
                              onChange={(e) =>
                                setValue("day7_a10", e.target.value as any, {
                                  shouldDirty: true,
                                })
                              }
                            />
                          </div>
                        </div>
                      </>
                    )}
                    <div className="row row-2">
                      {Hours.map((h) => (
                        <div
                          key={`d7-${h}`}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 10,
                          }}
                        >
                          <div
                            style={{
                              width: 52,
                              fontSize: 12,
                              color: "var(--v3-text-muted)",
                              paddingTop: 8,
                            }}
                          >
                            {hourKey(h)}
                          </div>
                          <textarea
                            className="v3-textarea"
                            rows={3}
                            {...register(`timeline_day7.${hourKey(h)}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )}

          {/* Police Details */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 12 }}>
              Police Details
            </div>
            <div className="row" style={{ gap: 14 }}>
              <YesNo name="police_attendance" label="Police attendance?" />
              <AnimatePresence initial={false} mode="wait">
                {police && (
                  <motion.div
                    className="row row-3"
                    initial={{
                      opacity: 0,
                      y: -8,
                      scale: 0.98,
                      filter: "blur(4px)",
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: 1,
                      filter: "blur(0px)",
                    }}
                    exit={{
                      opacity: 0,
                      y: -6,
                      scale: 0.98,
                      filter: "blur(3px)",
                    }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    layout
                  >
                    <div>
                      <label
                        className="h2"
                        style={{ display: "block", marginBottom: 6 }}
                      >
                        CAD Number:
                      </label>
                      <input className="v3-input" {...register("police_cad")} />
                    </div>
                    <div style={{ gridColumn: "span 2" }}>
                      <label
                        className="h2"
                        style={{ display: "block", marginBottom: 6 }}
                      >
                        Police Force:
                      </label>
                      <select
                        className="v3-input"
                        value={watch("police_force") || ""}
                        onChange={(e) =>
                          setValue("police_force", e.target.value as any, {
                            shouldDirty: true,
                          })
                        }
                      >
                        <option value=""></option>
                        {[
                          "Metropolitan Police",
                          "West Mercia",
                          "Thames Valley",
                          "West Midlands",
                          "Surrey",
                          "Essex",
                          "Kent",
                          "Other",
                        ].map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              <div>
                <label
                  className="h2"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Additional Notes:
                </label>
                <textarea
                  className="v3-textarea"
                  rows={5}
                  {...register("police_notes")}
                />
              </div>
            </div>
          </section>

          {/* Photos */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 12 }}>
              Photos:
            </div>
            <div className="photo-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={`A-${i}`}>
                  <div className="h2" style={{ marginBottom: 6 }}>
                    Photo:
                  </div>
                  <label className="photo-tile">
                    {photosA[i] ? (
                      <img
                        src={URL.createObjectURL(photosA[i] as File)}
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
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null;
                        const next = photosA.slice();
                        next[i] = f;
                        setPhotosA(next);
                      }}
                    />
                    {photosA[i] && (
                      <button
                        type="button"
                        className="photo-remove"
                        onClick={(e) => {
                          e.preventDefault();
                          const next = photosA.slice();
                          next[i] = null;
                          setPhotosA(next);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </label>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14 }}>
              <YesNo name="extra_photos_1" label="Need to upload More?" />
            </div>
            <AnimatePresence initial={false} mode="wait">
              {extraPhotos1 && (
                <motion.div
                  className="photo-grid"
                  style={{ marginTop: 12 }}
                  initial={{
                    opacity: 0,
                    y: -8,
                    scale: 0.98,
                    filter: "blur(4px)",
                  }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -6, scale: 0.98, filter: "blur(3px)" }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  layout
                >
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={`B-${i}`}>
                      <div className="h2" style={{ marginBottom: 6 }}>
                        Photo:
                      </div>
                      <label className="photo-tile">
                        {photosB[i] ? (
                          <img
                            src={URL.createObjectURL(photosB[i] as File)}
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
                          onChange={(e) => {
                            const f = e.target.files?.[0] ?? null;
                            const next = photosB.slice();
                            next[i] = f;
                            setPhotosB(next);
                          }}
                        />
                        {photosB[i] && (
                          <button
                            type="button"
                            className="photo-remove"
                            onClick={(e) => {
                              e.preventDefault();
                              const next = photosB.slice();
                              next[i] = null;
                              setPhotosB(next);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </label>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {extraPhotos1 && (
              <>
                <div style={{ marginTop: 14 }}>
                  <YesNo name="extra_photos_2" label="Need to upload More?" />
                </div>
                <AnimatePresence initial={false} mode="wait">
                  {extraPhotos2 && (
                    <motion.div
                      className="photo-grid"
                      style={{ marginTop: 12 }}
                      initial={{
                        opacity: 0,
                        y: -8,
                        scale: 0.98,
                        filter: "blur(4px)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: "blur(0px)",
                      }}
                      exit={{
                        opacity: 0,
                        y: -6,
                        scale: 0.98,
                        filter: "blur(3px)",
                      }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      layout
                    >
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`C-${i}`}>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            Photo:
                          </div>
                          <label className="photo-tile">
                            {photosC[i] ? (
                              <img
                                src={URL.createObjectURL(photosC[i] as File)}
                                alt="preview"
                                className="photo-thumb"
                              />
                            ) : (
                              <div
                                className="sub"
                                style={{ textAlign: "center" }}
                              >
                                Click to upload or drop
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                const next = photosC.slice();
                                next[i] = f;
                                setPhotosC(next);
                              }}
                            />
                            {photosC[i] && (
                              <button
                                type="button"
                                className="photo-remove"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const next = photosC.slice();
                                  next[i] = null;
                                  setPhotosC(next);
                                }}
                              >
                                ×
                              </button>
                            )}
                          </label>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {extraPhotos2 && (
              <>
                <div style={{ marginTop: 14 }}>
                  <YesNo name="extra_photos_3" label="Need to upload More?" />
                </div>
                <AnimatePresence initial={false} mode="wait">
                  {extraPhotos3 && (
                    <motion.div
                      className="photo-grid"
                      style={{ marginTop: 12 }}
                      initial={{
                        opacity: 0,
                        y: -8,
                        scale: 0.98,
                        filter: "blur(4px)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: "blur(0px)",
                      }}
                      exit={{
                        opacity: 0,
                        y: -6,
                        scale: 0.98,
                        filter: "blur(3px)",
                      }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      layout
                    >
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`D-${i}`}>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            Photo:
                          </div>
                          <label className="photo-tile">
                            {photosD[i] ? (
                              <img
                                src={URL.createObjectURL(photosD[i] as File)}
                                alt="preview"
                                className="photo-thumb"
                              />
                            ) : (
                              <div
                                className="sub"
                                style={{ textAlign: "center" }}
                              >
                                Click to upload or drop
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                const next = photosD.slice();
                                next[i] = f;
                                setPhotosD(next);
                              }}
                            />
                            {photosD[i] && (
                              <button
                                type="button"
                                className="photo-remove"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const next = photosD.slice();
                                  next[i] = null;
                                  setPhotosD(next);
                                }}
                              >
                                ×
                              </button>
                            )}
                          </label>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}

            {extraPhotos3 && (
              <>
                <div style={{ marginTop: 14 }}>
                  <YesNo name="extra_photos_4" label="Need to upload More?" />
                </div>
                <AnimatePresence initial={false} mode="wait">
                  {extraPhotos4 && (
                    <motion.div
                      className="photo-grid"
                      style={{ marginTop: 12 }}
                      initial={{
                        opacity: 0,
                        y: -8,
                        scale: 0.98,
                        filter: "blur(4px)",
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                        scale: 1,
                        filter: "blur(0px)",
                      }}
                      exit={{
                        opacity: 0,
                        y: -6,
                        scale: 0.98,
                        filter: "blur(3px)",
                      }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      layout
                    >
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div key={`E-${i}`}>
                          <div className="h2" style={{ marginBottom: 6 }}>
                            Photo:
                          </div>
                          <label className="photo-tile">
                            {photosE[i] ? (
                              <img
                                src={URL.createObjectURL(photosE[i] as File)}
                                alt="preview"
                                className="photo-thumb"
                              />
                            ) : (
                              <div
                                className="sub"
                                style={{ textAlign: "center" }}
                              >
                                Click to upload or drop
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              style={{ display: "none" }}
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null;
                                const next = photosE.slice();
                                next[i] = f;
                                setPhotosE(next);
                              }}
                            />
                            {photosE[i] && (
                              <button
                                type="button"
                                className="photo-remove"
                                onClick={(e) => {
                                  e.preventDefault();
                                  const next = photosE.slice();
                                  next[i] = null;
                                  setPhotosE(next);
                                }}
                              >
                                ×
                              </button>
                            )}
                          </label>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </section>

          {/* Additional Notes + Final */}
          <section className="dashboard-card" style={{ padding: 24 }}>
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
                <label
                  className="h2"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Departure Time:<span className="label-star">*</span>
                </label>
                <TimeInput {...register("departure_time")} />
              </div>
              <div>
                <label
                  className="h2"
                  style={{ display: "block", marginBottom: 6 }}
                >
                  Completion Date:<span className="label-star">*</span>
                </label>
                <DateInput {...register("completion_date")} />
              </div>
            </div>
            <div style={{ paddingTop: 14, display: 'flex', gap: 12 }}>
              <button
                className="btn-ghost"
                onClick={onCancel}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button-primary"
                type="submit"
                style={{ flex: 1 }}
              >
                Submit Report
              </button>
            </div>
          </section>
        </div>
      </div>
      </form>
    </FormProvider>
  );
}
