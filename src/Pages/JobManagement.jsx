import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import StickyActionBar from "@/components/layout/StickyActionBar.jsx";
import ResponsiveList from "@/components/responsive/ResponsiveList.jsx";
import LocationPicker from '@/components/LocationPicker.jsx';
import AgentMultiSelect from '@/components/AgentMultiSelect.jsx';
import ReportViewer from '@/components/modals/ReportViewer.jsx';
import { usePageHeader } from "@/components/layout/PageHeaderContext.jsx";
import { useAuth } from '../useAuth.jsx';
import { extractUkPostcode } from '../utils/ukPostcode';
import { JOB_TYPES } from '../constants/jobTypes.js';
import { toast } from 'sonner';
import {
  Plus,
  MapPin,
  Clock,
  Users,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Search,
  Briefcase,
  Receipt,
  Navigation,
  ExternalLink,
  X,
  FileText
} from 'lucide-react';
import '../styles/admin/jobs.css';

const initialJobState = {
  title: '',
  job_type: undefined,
  address: '',
  postcode: '',
  arrival_time: '',
  agents_required: 1,
  lead_agent_name: '',
  instructions: '',
  urgency_level: 'Standard',
  use_address_as_title: false,
  notify_agent_ids: [],
};

export default function JobManagement() {
  const { register } = usePageHeader();
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  // Parent state machine for modal management
  const [createOpen, setCreateOpen] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [selectedJob, setSelectedJob] = useState(null)
  const [showJobDetailsModal, setShowJobDetailsModal] = useState(false)
  const [jobAgents, setJobAgents] = useState([])
  const [jobInvoices, setJobInvoices] = useState([])
  const [jobV3Reports, setJobV3Reports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [showReportViewer, setShowReportViewer] = useState(false)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const { apiCall } = useAuth()


  const [newJob, setNewJob] = useState(() => ({ ...initialJobState }))

  const [loc, setLoc] = useState({ lat: null, lng: null, maps_link: '' })

  // Focus management
  const selectPinBtnRef = useRef(null)

  const detectedPostcode = extractUkPostcode(newJob.address || '')
  const hasLocation = Number.isFinite(loc.lat) && Number.isFinite(loc.lng)

  // Auto-parse postcode from address and update title if checkbox is checked
  const handleAddressChange = (address) => {
    const updates = { address }

    // Auto-parse postcode
    const parsedPostcode = extractUkPostcode(address)
    if (parsedPostcode) {
      updates.postcode = parsedPostcode
    }

    // Auto-update title if checkbox is checked
    if (newJob.use_address_as_title) {
      updates.title = address
    }

    setNewJob(prev => ({ ...prev, ...updates }))
  }

  const handleUseAddressAsTitle = (checked) => {
    const updates = { use_address_as_title: checked }
    if (checked) {
      updates.title = newJob.address
    }
    setNewJob(prev => ({ ...prev, ...updates }))
  }

  const [billingAgentCount, setBillingAgentCount] = useState('1')
  const [billingHourlyNet, setBillingHourlyNet] = useState('')
  const [billingFirstHourNet, setBillingFirstHourNet] = useState('')
  const [billingVatRate, setBillingVatRate] = useState('0.20')
  const [billingNoticeFeeNet, setBillingNoticeFeeNet] = useState('')

  // Modal transition handlers
  const handleOpenCreate = () => setCreateOpen(true)

  const handleOpenMap = () => {
    setCreateOpen(false)   // retract create modal
    setMapOpen(true)       // show map picker
  }

  const handleMapConfirm = ({ lat, lng }) => {
    const maps_link = `https://www.google.com/maps?q=${lat},${lng}`
    setLoc({ lat, lng, maps_link })
    setMapOpen(false)
    setCreateOpen(true)    // bring modal back
    // restore focus to the button for a11y
    requestAnimationFrame(() => selectPinBtnRef.current?.focus())
  }

  const handleMapCancel = () => {
    setMapOpen(false)
    setCreateOpen(true)
    requestAnimationFrame(() => selectPinBtnRef.current?.focus())
  }


  const fetchJobs = async () => {
    try {
      setLoading(true)
      const data = await apiCall('/jobs')
      setJobs(data.jobs || [])
    } catch (error) {
      setError('Failed to load jobs')
      console.error('Jobs error:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const count = Number(newJob.agents_required)
    setBillingAgentCount(String(Number.isFinite(count) && count > 0 ? count : 1))
  }, [newJob.agents_required])

  useEffect(() => {
    fetchJobs()
  }, [])

  useEffect(() => {
    register({
      title: "Jobs",
      action: (
        <Button size="sm" className="button-refresh hidden md:inline-flex" onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create
        </Button>
      )
    });
  }, [register]);

  useEffect(() => {
    const fixDialogStyling = () => {
      const dialogs = document.querySelectorAll('[role="dialog"]');
      dialogs.forEach(dialog => {
        dialog.style.backgroundColor = '#242424';
        dialog.style.border = '1px solid #333333';
        dialog.style.color = '#CCCCCC';
        dialog.style.opacity = '1';
      });
    };

    fixDialogStyling();

    const observer = new MutationObserver(fixDialogStyling);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, [createOpen]);

  useEffect(() => {
    if (!createOpen && !mapOpen) {
      setLoc({ lat: null, lng: null, maps_link: '' });
    }
  }, [createOpen, mapOpen])

  // Keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (mapOpen) {
          handleMapCancel()
        } else if (createOpen) {
          setCreateOpen(false)
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [mapOpen, createOpen, handleMapCancel])

  // Prevent background scroll when map is open
  useEffect(() => {
    if (mapOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [mapOpen])

  const handleCreateJob = async (e) => {
    e.preventDefault()
    setCreateLoading(true)

    // Validate required fields
    if (!newJob.job_type) {
      toast.error('Please select a job type')
      setCreateLoading(false)
      return
    }

    const agentCount = Number(billingAgentCount)
    const hourlyRate = parseFloat(billingHourlyNet)
    const firstHourRate = billingFirstHourNet ? parseFloat(billingFirstHourNet) : null
    const vatRate = billingVatRate === '' || billingVatRate === null ? 0.2 : parseFloat(billingVatRate)
    const noticeFee = billingNoticeFeeNet ? parseFloat(billingNoticeFeeNet) : null

    if (!Number.isFinite(agentCount) || agentCount < 1) {
      toast.error('Client pricing requires at least one billed agent')
      setCreateLoading(false)
      return
    }

    if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) {
      toast.error('Client hourly rate must be greater than zero')
      setCreateLoading(false)
      return
    }

    if (firstHourRate !== null && (!Number.isFinite(firstHourRate) || firstHourRate < hourlyRate)) {
      toast.error('First hour rate must be at least the standard hourly rate')
      setCreateLoading(false)
      return
    }

    if (!Number.isFinite(vatRate) || vatRate < 0) {
      toast.error('VAT rate must be zero or a positive number')
      setCreateLoading(false)
      return
    }

    if (noticeFee !== null && (!Number.isFinite(noticeFee) || noticeFee < 0)) {
      toast.error('Notice fee must be zero or a positive number')
      setCreateLoading(false)
      return
    }

    const notifyAgentIds = newJob.notify_agent_ids || []
    const hasTargetedAgents = notifyAgentIds.length > 0

    const payload = {
      ...newJob,
      agents_required: Number(newJob.agents_required) || 1,
      billing: {
        agent_count: agentCount,
        hourly_rate_net: hourlyRate,
        first_hour_rate_net: firstHourRate,
        vat_rate: vatRate,
        notice_fee_net: noticeFee,
      },
      notify_all: !hasTargetedAgents,
      notify_agents: hasTargetedAgents ? notifyAgentIds : [],
    }

    if (Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
      payload.location_lat = loc.lat
      payload.location_lng = loc.lng
      if (loc.maps_link) {
        payload.maps_link = loc.maps_link
      }
    }

    try {
      await apiCall('/jobs', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      toast.success("Job Created", {
  description: "New job has been created and notifications sent to available agents.",
})

      setCreateOpen(false)
      setNewJob({ ...initialJobState })
      setBillingAgentCount('1')
      setBillingHourlyNet('')
      setBillingFirstHourNet('')
      setBillingVatRate('0.20')
      setBillingNoticeFeeNet('')
      setLoc({ lat: null, lng: null, maps_link: '' })
      setMapOpen(false)
      fetchJobs()
    } catch (error) {
      toast.error("Error", {
  description: error.message || "Failed to create job",
})
    } finally {
      setCreateLoading(false)
    }
  }

  const handleUpdateJobStatus = async (jobId, newStatus) => {
    try {
      await apiCall(`/jobs/${jobId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      })

      toast.success("Job Updated", {
  description: `Job status changed to ${newStatus}`,
})

      fetchJobs()
    } catch (error) {
      toast.error("Error", {
  description: error.message || "Failed to update job",
})
    }
  }

  const handleDeleteJob = async (jobId) => {
    try {
      if (!confirm('Delete this job? This cannot be undone.')) return;
      await apiCall(`/admin/jobs/${jobId}`, { method: 'DELETE' })
      toast.success('Job deleted')
      fetchJobs()
    } catch (error) {
      toast.error('Failed to delete job', { description: error.message })
    }
  }

  const fetchJobDetails = async (jobId) => {
    setLoadingDetails(true)
    try {
      // Fetch job assignments (includes agent info)
      try {
        const assignmentsResponse = await apiCall(`/assignments/job/${jobId}`)
        const agents = assignmentsResponse.assignments?.map(assignment => ({
          id: assignment.agent_id,
          first_name: assignment.agent?.first_name || 'Unknown',
          last_name: assignment.agent?.last_name || '',
          email: assignment.agent?.email || '',
          status: assignment.status,
          role: assignment.is_lead ? 'lead' : 'agent'
        })) || []
        setJobAgents(agents)
      } catch (error) {
        console.error('Failed to fetch job agents:', error)
        setJobAgents([])
      }

      // Fetch job invoices
      try {
        const invoicesResponse = await apiCall(`/admin/jobs/${jobId}/invoices`)
        setJobInvoices(invoicesResponse.invoices || [])
      } catch (error) {
        console.error('Failed to fetch job invoices:', error)
        setJobInvoices([])
      }

      // Fetch V3 job reports
      try {
        const reportsResponse = await apiCall(`/admin/jobs/${jobId}/v3-reports`)
        setJobV3Reports(reportsResponse.reports || [])
      } catch (error) {
        console.error('Failed to fetch V3 reports:', error)
        setJobV3Reports([])
      }
    } catch (error) {
      toast.error('Failed to load job details')
      console.error('Error fetching job details:', error)
    } finally {
      setLoadingDetails(false)
    }
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.job_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.address.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

  const confirmedAgentsCount = jobAgents.filter(agent => agent.status === 'accepted').length

  const getStatusBadge = (status) => {
    const statusConfig = {
      open: { variant: 'secondary', icon: Clock, label: 'Open' },
      filled: { variant: 'default', icon: CheckCircle, label: 'Filled' },
      completed: { variant: 'default', icon: CheckCircle, label: 'Completed' },
      cancelled: { variant: 'destructive', icon: XCircle, label: 'Cancelled' }
    }

    const config = statusConfig[status] || statusConfig.open
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getUrgencyBadge = (urgency) => {
    const urgencyConfig = {
      'Low': { variant: 'outline', className: 'border-green-200 text-green-700' },
      'Standard': { variant: 'secondary', className: '' },
      'URGENT': { variant: 'destructive', className: 'bg-red-500 text-white' }
    }

    const config = urgencyConfig[urgency] || urgencyConfig.Standard

    return (
      <Badge variant={config.variant} className={config.className}>
        {urgency === 'URGENT' && <AlertTriangle className="h-3 w-3 mr-1" />}
        {urgency}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Job Management</h1>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="h-4 w-1/3 bg-muted animate-pulse rounded"></div>
                  <div className="h-3 w-1/2 bg-muted animate-pulse rounded"></div>
                  <div className="h-3 w-2/3 bg-muted animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Job Management</h1>
          <p className="text-muted-foreground">
            Create and manage field agent assignments
          </p>
        </div>
        
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Job
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Create New Job</DialogTitle>
              <DialogDescription>
                Create a new job assignment for field agents. Available agents will be notified automatically.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateJob}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Label htmlFor="title">Job Title/Label</Label>
                      <input
                        type="checkbox"
                        id="use_address_as_title"
                        checked={newJob.use_address_as_title}
                        onChange={(e) => handleUseAddressAsTitle(e.target.checked)}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="use_address_as_title" className="text-xs text-muted-foreground">
                        Use address as title
                      </Label>
                    </div>
                    <Input
                      id="title"
                      value={newJob.title}
                      onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                      placeholder="e.g., Security Guard - Shopping Center"
                      disabled={newJob.use_address_as_title}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_type">Job Type</Label>
                    <Select
                      value={newJob.job_type}
                      onValueChange={(value) => setNewJob({...newJob, job_type: value})}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select job type" />
                      </SelectTrigger>
                      <SelectContent>
                        {JOB_TYPES.map((type) => (
                          <SelectItem key={type.code} value={type.code}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Textarea
                    id="address"
                    value={newJob.address}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    placeholder="Full address including postcode (e.g., 123 Main Street, London, SW1A 1AA)"
                    required
                  />
                  {detectedPostcode && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        Postcode: {detectedPostcode}
                      </Badge>
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-[var(--v3-border)] bg-[var(--v3-bg-dark)] p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold" style={{ color: 'var(--v3-text-lightest)' }}>Entrance location</h3>
                      <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>Drop a pin so agents can navigate to the exact entrance.</p>
                    </div>
                    <button
                      type="button"
                      ref={selectPinBtnRef}
                      onClick={handleOpenMap}
                      className="button-refresh flex items-center gap-2 px-3 py-2 text-sm"
                    >
                      <Navigation className="h-4 w-4" />
                      Select Pin
                    </button>
                  </div>
                  {hasLocation ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-500/30 rounded-lg">
                        <div className="w-2 h-2 bg-green-400 rounded-full" />
                        <span className="text-sm text-green-400">Navigation link ready</span>
                        {loc.maps_link ? (
                          <a
                            href={loc.maps_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-auto text-green-400 hover:text-green-300"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--v3-bg-dark)] border border-[var(--v3-border)] rounded-lg">
                        <MapPin className="h-4 w-4" style={{ color: 'var(--v3-orange)' }} />
                        <span className="text-sm" style={{ color: 'var(--v3-text-lightest)' }}>
                          Coordinates: {loc.lat?.toFixed(6)}, {loc.lng?.toFixed(6)}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
                      No pin selected yet. Agents will only see the typed address until you place the marker.
                    </p>
                  )}
                  {detectedPostcode && (
                    <div className="px-3 py-2 bg-[var(--v3-bg-dark)] border border-[var(--v3-border)] rounded-lg text-xs" style={{ color: 'var(--v3-text-lightest)' }}>
                      Detected postcode: <span className="text-[var(--v3-orange)] font-semibold">{detectedPostcode}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="arrival_time">Arrival Time</Label>
                    <Input
                      id="arrival_time"
                      type="datetime-local"
                      value={newJob.arrival_time}
                      onChange={(e) => setNewJob({...newJob, arrival_time: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agents_required">Agents Required</Label>
                    <Input
                      id="agents_required"
                      type="number"
                      min="1"
                      value={newJob.agents_required}
                      onChange={(e) => setNewJob({...newJob, agents_required: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="lead_agent_name">Lead Agent Name</Label>
                    <Input
                      id="lead_agent_name"
                      value={newJob.lead_agent_name}
                      onChange={(e) => setNewJob({...newJob, lead_agent_name: e.target.value})}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency_level">Urgency Level</Label>
                    <Select 
                      value={newJob.urgency_level} 
                      onValueChange={(value) => setNewJob({...newJob, urgency_level: value})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Standard">Standard</SelectItem>
                        <SelectItem value="URGENT">URGENT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Instructions</Label>
                  <Textarea
                    id="instructions"
                    value={newJob.instructions}
                    onChange={(e) => setNewJob({...newJob, instructions: e.target.value})}
                    placeholder="Special instructions, dress code, equipment needed, etc."
                  />
                </div>

                <div className="rounded-lg border border-[var(--v3-border)] bg-[var(--v3-bg-dark)] p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--v3-text-lightest)' }}>Client Pricing (per agent)</h3>
                    <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
                      Agent costs will appear after agents submit their invoices.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="billingAgentCount">Billable Agents</Label>
                      <Input
                        id="billingAgentCount"
                        type="number"
                        min="1"
                        value={billingAgentCount}
                        onChange={(e) => setBillingAgentCount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingHourlyNet">Hourly Rate (net)</Label>
                      <Input
                        id="billingHourlyNet"
                        type="number"
                        min="0"
                        step="0.01"
                        value={billingHourlyNet}
                        onChange={(e) => setBillingHourlyNet(e.target.value)}
                        placeholder="e.g., 40"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingFirstHourNet">First Hour Rate (net)</Label>
                      <Input
                        id="billingFirstHourNet"
                        type="number"
                        min="0"
                        step="0.01"
                        value={billingFirstHourNet}
                        onChange={(e) => setBillingFirstHourNet(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="billingVatRate">VAT Rate</Label>
                      <Input
                        id="billingVatRate"
                        type="number"
                        min="0"
                        step="0.01"
                        value={billingVatRate}
                        onChange={(e) => setBillingVatRate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="billingNoticeFeeNet">Notice Fee (net)</Label>
                      <Input
                        id="billingNoticeFeeNet"
                        type="number"
                        min="0"
                        step="0.01"
                        value={billingNoticeFeeNet}
                        onChange={(e) => setBillingNoticeFeeNet(e.target.value)}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>

                {/* Agent Notification Section */}
                <div className="rounded-lg border border-[var(--v3-border)] bg-[var(--v3-bg-dark)] p-4 space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--v3-text-lightest)' }}>Notify Agents</h3>
                    <p className="text-xs" style={{ color: 'var(--v3-text-muted)' }}>
                      Only selected agents will be notified. You can broadcast to all later from Job actions.
                    </p>
                  </div>
                  <AgentMultiSelect
                    arrivalISO={newJob.arrival_time}
                    value={newJob.notify_agent_ids}
                    onChange={(ids) => setNewJob({...newJob, notify_agent_ids: ids})}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading || mapOpen}>
                  {createLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Job'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="filled">Filled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Jobs List */}
      <div>
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
                <p className="text-muted-foreground">
                  {searchTerm || statusFilter !== 'all' 
                    ? 'Try adjusting your search or filters' 
                    : 'Create your first job to get started'
                  }
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ResponsiveList
            data={filteredJobs}
            columns={[
              { key: 'address', header: 'Address' },
              { key: 'type', header: 'Type' },
              { key: 'arrival', header: 'Arrival' },
              { key: 'agents', header: 'Agents' },
              { key: 'status', header: 'Status' },
              { key: 'actions', header: 'Actions' },
            ]}
            renderCard={(job) => (
              <Card 
                key={job.id} 
                className="cursor-pointer hover:border-[var(--v3-orange)] transition-all"
                onClick={() => {
                  setSelectedJob(job)
                  setShowJobDetailsModal(true)
                  fetchJobDetails(job.id)
                }}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {job.address}
                        {getUrgencyBadge(job.urgency_level)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.job_type}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(job.arrival_time).toLocaleString()}
                        </span>
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(job.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium mb-1">Address</p>
                        <p className="text-sm text-muted-foreground">{job.address}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Requirements</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {job.agents_required} agents needed
                          </span>
                          {job.lead_agent_name && (
                            <span>Lead: {job.lead_agent_name}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    {job.instructions && (
                      <div>
                        <p className="text-sm font-medium mb-1">Instructions</p>
                        <p className="text-sm text-muted-foreground">{job.instructions}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t">
                      {job.status === 'open' && (
                        <>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleUpdateJobStatus(job.id, 'cancelled'); }}>Cancel Job</Button>
                          <Button size="sm" onClick={(e) => { e.stopPropagation(); handleUpdateJobStatus(job.id, 'filled'); }}>Mark as Filled</Button>
                        </>
                      )}
                      <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}>Delete Job</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            renderRow={(job) => (
              <tr 
                key={job.id} 
                className="border-b cursor-pointer hover:bg-[var(--v3-bg-dark)] transition-all"
                onClick={() => {
                  setSelectedJob(job)
                  setShowJobDetailsModal(true)
                  fetchJobDetails(job.id)
                }}
              >
                <td className="p-2 text-sm">{job.address}</td>
                <td className="p-2 text-sm">{job.job_type}</td>
                <td className="p-2 text-sm">{new Date(job.arrival_time).toLocaleString()}</td>
                <td className="p-2 text-sm">{job.agents_required}</td>
                <td className="p-2 text-sm">{getStatusBadge(job.status)}</td>
                <td className="p-2 text-sm">
                  <div className="flex gap-2">
                    {job.status === 'open' && (
                      <>
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleUpdateJobStatus(job.id, 'cancelled'); }}>Cancel</Button>
                        <Button size="sm" onClick={(e) => { e.stopPropagation(); handleUpdateJobStatus(job.id, 'filled'); }}>Filled</Button>
                      </>
                    )}
                    <Button size="sm" variant="destructive" onClick={(e) => { e.stopPropagation(); handleDeleteJob(job.id); }}>Delete</Button>
                  </div>
                </td>
              </tr>
            )}
          />
        )}
      </div>
      {/* FAB for mobile create */}
      <div className="md:hidden fixed bottom-16 right-4 z-30">
        <Button size="icon" className="rounded-full h-14 w-14 shadow-lg" aria-label="Create Job" data-testid="fab-create-job" onClick={handleOpenCreate}>
          <Plus className="h-6 w-6" />
        </Button>
      </div>

      {/* Sticky Action Bar example if needed for bulk actions (hidden for now) */}
      <StickyActionBar className="hidden" />

      {/* Job Details Modal */}
      {showJobDetailsModal && selectedJob && (
        <Dialog open={showJobDetailsModal} onOpenChange={setShowJobDetailsModal}>
          <DialogContent className="job-modal p-0">
            {/* Sticky Header */}
            <div className="job-modal__header">
              <div className="job-modal__header-content">
                <h2 className="job-modal__title">Job Details</h2>
                <p className="job-modal__subtitle">
                  <MapPin />
                  {selectedJob.address || 'Job Information'}
                </p>
              </div>
              <button
                className="job-modal__close-btn"
                onClick={() => setShowJobDetailsModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="job-modal__body">
              <div className="job-modal__grid">
                {/* Job Information - Left Column */}
                <div className="job-modal__info">
                  <div className="job-modal__card">
                    <h3 className="job-modal__card-title">
                      <MapPin />
                      Job Information
                    </h3>
                    <div className="kv-grid">
                      <div className="kv-row">
                        <span className="kv-label">Address</span>
                        <span className="kv-value">{selectedJob.address}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-label">Type</span>
                        <span className="kv-value">{selectedJob.job_type}</span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-label">Arrival Time</span>
                        <span className="kv-value">
                          {selectedJob.arrival_time ? new Date(selectedJob.arrival_time).toLocaleString() : 'Not set'}
                        </span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-label">Status</span>
                        <span className="kv-value">
                          <Badge style={{
                            backgroundColor: selectedJob.status === 'completed' ? '#10b981' : 'var(--v3-orange)',
                            color: 'white',
                            border: 'none'
                          }}>
                            {selectedJob.status?.toUpperCase()}
                          </Badge>
                        </span>
                      </div>
                      <div className="kv-row">
                        <span className="kv-label">Agents Required</span>
                        <span className="kv-value">{selectedJob.agents_required}</span>
                      </div>
                      {selectedJob.lead_agent_name && (
                        <div className="kv-row">
                          <span className="kv-label">Lead Agent</span>
                          <span className="kv-value">{selectedJob.lead_agent_name}</span>
                        </div>
                      )}
                      {selectedJob.instructions && (
                        <div className="kv-row">
                          <span className="kv-label">Instructions</span>
                          <span className="kv-value">{selectedJob.instructions}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assigned Agents - Right Column Top */}
                <div className="job-modal__agents">
                  <div className="job-modal__card">
                    <h3 className="job-modal__card-title">
                      <Users />
                      Assigned Agents
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--v3-text-muted)' }}>
                        {confirmedAgentsCount} of {selectedJob.agents_required} confirmed
                      </span>
                    </h3>
                    {loadingDetails ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--v3-orange)' }} />
                      </div>
                    ) : jobAgents.length > 0 ? (
                      <div className="agent-list">
                        {jobAgents.map((agent) => (
                          <div key={agent.id} className="agent-item">
                            <div className="agent-avatar">
                              {agent.first_name?.[0]}{agent.last_name?.[0]}
                            </div>
                            <div className="agent-info">
                              <p className="agent-name">{agent.first_name} {agent.last_name}</p>
                              <p className="agent-role">{agent.email}</p>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                              {agent.role === 'lead' && (
                                <Badge style={{ backgroundColor: 'var(--v3-orange)', color: 'white', border: 'none', fontSize: '0.7rem' }}>
                                  Lead
                                </Badge>
                              )}
                              <Badge
                                style={{
                                  backgroundColor: agent.status === 'accepted'
                                    ? '#10b981'
                                    : agent.status === 'pending'
                                      ? 'var(--v3-orange)'
                                      : '#6b7280',
                                  color: 'white',
                                  border: 'none',
                                  fontSize: '0.7rem'
                                }}
                              >
                                {agent.status?.toUpperCase() || 'UNKNOWN'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="agent-list-empty">
                        <Users className="h-12 w-12" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p>No agents assigned yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Invoices - Right Column Bottom */}
                <div className="job-modal__invoices">
                  <div className="job-modal__card">
                    <h3 className="job-modal__card-title">
                      <Receipt />
                      Invoices
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--v3-text-muted)' }}>
                        {jobInvoices.length} submitted
                      </span>
                    </h3>
                    {loadingDetails ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--v3-orange)' }} />
                      </div>
                    ) : jobInvoices.length > 0 ? (
                      <div className="invoice-list">
                        {jobInvoices.map((invoice) => (
                          <div key={invoice.id} className="invoice-item">
                            <div className="invoice-header">
                              <span className="invoice-number">{invoice.invoice_number}</span>
                              <Badge
                                className={`invoice-status ${invoice.status === 'paid' ? 'paid' : 'unpaid'}`}
                              >
                                {invoice.status?.toUpperCase()}
                              </Badge>
                            </div>
                            <div className="invoice-details">
                              <div>
                                <strong>Agent</strong>
                                <span>{invoice.agent_name || 'Unknown Agent'}</span>
                              </div>
                              <div>
                                <strong>Issued</strong>
                                <span>{invoice.issue_date ? new Date(invoice.issue_date).toLocaleDateString() : 'Not issued'}</span>
                              </div>
                              <div>
                                <strong>Due Date</strong>
                                <span>{invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Not set'}</span>
                              </div>
                              <div className="invoice-amount">
                                &pound;{invoice.total_amount || '0.00'}
                              </div>
                            </div>
                            {invoice.status === 'sent' && (
                              <div className="invoice-actions">
                                <Button
                                  size="sm"
                                  className="button-refresh text-xs"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toast.info('Mark as paid functionality coming soon')
                                  }}
                                >
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Mark as Paid
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="invoice-list-empty">
                        <Receipt className="h-12 w-12" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p>No invoices submitted yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* V3 Reports - Right Column */}
                <div className="job-modal__reports">
                  <div className="job-modal__card">
                    <h3 className="job-modal__card-title">
                      <FileText />
                      V3 Job Reports
                      <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontWeight: 'normal', color: 'var(--v3-text-muted)' }}>
                        {jobV3Reports.length} submitted
                      </span>
                    </h3>
                    {loadingDetails ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 0' }}>
                        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--v3-orange)' }} />
                      </div>
                    ) : jobV3Reports.length > 0 ? (
                      <div className="report-list">
                        {jobV3Reports.map((report) => {
                          const formTypeNames = {
                            'traveller_eviction': 'Traveller Eviction Report',
                            'traveller_serve': 'Traveller Serve Report',
                            'squatter_serve': 'Squatter Serve Report',
                          };
                          const reportName = formTypeNames[report.form_type] || report.form_type.replace('_', ' ');

                          return (
                            <div key={report.id} className="report-item" onClick={() => {
                              setSelectedReport(report);
                              setShowReportViewer(true);
                            }}>
                              <div className="report-header">
                                <span className="report-type">{reportName}</span>
                                <span className="report-status">{report.status}</span>
                              </div>
                              <div className="report-details">
                                <div>
                                  <strong>Agent</strong>
                                  <span>{report.agent_name || 'Unknown Agent'}</span>
                                </div>
                                <div>
                                  <strong>Submitted</strong>
                                  <span>{report.submitted_at ? new Date(report.submitted_at).toLocaleString() : 'Not set'}</span>
                                </div>
                                <div>
                                  <strong>Report ID</strong>
                                  <span>#{report.id}</span>
                                </div>
                                {report.reviewed_at && (
                                  <div>
                                    <strong>Reviewed</strong>
                                    <span>{new Date(report.reviewed_at).toLocaleString()}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="report-list-empty">
                        <FileText className="h-12 w-12" style={{ marginBottom: '0.5rem', opacity: 0.5 }} />
                        <p>No V3 reports submitted yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes/Activity - Full Width Bottom */}
                <div className="job-modal__notes">
                  <div className="job-modal__card">
                    <h3 className="job-modal__card-title">
                      <FileText />
                      Notes & Activity
                    </h3>
                    <div className="job-modal__notes-content">
                      {selectedJob.notes || selectedJob.activity ? (
                        <p>{selectedJob.notes || selectedJob.activity}</p>
                      ) : (
                        <p className="job-modal__notes-empty">No notes or activity recorded for this job.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compact Footer */}
            <div className="job-modal__footer">
              <button
                className="job-modal__footer-btn"
                onClick={() => setShowJobDetailsModal(false)}
              >
                Close
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Report Viewer Modal */}
      <ReportViewer
        report={selectedReport}
        isOpen={showReportViewer}
        onClose={() => {
          setShowReportViewer(false);
          setSelectedReport(null);
        }}
      />

      <LocationPicker
        isOpen={mapOpen}
        onConfirm={handleMapConfirm}
        onCancel={handleMapCancel}
        address={newJob.address}
        postcode={newJob.postcode}
      />
    </div>
  )
}
