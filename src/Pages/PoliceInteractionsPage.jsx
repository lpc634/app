import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/useAuth.jsx'
import PoliceInteractionForm from '@/components/police/PoliceInteractionForm.jsx'

export default function PoliceInteractionsPage() {
  const { apiCall, user } = useAuth()
  const [items, setItems] = useState([])
  const [filters, setFilters] = useState({ force: '', outcome: '', job_address: '', helpfulness: '' })
  const [openForm, setOpenForm] = useState(false)

  const load = async () => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => { if (v) params.append(k, v) })
    const res = await apiCall(`/police-interactions?${params.toString()}`)
    setItems(res.items || [])
  }

  useEffect(() => { load() }, [])

  const canEdit = user?.role === 'admin'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Police Interactions</h1>
        <button className="button-refresh" onClick={() => setOpenForm(true)}>New</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input placeholder="Force" className="bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={filters.force} onChange={e=>setFilters({...filters, force:e.target.value})} />
        <input placeholder="Outcome" className="bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={filters.outcome} onChange={e=>setFilters({...filters, outcome:e.target.value})} />
        <input placeholder="Job address" className="bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={filters.job_address} onChange={e=>setFilters({...filters, job_address:e.target.value})} />
        <select className="bg-v3-bg-dark border border-v3-border rounded px-2 py-2" value={filters.helpfulness} onChange={e=>setFilters({...filters, helpfulness:e.target.value})}>
          <option value="">Helpfulness</option>
          {[1,2,3,4,5].map(n=> <option key={n} value={n}>{n}</option>)}
        </select>
        <div className="md:col-span-4">
          <button className="px-3 py-2 bg-v3-bg-dark border border-v3-border rounded" onClick={load}>Apply Filters</button>
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
            {items.map(i => (
              <tr key={i.id} className="border-t border-v3-border">
                <td className="px-3 py-2">{new Date(i.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{i.job_address}</td>
                <td className="px-3 py-2">{i.force}</td>
                <td className="px-3 py-2">{(i.officers||[]).map(o=>o.shoulder_number).join(', ')}</td>
                <td className="px-3 py-2">{i.reason}</td>
                <td className="px-3 py-2">{i.outcome}</td>
                <td className="px-3 py-2">{i.helpfulness}</td>
                <td className="px-3 py-2">{i.created_by_role} #{i.created_by_user_id}</td>
                {canEdit && (
                  <td className="px-3 py-2 text-right space-x-2">
                    {/* Edit/Delete will be wired inside form later if needed */}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {openForm && (
        <PoliceInteractionForm onClose={()=>{ setOpenForm(false); load(); }} />
      )}
    </div>
  )
}


