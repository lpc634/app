import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/useAuth.jsx'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog.jsx'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Button } from '@/components/ui/button.jsx'
import { POLICE_FORCES, REASONS, OUTCOMES, HELP_RANGE } from '@/constants/policeOptions.js'

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
    <Dialog open onOpenChange={(v)=>{ if(!v) onClose?.() }}> 
      <DialogContent className="max-w-3xl rounded-2xl border-neutral-800 shadow-2xl backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>New Police Interaction</DialogTitle>
          <DialogDescription>Record details of police involvement for a job.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="pl-3 border-l-2 border-orange-500 mb-2 text-sm text-muted-foreground">Job</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Open job</label>
                <Select value={form.job_id||''} onValueChange={(v)=>updateField('job_id', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select open job (optional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {openJobs.map(j=> <SelectItem key={j.id} value={String(j.id)}>{j.address}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Or enter address</label>
                <Input value={form.job_address} onChange={e=>updateField('job_address', e.target.value)} placeholder="Manual job address" />
              </div>
            </div>
          </div>

          <div>
            <div className="pl-3 border-l-2 border-orange-500 mb-2 text-sm text-muted-foreground">Details</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Force</label>
                <Select value={form.force||''} onValueChange={(v)=>updateField('force', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select force" /></SelectTrigger>
                  <SelectContent>
                    {POLICE_FORCES.map(f=> <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.force === 'Other' && (
                  <Input className="mt-2" placeholder="Enter force" onChange={e=>updateField('force', e.target.value)} />
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Helpfulness (1-5)</label>
                <Select value={String(form.helpfulness)} onValueChange={(v)=>updateField('helpfulness', Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HELP_RANGE.map(n=> <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div>
            <div className="pl-3 border-l-2 border-orange-500 mb-2 text-sm text-muted-foreground">Officers</div>
            <div className="space-y-2">
              {form.officers.map((o, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                  <Input placeholder="Shoulder number" value={o.shoulder_number} onChange={e=>updateOfficer(idx, 'shoulder_number', e.target.value)} />
                  <Input placeholder="Name (optional)" value={o.name} onChange={e=>updateOfficer(idx, 'name', e.target.value)} className="md:col-span-2" />
                  {idx>0 && <Button variant="outline" onClick={()=>removeOfficer(idx)} className="justify-self-start">Remove</Button>}
                </div>
              ))}
              <Button variant="outline" onClick={addOfficer} className="mt-1">Add officer</Button>
            </div>
          </div>

          <div>
            <div className="pl-3 border-l-2 border-orange-500 mb-2 text-sm text-muted-foreground">Reason & Outcome</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Reason</label>
                <Select value={form.reason||''} onValueChange={(v)=>updateField('reason', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r=> <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.reason === 'Other' && (
                  <Input className="mt-2" placeholder="Enter reason" onChange={e=>updateField('reason', e.target.value)} />
                )}
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Outcome</label>
                <Select value={form.outcome||''} onValueChange={(v)=>updateField('outcome', v)}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select outcome" /></SelectTrigger>
                  <SelectContent>
                    {OUTCOMES.map(o=> <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {form.outcome === 'Other' && (
                  <Input className="mt-2" placeholder="Enter outcome" onChange={e=>updateField('outcome', e.target.value)} />
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="pl-3 border-l-2 border-orange-500 mb-2 text-sm text-muted-foreground">Notes</div>
            <Textarea rows={4} value={form.notes} onChange={e=>updateField('notes', e.target.value)} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}


