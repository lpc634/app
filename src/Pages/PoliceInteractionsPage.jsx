import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/useAuth.jsx'
import PoliceInteractionForm from '@/components/police/PoliceInteractionForm.jsx'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Badge } from '@/components/ui/badge.jsx'
import { POLICE_FORCES, OUTCOMES, HELP_RANGE, ALL } from '@/constants/policeOptions.js'

export default function PoliceInteractionsPage() {
  const { apiCall, user } = useAuth()
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({ force: undefined, outcome: undefined, job_address: undefined, helpfulness: undefined })
  const [openJobs, setOpenJobs] = useState([])
  const [loading, setLoading] = useState(false)
  const [openForm, setOpenForm] = useState(false)

  const load = async () => {
    const params = new URLSearchParams()
    if (filters.force && filters.force !== ALL) params.append('force', filters.force)
    if (filters.outcome && filters.outcome !== ALL) params.append('outcome', filters.outcome)
    if (filters.job_address && filters.job_address !== ALL) params.append('job_address', filters.job_address)
    if (filters.helpfulness && filters.helpfulness !== ALL) params.append('helpfulness', String(filters.helpfulness))
    setLoading(true)
    try {
      const res = await apiCall(`/police-interactions?${params.toString()}`)
      setItems(res.items || [])
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    ;(async ()=>{ try{ const jobs = await apiCall('/jobs/open-min'); setOpenJobs(jobs||[]) } catch(_){} })()
  }, [])

  const canEdit = user?.role === 'admin'

  function formatDate(iso) {
    if (!iso) return '—'
    try { return new Date(iso).toLocaleString() } catch { return iso }
  }

  function renderOfficers(officers) {
    const list = (Array.isArray(officers) ? officers : [])
      .filter(Boolean)
      .map(o => o?.shoulder_number ? (o.name ? `${o.shoulder_number} (${o.name})` : String(o.shoulder_number)) : null)
      .filter(Boolean)
    if (list.length === 0) return '—'
    const [first, second, ...rest] = list
    return (
      <div className="flex flex-wrap gap-1">
        {[first, second].filter(Boolean).map((t, i) => (
          <span key={i} className="px-2 py-0.5 rounded bg-v3-bg-dark text-v3-text-lightest text-xs">{t}</span>
        ))}
        {rest.length > 0 && (
          <span className="px-2 py-0.5 rounded bg-v3-bg-dark text-v3-text-muted text-xs">+{rest.length} more</span>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Police Interactions</h1>
        <button className="button-refresh" onClick={() => setOpenForm(true)}>New</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
        <div>
          <label className="block text-xs text-v3-text-muted mb-1">Force</label>
          <Select value={filters.force} onValueChange={(v)=>setFilters({...filters, force: v})}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All forces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All forces</SelectItem>
              {POLICE_FORCES.map(f=> <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-v3-text-muted mb-1">Outcome</label>
          <Select value={filters.outcome} onValueChange={(v)=>setFilters({...filters, outcome: v})}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All outcomes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All outcomes</SelectItem>
              {OUTCOMES.map(o=> <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-v3-text-muted mb-1">Job address</label>
          <Select value={filters.job_address} onValueChange={(v)=>setFilters({...filters, job_address: v})}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All jobs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All jobs</SelectItem>
              {openJobs.map(j=> <SelectItem key={j.id} value={j.address}>{j.address}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="block text-xs text-v3-text-muted mb-1">Helpfulness</label>
          <Select value={filters.helpfulness} onValueChange={(v)=>setFilters({...filters, helpfulness: v})}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {HELP_RANGE.map(n=> <SelectItem key={n} value={n}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Button onClick={load} className="w-full">Apply Filters</Button>
        </div>
      </div>

      <div className="overflow-x-auto border border-v3-border rounded">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-v3-bg-dark">
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Job Address</th>
              <th className="px-3 py-2 text-left">Force</th>
              <th className="px-3 py-2 text-left">Officers</th>
              <th className="px-3 py-2 text-left">Reason</th>
              <th className="px-3 py-2 text-left">Outcome</th>
              <th className="px-3 py-2 text-left">Helpfulness</th>
              <th className="px-3 py-2 text-left">Created By</th>
              {canEdit && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-sm text-v3-text-muted">Loading…</td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-v3-text-muted">
                  No police interactions yet. <button className="button-refresh ml-2" onClick={()=>setOpenForm(true)}>New</button>
                </td>
              </tr>
            ) : (
              items.map((i) => (
                <tr key={i.id} className="border-t border-v3-border hover:bg-v3-bg-dark/40">
                  <td className="px-3 py-2">{formatDate(i.created_at)}</td>
                  <td className="px-3 py-2">{i.job_address}</td>
                  <td className="px-3 py-2">{i.force}</td>
                  <td className="px-3 py-2">{renderOfficers(i.officers)}</td>
                  <td className="px-3 py-2">{i.reason}</td>
                  <td className="px-3 py-2">{i.outcome}</td>
                  <td className="px-3 py-2">{i.helpfulness}</td>
                  <td className="px-3 py-2">{i.created_by_role} #{i.created_by_user_id}</td>
                  {canEdit && (
                    <td className="px-3 py-2 text-right space-x-2" />
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {openForm && (
        <PoliceInteractionForm onClose={()=>{ setOpenForm(false); load(); }} />
      )}
    </div>
  )
}


