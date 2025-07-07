import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from '../useAuth.jsx';
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
  Briefcase
} from 'lucide-react';

export default function JobManagement() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const { apiCall } = useAuth()
  

  const [newJob, setNewJob] = useState({
    title: '',
    job_type: '',
    address: '',
    postcode: '',
    arrival_time: '',
    agents_required: 1,
    lead_agent_name: '',
    instructions: '',
    urgency_level: 'Standard'
  })

  useEffect(() => {
    fetchJobs()
  }, [])

  // Fix dialog transparency issue
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

    // Run immediately
    fixDialogStyling();
    
    // Also run when DOM changes
    const observer = new MutationObserver(fixDialogStyling);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, [showCreateDialog]);

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

  const handleCreateJob = async (e) => {
    e.preventDefault()
    setCreateLoading(true)

    try {
      await apiCall('/jobs', {
        method: 'POST',
        body: JSON.stringify(newJob)
      })

      toast.success("Job Created", {
  description: "New job has been created and notifications sent to available agents.",
})

      setShowCreateDialog(false)
      setNewJob({
        title: '',
        job_type: '',
        address: '',
        postcode: '',
        arrival_time: '',
        agents_required: 1,
        lead_agent_name: '',
        instructions: '',
        urgency_level: 'Standard'
      })
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

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.job_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         job.address.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    
    return matchesSearch && matchesStatus
  })

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
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
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
                    <Label htmlFor="title">Job Title</Label>
                    <Input
                      id="title"
                      value={newJob.title}
                      onChange={(e) => setNewJob({...newJob, title: e.target.value})}
                      placeholder="e.g., Security Guard - Shopping Center"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job_type">Job Type</Label>
                    <Input
                      id="job_type"
                      value={newJob.job_type}
                      onChange={(e) => setNewJob({...newJob, job_type: e.target.value})}
                      placeholder="e.g., Security, Event Staff"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={newJob.address}
                      onChange={(e) => setNewJob({...newJob, address: e.target.value})}
                      placeholder="Full address including postcode"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="postcode">Postcode</Label>
                    <Input
                      id="postcode"
                      value={newJob.postcode}
                      onChange={(e) => setNewJob({...newJob, postcode: e.target.value})}
                      placeholder="e.g., SW1A 1AA"
                    />
                  </div>
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
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createLoading}>
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
      <div className="grid gap-4">
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
          filteredJobs.map((job) => (
            <Card key={job.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      {job.title}
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

                  {job.assignments && job.assignments.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Agent Responses</p>
                      <div className="flex flex-wrap gap-2">
                        {job.assignments.map((assignment) => (
                          <Badge 
                            key={assignment.id} 
                            variant={assignment.status === 'accepted' ? 'default' : 
                                   assignment.status === 'declined' ? 'destructive' : 'secondary'}
                          >
                            {assignment.agent?.first_name} {assignment.agent?.last_name} - {assignment.status}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {job.status === 'open' && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleUpdateJobStatus(job.id, 'cancelled')}
                      >
                        Cancel Job
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => handleUpdateJobStatus(job.id, 'filled')}
                      >
                        Mark as Filled
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}