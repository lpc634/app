import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from "../useAuth";
import { toast } from 'sonner';
import { Loader2, ServerCrash, RefreshCw, AlertCircle, Briefcase, MapPin, Clock, CheckCircle, XCircle } from 'lucide-react';

const AvailableJobs = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debugInfo, setDebugInfo] = useState(null);
  const { apiCall, user } = useAuth();

  const fetchJobs = useCallback(async () => {
    if (!user) return; 
    try {
      setLoading(true);
      setError('');
      
      console.log('Fetching assignments for user:', user.id);
      
      // Fetch pending assignments
      const data = await apiCall(`/assignments/agent/${user.id}?status=pending`);
      console.log('Assignments response:', data);
      
      // Set assignments
      setAssignments(data.assignments || []);
      
      // If no assignments, fetch debug info
      if (!data.assignments || data.assignments.length === 0) {
        try {
          const debugData = await apiCall(`/debug/availability/${user.id}`);
          setDebugInfo(debugData);
          console.log('Debug info:', debugData);
        } catch (debugError) {
          console.log('Could not fetch debug info:', debugError);
        }
      }
      
    } catch (error) {
      setError('Failed to load available jobs. Please try again.');
      console.error('Available Jobs error:', error);
    } finally {
      setLoading(false);
    }
  }, [apiCall, user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleJobResponse = async (assignmentId, response) => {
    try {
      await apiCall(`/assignments/${assignmentId}/respond`, {
          method: 'POST',
          body: JSON.stringify({ response })
      });

      toast.success(`Job successfully ${response}ed!`);
      fetchJobs();
    } catch (err) {
        toast.error(`Failed to ${response} job`, { description: err.message });
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-v3-text-muted">
        <Loader2 className="h-8 w-8 animate-spin mx-auto" />
        <p className="mt-2">Loading available jobs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-card text-center p-8">
        <ServerCrash className="mx-auto h-16 w-16 text-v3-orange mb-4" />
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-v3-text-muted mb-6">{error}</p>
        <button onClick={fetchJobs} className="button-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Available Jobs</h1>
          <p className="text-muted-foreground">Jobs you have been notified about and are pending your response.</p>
        </div>
        <button onClick={fetchJobs} className="button-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </button>
      </div>

      {assignments.length === 0 ? (
        <div className="dashboard-card text-center p-8">
          <AlertCircle className="mx-auto text-v3-text-muted mb-4" size={48} />
          <h3 className="text-v3-text-lightest text-xl font-semibold mb-2">No Jobs Available</h3>
          <p className="text-v3-text-muted mb-4">There are currently no new jobs requiring your response.</p>
          
          {/* Debug Information - Remove this after fixing the issue */}
          {debugInfo && (
            <div className="mt-6 p-4 bg-gray-800 rounded-lg text-left text-sm">
              <h4 className="font-semibold mb-2 text-yellow-400">Debug Info:</h4>
              <p><strong>Verification Status:</strong> {debugInfo.agent.verification_status}</p>
              <p><strong>Recent Availability:</strong></p>
              <ul className="ml-4 list-disc">
                {debugInfo.recent_availability.map((avail, index) => (
                  <li key={index}>
                    {avail.date}: {avail.is_available ? 'Available' : 'Not Available'} 
                    {avail.is_away && ' (Away)'}
                  </li>
                ))}
              </ul>
              {debugInfo.weekly_schedule && (
                <div className="mt-2">
                  <p><strong>Weekly Schedule:</strong></p>
                  <p>Mon: {debugInfo.weekly_schedule.monday ? 'Yes' : 'No'}, 
                     Tue: {debugInfo.weekly_schedule.tuesday ? 'Yes' : 'No'}, 
                     Wed: {debugInfo.weekly_schedule.wednesday ? 'Yes' : 'No'}, 
                     Thu: {debugInfo.weekly_schedule.thursday ? 'Yes' : 'No'}, 
                     Fri: {debugInfo.weekly_schedule.friday ? 'Yes' : 'No'}, 
                     Sat: {debugInfo.weekly_schedule.saturday ? 'Yes' : 'No'}, 
                     Sun: {debugInfo.weekly_schedule.sunday ? 'Yes' : 'No'}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            const job = assignment.job_details;
            
            // Check if job_details exists
            if (!job) {
              console.error('Assignment missing job_details:', assignment);
              return (
                <div key={assignment.id} className="dashboard-card p-6 bg-red-900/20 border-red-500">
                  <p className="text-red-400">Error: Job details not found for assignment {assignment.id}</p>
                </div>
              );
            }
            
            return (
              <div key={assignment.id} className="dashboard-card p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <Briefcase className="w-6 h-6 text-v3-orange" />
                      <h3 className="text-v3-text-lightest font-semibold text-lg">{job.title}</h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-v3-text-muted pl-9">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} />
                        {job.address}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {new Date(job.arrival_time).toLocaleString('en-GB')}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 flex sm:flex-col items-center gap-3">
                    <button 
                      onClick={() => handleJobResponse(assignment.id, 'accepted')} 
                      className="button-refresh bg-green-600 hover:bg-green-700 w-full sm:w-32 flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={16} /> Accept
                    </button>
                    <button 
                      onClick={() => handleJobResponse(assignment.id, 'declined')} 
                      className="button-refresh bg-red-600 hover:bg-red-700 w-full sm:w-32 flex items-center justify-center gap-2"
                    >
                      <XCircle size={16} /> Decline
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AvailableJobs;