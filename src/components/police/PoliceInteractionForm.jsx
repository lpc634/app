import React, { useEffect, useState } from 'react'
import { useAuth } from '@/useAuth.jsx'

export default function PoliceInteractionForm({ onClose }) {
  const { apiCall } = useAuth()
  const [openJobs, setOpenJobs] = useState([])
  const [form, setForm] = useState({
    job_id: '',
    job_address: '',
    force: '',
    officers: [{ shoulder_number: '', name: '' }],
    reason: '',
    outcome: '',
    helpfulness: 3,
    notes: ''
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    (async () => {
      try {
        const jobs = await apiCall('/jobs/open-min')
        setOpenJobs(jobs || [])
      } catch (_) {}
    })()
  }, [])

  const updateField = (k, v) => setForm(prev => ({ ...prev, [k]: v }))
  const updateOfficer = (idx, k, v) => setForm(prev => ({ ...prev, officers: prev.officers.map((o,i)=> i===idx? { ...o, [k]: v }: o) }))

  const addOfficer = () => setForm(prev => ({ ...prev, officers: [...prev.officers, { shoulder_number: '', name: '' }] }))
  const removeOfficer = (idx) => setForm(prev => ({ ...prev, officers: prev.officers.filter((_,i)=>i!==idx) }))

  const submit = async () => {
    // Basic client validation
    if (!(form.job_address || form.job_id)) return alert('Job address is required')
    if (!form.force) return alert('Force is required')
    if (!form.reason) return alert('Reason is required')
    if (!form.outcome) return alert('Outcome is required')
    if (!form.officers[0]?.shoulder_number) return alert('At least one officer shoulder number is required')

    setSaving(true)
    try {
      const payload = {
        ...form,
        job_id: form.job_id ? Number(form.job_id) : null,
        job_address: form.job_id ? (openJobs.find(j=>String(j.id)===String(form.job_id))?.address || form.job_address) : form.job_address
      }
      await apiCall('/police-interactions', { method: 'POST', body: JSON.stringify(payload) })
      onClose?.()
    } catch (e) {
      alert(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-v3-bg-card border border-v3-border rounded-lg w-full max-w-2xl p-4" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">New Police Interaction</h2>
          <button onClick={onClose} className="px-2 py-1">Close</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Job (open)</label>
            <select className="w-full bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={form.job_id} onChange={e=>updateField('job_id', e.target.value)}>
              <option value="">Select open job (optional)</option>
              {openJobs.map(j=> <option key={j.id} value={j.id}>{j.address}</option>)}
            </select>
            <input className="mt-2 w-full bg-v3-bg-dark border border-v3-border rounded px-2 py-2" placeholder="Or enter job address" value={form.job_address} onChange={e=>updateField('job_address', e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Force</label>
              <input className="w-full bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={form.force} onChange={e=>updateField('force', e.target.value)} placeholder="e.g. Met Police" />
            </div>
            <div>
              <label className="block text-sm mb-1">Helpfulness (1-5)</label>
              <select className="w-full bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={form.helpfulness} onChange={e=>updateField('helpfulness', e.target.value)}>
                {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Officers</label>
            <div className="space-y-2">
              {form.officers.map((o, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                  <input placeholder="Shoulder number" className="bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={o.shoulder_number} onChange={e=>updateOfficer(idx, 'shoulder_number', e.target.value)} />
                  <input placeholder="Name (optional)" className="bg-v3-bg-dark border border-v3-border rounded px-2 py-2 md:col-span-2" value={o.name} onChange={e=>updateOfficer(idx, 'name', e.target.value)} />
                  {idx>0 && <button className="text-xs" onClick={()=>removeOfficer(idx)}>Remove</button>}
                </div>
              ))}
              <button className="text-xs" onClick={addOfficer}>Add officer</button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm mb-1">Reason</label>
              <input className="w-full bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={form.reason} onChange={e=>updateField('reason', e.target.value)} placeholder="e.g. Section 61" />
            </div>
            <div>
              <label className="block text-sm mb-1">Outcome</label>
              <input className="w-full bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={form.outcome} onChange={e=>updateField('outcome', e.target.value)} placeholder="e.g. Support provided" />
            </div>
          </div>

          <div>
            <label className="block text-sm mb-1">Notes</label>
            <textarea rows={4} className="w-full bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={form.notes} onChange={e=>updateField('notes', e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button className="px-3 py-2 border border-v3-border rounded" onClick={onClose}>Cancel</button>
            <button className="button-refresh" disabled={saving} onClick={submit}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}


