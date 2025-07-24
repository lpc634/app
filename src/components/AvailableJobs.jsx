import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from "../useAuth";
import { toast } from 'sonner';
import { Loader2, ServerCrash, RefreshCw, AlertCircle, Briefcase, MapPin, Clock, CheckCircle, XCircle } from 'lucide-react';

const AvailableJobs = () => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { apiCall, user } = useAuth();

  const fetchJobs = useCallback(async () => {
    if (!user) {
      console.log('No user found, skipping fetch');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      console.log(`Fetching assignments for user ${user.id}`);
      
      // Fetch pending assignments
      const data = await apiCall(`/assignments/agent/${user.id}?status=pending`);
      console.log('API Response:', data);
      
      // Handle the response - we know it has assignments array
      const assignmentsArray = data?.assignments || [];
      
      console.log(`Found ${assignmentsArray.length} assignments`);
      setAssignments(assignmentsArray);
      
    } catch (error) {
      console.error('Available Jobs error:', error);
      setError(`Failed to load available jobs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [apiCall, user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleJobResponse = async (assignmentId, response) => {
    try {
      console.log(`Responding to assignment ${assignmentId} with ${response}`);
      
      await apiCall(`/assignments/${assignmentId}/respond`, {
          method: 'POST',
          body: JSON.stringify({ response })
      });

      toast.success(`Job successfully ${response}d!`);
      fetchJobs(); // Refresh the list
    } catch (err) {
        console.error('Job response error:', err);
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
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment) => {
            // Safe access to job details with fallbacks
            const job = assignment?.job_details || {};
            
            // If no job details, show error state
            if (!assignment?.job_details) {
              console.error('Assignment missing job_details:', assignment);
              return (
                <div key={assignment?.id || 'unknown'} className="dashboard-card p-6 bg-red-900/20 border-red-500">
                  <p className="text-red-400">
                    Error: Job details not found for assignment {assignment?.id || 'unknown'}
                  </p>
                </div>
              );
            }
            
            return (
              <div key={assignment.id} className="dashboard-card p-6">
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="flex-grow">
                    <div className="flex items-center gap-3 mb-2">
                      <Briefcase className="w-6 h-6 text-v3-orange" />
                      <h3 className="text-v3-text-lightest font-semibold text-lg">
                        {job.title || 'Untitled Job'}
                      </h3>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-v3-text-muted pl-9">
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} />
                        {job.address || 'Address not specified'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock size={14} />
                        {job.arrival_time ? new Date(job.arrival_time).toLocaleString('en-GB') : 'Time not specified'}
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