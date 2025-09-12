import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/useAuth.jsx'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { usePageHeader } from '@/components/layout/PageHeaderContext.jsx'
import Portal from '@/components/Portal.jsx'
import { 
  Loader2, 
  Send, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Search, 
  X,
  MessageSquare,
  UserCheck,
  UserX,
  AlertTriangle,
  Check
} from 'lucide-react'

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
  const maxLength = 1000
  const [sending, setSending] = useState(false)
  const [results, setResults] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [loadingAgents, setLoadingAgents] = useState(false)
  const textareaRef = useRef(null)

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
  const unlinkedCount = agents.length - linkedCount

  const toggle = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectAllInView = () => {
    setSelected(filtered.map(a => a.id))
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
    if (!results) return { success: 0, failed: 0, not_linked: 0 }
    const success = results.results?.filter(r => r.status === 'success').length || 0
    const failed = results.results?.filter(r => r.status === 'failed').length || 0
    const notLinked = results.not_linked?.length || 0
    return { success, failed, not_linked: notLinked }
  }, [results])

  const length = message.length
  const overLimit = length > maxLength
  const disabledSend = sending || message.trim().length === 0 || (selected.length === 0) || overLimit

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`
  }, [message])

  // Get first letter of name for avatar
  const getInitials = (name) => {
    return name ? name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : '?'
  }

  if (loadingAgents) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading agents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen space-y-4 pb-6 px-4 md:px-6 max-w-4xl mx-auto">
      {/* Simple Header */}
      <div className="text-center md:text-left py-4">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Send Message</h1>
        <p className="text-muted-foreground">Send Telegram messages to your field agents</p>
      </div>

      {/* Message Composition Card */}
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Compose Message</CardTitle>
          <CardDescription>
            Type your message (max {maxLength} characters)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="message-textarea" className="text-sm font-medium">Message</label>
              <div className={`text-sm font-mono ${overLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                {length}/{maxLength}
              </div>
            </div>
            <Textarea
              id="message-textarea"
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here..."
              className={`min-h-24 md:min-h-32 resize-none text-base leading-relaxed ${
                overLimit ? 'border-red-500 focus:border-red-500' : ''
              }`}
            />
            {overLimit && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4" />
                <span>Message exceeds character limit</span>
              </div>
            )}
          </div>
          
          {/* Send Button - Right under the textarea */}
          <Button 
            className="w-full h-12 text-base font-semibold" 
            disabled={disabledSend} 
            onClick={handleSend}
          >
            {sending ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-5 w-5 mr-2" />
                Send to {selected.length} agent{selected.length === 1 ? '' : 's'}
              </>
            )}
          </Button>
          {disabledSend && !sending && (
            <p className="text-sm text-muted-foreground text-center">
              {message.trim().length === 0 ? 'Type a message first' : 
               selected.length === 0 ? 'Select agents below' : 
               overLimit ? 'Message too long' : ''}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Agent Selection Card */}
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Select Recipients</CardTitle>
          <CardDescription>
            Choose agents to receive your message
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filter Controls */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents..."
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Button 
                type="button" 
                variant={showAll ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setShowAll(true); setShowLinked(true); setIncludeUnlinked(true); }}
              >
                All ({agents.length})
              </Button>
              <Button 
                type="button" 
                variant={showLinked && !showAll && !includeUnlinked ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setShowAll(false); setShowLinked(true); setIncludeUnlinked(false); }}
              >
                Connected ({linkedCount})
              </Button>
              <Button 
                type="button" 
                variant={includeUnlinked && !showAll && !showLinked ? 'default' : 'outline'} 
                size="sm" 
                onClick={() => { setShowAll(false); setShowLinked(false); setIncludeUnlinked(true); }}
              >
                Not Connected ({unlinkedCount})
              </Button>
            </div>

            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={selectAllInView}
                disabled={filtered.length === 0}
              >
                Select All ({filtered.length})
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={clearAll}
                disabled={selected.length === 0}
              >
                Clear Selection
              </Button>
            </div>
          </div>

          {/* Agents List */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No agents found</p>
              </div>
            ) : (
              filtered.map((agent) => (
                <label 
                  key={agent.id} 
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer hover:bg-muted/50 ${
                    selected.includes(agent.id) 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5 text-primary border-2 border-muted-foreground rounded"
                    checked={selected.includes(agent.id)}
                    onChange={() => toggle(agent.id)}
                    aria-label={`Select ${agent.name}`}
                  />
                  
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold text-sm ${
                    agent.linked 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {getInitials(agent.name)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{agent.name}</p>
                      <div className={`w-2 h-2 rounded-full ${agent.linked ? 'bg-green-500' : 'bg-muted-foreground'}`}></div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                  </div>
                </label>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Card */}
      {results && (
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                Delivery Results
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  <Check className="h-3 w-3 mr-1" />
                  Success: {summary.success}
                </Badge>
                <Badge variant="secondary" className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                  <X className="h-3 w-3 mr-1" />
                  Failed: {summary.failed}
                </Badge>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Not Connected: {summary.not_linked}
                </Badge>
                <Button size="sm" variant="ghost" onClick={() => setResults(null)} aria-label="Clear results">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.results?.map((result, index) => (
                <div key={`${result.agent_id}-${index}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <div className={`w-2 h-2 rounded-full ${
                    result.status === 'success' ? 'bg-green-500' : 
                    result.status === 'failed' ? 'bg-red-500' : 'bg-muted-foreground'
                  }`} />
                  <span className="font-medium text-sm">Agent #{result.agent_id}</span>
                  <span className="text-sm text-muted-foreground">—</span>
                  <span className={`text-sm font-medium ${
                    result.status === 'success' ? 'text-green-600' : 
                    result.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'
                  }`}>
                    {result.status}
                  </span>
                  {result.error && (
                    <>
                      <span className="text-sm text-muted-foreground">•</span>
                      <span className="text-sm text-red-600 truncate flex-1">{result.error}</span>
                    </>
                  )}
                </div>
              ))}
              {results.not_linked?.length > 0 && (
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800">
                  <p className="text-sm text-orange-800 dark:text-orange-200">
                    <strong>Not connected to Telegram:</strong> Agent IDs {results.not_linked.join(', ')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards - Moved to Bottom */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4">
        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="p-3">
            <div className="text-center">
              <UserCheck className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-green-900 dark:text-green-100">{linkedCount}</p>
              <p className="text-xs font-medium text-green-700 dark:text-green-300">Connected</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardContent className="p-3">
            <div className="text-center">
              <UserX className="h-6 w-6 text-orange-600 dark:text-orange-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-orange-900 dark:text-orange-100">{unlinkedCount}</p>
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300">Not Connected</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="text-center">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-blue-900 dark:text-blue-100">{agents.length}</p>
              <p className="text-xs font-medium text-blue-700 dark:text-blue-300">Total Agents</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-3">
            <div className="text-center">
              <MessageSquare className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-purple-900 dark:text-purple-100">{selected.length}</p>
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300">Selected</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Confirm Bulk Send
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You're about to send a message to <strong>{selected.length} agents</strong>. This action cannot be undone.
            </p>
            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm font-medium mb-2">Message Preview:</p>
              <p className="text-sm text-muted-foreground italic">"{message.trim().substring(0, 100)}{message.trim().length > 100 ? '...' : ''}"</p>
            </div>
          </div>
          <div className="flex flex-col-reverse md:flex-row justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="w-full md:w-auto">
              Cancel
            </Button>
            <Button onClick={doSend} className="bg-primary w-full md:w-auto">
              <Send className="h-4 w-4 mr-2" />
              Send Message
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}