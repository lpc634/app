import React, { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/useAuth.jsx'

export default function AgentMultiSelect({ value = [], onChange = () => {} }) {
  const { apiCall } = useAuth()
  const [agents, setAgents] = useState([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        // Use /users and map to id/name
        const users = await apiCall('/users')
        const mapped = (users.users || [])
          .filter(u => u.role === 'agent')
          .map(u => ({ id: u.id, name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || `Agent #${u.id}` }))
        if (mounted) setAgents(mapped)
      } finally {
        setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return agents
    return agents.filter(a => a.name.toLowerCase().includes(q) || String(a.id).includes(q))
  }, [agents, query])

  const toggle = (id) => {
    const exists = value.includes(id)
    const next = exists ? value.filter(x => x !== id) : [...value, id]
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <input
        type="text"
        placeholder="Search agents by name or ID..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-3 py-2 text-sm text-v3-text-lightest placeholder-v3-text-muted"
      />
      <div className="max-h-56 overflow-y-auto border border-v3-border rounded-md divide-y divide-v3-border">
        {loading ? (
          <div className="p-3 text-sm text-v3-text-muted">Loading agents...</div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-sm text-v3-text-muted">No agents found.</div>
        ) : (
          filtered.map(a => (
            <label key={a.id} className="flex items-center gap-3 p-2 text-sm text-v3-text-lightest cursor-pointer">
              <input
                type="checkbox"
                checked={value.includes(a.id)}
                onChange={() => toggle(a.id)}
                className="h-4 w-4"
              />
              <span className="truncate">{a.name}</span>
              <span className="ml-auto text-xs text-v3-text-muted">#{a.id}</span>
            </label>
          ))
        )}
      </div>
      <div className="text-xs text-v3-text-muted">Selected: {value.length}</div>
    </div>
  )
}


