import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";

/** =====================
 *  V3 THEME + STARBORDER + STICKY PROGRESS
 *  ===================== */
const THEME_CSS = String.raw`
:root, .dark { --v3-orange:#FF6A2B; --v3-orange-dark:#D84E17; --v3-orange-glow:rgba(255,106,43,.45); --v3-bg-darkest:#0D0D0E; --v3-bg-dark:#141416; --v3-bg:#111114; --v3-bg-card:#15161A; --v3-border:#2B2D33; --v3-text-strong:#F8F8FA; --v3-text:#E6E6EA; --v3-text-muted:#9CA3AF; }
.dark, .v3-root{ background:var(--v3-bg-darkest); color:var(--v3-text); font-family:Inter, ui-sans-serif, system-ui, Segoe UI, Roboto, Arial }
.page-shell{ max-width:1100px; margin:0 auto; padding:28px 18px 120px }
.h1{ font-size:1.8rem; font-weight:800; color:var(--v3-text-strong) }
.h2{ font-size:1.05rem; font-weight:700; color:var(--v3-text-strong) }
.sub{ font-size:.9rem; color:var(--v3-text-muted) }
.dashboard-card{ background:var(--v3-bg-card); border:1px solid var(--v3-border); border-radius:16px; box-shadow: inset 0 0 0 1px var(--v3-orange), 0 10px 28px rgba(0,0,0,.35); padding:24px }
.button-primary{ background:linear-gradient(135deg,var(--v3-orange),var(--v3-orange-dark)); color:#fff; border:0; height:42px; padding:0 16px; border-radius:10px; cursor:pointer }
.progress-rail{ height:10px; border-radius:999px; background:#1d1f26; border:1px solid #2A2D36; overflow:hidden }
.progress-bar{ height:100%; border-radius:inherit; background:linear-gradient(90deg,var(--v3-orange),var(--v3-orange-dark)) }
.label-star{ color:#ff6868; margin-left:4px }
.row{ display:grid; gap:12px }
@media(min-width:780px){ .row-2{ grid-template-columns:1fr 1fr } .row-3{ grid-template-columns:repeat(3,1fr) } .row-4{ grid-template-columns:repeat(4,1fr) } }
.v3-input{ width:100%; background:var(--v3-bg-dark); border:1px solid var(--v3-border); color:var(--v3-text); height:42px; border-radius:10px; padding:0 12px }
.v3-input:focus{ outline:none; box-shadow:0 0 0 3px var(--v3-orange-glow); border-color:var(--v3-orange) }
.v3-textarea{ width:100%; background:var(--v3-bg-dark); border:1px solid var(--v3-border); color:var(--v3-text); border-radius:10px; padding:10px 12px }
.v3-textarea:focus{ outline:none; box-shadow:0 0 0 3px var(--v3-orange-glow); border-color:var(--v3-orange) }
/* StarBorder */
.star-border-container{ display:block; position:relative; border-radius:20px; overflow:hidden; width:100% }
.border-gradient-bottom{ position:absolute; width:300%; height:50%; opacity:.7; bottom:-12px; right:-250%; border-radius:50%; animation:star-movement-bottom linear infinite alternate; z-index:0 }
.border-gradient-top{ position:absolute; width:300%; height:50%; opacity:.7; top:-12px; left:-250%; border-radius:50%; animation:star-movement-top linear infinite alternate; z-index:0 }
.inner-content{ position:relative; border:1px solid var(--v3-border); background:rgba(17,17,20,.6); backdrop-filter:blur(8px); color:var(--v3-text); font-size:16px; padding:12px 14px; border-radius:20px; z-index:1 }
.star-border-container .inner-content{ box-shadow: inset 0 0 0 1px var(--v3-orange) }
@keyframes star-movement-bottom{ 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(-100%,0);opacity:0} }
@keyframes star-movement-top{ 0%{transform:translate(0,0);opacity:1} 100%{transform:translate(100%,0);opacity:0} }
/* Yes/No pills — orange dot only */
.yn{ display:flex; gap:10px; align-items:center; flex-wrap:wrap }
.yn label{ display:flex; align-items:center; gap:8px; padding:8px 12px; border:1px solid var(--v3-border); border-radius:10px; background:var(--v3-bg-card); cursor:pointer; transition: background-color 180ms ease }
.yn input{ width:16px; height:16px; accent-color: var(--v3-orange) }
.yn label:has(input:checked){ background: linear-gradient(180deg, rgba(255,106,43,.15), rgba(255,106,43,0) 60%); border-color: var(--v3-border) }
/* Photo tiles */
.photo-grid{ display:grid; grid-template-columns:1fr; gap:18px }
@media(min-width:780px){ .photo-grid{ grid-template-columns:1fr 1fr } }
.photo-tile{ position:relative; border:1px dashed #383B44; background:#17181D; border-radius:14px; height:118px; display:grid; place-items:center; cursor:pointer; overflow:hidden }
.photo-tile:hover{ border-color:var(--v3-orange); box-shadow:0 0 0 3px var(--v3-orange-glow) }
.photo-thumb{ width:100%; height:100%; object-fit:cover; border-radius:12px }
.photo-remove{ position:absolute; top:6px; right:6px; padding:2px 8px; border-radius:8px; border:1px solid var(--v3-border); background:rgba(0,0,0,.55); color:var(--v3-text); line-height:1; cursor:pointer }
.photo-remove:hover{ background:rgba(0,0,0,.75) }
`;

/** =====================
 *  Form Schema
 *  ===================== */
const schema = z.object({
  // Header / basics
  client: z.string().min(1, "Client is required"),
  address1: z.string().min(1, "Address line 1 is required"),
  address2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  postcode: z.string().min(1, "Postal / Zip Code is required"),
  date: z.string().min(1, "Date is required"),
  arrival_time: z.string().min(1, "Arrival time is required"),

  // Agents (1-20 with toggle for 11-20)
  agent_1: z.string().min(1, "Lead Agent is required"),
  agent_2: z.string().optional(), agent_3: z.string().optional(), agent_4: z.string().optional(),
  agent_5: z.string().optional(), agent_6: z.string().optional(), agent_7: z.string().optional(), agent_8: z.string().optional(),
  agent_9: z.string().optional(), agent_10: z.string().optional(),
  more_than_10: z.boolean().default(false),
  agent_11: z.string().optional(), agent_12: z.string().optional(), agent_13: z.string().optional(), agent_14: z.string().optional(),
  agent_15: z.string().optional(), agent_16: z.string().optional(), agent_17: z.string().optional(), agent_18: z.string().optional(),
  agent_19: z.string().optional(), agent_20: z.string().optional(),

  // Property details
  prior_notice_served: z.boolean().default(false),
  property_condition: z.string().min(1, "Property condition is required"),
  property_damage: z.boolean().default(false),
  damage_details: z.string().optional(),
  aggressive: z.boolean().default(false),
  aggression_details: z.string().optional(),
  dogs_on_site: z.boolean().default(false),
  dog_details: z.string().optional(),
  num_males: z.coerce.number().min(0).default(0),
  num_children: z.coerce.number().min(0).default(0),
  num_females: z.coerce.number().min(0).default(0),

  // Timeline (1..10) + optional reveal for 6..10
  need_more_entries: z.boolean().default(false),
  ev1_text: z.string().optional(), ev1_time: z.string().optional(),
  ev2_text: z.string().optional(), ev2_time: z.string().optional(),
  ev3_text: z.string().optional(), ev3_time: z.string().optional(),
  ev4_text: z.string().optional(), ev4_time: z.string().optional(),
  ev5_text: z.string().optional(), ev5_time: z.string().optional(),
  ev6_text: z.string().optional(), ev6_time: z.string().optional(),
  ev7_text: z.string().optional(), ev7_time: z.string().optional(),
  ev8_text: z.string().optional(), ev8_time: z.string().optional(),
  ev9_text: z.string().optional(), ev9_time: z.string().optional(),
  ev10_text: z.string().optional(), ev10_time: z.string().optional(),

  // Hourly timeline fields (multi-day)
  timeline_day1: z.record(z.string().optional()),
  timeline_day2: z.record(z.string().optional()).optional(),
  timeline_day3: z.record(z.string().optional()).optional(),
  timeline_day4: z.record(z.string().optional()).optional(),
  timeline_day5: z.record(z.string().optional()).optional(),
  timeline_day6: z.record(z.string().optional()).optional(),
  timeline_day7: z.record(z.string().optional()).optional(),

  // Day toggles
  day2_enabled: z.boolean().default(false),
  day3_enabled: z.boolean().default(false),
  day4_enabled: z.boolean().default(false),
  day5_enabled: z.boolean().default(false),
  day6_enabled: z.boolean().default(false),
  day7_enabled: z.boolean().default(false),

  // Police
  police_attendance: z.boolean().default(false),
  cad_number: z.string().optional(),
  police_force: z.string().optional(),
  police_notes: z.string().optional(),

  // Photos
  photo_of_serve: z.any(),
  need_more_photos: z.boolean().default(false),
  p2: z.any().optional(), p3: z.any().optional(), p4: z.any().optional(), p5: z.any().optional(), p6: z.any().optional(), p7: z.any().optional(), p8: z.any().optional(), p9: z.any().optional(), p10: z.any().optional(), p11: z.any().optional(), p12: z.any().optional(), p13: z.any().optional(),

  // Footer
  additional_notes: z.string().optional(),
  departure_time: z.string().min(1, "Departure time is required"),
  completion_date: z.string().min(1, "Completion date is required"),
});

/** =====================
 *  StarBorder Component
 *  ===================== */
function StarBorder({ color = "white", speed = "8s", thickness = 1, children }) {
  return (
    <div className="star-border-container" style={{ padding: `${thickness}px 0` }}>
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
    </div>
  );
}

/** =====================
 *  Small helpers
 *  ===================== */
function Field({ label, required=false, children }){
  return (
    <div>
      <label className="h2" style={{ display:"block", marginBottom:6 }}>
        {label}{required && <span className="label-star">*</span>}
      </label>
      {children}
    </div>
  );
}
const TextInput = (p)=> <input className="v3-input" {...p}/>;
const TextArea = (p)=> <textarea className="v3-textarea" {...p}/>;
const DateInput = (p)=> <input type="date" className="v3-input" {...p}/>;
const TimeInput = (p)=> <input type="time" className="v3-input" {...p}/>;
const SelectInput = (p)=> <select className="v3-input" {...p}/>;

// Hourly timeline helpers (align with other forms)
const Hours = Array.from({ length: 18 }, (_, i) => 6 + i);
const hourKey = (h: number) => `${String(h).padStart(2, '0')}:00`;

function YesNo({ name, label }){
  const { setValue, watch } = useFormContext();
  const v = !!watch(name);
  return (
    <div style={{ marginTop: 4 }}>
      <div className="h2" style={{ fontWeight:600, marginBottom:8 }}>{label}</div>
      <div className="yn" style={{ flexWrap: 'nowrap' }}>
        <label><input type="radio" name={name} checked={v===true} onChange={()=>setValue(name,true,{shouldDirty:true})} /><span>Yes</span></label>
        <label><input type="radio" name={name} checked={v===false} onChange={()=>setValue(name,false,{shouldDirty:true})} /><span>No</span></label>
      </div>
    </div>
  );
}
function CountSelect({ name }){
  const { setValue, watch } = useFormContext();
  const v = watch(name) ?? 0;
  const opts = useMemo(()=>Array.from({length:51},(_,i)=>i),[]);
  return (
    <select className="v3-input" value={String(v)} onChange={(e)=>setValue(name, Number(e.target.value), {shouldDirty:true})}>
      {opts.map(n=> <option key={n} value={n}>{n}</option>)}
    </select>
  );
}
function PhotoTile({ value, onChange }){
  return (
    <label className="photo-tile">
      {value ? <img src={URL.createObjectURL(value)} alt="preview" className="photo-thumb"/> : <div className="sub" style={{textAlign:"center"}}>Upload or drag files here.</div>}
      <input type="file" accept="image/*" style={{display:"none"}} onChange={(e)=>onChange(e.target.files?.[0] ?? null)} />
      {value && <button type="button" className="photo-remove" onClick={(e)=>{ e.preventDefault(); onChange(null); }}>×</button>}
    </label>
  );
}

/** =====================
 *  Main component
 *  ===================== */
export default function SquatterEvictionForm({ jobData, onSubmit: parentOnSubmit, onCancel }){
  const methods = useForm({ resolver: zodResolver(schema), defaultValues:{
    more_than_10:false, need_more_entries:false, need_more_photos:false,
    prior_notice_served:false, locked_in:false, property_damage:false, aggressive:false, dogs_on_site:false, police_attendance:false,
    day2_enabled:false,
  }});
  const { register, handleSubmit, watch, setValue } = methods;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Progress bar - find scrollable container
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

  // toggles
  const moreAgents = watch('more_than_10');
  const priorNotice = watch('prior_notice_served');
  const lockedIn = watch('locked_in');
  const propertyDamage = watch('property_damage');
  const aggressive = watch('aggressive');
  const dogs = watch('dogs_on_site');
  const moreEntries = watch('need_more_entries');
  const day2 = watch('day2_enabled');
  const day3 = watch('day3_enabled');
  const day4 = watch('day4_enabled');
  const day5 = watch('day5_enabled');
  const day6 = watch('day6_enabled');
  const day7 = watch('day7_enabled');
  const morePhotos = watch('need_more_photos');
  const police = watch('police_attendance');

  // photo previews state
  const [photos, setPhotos] = useState({ p0:null, p2:null, p3:null, p4:null, p5:null, p6:null, p7:null, p8:null, p9:null, p10:null, p11:null, p12:null, p13:null });

  const onSubmit = (values)=>{
    console.log('Squatter Eviction Form', values);
    alert('Submitted (demo) — see console for JSON payload.');
  };

  return (
    <FormProvider {...methods}>
      <style>{THEME_CSS}</style>
      <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="dark v3-root">
        {/* Sticky StarBorder header */}
        <div className="page-shell" style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          paddingBottom: 14,
          background: 'var(--v3-bg-darkest)',
          backdropFilter: 'blur(8px)'
        }}>
          <StarBorder color="var(--v3-orange)" speed="8s" thickness={2}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%'
            }}>
              <div style={{ width: '40px' }} />
              <div className="h1" style={{ textAlign: 'center', flex: 1 }}>
                Squatter Eviction Form
              </div>
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  style={{
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(239, 68, 68, 0.9)',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    borderRadius: '10px',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 1)';
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.9)';
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="progress-rail" style={{ marginTop: 10 }}>
              <div className="progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          </StarBorder>
        </div>

        <div className="page-shell" style={{ display:'grid', gap:24 }}>
          {/* Eviction Report */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom:12 }}>Eviction Report</div>
            <div className="row">
              <Field label="Client:" required>
                <TextInput placeholder="Client" {...register('client')} />
              </Field>
              <Field label="Eviction Address:" required>
                <div className="row">
                  <TextInput placeholder="Address Line 1" {...register('address1')} />
                  <TextInput placeholder="Address Line 2" {...register('address2')} />
                  <div className="row row-2">
                    <TextInput placeholder="City" {...register('city')} />
                    <TextInput placeholder="Postal / Zip Code" {...register('postcode')} />
                  </div>
                </div>
              </Field>
              <div className="row row-2">
                <Field label="Date:" required>
                  <DateInput {...register('date')} />
                </Field>
                <Field label="Arrival Time:" required>
                  <TimeInput {...register('arrival_time')} />
                </Field>
              </div>
            </div>
          </section>

          {/* Agents on Site */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom:12 }}>Agents on Site</div>
            <div className="row row-2">
              <Field label="1. Lead Agent:" required>
                <TextInput {...register('agent_1')} />
              </Field>
              <Field label="2. Agent:">
                <TextInput {...register('agent_2')} />
              </Field>
            </div>
            <div className="row row-2">
              <Field label="3. Agent:"><TextInput {...register('agent_3')} /></Field>
              <Field label="4. Agent:"><TextInput {...register('agent_4')} /></Field>
            </div>
            <div className="row row-2">
              <Field label="5. Agent:"><TextInput {...register('agent_5')} /></Field>
              <Field label="6. Agent:"><TextInput {...register('agent_6')} /></Field>
            </div>
            <div className="row row-2">
              <Field label="7. Agent:"><TextInput {...register('agent_7')} /></Field>
              <Field label="8. Agent:"><TextInput {...register('agent_8')} /></Field>
            </div>
            <div className="row row-2">
              <Field label="9. Agent:"><TextInput {...register('agent_9')} /></Field>
              <Field label="10. Agent:"><TextInput {...register('agent_10')} /></Field>
            </div>
            <div className="row">
              <YesNo name="more_than_10" label="More Than 10 Agents?" />
            </div>
            <AnimatePresence>{moreAgents && (
              <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                <div className="row row-2" style={{ marginTop:12 }}>
                  <Field label="11. Agent:"><TextInput {...register('agent_11')} /></Field>
                  <Field label="12. Agent:"><TextInput {...register('agent_12')} /></Field>
                  <Field label="13. Agent:"><TextInput {...register('agent_13')} /></Field>
                  <Field label="14. Agent:"><TextInput {...register('agent_14')} /></Field>
                  <Field label="15. Agent:"><TextInput {...register('agent_15')} /></Field>
                  <Field label="16. Agent:"><TextInput {...register('agent_16')} /></Field>
                  <Field label="17. Agent:"><TextInput {...register('agent_17')} /></Field>
                  <Field label="18. Agent:"><TextInput {...register('agent_18')} /></Field>
                  <Field label="19. Agent:"><TextInput {...register('agent_19')} /></Field>
                  <Field label="20. Agent:"><TextInput {...register('agent_20')} /></Field>
                </div>
              </motion.div>
            )}</AnimatePresence>
          </section>

          {/* Property Details */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom:12 }}>Property Details</div>

            {/* Prior notice */}
            <div className="row">
              <YesNo name="prior_notice_served" label="Has the notice been served prior to your arrival?" />
            </div>

            {/* Property condition */}
            <div className="row row-2">
              <Field label="Property Condition:" required>
                <SelectInput {...register('property_condition')}>
                  <option value=""></option>
                  <option>Good</option>
                  <option>Fair</option>
                  <option>Poor</option>
                </SelectInput>
              </Field>
              <div />
            </div>

            {/* Removed 'locked themselves in' question per request */}

            {/* Damage: when Yes, require photo and show details; stacked below */}
            <div className="row">
              <YesNo name="property_damage" label="Property damage?" />
            </div>
            <AnimatePresence>
              {propertyDamage && (
                <motion.div className="row" initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                  <div className="h2" style={{ marginBottom:6 }}>
                    Pictures of property damage<span className="label-star">*</span>
                  </div>
                  <div className="photo-grid" style={{ gridTemplateColumns: '1fr' }}>
                    <PhotoTile value={photos.p2} onChange={(f)=>setPhotos(p=>({ ...p, p2:f }))} />
                  </div>
                  <Field label="Property Damage Details:"><TextArea rows={3} {...register('damage_details')} /></Field>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Aggression: details only when Yes, stacked below */}
            <div className="row">
              <YesNo name="aggressive" label="Are the squatters aggressive?" />
            </div>
            <AnimatePresence>
              {aggressive && (
                <motion.div className="row" initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                  <Field label="Aggression Details:"><TextArea rows={3} {...register('aggression_details')} /></Field>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Dogs: details only when Yes, stacked below */}
            <div className="row">
              <YesNo name="dogs_on_site" label="Are there dogs on site?" />
            </div>
            <AnimatePresence>
              {dogs && (
                <motion.div className="row" initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                  <Field label="Dog Details:"><TextArea rows={3} {...register('dog_details')} /></Field>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Counts */}
            <div className="row row-3">
              <Field label="Number of Adult Males:"><CountSelect name="num_males" /></Field>
              <Field label="Number of children:"><CountSelect name="num_children" /></Field>
              <Field label="Number of Adult Females:"><CountSelect name="num_females" /></Field>
            </div>
          </section>

          {/* Eviction Timeline (hourly, aligned with other forms) */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2">Eviction Timeline:</div>
            <div className="sub" style={{ marginBottom: 12 }}>Please use this section to keep a diary of what happened throughout the day.</div>
            <div className="row row-2">
              {Hours.map((h) => (
                <div key={`d1-${h}`} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  <div style={{ width:52, fontSize:12, color:'var(--v3-text-muted)', paddingTop:8 }}>
                    {hourKey(h)}
                  </div>
                  <TextArea rows={3} {...register(`timeline_day1.${hourKey(h)}`)} />
                </div>
              ))}
            </div>
          </section>

          {/* Day 2? (optional) */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 8 }}>Day 2?</div>
            <div style={{ marginBottom: 12 }}>
              <YesNo name="day2_enabled" label="Yes/No" />
            </div>
            <AnimatePresence initial={false}>
              {day2 && (
                <motion.div className="row row-2" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                  {Hours.map((h) => (
                    <div key={`d2-${h}`} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:52, fontSize:12, color:'var(--v3-text-muted)', paddingTop:8 }}>
                        {hourKey(h)}
                      </div>
                      <TextArea rows={3} {...register(`timeline_day2.${hourKey(h)}`)} />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Day 3..7 chained */}
          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 8 }}>Day 3?</div>
            <div style={{ marginBottom: 12 }}>
              <YesNo name="day3_enabled" label="Yes/No" />
            </div>
            <AnimatePresence initial={false}>
              {day2 && day3 && (
                <motion.div className="row row-2" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                  {Hours.map((h) => (
                    <div key={`d3-${h}`} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:52, fontSize:12, color:'var(--v3-text-muted)', paddingTop:8 }}>{hourKey(h)}</div>
                      <TextArea rows={3} {...register(`timeline_day3.${hourKey(h)}`)} />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 8 }}>Day 4?</div>
            <div style={{ marginBottom: 12 }}>
              <YesNo name="day4_enabled" label="Yes/No" />
            </div>
            <AnimatePresence initial={false}>
              {day3 && day4 && (
                <motion.div className="row row-2" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                  {Hours.map((h) => (
                    <div key={`d4-${h}`} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:52, fontSize:12, color:'var(--v3-text-muted)', paddingTop:8 }}>{hourKey(h)}</div>
                      <TextArea rows={3} {...register(`timeline_day4.${hourKey(h)}`)} />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 8 }}>Day 5?</div>
            <div style={{ marginBottom: 12 }}>
              <YesNo name="day5_enabled" label="Yes/No" />
            </div>
            <AnimatePresence initial={false}>
              {day4 && day5 && (
                <motion.div className="row row-2" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                  {Hours.map((h) => (
                    <div key={`d5-${h}`} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:52, fontSize:12, color:'var(--v3-text-muted)', paddingTop:8 }}>{hourKey(h)}</div>
                      <TextArea rows={3} {...register(`timeline_day5.${hourKey(h)}`)} />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 8 }}>Day 6?</div>
            <div style={{ marginBottom: 12 }}>
              <YesNo name="day6_enabled" label="Yes/No" />
            </div>
            <AnimatePresence initial={false}>
              {day5 && day6 && (
                <motion.div className="row row-2" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                  {Hours.map((h) => (
                    <div key={`d6-${h}`} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:52, fontSize:12, color:'var(--v3-text-muted)', paddingTop:8 }}>{hourKey(h)}</div>
                      <TextArea rows={3} {...register(`timeline_day6.${hourKey(h)}`)} />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          <section className="dashboard-card" style={{ padding: 24 }}>
            <div className="h2" style={{ marginBottom: 8 }}>Day 7?</div>
            <div style={{ marginBottom: 12 }}>
              <YesNo name="day7_enabled" label="Yes/No" />
            </div>
            <AnimatePresence initial={false}>
              {day6 && day7 && (
                <motion.div className="row row-2" initial={{ opacity:0, height:0 }} animate={{ opacity:1, height:'auto' }} exit={{ opacity:0, height:0 }}>
                  {Hours.map((h) => (
                    <div key={`d7-${h}`} style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                      <div style={{ width:52, fontSize:12, color:'var(--v3-text-muted)', paddingTop:8 }}>{hourKey(h)}</div>
                      <TextArea rows={3} {...register(`timeline_day7.${hourKey(h)}`)} />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Police Details */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom:12 }}>Police Details</div>
            <div className="row row-3">
              <YesNo name="police_attendance" label="Police attendance?" />
              <Field label="CAD Number:"><TextInput {...register('cad_number')} /></Field>
              <Field label="Police Force:"><TextInput {...register('police_force')} /></Field>
            </div>
            <div className="row" style={{ marginTop:8 }}>
              <Field label="Additional Notes:"><TextArea rows={4} {...register('police_notes')} /></Field>
            </div>
          </section>

          {/* Photos */}
          <section className="dashboard-card">
            <div className="h2" style={{ marginBottom:12 }}>Photos</div>
            <div className="row row-2">
              <Field label="Photo of Serve:" required>
                <PhotoTile value={photos.p0} onChange={(f)=>{ setPhotos(p=>({ ...p, p0:f })); setValue('photo_of_serve', f); }} />
              </Field>
              <Field label="Photo:">
                <PhotoTile value={photos.p3} onChange={(f)=>setPhotos(p=>({ ...p, p3:f }))} />
              </Field>
            </div>
            <div className="row row-2" style={{marginTop:12}}>
              <Field label="Photo:"><PhotoTile value={photos.p4} onChange={(f)=>setPhotos(p=>({ ...p, p4:f }))} /></Field>
              <Field label="Photo:"><PhotoTile value={photos.p5} onChange={(f)=>setPhotos(p=>({ ...p, p5:f }))} /></Field>
            </div>
            <div className="row" style={{ marginTop:8 }}>
              <YesNo name="need_more_photos" label="Need to upload more?" />
            </div>
            <AnimatePresence>{morePhotos && (
              <motion.div initial={{opacity:0, height:0}} animate={{opacity:1, height:'auto'}} exit={{opacity:0, height:0}}>
                <div className="row row-2" style={{marginTop:12}}>
                  <Field label="Photo:"><PhotoTile value={photos.p6} onChange={(f)=>setPhotos(p=>({ ...p, p6:f }))} /></Field>
                  <Field label="Photo:"><PhotoTile value={photos.p7} onChange={(f)=>setPhotos(p=>({ ...p, p7:f }))} /></Field>
                </div>
                <div className="row row-2" style={{marginTop:12}}>
                  <Field label="Photo:"><PhotoTile value={photos.p8} onChange={(f)=>setPhotos(p=>({ ...p, p8:f }))} /></Field>
                  <Field label="Photo:"><PhotoTile value={photos.p9} onChange={(f)=>setPhotos(p=>({ ...p, p9:f }))} /></Field>
                </div>
                <div className="row row-2" style={{marginTop:12}}>
                  <Field label="Photo:"><PhotoTile value={photos.p10} onChange={(f)=>setPhotos(p=>({ ...p, p10:f }))} /></Field>
                  <Field label="Photo:"><PhotoTile value={photos.p11} onChange={(f)=>setPhotos(p=>({ ...p, p11:f }))} /></Field>
                </div>
                <div className="row row-2" style={{marginTop:12}}>
                  <Field label="Photo:"><PhotoTile value={photos.p12} onChange={(f)=>setPhotos(p=>({ ...p, p12:f }))} /></Field>
                  <Field label="Photo:"><PhotoTile value={photos.p13} onChange={(f)=>setPhotos(p=>({ ...p, p13:f }))} /></Field>
                </div>
              </motion.div>
            )}</AnimatePresence>
          </section>

          {/* Footer */}
          <section className="dashboard-card">
            <Field label="Additional Notes:"><TextArea rows={5} {...register('additional_notes')} /></Field>
            <div className="row row-2" style={{ marginTop:12 }}>
              <Field label="Departure Time:" required><TimeInput {...register('departure_time')} /></Field>
              <Field label="Completion Date:" required><DateInput {...register('completion_date')} /></Field>
            </div>
            <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:14 }}>
              <button className="button-primary" type="button" onClick={handleSubmit(onSubmit)}>Submit</button>
            </div>
          </section>
        </div>
      </form>
    </FormProvider>
  );
}
