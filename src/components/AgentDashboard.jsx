import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Briefcase, Calendar, ClipboardList, LogOut, Loader2, Power,
    PowerOff, RefreshCw, MapPin, Clock, CheckCircle, ServerCrash
} from 'lucide-react';

const JobListItem = ({ job, children }) => (
    <div className="bg-v3-bg-dark p-4 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
            <p className="font-semibold text-v3-text-lightest">{job.title}</p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-v3-text-muted mt-1">
                <span className="flex items-center gap-1.5"><MapPin size={14} />{job.address}</span>
                <span className="flex items-center gap-1.5"><Clock size={14} />{new Date(job.arrival_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
        <div className="w-full sm:w-auto flex-shrink-0">{children}</div>
    </div>
);

export default function AgentDashboard() {
  const { apiCall, logout, user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isToggling, setIsToggling] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const dashboardRes = await apiCall('/agent/dashboard');
      setDashboardData(dashboardRes);
    } catch (err) {
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [apiCall, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleAvailability = async () => {
      setIsToggling(true);
      const newStatus = dashboardData.today_status === 'available' ? 'unavailable' : 'available';
      try {
          await apiCall('/agent/availability/today', {
              method: 'POST',
              body: JSON.stringify({ status: newStatus })
          });
          setDashboardData(prev => ({...prev, today_status: newStatus}));
          toast.success(`Status updated to ${newStatus}`);
      } catch (err) {
          console.error("Failed to toggle availability", err);
          toast.error("Could not update availability status.");
      } finally {
          setIsToggling(false);
      }
  };

  const handleAcceptJob = async (jobId) => {
      // Logic for accepting a job
  };

  if (loading || !dashboardData) {
    return <div className="p-8 text-center text-v3-text-muted"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>;
  }

  if (error) {
     return (
        <div className="p-8 text-center text-red-500">
            <ServerCrash className="h-12 w-12 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Connection Error</h2>
            <p className="mb-4">{error}</p>
            <button onClick={fetchData} className="button-refresh flex items-center gap-2 mx-auto">
                <RefreshCw size={16} /> Try Again
            </button>
        </div>
     );
  }

  // --- MODIFIED: Added styles for the red glow ---
  const neonGlowStyles = `
    .dot-glow-green {
        background-color: #39FF14;
        box-shadow: 0 0 8px #39FF14;
    }
    .text-glow-green {
        text-shadow: 0 0 8px #39FF14;
    }
    .dot-glow-red {
        background-color: #ef4444; /* Corresponds to Tailwind's red-500 */
        box-shadow: 0 0 8px #ef4444;
    }
    .text-glow-red {
        text-shadow: 0 0 8px #ef4444;
    }
  `;

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6 bg-v3-bg-darkest min-h-screen text-v3-text-light">
      <style>{neonGlowStyles}</style>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest">Action Center</h1>
          <p className="text-v3-text-muted">Welcome back, {dashboardData?.agent_name}.</p>
        </div>
         <button onClick={logout} className="button-refresh bg-red-600 hover:bg-red-700 flex items-center gap-2">
            <LogOut size={16} /> Sign Out
        </button>
      </div>
      <div className="dashboard-card p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
                {/* --- MODIFIED: Added the new red glow class for the dot --- */}
                <div className={`w-3 h-3 rounded-full ${dashboardData.today_status === 'available' ? 'dot-glow-green' : 'dot-glow-red'}`}></div>
                <p className="font-bold text-lg text-v3-text-lightest">
                    You are currently <span className={`${dashboardData.today_status === 'available' ? 'text-green-400 text-glow-green' : 'text-red-400 text-glow-red'}`}>{dashboardData.today_status}</span> for jobs today.
                </p>
            </div>
            <Button onClick={handleToggleAvailability} disabled={isToggling} className="button-refresh w-full sm:w-auto">
                {isToggling ? <Loader2 className="animate-spin" /> : (dashboardData.today_status === 'available' ? <PowerOff className="mr-2" /> : <Power className="mr-2" />)}
                {isToggling ? 'Updating...' : (dashboardData.today_status === 'available' ? 'Go Offline' : 'Go Online')}
            </Button>
      </div>
      <div className="space-y-6">
        <div className="dashboard-card">
            <div className="p-4"><h2 className="text-lg font-semibold flex items-center gap-2"><Briefcase /> Available Jobs</h2></div>
            <div className="px-4 pb-4 space-y-3">
                {dashboardData.available_jobs && dashboardData.available_jobs.length > 0 ? dashboardData.available_jobs.map(job => (
                    <JobListItem key={job.id} job={job}>
                        <button onClick={() => handleAcceptJob(job.id)} className="button-refresh bg-green-600 hover:bg-green-700 w-full sm:w-auto flex items-center gap-2">
                            <CheckCircle size={16} /> Accept
                        </button>
                    </JobListItem>
                )) : <p className="text-v3-text-muted text-center py-4">No new jobs are available for you at this time.</p>}
            </div>
        </div>
        {dashboardData.upcoming_shifts && dashboardData.upcoming_shifts.length > 0 && (
             <div className="dashboard-card">
                <div className="p-4"><h2 className="text-lg font-semibold flex items-center gap-2"><Calendar /> My Upcoming Shifts</h2></div>
                <div className="px-4 pb-4 space-y-3">
                     {dashboardData.upcoming_shifts.map(job => (
                        <Link to={`/agent/jobs/${job.id}`} key={job.id} className="block bg-v3-bg-dark p-3 rounded-lg hover:bg-v3-bg-card transition-colors cursor-pointer">
                            <p className="font-semibold text-v3-text-lightest">{job.title}</p>
                            <p className="text-sm text-v3-text-muted">
                                {new Date(job.arrival_time).toLocaleDateString('en-GB', { dateStyle: 'full' })} at {new Date(job.arrival_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                        </Link>
                     ))}
                </div>
            </div>
        )}
      </div>
    </main>
  );
}