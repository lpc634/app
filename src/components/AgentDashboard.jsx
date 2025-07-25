import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
    Briefcase, Calendar, ClipboardList, LogOut, Loader2, Power,
    PowerOff, RefreshCw, MapPin, Clock, CheckCircle, XCircle, ServerCrash
} from 'lucide-react';

const JobListItem = ({ job, children }) => (
    <div className="agent-job-card">
        <div className="agent-job-card-header">
            <h3 className="agent-job-card-title">{job.title}</h3>
            <div className="agent-job-card-meta">
                <div className="agent-job-card-meta-item">
                    <MapPin className="agent-job-card-meta-icon" />
                    <span>{job.address}</span>
                </div>
                <div className="agent-job-card-meta-item">
                    <Clock className="agent-job-card-meta-icon" />
                    <span>{new Date(job.arrival_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        </div>
        <div className="agent-job-card-actions">{children}</div>
    </div>
);

export default function AgentDashboard() {
  const { apiCall, logout, user } = useAuth();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isToggling, setIsToggling] = useState(false);
  const [respondingJobs, setRespondingJobs] = useState(new Set()); // Track which jobs are being responded to

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

  // Updated job response handler
  const handleJobResponse = async (job, response) => {
    const jobId = job.id;
    const assignmentId = job.assignment_id;
    
    if (!assignmentId) {
      toast.error('Error: Assignment ID not found');
      return;
    }

    // Add this job to the "responding" set to show loading state
    setRespondingJobs(prev => new Set(prev).add(jobId));

    try {
      await apiCall(`/assignments/${assignmentId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ response })
      });

      toast.success(`Job successfully ${response}d!`);
      
      // Refresh dashboard data to update the UI
      await fetchData();
      
    } catch (err) {
      console.error('Job response error:', err);
      toast.error(`Failed to ${response} job`, { description: err.message });
    } finally {
      // Remove job from responding set
      setRespondingJobs(prev => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    }
  };

  if (loading || !dashboardData) {
    return (
      <div className="agent-mobile-content">
        <div className="agent-mobile-loading">
          <Loader2 className="agent-mobile-loading-spinner" size={32} />
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
     return (
       <div className="agent-mobile-content">
         <div className="agent-mobile-error">
           <ServerCrash className="agent-mobile-error-icon" size={48} />
           <h2 className="agent-mobile-error-title">Connection Error</h2>
           <p className="agent-mobile-error-message">{error}</p>
           <button 
             onClick={fetchData} 
             className="agent-mobile-button agent-mobile-button-primary"
           >
             <RefreshCw size={16} /> 
             Try Again
           </button>
         </div>
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
    <div className="agent-mobile-content">
      <style>{neonGlowStyles}</style>
      
      {/* Header Section */}
      <div className="agent-mobile-section">
        <h1 className="agent-mobile-section-title">
          <Briefcase size={24} />
          Action Center
        </h1>
        <p className="agent-mobile-section-subtitle">
          Welcome back, {dashboardData?.agent_name}. Stay connected with your job assignments.
        </p>
      </div>
      {/* Status Section */}
      <div className="agent-status-indicator">
        <div className={`agent-status-dot ${dashboardData.today_status === 'available' ? 'available' : 'unavailable'}`}></div>
        <div className="agent-status-text">
          You are currently <span className={`${dashboardData.today_status === 'available' ? 'text-green-400 text-glow-green' : 'text-red-400 text-glow-red'}`}>{dashboardData.today_status}</span> for jobs today.
        </div>
        <button 
          onClick={handleToggleAvailability} 
          disabled={isToggling} 
          className={`agent-mobile-button agent-status-toggle ${
            dashboardData.today_status === 'available' 
              ? 'agent-mobile-button-danger' 
              : 'agent-mobile-button-success'
          } ${isToggling ? 'agent-mobile-button-disabled' : ''}`}
        >
          {isToggling ? (
            <Loader2 className="agent-mobile-loading-spinner" size={16} />
          ) : (
            dashboardData.today_status === 'available' ? <PowerOff size={16} /> : <Power size={16} />
          )}
          {isToggling ? 'Updating...' : (dashboardData.today_status === 'available' ? 'Go Offline' : 'Go Online')}
        </button>
      </div>
      {/* Available Jobs Section */}
      <div className="agent-mobile-section">
        <h2 className="agent-mobile-section-title">
          <Briefcase size={20} />
          Available Jobs
        </h2>
        
        {dashboardData.available_jobs && dashboardData.available_jobs.length > 0 ? (
          <div className="space-y-4">
            {dashboardData.available_jobs.map(job => (
              <JobListItem key={job.id} job={job}>
                <div className="agent-job-actions">
                  <button 
                    onClick={() => handleJobResponse(job, 'accepted')} 
                    disabled={respondingJobs.has(job.id)}
                    className={`agent-mobile-button agent-mobile-button-success ${
                      respondingJobs.has(job.id) ? 'agent-mobile-button-disabled' : ''
                    }`}
                  >
                    {respondingJobs.has(job.id) ? (
                      <Loader2 className="agent-mobile-loading-spinner" size={16} />
                    ) : (
                      <CheckCircle size={16} />
                    )}
                    Accept
                  </button>
                  <button 
                    onClick={() => handleJobResponse(job, 'declined')} 
                    disabled={respondingJobs.has(job.id)}
                    className={`agent-mobile-button agent-mobile-button-danger ${
                      respondingJobs.has(job.id) ? 'agent-mobile-button-disabled' : ''
                    }`}
                  >
                    {respondingJobs.has(job.id) ? (
                      <Loader2 className="agent-mobile-loading-spinner" size={16} />
                    ) : (
                      <XCircle size={16} />
                    )}
                    Decline
                  </button>
                </div>
              </JobListItem>
            ))}
          </div>
        ) : (
          <div className="agent-mobile-card">
            <div className="agent-mobile-card-content text-center py-8">
              <Briefcase className="mx-auto mb-4 text-v3-text-muted" size={32} />
              <p className="text-v3-text-muted">No new jobs are available for you at this time.</p>
              <p className="text-sm text-v3-text-muted mt-2">Check back later or ensure your availability is set to online.</p>
            </div>
          </div>
        )}
      </div>
      {/* Upcoming Shifts Section */}
      {dashboardData.upcoming_shifts && dashboardData.upcoming_shifts.length > 0 && (
        <div className="agent-mobile-section">
          <h2 className="agent-mobile-section-title">
            <Calendar size={20} />
            My Upcoming Shifts
          </h2>
          
          <div className="space-y-3">
            {dashboardData.upcoming_shifts.map(job => (
              <Link 
                to={`/agent/jobs/${job.id}`} 
                key={job.id} 
                className="agent-mobile-card block hover:border-v3-orange transition-colors"
              >
                <div className="agent-mobile-card-header">
                  <h3 className="agent-mobile-card-title">{job.title}</h3>
                  <p className="agent-mobile-card-subtitle">
                    {new Date(job.arrival_time).toLocaleDateString('en-GB', { dateStyle: 'full' })} at {new Date(job.arrival_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}