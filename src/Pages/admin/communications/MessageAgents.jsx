import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/useAuth.jsx'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePageHeader } from '@/components/layout/PageHeaderContext.jsx'
import StickyActionBar from '@/components/layout/StickyActionBar.jsx'
import Portal from '@/components/Portal.jsx'
import { Loader2, Send, Users, CheckCircle2, XCircle, Link as LinkIcon, Search, X } from 'lucide-react'

export default function MessageAgents() {
  const { apiCall, user } = useAuth()
  const { register } = usePageHeader()

  const [agents, setAgents] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  const [includeUnlinked, setIncludeUnlinked] = useState(false)
  const [showLinked, setShowLinked] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(false)

  useEffect(() => {
    register({ title: 'Message agents' })
  }, [register])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoadingAgents(true)
        const data = await apiCall('/admin/agents/minimal')
        if (mounted) setAgents(data || [])
      } finally {
        setLoadingAgents(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const base = showAll ? agents : agents.filter(a => (showLinked && a.linked) || (includeUnlinked && !a.linked))
    if (!q) return base
    return base.filter(a => a.name?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q))
  }, [agents, query, includeUnlinked, showLinked, showAll])

  const linkedCount = agents.filter(a => a.linked).length
  const toggle = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const selectAllLinked = () => {
    setSelected(agents.filter(a => a.linked).map(a => a.id))
  }
  const clearAll = () => setSelected([])

  const handleSend = async () => {
    if (selected.length > 25) {
      setConfirmOpen(true)
      return
    }
    await doSend()
  }

  const doSend = async () => {
    try {
      setSending(true)
      setResults(null)
      const payload = {
        message: message.trim(),
        agent_ids: selected,
        send_to_all: false,
      }
      const resp = await apiCall('/admin/telegram/messages', { method: 'POST', body: JSON.stringify(payload) })
      setResults(resp)
    } catch (e) {
      setResults({ error: e.message })
    } finally {
      setSending(false)
      setConfirmOpen(false)
    }
  }

  const summary = useMemo(() => {
    if (!results) return { success: 0, failed: 0, not_linked: results?.not_linked?.length || 0 }
    const success = results.results?.filter(r => r.status === 'success').length || 0
    const failed = results.results?.filter(r => r.status === 'failed').length || 0
    const notLinked = results.not_linked?.length || 0
    return { success, failed, not_linked: notLinked }
  }, [results])

  const disabledSend = sending || message.trim().length === 0 || (selected.length === 0)

  return (
    <div className="space-y-4 pb-24 md:pb-0 px-3">
      <div>
        <h1 className="text-2xl font-semibold">Message agents</h1>
        <p className="text-sm text-muted-foreground">Send a Telegram message to one or many agents. Linked agents have Telegram connected.</p>
        <div className="flex items-center gap-2 mt-2 text-xs">
          <Badge variant="outline" className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500"/> Linked</Badge>
          <Badge variant="outline" className="flex items-center gap-1"><LinkIcon className="h-3 w-3 text-gray-400"/> Not linked</Badge>
        </div>
      </div>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Compose</CardTitle>
          <CardDescription>Up to 1000 characters. Telegram formatting is disabled.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="relative">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value.slice(0, 1000))}
                placeholder="Write your message..."
                className="min-h-28"
              />
              <div className="absolute right-2 bottom-2 text-xs text-muted-foreground">{message.length}/1000</div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Recipients</div>
              <div className="flex gap-2">
                <Button type="button" variant={showAll ? 'default' : 'outline'} size="sm" onClick={() => { setShowAll(true); setShowLinked(true); setIncludeUnlinked(true); }} aria-pressed={showAll}>All</Button>
                <Button type="button" variant={showLinked && !showAll ? 'default' : 'outline'} size="sm" onClick={() => { setShowAll(false); setShowLinked(v => !v); }} aria-pressed={showLinked}>Linked</Button>
                <Button type="button" variant={includeUnlinked && !showAll ? 'default' : 'outline'} size="sm" onClick={() => { setShowAll(false); setIncludeUnlinked(v => !v); }} aria-pressed={includeUnlinked}>Not linked</Button>
                <div className="w-px h-6 bg-border" />
                <Button type="button" variant="default" size="sm" onClick={selectAllLinked}>Select linked ({linkedCount})</Button>
                <Button type="button" variant="ghost" size="sm" onClick={clearAll}>Clear</Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents by name or email..."
                className="w-full pl-10 pr-3 h-10 rounded-md border bg-background"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto rounded-lg border divide-y">
              {loadingAgents ? (
                <div className="p-3 text-sm text-muted-foreground">Loading agents...</div>
              ) : filtered.length === 0 ? (
                <div className="p-3 text-sm text-muted-foreground">No agents found.</div>
              ) : (
                filtered.map(a => (
                  <label key={a.id} className="flex items-center gap-3 p-3 cursor-pointer tap-target min-h-[48px]">
                    <input type="checkbox" className="h-4 w-4" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{a.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{a.email}</div>
                    </div>
                    <div className="ml-auto flex items-center gap-2 text-xs">
                      <span className={`w-2 h-2 rounded-full ${a.linked ? 'bg-green-500' : 'bg-gray-500'}`} />
                      {a.linked ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">Linked</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20">Not linked</span>
                      )}
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {results && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Results</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">Success {summary.success}</Badge>
                <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20">Failed {summary.failed}</Badge>
                <Badge variant="outline" className="bg-gray-500/10 text-gray-300 border-gray-500/20">Not linked {summary.not_linked}</Badge>
                <Button size="sm" variant="ghost" onClick={() => setResults(null)} aria-label="Clear results"><X className="h-4 w-4" /></Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2">
              {results.results?.map(r => (
                <div key={`${r.agent_id}-${r.status}-${r.telegram_message_id || ''}`} className="flex items-center gap-2 text-sm">
                  <span className={`w-2 h-2 rounded-full ${r.status === 'success' ? 'bg-green-500' : r.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'}`}/>
                  <span className="font-medium">Agent #{r.agent_id}</span>
                  <span className="text-muted-foreground">— {r.status}</span>
                  {r.error && <span className="text-muted-foreground truncate"> • {r.error}</span>}
                </div>
              ))}
              {results.not_linked?.length > 0 && (
                <div className="text-xs text-muted-foreground">Not linked: {results.not_linked.join(', ')}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Desktop action bar */}
      <div className="hidden md:flex items-center gap-2 justify-end pt-2 border-t">
        <div className="mr-auto text-sm text-muted-foreground">Selected: {selected.length}</div>
        <Button data-testid="send-message-desktop" disabled={disabledSend} onClick={handleSend}>
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send
        </Button>
      </div>

      <Portal>
        <StickyActionBar>
          <div className="text-xs text-muted-foreground mr-auto">
            {disabledSend
              ? 'Type a message and select at least one linked agent'
              : `Ready to send to ${selected.length} agent${selected.length === 1 ? '' : 's'}`}
            {!disabledSend && includeUnlinked && selected.some(id => (agents.find(a => a.id === id)?.linked === false)) && (
              <span className="ml-2">• Unlinked recipients will appear under Not linked</span>
            )}
          </div>
          <Button data-testid="send-message" className="flex-1" disabled={disabledSend} onClick={handleSend}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Send
          </Button>
        </StickyActionBar>
      </Portal>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm bulk send</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">You’re about to message {selected.length} agents. Continue?</p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={doSend}>Send</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
