import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '../useAuth.jsx';
import { toast } from "sonner"; // MODIFIED: Import from sonner
import {
  Briefcase,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Calendar,
  Users,
  Navigation,
  CloudRain
} from 'lucide-react'

export default function JobsPage() {
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [respondingTo, setRespondingTo] = useState(null)
  const { user, apiCall } = useAuth()
  // REMOVED: const { toast } = useToast()

  useEffect(() => {
    fetchAssignments()
  }, [])

  const fetchAssignments = async () => {
    try {
      setLoading(true)
      const data = await apiCall(`/assignments/agent/${user.id}`)
      setAssignments(data.assignments || [])
    } catch (error) {
      console.error('Assignments error:', error)
    } finally {
      setLoading(false)
    }
  }

  const respondToJob = async (assignmentId, response) => {
    try {
      setRespondingTo(assignmentId)

      await apiCall(`/assignments/${assignmentId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response })
      })

      // MODIFIED: Replaced toast call with sonner
      if (response === 'accept') {
        toast.success("Job Accepted", {
          description: "You have accepted this job assignment. Check your email for details.",
        })
      } else {
        toast.info("Job Declined", {
          description: "You have declined this job assignment.",
        })
      }

      fetchAssignments()
    } catch (error) {
      // MODIFIED: Replaced toast call with sonner
      toast.error("Error", {
        description: error.message || "Failed to respond to job",
      })
    } finally {
      setRespondingTo(null)
    }
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { variant: 'secondary', icon: Clock, label: 'Pending Response', className: 'bg-yellow-500 text-white' },
      accepted: { variant: 'default', icon: CheckCircle, label: 'Accepted', className: 'bg-green-500' },
      declined: { variant: 'destructive', icon: XCircle, label: 'Declined' }
    }

    const config = statusConfig[status] || statusConfig.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className || ''}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const getUrgencyBadge = (urgency) => {
    const urgencyConfig = {
      'Low': { variant: 'outline', className: 'border-green-200 text-green-700' },
      'Standard': { variant: 'secondary', className: '' },
      'URGENT': { variant: 'destructive', className: 'bg-red-500 text-white animate-pulse' }
    }

    const config = urgencyConfig[urgency] || urgencyConfig.Standard

    return (
      <Badge variant={config.variant} className={config.className}>
        {urgency === 'URGENT' && <AlertTriangle className="h-3 w-3 mr-1" />}
        {urgency}
      </Badge>
    )
  }

  const formatDateTime = (dateString) => {
    const date = new Date(dateString)
    return {
      date: date.toLocaleDateString('en-GB', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }),
      time: date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const isJobToday = (dateString) => {
    const jobDate = new Date(dateString).toDateString()
    const today = new Date().toDateString()
    return jobDate === today
  }

  const isJobSoon = (dateString) => {
    const jobTime = new Date(dateString).getTime()
    const now = new Date().getTime()
    const twoHours = 2 * 60 * 60 * 1000
    return jobTime - now <= twoHours && jobTime > now
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-v3-bg-card animate-pulse rounded"></div>
          <div className="h-4 w-48 bg-v3-bg-card animate-pulse rounded"></div>
        </div>
        <div className="grid gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="dashboard-card h-48 animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  const pendingJobs = assignments.filter(a => a.status === 'pending')
  const respondedJobs = assignments.filter(a => a.status !== 'pending')

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-v3-text-lightest">Job Assignments</h1>
        <p className="text-muted-foreground">
          View and respond to your job assignments
        </p>
      </div>

      {/* Pending Jobs */}
      {pendingJobs.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-v3-text-lightest">Pending Response</h2>
            <Badge variant="secondary">{pendingJobs.length}</Badge>
          </div>

          {pendingJobs.map((assignment) => {
            const job = assignment.job
            const dateTime = formatDateTime(job.arrival_time)
            const isSoon = isJobSoon(job.arrival_time)
            const isToday = isJobToday(job.arrival_time)

            return (
              <Card key={assignment.id} className={`dashboard-card ${isSoon ? 'border-orange-200' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg text-v3-text-lightest">
                        {job.address}
                        {getUrgencyBadge(job.urgency_level)}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-4 text-v3-text-muted">
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-4 w-4" />
                          {job.job_type}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {dateTime.date} at {dateTime.time}
                          {isToday && <span className="text-primary font-medium">(Today)</span>}
                        </span>
                      </CardDescription>
                    </div>
                    {getStatusBadge(assignment.status)}
                  </div>
                  {isSoon && (
                    <div className="flex items-center gap-2 text-orange-600 text-sm mt-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Job starts in less than 2 hours!</span>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 mt-0.5 text-v3-text-muted" />
                        <div>
                          <p className="text-sm font-medium text-v3-text-light">Location</p>
                          <p className="text-sm text-v3-text-muted">{job.address}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-v3-text-muted" />
                        <div>
                          <p className="text-sm font-medium text-v3-text-light">Team Size</p>
                          <p className="text-sm text-v3-text-muted">
                            {job.agents_required} agent{job.agents_required > 1 ? 's' : ''} required
                          </p>
                        </div>
                      </div>
                    </div>

                    {job.lead_agent_name && (
                      <div>
                        <p className="text-sm font-medium text-v3-text-light">Lead Agent</p>
                        <p className="text-sm text-v3-text-muted">{job.lead_agent_name}</p>
                      </div>
                    )}

                    {job.instructions && (
                      <div>
                        <p className="text-sm font-medium text-v3-text-light">Instructions</p>
                        <p className="text-sm text-v3-text-muted">{job.instructions}</p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-4 border-t border-v3-border">
                      <Button
                        variant="destructive"
                        className="flex-1"
                        onClick={() => respondToJob(assignment.id, 'decline')}
                        disabled={respondingTo === assignment.id}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Decline
                      </Button>
                      <Button
                        className="flex-1 button-refresh bg-green-600 hover:bg-green-700"
                        onClick={() => respondToJob(assignment.id, 'accept')}
                        disabled={respondingTo === assignment.id}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Accept
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Recent Jobs */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-v3-text-lightest">Recent Jobs</h2>
          <Badge variant="outline">{respondedJobs.length}</Badge>
        </div>

        {respondedJobs.length === 0 && pendingJobs.length === 0 ? (
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Briefcase className="mx-auto h-12 w-12 text-v3-text-muted mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-v3-text-light">No job assignments yet</h3>
                <p className="text-v3-text-muted">
                  Job assignments will appear here when you're selected for jobs.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : respondedJobs.length === 0 ? (
          <Card className="dashboard-card">
            <CardContent className="pt-6">
              <div className="text-center py-6">
                <Clock className="mx-auto h-8 w-8 text-v3-text-muted mb-3" />
                <p className="text-sm text-v3-text-muted">
                  No recent job history
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          respondedJobs.slice(0, 10).map((assignment) => {
            const job = assignment.job
            const dateTime = formatDateTime(job.arrival_time)

            return (
              <Card key={assignment.id} className="dashboard-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-base text-v3-text-lightest">{job.address}</CardTitle>
                      <CardDescription className="flex items-center gap-4 text-v3-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {dateTime.date} at {dateTime.time}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.job_type}
                        </span>
                      </CardDescription>
                    </div>
                    {getStatusBadge(assignment.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-v3-text-muted">
                      {job.address}
                    </p>
                    <p className="text-xs text-v3-text-muted">
                      Responded: {new Date(assignment.responded_at || assignment.created_at).toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}