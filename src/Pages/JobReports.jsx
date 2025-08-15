import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from "../useAuth";
import { motion, AnimatePresence } from 'framer-motion'; // Re-added for smooth animations
import { ClipboardList, Edit, CheckCircle, ServerCrash, RefreshCw, X, History, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const COGNITO_FORM_CONFIGS = {
  'eviction': { key: 'sZH0eAh12kuFR54t7shuOw', formId: '6', name: 'Eviction Report' },
  'traveller_serve': { key: 'sZH0eAh12kuFR54t7shuOw', formId: '7', name: 'Traveller Serve Report' },
  'squatter_serve': { key: 'sZH0eAh12kuFR54t7shuOw', formId: '8', name: 'Squatter Serve Report' },
  'default': { key: 'sZH0eAh12kuFR54t7shuOw', formId: '6', name: 'General Report' }
};

const CognitoFormEmbed = ({ formKey, formId, prefillData }) => {
  const embedContainer = React.useRef(null);
  
  useEffect(() => {
    if (!formKey || !formId || !embedContainer.current) return;
    embedContainer.current.innerHTML = '';
    
    const script = document.createElement('script');
    script.src = "https://www.cognitoforms.com/f/seamless.js";
    script.setAttribute('data-key', formKey);
    script.setAttribute('data-form', formId);
    if (prefillData) {
        script.setAttribute('data-entry', JSON.stringify(prefillData));
    }
    
    // Enhanced iOS-specific handling
    script.onload = () => {
      // Listen for form resize messages
      const handleResize = (event) => {
        if (event.origin === 'https://www.cognitoforms.com' && event.data?.height) {
          const iframe = embedContainer.current?.querySelector('iframe');
          if (iframe) {
            iframe.style.height = event.data.height + 'px';
            iframe.style.minHeight = 'auto';
          }
        }
      };
      
      // iOS iframe setup
      const setupIframe = () => {
        const iframe = embedContainer.current?.querySelector('iframe');
        if (iframe) {
          iframe.style.width = '100%';
          iframe.style.border = 'none';
          iframe.style.overflow = 'hidden';
          iframe.scrolling = 'no';
        }
      };
      
      window.addEventListener('message', handleResize);
      setTimeout(setupIframe, 100);
      
      return () => window.removeEventListener('message', handleResize);
    };
    
    embedContainer.current.appendChild(script);
  }, [formKey, formId, prefillData]);
  
  return (
    <div 
      ref={embedContainer} 
      className="cognito w-full"
      style={{
        width: '100%',
        minHeight: '400px'
      }}
    />
  );
};

const JobReports = () => {
  const { user, apiCall } = useAuth();
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedFormType, setSelectedFormType] = useState('');

  const fetchCompletedJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await apiCall('/agent/jobs/completed');
      setCompletedJobs(data.jobs || []);
    } catch (error) {
      setError('Failed to load completed jobs.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiCall]);

  useEffect(() => {
    fetchCompletedJobs();
  }, [fetchCompletedJobs]);

  useEffect(() => {
    if (completedJobs.length > 0 && !selectedJob) {
      const firstPendingJob = completedJobs.find(job => job.reportStatus === 'pending');
      if (firstPendingJob) {
        setSelectedJob(firstPendingJob);
      }
    }
  }, [completedJobs]);

  useEffect(() => {
    if (selectedJob) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [selectedJob]);

  const { pendingReports, submittedReports } = useMemo(() => {
    const pending = [];
    const submitted = [];
    completedJobs.forEach(job => {
      if (job.reportStatus === 'pending') {
        pending.push(job);
      } else {
        submitted.push(job);
      }
    });
    return { pendingReports: pending, submittedReports: submitted };
  }, [completedJobs]);

  const handleSelectJob = (job) => setSelectedJob(job);
  const handleCloseModal = () => setSelectedJob(null);

  const handleAfterSubmit = () => {
    handleCloseModal();
    setTimeout(() => {
        fetchCompletedJobs();
    }, 1000);
  };

  const handleViewForm = () => {
    if (!selectedFormType) {
        console.log("No form type selected");
        return;
    }
    const mockJob = {
        id: 'MANUAL',
        title: 'Manual Report Entry',
        jobType: selectedFormType.replace(/_/g, ' ')
    };
    handleSelectJob(mockJob);
  };

  const getFormConfig = (job) => {
    const jobTypeKey = job.jobType?.toLowerCase().replace(/ /g, '_') || 'default';
    if (!COGNITO_FORM_CONFIGS[jobTypeKey]) {
        console.warn(`No specific form config for job type "${job.jobType}". Using default.`);
        return COGNITO_FORM_CONFIGS['default'];
    }
    return COGNITO_FORM_CONFIGS[jobTypeKey];
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-4 animate-pulse">
          <div className="h-12 w-1/3 bg-v3-bg-card rounded-lg"></div>
          <div className="h-24 bg-v3-bg-card rounded-lg"></div>
          <div className="h-24 bg-v3-bg-card rounded-lg"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="dashboard-card text-center p-8">
          <ServerCrash className="mx-auto h-16 w-16 text-v3-orange" />
          <p className="mt-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <main className="min-h-screen-ios w-full max-w-full prevent-horizontal-scroll safe-pb">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-v3-text-lightest truncate">Job Reports</h1>
                <p className="text-muted-foreground text-sm sm:text-base">Submit and review your post-job reports.</p>
              </div>
              <div className="flex-shrink-0">
                <button onClick={fetchCompletedJobs} className="button-refresh tap-target w-full sm:w-auto" disabled={loading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Reports
                </button>
              </div>
            </div>

          <>
            <Card className="dashboard-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><FileText size={20} /> Manual Report Selection</CardTitle>
                <CardDescription>Manually select a blank report form to fill out.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-4">
                <select
                  value={selectedFormType}
                  onChange={(e) => setSelectedFormType(e.target.value)}
                  className="w-full sm:flex-1 p-2 bg-v3-bg-dark border border-v3-border rounded-md text-v3-text-lightest"
                >
                  <option value="">-- Select a form type --</option>
                  {Object.entries(COGNITO_FORM_CONFIGS).map(([key, config]) => (
                    <option key={key} value={key}>
                      {config.name}
                    </option>
                  ))}
                </select>
                <Button onClick={handleViewForm} className="button-refresh" disabled={!selectedFormType}>
                  View Form
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-v3-orange flex items-center gap-2"><Edit size={20} /> Action Required: Reports to Submit</h2>
              {pendingReports.length > 0 ? (
                pendingReports.map((job) => (
                  <motion.div
                    key={job.id}
                    layoutId={`job-card-${job.id}`}
                    onClick={() => handleSelectJob(job)}
                    className="dashboard-card cursor-pointer hover:border-v3-orange transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-v3-text-lightest">{job.address}</h3>
                        <p className="text-v3-text-muted text-sm">Completed: {new Date(job.arrival_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-v3-orange">File Report</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="dashboard-card text-center p-8">
                  <CheckCircle className="mx-auto text-green-500 mb-4" size={48} />
                  <h3 className="text-v3-text-lightest text-xl font-semibold">All Reports Submitted</h3>
                  <p className="text-v3-text-muted mt-2">You're all caught up. Great work!</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-v3-text-lightest flex items-center gap-2"><History size={20} /> Recently Submitted</h2>
              {submittedReports.length > 0 ? (
                  submittedReports.map((job) => (
                  <motion.div
                    key={job.id}
                    className="dashboard-card bg-v3-bg-dark"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-v3-text-light">{job.address}</h3>
                        <p className="text-v3-text-muted text-sm">Completed: {new Date(job.arrival_time).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                      <div className="text-right flex items-center gap-2 text-green-400">
                        <CheckCircle size={16} />
                        <span className="text-sm font-medium">Submitted</span>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                  <p className="text-sm text-v3-text-muted px-4">No reports have been submitted yet.</p>
              )}
            </div>
          </>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col safe-pt safe-pb"
          >
            <motion.div
              className="bg-v3-bg-darkest flex flex-col w-full h-full max-w-4xl mx-auto rounded-lg shadow-2xl overflow-hidden m-4"
              initial={{ y: "100%" }}
              animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
              exit={{ y: "100%" }}
            >
              {/* Header - Fixed height */}
              <div className="flex-shrink-0 p-4 border-b border-v3-border flex items-center justify-between">
                <div className='flex-1 min-w-0 pr-4'>
                  <h2 className="text-lg font-bold text-v3-text-lightest truncate">{getFormConfig(selectedJob).name}</h2>
                  <p className="text-sm text-v3-text-muted truncate">{selectedJob.title}</p>
                </div>
                <button onClick={handleCloseModal} className="p-3 rounded-full hover:bg-v3-bg-card tap-target flex-shrink-0 bg-red-600 text-white">
                  <X className="w-6 h-6"/>
                </button>
              </div>

              {/* Form Content - Scrollable */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch', minHeight: 'calc(100vh - 200px)' }}>
                 <div className="bg-white rounded-lg min-h-[600px]">
                    <div className="p-4">
                       <CognitoFormEmbed
                         formKey={getFormConfig(selectedJob).key}
                         formId={getFormConfig(selectedJob).formId}
                         prefillData={{ "JobID": selectedJob.id, "JobTitle": selectedJob.title, "AgentName": user?.first_name + ' ' + user?.last_name }}
                       />
                     </div>
                 </div>
              </div>

              {/* Footer - Fixed height */}
              <div className="flex-shrink-0 p-4 border-t border-v3-border bg-v3-bg-darkest">
                <button onClick={handleAfterSubmit} className="w-full py-4 px-6 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg flex items-center justify-center gap-2 tap-target text-lg">
                  ✓ I Have Submitted This Report
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default JobReports;