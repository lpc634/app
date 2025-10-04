import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from "../useAuth";
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Edit, CheckCircle, ServerCrash, RefreshCw, X, History, FileText, Plus, Briefcase } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import TravellerEvictionForm from '../components/forms/TravellerEvictionForm';
import { AdminFormStartModal } from '../components/modals/AdminFormStartModal';
import { useForm, FormProvider } from "react-hook-form";
import { JobSelect } from "@/components/common/JobSelect";

// Form types configuration - can be expanded as more forms are built
const V3_FORM_TYPES = {
  'traveller_eviction': {
    id: 'traveller_eviction',
    name: 'Traveller Eviction Report',
    component: TravellerEvictionForm,
    description: 'Report for traveller eviction operations'
  },
  // Add more forms here as they are built
  // 'traveller_serve': { ... },
  // 'squatter_serve': { ... },
};

const V3JobReports = () => {
  const { user, apiCall } = useAuth();
  const methods = useForm({ defaultValues: { job_id: "" } });
  const watchedJobId = methods.watch("job_id");
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [selectedFormType, setSelectedFormType] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [showAdminStartModal, setShowAdminStartModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchCompletedJobs = useCallback(async () => {
    // Skip fetching jobs for admin/manager users - they only need manual form creation
    if (user?.role === 'admin' || user?.role === 'manager') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      // Fetch accepted jobs (both completed and active)
      const data = await apiCall('/agent/jobs/completed');
      setCompletedJobs(data.jobs || []);
    } catch (error) {
      setError('Failed to load your jobs.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [apiCall, user]);

  useEffect(() => {
    fetchCompletedJobs();
  }, [fetchCompletedJobs]);

  useEffect(() => {
    if (showFormModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showFormModal]);

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

  const handleSelectJob = (job) => {
    setSelectedJob(job);
    // If this is a real job from the pending list, try to auto-select a form type
    if (job.jobType) {
      const jobTypeKey = job.jobType.toLowerCase().replace(/ /g, '_');
      if (V3_FORM_TYPES[jobTypeKey]) {
        setSelectedFormType(jobTypeKey);
      } else {
        // Default to first available form type if no match
        setSelectedFormType(Object.keys(V3_FORM_TYPES)[0]);
      }
    }
    setShowFormModal(true);
  };

  const handleCloseModal = () => {
    setShowFormModal(false);
    setSelectedJob(null);
    // Reset the dropdown to empty state
    setTimeout(() => setSelectedFormType(''), 100);
    // Clear the job selection to prevent reopening
    methods.setValue('job_id', '');
  };

  const handleFormSubmit = async (submissionData) => {
    try {
      console.log('📤 Form Submission Data:', submissionData);
      console.log('📸 Photos to upload:', submissionData.photos);

      let photoUrls = [];

      // Check if we have photos to upload
      if (submissionData.photos && submissionData.photos.length > 0) {
        toast.info('Uploading photos...', { description: `${submissionData.photos.length} photos found` });

        // Create FormData for photo upload
        const formData = new FormData();
        submissionData.photos.forEach((photo) => {
          formData.append('photos', photo);
        });

        // Upload photos to S3 (use admin or agent endpoint based on role)
        const uploadEndpoint = (user?.role === 'admin' || user?.role === 'manager')
          ? '/admin/v3-reports/upload-photos'
          : '/agent/v3-reports/upload-photos';

        const API_BASE_URL = import.meta.env.PROD
          ? 'https://v3-app-49c3d1eff914.herokuapp.com/api'
          : 'http://localhost:5001/api';

        try {
          const uploadResponse = await fetch(`${API_BASE_URL}${uploadEndpoint}`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: formData
          });

          if (!uploadResponse.ok) {
            throw new Error('Photo upload failed');
          }

          const uploadData = await uploadResponse.json();
          photoUrls = uploadData.photos || [];

          toast.success(`${photoUrls.length} photos uploaded successfully`);
        } catch (uploadErr) {
          console.error('Photo upload error:', uploadErr);
          toast.error('Failed to upload photos', {
            description: 'Report will be submitted without photos'
          });
        }
      }

      // Submit the form data to the backend (use admin or agent endpoint based on role)
      const submitEndpoint = (user?.role === 'admin' || user?.role === 'manager')
        ? '/admin/v3-reports/submit'
        : '/agent/v3-reports/submit';

      const response = await apiCall(submitEndpoint, {
        method: 'POST',
        body: JSON.stringify({
          job_id: selectedJob.id,
          form_type: selectedFormType,
          report_data: submissionData.formData || submissionData,
          photo_urls: photoUrls
        })
      });

      toast.success('Report submitted successfully', {
        description: 'Your report has been saved and admin has been notified.'
      });

      // Refresh the job list
      await fetchCompletedJobs();

      // Close the modal
      handleCloseModal();
    } catch (err) {
      console.error('Report submission error:', err);
      toast.error('Failed to submit report', {
        description: err?.message || 'Please try again or contact support.'
      });
      throw err; // Re-throw to let form handle the error
    }
  };

  const handleManualFormCreate = () => {
    if (!selectedFormType) {
      toast.error('Please select a form type');
      return;
    }

    const mockJob = {
      id: 'MANUAL',
      title: 'Manual Report Entry',
      address: 'Manual Entry',
      jobType: selectedFormType.replace(/_/g, ' '),
      agentName: `${user?.first_name} ${user?.last_name}`
    };

    handleSelectJob(mockJob);
  };

  // Get the current form component based on selection
  const getCurrentFormComponent = () => {
    if (!selectedFormType || !V3_FORM_TYPES[selectedFormType]) {
      return null;
    }
    return V3_FORM_TYPES[selectedFormType].component;
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

  const FormComponent = getCurrentFormComponent();

  return (
    <>
      <main className="min-h-screen-ios w-full max-w-full prevent-horizontal-scroll safe-pb">
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-v3-text-lightest truncate">
                    V3 Job Reports
                  </h1>
                  <span className="px-2 py-1 text-xs font-semibold bg-v3-orange text-white rounded-md">
                    NEW
                  </span>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Submit job reports using our new custom forms (Cognito Forms will be phased out).
                </p>
              </div>
              <div className="flex-shrink-0">
                <button
                  onClick={fetchCompletedJobs}
                  className="button-refresh tap-target w-full sm:w-auto"
                  disabled={loading}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh Reports
                </button>
              </div>
            </div>

            {/* Job Selection for Agents */}
            {user?.role === 'agent' && (
              <Card className="dashboard-card border-v3-orange/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase size={20} className="text-v3-orange" />
                    Report for a Job
                  </CardTitle>
                  <CardDescription>
                    Search and select one of your accepted jobs to create a report.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormProvider {...methods}>
                    <div className="space-y-2">
                      <JobSelect
                        control={methods.control}
                        name="job_id"
                        label="Select Job"
                        placeholder="Search jobs…"
                        disabled={false}
                      />
                    </div>
                  </FormProvider>
                </CardContent>
              </Card>
            )}

            {/* React to job selection for agents */}
            {watchedJobId && user?.role === 'agent' && (
              (() => {
                const job = completedJobs.find(j => String(j.id) === String(watchedJobId));
                if (job && (!selectedJob || selectedJob.id !== job.id)) {
                  // open modal for this job
                  setTimeout(() => handleSelectJob(job), 0);
                }
                return null;
              })()
            )}

            {/* React to job selection for admins */}
            {watchedJobId && (user?.role === 'admin' || user?.role === 'manager') && (
              (() => {
                // For admins, fetch job details and open form modal
                const fetchJobAndOpenModal = async () => {
                  try {
                    const job = await apiCall(`/jobs/${watchedJobId}`);
                    const formattedJob = {
                      id: job.id,
                      title: job.reference || job.address,
                      address: job.address || job.site_name,
                      jobType: job.job_type || 'Traveller Eviction',
                      arrival_time: job.created_at,
                      agentName: `${user?.first_name} ${user?.last_name}`
                    };
                    if (!selectedJob || selectedJob.id !== formattedJob.id) {
                      setTimeout(() => handleSelectJob(formattedJob), 0);
                    }
                  } catch (error) {
                    console.error('Failed to fetch job details:', error);
                    toast.error('Failed to load job details');
                  }
                };
                fetchJobAndOpenModal();
                return null;
              })()
            )}

            {/* Job Selection for Admins */}
            {(user?.role === 'admin' || user?.role === 'manager') && (
              <Card className="dashboard-card border-v3-orange/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase size={20} className="text-v3-orange" />
                    Report for a Job
                  </CardTitle>
                  <CardDescription>
                    Search and select an open job to create a report.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormProvider {...methods}>
                    <div className="space-y-2">
                      <JobSelect
                        control={methods.control}
                        name="job_id"
                        label="Select Job"
                        placeholder="Search open jobs…"
                        disabled={false}
                      />
                    </div>
                  </FormProvider>
                </CardContent>
              </Card>
            )}

            {/* Pending Reports - Only show for agents */}
            {user?.role === 'agent' && (
              <>
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-v3-orange flex items-center gap-2">
                    <Edit size={20} />
                    Action Required: Reports to Submit
                  </h2>
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
                            <p className="text-v3-text-muted text-sm">
                              Job Type: {job.jobType || 'Not specified'}
                            </p>
                            <p className="text-v3-text-muted text-sm">
                              Completed: {new Date(job.arrival_time).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
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

                {/* Submitted Reports */}
                <div className="space-y-4">
                  <h2 className="text-xl font-semibold text-v3-text-lightest flex items-center gap-2">
                    <History size={20} />
                    Recently Submitted
                  </h2>
                  {submittedReports.length > 0 ? (
                    submittedReports.map((job) => (
                      <motion.div
                        key={job.id}
                        className="dashboard-card bg-v3-bg-dark"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-v3-text-light">{job.address}</h3>
                            <p className="text-v3-text-muted text-sm">
                              Job Type: {job.jobType || 'Not specified'}
                            </p>
                            <p className="text-v3-text-muted text-sm">
                              Completed: {new Date(job.arrival_time).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </p>
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
            )}
          </div>
        </div>
      </main>

      {/* Form Modal */}
      <AnimatePresence>
        {showFormModal && selectedJob && FormComponent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col safe-pt safe-pb"
          >
            <motion.div
              className="bg-v3-bg-darkest mx-auto w-full max-w-7xl rounded-lg shadow-2xl m-4 flex flex-col overflow-hidden"
              style={{ maxHeight: 'calc(100vh - 2rem)' }}
              initial={{ y: "100%" }}
              animate={{ y: 0, transition: { type: "spring", stiffness: 300, damping: 30 } }}
              exit={{ y: "100%" }}
            >
              {/* Scrollable Form Content - No separate header, form has its own styling */}
              <div className="overflow-y-auto flex-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                <FormComponent
                  jobData={{
                    id: selectedJob.id,
                    title: selectedJob.title,
                    address: selectedJob.address,
                    arrival_time: selectedJob.arrival_time,
                    agentName: `${user?.first_name} ${user?.last_name}`,
                    jobType: selectedJob.jobType
                  }}
                  onSubmit={handleFormSubmit}
                  onCancel={handleCloseModal}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin Form Start Modal */}
      <AdminFormStartModal
        isOpen={showAdminStartModal}
        onClose={() => setShowAdminStartModal(false)}
      />
    </>
  );
};

export default V3JobReports;
