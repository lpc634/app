import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '../useAuth.jsx';
import { Link } from 'react-router-dom';
import { 
  PlusCircle, 
  Briefcase, 
  Users, 
  Clock,
  RefreshCw,
  ServerCrash
} from 'lucide-react';

export default function Dashboard() {
  const [liveJobs, setLiveJobs] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { apiCall } = useAuth();

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      
      const jobsPromise = apiCall('/jobs?status=open');
      
      const today = new Date().toISOString().split('T')[0];
      const agentsPromise = apiCall(`/agents/available?date=${today}`);

      const [jobsResponse, agentsResponse] = await Promise.all([jobsPromise, agentsPromise]);
      
      setLiveJobs(jobsResponse.jobs || []);
      setAvailableAgents(agentsResponse.available_agents || []);

    } catch (error) {
      setError('Failed to load dashboard data. Please try again.');
      console.error('Dashboard error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);
  
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

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Live Jobs
              </CardTitle>
              <CardDescription>Jobs that are currently open or have been assigned.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {liveJobs.length > 0 ? liveJobs.map(job => (
                  <div key={job.id} className="p-4 rounded-lg bg-v3-bg-dark flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-v3-text-lightest">{job.title}</p>
                      <p className="text-sm text-v3-text-muted">{job.address}</p>
                    </div>
                    {/* --- THIS IS THE UPDATED SECTION --- */}
                    <div className="text-right">
                       <div className={`text-lg font-bold ${job.agents_allocated >= job.agents_required ? 'text-green-400' : 'text-v3-orange'}`}>
                         {job.agents_allocated} / {job.agents_required}
                       </div>
                       <p className="text-xs text-v3-text-muted">Allocated</p>
                    </div>
                    {/* --- END UPDATED SECTION --- */}
                  </div>
                )) : (
                  <div className="text-center py-10">
                    <p className="text-v3-text-muted">No active jobs at the moment.</p>
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
        </div>
      </div>
    </div>
  );
}