import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '../useAuth.jsx';
import { useToast } from '../use-toast.js';
import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  Briefcase, 
  Users, 
  Clock,
  RefreshCw,
  ServerCrash,
  FileText,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Trash2
} from 'lucide-react';
import { Switch } from '@/components/ui/switch.jsx';
import { useEffect } from 'react';
import { usePageHeader } from '@/components/layout/PageHeaderContext.jsx';

export default function Dashboard() {
  const { register } = usePageHeader();
  const [liveJobs, setLiveJobs] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [pendingDocuments, setPendingDocuments] = useState([]);
  const [documentStats, setDocumentStats] = useState({ pending: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [jobFilter, setJobFilter] = useState('open');
  const [actionLoading, setActionLoading] = useState({});
  const { apiCall, user } = useAuth();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [savingToggle, setSavingToggle] = useState(false);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const jobsPromise = apiCall('/jobs');
      
      const today = new Date().toISOString().split('T')[0];
      const agentsPromise = apiCall(`/agents/available?date=${today}`);

      // Only fetch document data for admin users
      const promises = [jobsPromise, agentsPromise];
      if (user?.role === 'admin') {
        promises.push(apiCall('/admin/documents/pending'));
        promises.push(apiCall('/admin/agents/documents'));
        // Also fetch notifications setting
        promises.push(apiCall('/admin/settings/notifications'));
      }

      const responses = await Promise.all(promises);
      
      setLiveJobs(responses[0].jobs || []);
      setAvailableAgents(responses[1].available_agents || []);

      // Handle document data for admin users
      if (user?.role === 'admin' && responses.length > 2) {
        setPendingDocuments(responses[2].pending_documents || []);
        const agentsData = responses[3].agents || [];
        const stats = agentsData.reduce((acc, agent) => {
          acc.total++;
          if (agent.verification_status === 'pending') acc.pending++;
          return acc;
        }, { pending: 0, total: 0 });
        setDocumentStats(stats);
        const notif = responses[4];
        if (typeof notif?.enabled !== 'undefined') setNotificationsEnabled(Boolean(notif.enabled));
      }

    } catch (error) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  const markJobComplete = async (jobId) => {
    try {
      setActionLoading(prev => ({ ...prev, [`complete_${jobId}`]: true }));
      
      const response = await apiCall(`/jobs/${jobId}/complete`, {
        method: 'POST'
      });
      
      if (response && response.success) {
        toast({
          title: "Success",
          description: response.message || "Job marked as complete",
          variant: "default"
        });
        
        // Update the job in the current state instead of refetching all data
        setLiveJobs(prevJobs => 
          prevJobs.map(job => 
            job.id === jobId 
              ? { ...job, status: 'completed' }
              : job
          )
        );
      }
    } catch (error) {
      console.error('Error completing job:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to mark job as complete",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`complete_${jobId}`]: false }));
    }
  };

  const deleteJob = async (jobId) => {
    if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }
    
    try {
      setActionLoading(prev => ({ ...prev, [`delete_${jobId}`]: true }));
      
      const response = await apiCall(`/jobs/${jobId}`, {
        method: 'DELETE'
      });
      
      if (response && response.success) {
        toast({
          title: "Success",
          description: response.message || "Job deleted successfully",
          variant: "default"
        });
        
        // Remove the job from the current state instead of refetching all data
        setLiveJobs(prevJobs => prevJobs.filter(job => job.id !== jobId));
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive"
      });
    } finally {
      setActionLoading(prev => ({ ...prev, [`delete_${jobId}`]: false }));
    }
  };

  // Filter jobs based on selected filter
  const filteredJobs = liveJobs.filter(job => {
    switch (jobFilter) {
      case 'open':
        return job.status !== 'completed';
      case 'completed':
        return job.status === 'completed';
      case 'all':
      default:
        return true;
    }
  });

  useEffect(() => {
    fetchData();
  }, []);
  useEffect(() => {
    register({
      title: 'Dashboard',
      action: (
        <Link to="/admin/jobs" className="hidden md:inline-flex">
          <Button className="button-refresh flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Create Job
          </Button>
        </Link>
      )
    });
  }, [register]);
  
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-10 w-48 bg-v3-bg-card rounded-md"></div>
        <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 h-72 bg-v3-bg-card rounded-lg"></div>
            <div className="h-72 bg-v3-bg-card rounded-lg"></div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="dashboard-card text-center p-8">
         <ServerCrash className="mx-auto h-16 w-16 text-v3-orange mb-4" />
         <h2 className="text-xl font-bold mb-2">Connection Error</h2>
         <p className="text-v3-text-muted mb-6">{error}</p>
         <Button onClick={fetchData} className="button-refresh">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
         </Button>
      </div>
    );
  }

  const toggleNotifications = async (nextVal) => {
    const desired = typeof nextVal === 'boolean' ? nextVal : !notificationsEnabled;
    try {
      setSavingToggle(true);
      setNotificationsEnabled(desired);
      await apiCall('/admin/settings/notifications', {
        method: 'PUT',
        body: JSON.stringify({ enabled: Boolean(desired) })
      });
      toast({ title: desired ? 'Notifications enabled' : 'Notifications disabled' });
    } catch (e) {
      setNotificationsEnabled(!desired);
      toast({ title: 'Failed to update notifications', variant: 'destructive' });
    } finally {
      setSavingToggle(false);
    }
  };

  return (
    <div className="space-y-6">
      {user?.role === 'admin' && (
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>When off, the system will not send Telegram or other notifications. Safe for testing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Enable notifications</p>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={notificationsEnabled}
                  onCheckedChange={(val) => toggleNotifications(val)}
                  disabled={savingToggle}
                />
                <Button variant="outline" onClick={() => toggleNotifications()} disabled={savingToggle}>
                  {notificationsEnabled ? 'Disable' : 'Enable'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Dispatch Center</h1>
            <p className="text-muted-foreground">Live overview of jobs and agent availability.</p>
        </div>
        <Link to="/jobs">
          <Button className="button-refresh flex items-center gap-2">
            <PlusCircle className="h-5 w-5" />
            Create New Job
          </Button>
        </Link>
      </div>

      {/* Document Review Section - Only for Admin Users */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending Reviews</p>
                  <p className="text-2xl font-bold text-yellow-600">{documentStats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Agents</p>
                  <p className="text-2xl font-bold text-blue-600">{documentStats.total}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Documents</p>
                  <p className="text-2xl font-bold text-purple-600">{pendingDocuments.reduce((acc, agent) => acc + agent.document_count, 0)}</p>
                </div>
                <FileText className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Link to="/admin/documents" className="block">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Review Center</p>
                    <p className="text-sm text-blue-600 hover:text-blue-800">View All →</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={user?.role === 'admin' ? "lg:col-span-2" : "lg:col-span-2"}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Live Jobs
              </CardTitle>
              <CardDescription>Jobs that are currently open or have been assigned.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Job Filter Tabs */}
              {user?.role === 'admin' && (
                <div className="flex gap-4 mb-6">
                  <button 
                    onClick={() => setJobFilter('open')}
                    className={`px-4 py-2 rounded-lg ${jobFilter === 'open' ? 'button-refresh' : 'bg-v3-bg-dark text-v3-text-muted'}`}
                  >
                    Open Jobs
                  </button>
                  
                  <button 
                    onClick={() => setJobFilter('completed')}
                    className={`px-4 py-2 rounded-lg ${jobFilter === 'completed' ? 'button-refresh' : 'bg-v3-bg-dark text-v3-text-muted'}`}
                  >
                    Completed Jobs
                  </button>
                  
                  <button 
                    onClick={() => setJobFilter('all')}
                    className={`px-4 py-2 rounded-lg ${jobFilter === 'all' ? 'button-refresh' : 'bg-v3-bg-dark text-v3-text-muted'}`}
                  >
                    All Jobs
                  </button>
                </div>
              )}
              
              <div className="space-y-4">
                {filteredJobs.length > 0 ? filteredJobs.map(job => (
                  <div key={job.id} className={`p-4 rounded-lg bg-v3-bg-dark ${job.status === 'completed' ? 'opacity-75' : ''}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-v3-text-lightest">{job.address}</h3>
                          {job.status === 'completed' && (
                            <span className="px-2 py-1 bg-green-900/50 text-green-400 border border-green-500/50 rounded-full text-xs">
                              Completed
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-v3-text-muted">{job.address}</p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <div className={`text-lg font-bold ${job.agents_allocated >= job.agents_required ? 'text-green-400' : 'text-v3-orange'}`}>
                            {job.agents_allocated} / {job.agents_required}
                          </div>
                          <p className="text-xs text-v3-text-muted">Allocated</p>
                        </div>
                        
                        {/* Action Buttons - Admin Only */}
                        {user?.role === 'admin' && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => markJobComplete(job.id)}
                              className="button-refresh px-3 py-1 text-sm flex items-center gap-1"
                              disabled={job.status === 'completed' || actionLoading[`complete_${job.id}`]}
                            >
                              {actionLoading[`complete_${job.id}`] ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                              {actionLoading[`complete_${job.id}`] ? 'Completing...' : 'Complete'}
                            </button>
                            
                            <button
                              onClick={() => deleteJob(job.id)}
                              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={actionLoading[`delete_${job.id}`]}
                            >
                              {actionLoading[`delete_${job.id}`] ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              {actionLoading[`delete_${job.id}`] ? 'Deleting...' : 'Delete'}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <p className="text-v3-text-muted">
                      {jobFilter === 'completed' 
                        ? 'No completed jobs found.' 
                        : jobFilter === 'open' 
                        ? 'No open jobs at the moment.' 
                        : 'No jobs found.'}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Available Agents Today
              </CardTitle>
               <CardDescription>Agents marked as available for today.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {availableAgents.length > 0 ? availableAgents.map(agent => (
                        <div key={agent.id} className="flex items-center gap-3">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-v3-text-light">
                                {agent.first_name} {agent.last_name}
                            </span>
                        </div>
                    )) : (
                        <div className="text-center py-10">
                            <p className="text-v3-text-muted">No agents are available today.</p>
                        </div>
                    )}
                </div>
            </CardContent>
          </Card>
          
          {/* Recent Document Reviews - Only for Admin */}
          {user?.role === 'admin' && pendingDocuments.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Submissions
                </CardTitle>
                <CardDescription>Latest agent document uploads</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingDocuments.slice(0, 5).map((agent) => (
                    <div key={agent.agent_id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-sm font-medium">{agent.agent_name}</span>
                      </div>
                      <Badge 
                        variant="outline" 
                        className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200"
                      >
                        {agent.document_count} docs
                      </Badge>
                    </div>
                  ))}
                  {pendingDocuments.length > 5 && (
                    <Link 
                      to="/admin/documents" 
                      className="text-sm text-blue-600 hover:text-blue-800 block text-center pt-2"
                    >
                      View {pendingDocuments.length - 5} more →
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}