import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, AlertCircle, CheckSquare, Square, 
  Briefcase, CheckCircle, PoundSterling, Search, Calendar, 
  MapPin, Clock, Check, FileText, User
} from 'lucide-react';

const CreateInvoiceFromJobs = () => {
  const { apiCall } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  
  // State to track selected jobs and their hours, rate, and invoice data
  const [selected, setSelected] = useState({});
  const [invoiceNumber, setInvoiceNumber] = useState('');
  
  // New state for enhanced UI
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        // Try the correct endpoint for uninvoiced jobs
        const data = await apiCall('/agent/jobs?invoiced=false');
        setJobs(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching jobs:', error);
        // Fallback to alternative endpoint
        try {
          const fallbackData = await apiCall('/agent/invoiceable-jobs');
          setJobs(Array.isArray(fallbackData) ? fallbackData : []);
        } catch (fallbackError) {
          toast.error('Failed to load invoiceable jobs', { description: error.message });
          setJobs([]);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [apiCall]);

  // Handle pre-selected job from URL query params
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const preselectedJobId = queryParams.get('jobId');
    
    if (preselectedJobId && jobs.length > 0) {
      const job = jobs.find(j => j.id === parseInt(preselectedJobId));
      if (job && !selected[job.id]) {
        setSelected(prev => ({
          ...prev,
          [job.id]: { hours: '', rate: job.hourly_rate || 0 }
        }));
      }
    }
  }, [location.search, jobs, selected]);

  const handleToggleJob = (job) => {
    setSelected(prev => {
      const newSelected = { ...prev };
      if (newSelected[job.id]) {
        delete newSelected[job.id]; // Uncheck
      } else {
        newSelected[job.id] = { hours: '', rate: job.hourly_rate || 0 }; // Check
      }
      return newSelected;
    });
  };

  const handleHoursChange = (jobId, hours) => {
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(hours)) {
      setSelected(prev => ({
        ...prev,
        [jobId]: { ...prev[jobId], hours: hours }
      }));
    }
  };

  const handleRateChange = (jobId, rate) => {
    // Allow only numbers and a single decimal point
    if (/^\d*\.?\d*$/.test(rate)) {
      setSelected(prev => ({
        ...prev,
        [jobId]: { ...prev[jobId], rate: rate }
      }));
    }
  };

  const totalAmount = useMemo(() => {
    return Object.values(selected).reduce((acc, job) => {
      const hours = parseFloat(job.hours) || 0;
      const rate = parseFloat(job.rate) || 0;
      return acc + (hours * rate);
    }, 0);
  }, [selected]);

  // Helper functions for new UI
  const isJobSelected = (jobId) => {
    return selected[jobId] !== undefined;
  };

  const getJobHours = (jobId) => {
    return selected[jobId]?.hours || '';
  };

  const getJobRate = (jobId) => {
    return selected[jobId]?.rate || '';
  };

  const updateJobHours = (jobId, hours) => {
    if (/^\d*\.?\d*$/.test(hours)) {
      setSelected(prev => ({
        ...prev,
        [jobId]: { ...prev[jobId], hours: hours }
      }));
    }
  };

  const updateJobRate = (jobId, rate) => {
    if (/^\d*\.?\d*$/.test(rate)) {
      setSelected(prev => ({
        ...prev,
        [jobId]: { ...prev[jobId], rate: rate }
      }));
    }
  };

  const getTotalHours = () => {
    return Object.values(selected).reduce((sum, job) => {
      return sum + (parseFloat(job.hours) || 0);
    }, 0).toFixed(1);
  };

  const getSelectedJobsCount = () => {
    return Object.keys(selected).length;
  };

  const handleJobToggle = (job) => {
    if (isJobSelected(job.id)) {
      setSelected(prev => {
        const newSelected = { ...prev };
        delete newSelected[job.id];
        return newSelected;
      });
    } else {
      setSelected(prev => ({
        ...prev,
        [job.id]: { hours: '', rate: job.hourly_rate || 0 }
      }));
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Filtered jobs based on search and date filter
  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      const matchesSearch = searchTerm === '' || 
        job.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.job_type && job.job_type.toLowerCase().includes(searchTerm.toLowerCase()));
      
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const jobDate = new Date(job.arrival_time);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        switch (dateFilter) {
          case 'week':
            matchesDate = jobDate >= weekAgo;
            break;
          case 'month':
            matchesDate = jobDate >= monthAgo;
            break;
          case 'older':
            matchesDate = jobDate < monthAgo;
            break;
        }
      }
      
      return matchesSearch && matchesDate;
    });
  }, [jobs, searchTerm, dateFilter]);

  const handleReviewInvoice = async () => {
    const jobsToInvoice = Object.entries(selected)
      .filter(([_, job]) => parseFloat(job.hours) > 0 && parseFloat(job.rate) > 0)
      .map(([jobId, jobData]) => ({
        job_id: parseInt(jobId),  // Use job_id instead of jobId to match backend
        hours: parseFloat(jobData.hours),
        rate: parseFloat(jobData.rate)
      }));

    if (jobsToInvoice.length === 0) {
      toast.error("No jobs selected", { description: "Please select at least one job and enter the hours and rate." });
      return;
    }

    if (!invoiceNumber.trim()) {
      toast.error("Invoice number required", { description: "Please enter your invoice number." });
      return;
    }

    try {
      setCreating(true);
      
      // Use the unified invoice creation endpoint with correct payload format
      const response = await apiCall('/agent/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoice_number: invoiceNumber.trim(),
          jobs: jobsToInvoice
        })
      });

      toast.success("Invoice created successfully!", { 
        description: `Invoice ${response.invoice_number} has been generated.` 
      });

      // Navigate back to invoices page
      navigate('/agent/invoices');
      
    } catch (error) {
      console.error('Invoice creation error:', error);
      
      // Handle specific error cases
      if (error.status === 409 && error.suggested) {
        toast.error('Invoice number already used', { 
          description: `Invoice number ${invoiceNumber} has already been used. Try ${error.suggested} instead.`
        });
        setInvoiceNumber(error.suggested.toString());
      } else {
        toast.error('Failed to create invoice', { 
          description: error.message || 'An error occurred while creating the invoice.'
        });
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-v3-orange" />
      </div>
    );
  }

  return (
    <div className="min-h-screen-ios w-full max-w-full prevent-horizontal-scroll">
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <Link to="/agent/invoices/new" className="inline-flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors mb-3">
              <ArrowLeft size={20} />
              <span>Back to Invoice Options</span>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-v3-text-lightest truncate">Create Invoice from Jobs</h1>
            <p className="text-v3-text-muted text-sm sm:text-base">Select completed jobs and specify hours to generate your invoice</p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="dashboard-card">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-v3-text-muted">Available Jobs</p>
                  <p className="text-2xl font-bold text-v3-text-lightest">{filteredJobs.length}</p>
                </div>
                <Briefcase className="h-8 w-8 text-v3-text-muted" />
              </div>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-v3-text-muted">Selected Jobs</p>
                  <p className="text-2xl font-bold text-green-400">{getSelectedJobsCount()}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-400" />
              </div>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-v3-text-muted">Estimated Total</p>
                  <p className="text-2xl font-bold text-v3-orange">£{totalAmount.toFixed(2)}</p>
                </div>
                <PoundSterling className="h-8 w-8 text-v3-orange" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="dashboard-card">
          <div className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-v3-text-muted h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by address or job type..."
                  className="w-full pl-10 pr-4 py-3 bg-v3-bg-dark border border-v3-border rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange text-v3-text-lightest"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="px-4 py-3 bg-v3-bg-dark border border-v3-border rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange text-v3-text-lightest"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">All Jobs</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="older">Older Jobs</option>
              </select>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        {filteredJobs.length === 0 ? (
          <div className="dashboard-card text-center py-12">
            <Briefcase className="h-16 w-16 text-v3-text-muted mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-v3-text-lightest mb-2">
              {jobs.length === 0 ? 'No Uninvoiced Jobs' : 'No Matching Jobs'}
            </h3>
            <p className="text-v3-text-muted mb-6">
              {jobs.length === 0 
                ? 'All your completed jobs have been invoiced. Great work!' 
                : 'Try adjusting your search terms or filters to find more jobs.'
              }
            </p>
            <div className="flex justify-center gap-4">
              <Link to="/agent/invoices/new/misc">
                <button className="button-refresh">
                  Create Miscellaneous Invoice
                </button>
              </Link>
              <Link to="/agent/invoices/new">
                <button className="px-4 py-2 border border-v3-border text-v3-text-lightest rounded-lg hover:bg-v3-bg-dark">
                  Back to Options
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map(job => (
              <div key={job.id} className={`dashboard-card cursor-pointer transition-all hover:border-v3-orange ${
                isJobSelected(job.id) ? 'border-v3-orange bg-v3-bg-card/50' : ''
              }`} onClick={() => handleJobToggle(job)}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin className="h-5 w-5 text-v3-text-muted flex-shrink-0" />
                        <h3 className="font-semibold text-v3-text-lightest truncate">{job.address}</h3>
                      </div>
                      <div className="space-y-1 ml-8 text-sm text-v3-text-muted">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(job.arrival_time)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          <span>{job.job_type || 'Service Call'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isJobSelected(job.id) ? (
                        <CheckSquare className="h-6 w-6 text-v3-orange" />
                      ) : (
                        <Square className="h-6 w-6 text-v3-text-muted" />
                      )}
                    </div>
                  </div>

                  {isJobSelected(job.id) && (
                    <div className="mt-4 pt-4 border-t border-v3-border space-y-4" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-v3-text-muted mb-2">Hourly Rate (£)</label>
                          <input
                            type="number"
                            placeholder="0.00"
                            className="w-full px-4 py-2 bg-v3-bg-dark border border-v3-border rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange text-v3-text-lightest"
                            value={getJobRate(job.id)}
                            onChange={(e) => updateJobRate(job.id, e.target.value)}
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-v3-text-muted mb-2">Hours Worked</label>
                          <input
                            type="number"
                            placeholder="0.0"
                            className="w-full px-4 py-2 bg-v3-bg-dark border border-v3-border rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange text-v3-text-lightest"
                            value={getJobHours(job.id)}
                            onChange={(e) => updateJobHours(job.id, e.target.value)}
                            step="0.5"
                            min="0"
                          />
                        </div>
                      </div>
                      {getJobHours(job.id) && getJobRate(job.id) && (
                        <div className="flex justify-between items-center pt-2 border-t border-v3-border/50">
                          <span className="text-sm text-v3-text-muted">Subtotal</span>
                          <span className="font-semibold text-v3-orange">
                            £{((parseFloat(getJobHours(job.id)) || 0) * (parseFloat(getJobRate(job.id)) || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Invoice Creation */}
        {getSelectedJobsCount() > 0 && (
          <div className="dashboard-card">
            <div className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-v3-text-muted mb-2">Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g., INV-001"
                    className="w-full px-4 py-3 bg-v3-bg-dark border border-v3-border rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange text-v3-text-lightest font-mono"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm text-v3-text-muted">Total Amount</p>
                    <p className="text-2xl font-bold text-v3-orange">£{totalAmount.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={handleReviewInvoice}
                    disabled={getSelectedJobsCount() === 0 || !invoiceNumber || totalAmount === 0 || creating}
                    className="button-refresh min-w-[140px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Create Invoice
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateInvoiceFromJobs;
