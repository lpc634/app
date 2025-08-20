import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertCircle, CheckSquare, Square, Briefcase, Calendar, MapPin, Clock } from 'lucide-react';

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

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        setLoading(true);
        console.log('Fetching uninvoiced jobs...');
        
        // Try the uninvoiced jobs endpoint first
        let response = await apiCall('/agent/jobs?invoiced=false');
        console.log('Response from /agent/jobs?invoiced=false:', response);
        
        // Handle both response.jobs array and direct array response
        let jobsList = Array.isArray(response) ? response : (response.jobs || []);
        console.log('Parsed jobs list:', jobsList);
        
        // If no jobs found, try the force endpoint as fallback
        if (jobsList.length === 0) {
          console.log('No jobs found, trying force endpoint...');
          try {
            response = await apiCall('/agent/force-invoiceable-jobs');
            console.log('Response from force endpoint:', response);
            jobsList = Array.isArray(response) ? response : (response.jobs || []);
            console.log('Force endpoint jobs list:', jobsList);
            
            // Add a flag to indicate we used the force endpoint
            if (jobsList.length > 0) {
              setJobs(jobsList.map(job => ({ ...job, __force_endpoint: true })));
              return;
            }
          } catch (forceError) {
            console.log('Force endpoint also failed:', forceError);
          }
        }
        
        setJobs(jobsList);
        
        // Check for preselected job from query params
        const queryParams = new URLSearchParams(location.search);
        const preselectedJobId = queryParams.get('jobId');
        
        if (preselectedJobId && jobsList.length > 0) {
          const job = jobsList.find(j => j.id === parseInt(preselectedJobId));
          if (job) {
            setSelected({
              [job.id]: { hours: '', rate: job.hourly_rate || 0 }
            });
            console.log('Preselected job:', job);
          }
        }
      } catch (error) {
        console.error('Error fetching jobs:', error);
        toast.error('Failed to load jobs', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    
    fetchJobs();
  }, [apiCall, location.search]);

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
    <div className="space-y-8">
      <div>
        <Link to="/agent/invoices/new" className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors w-fit mb-4">
          <ArrowLeft size={20} />
          <span>Back to Invoice Type Selection</span>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-v3-text-lightest">Create Invoice from Jobs</h1>
        <p className="text-v3-text-muted">Select completed jobs and enter the hours worked for each.</p>
      </div>
      
      <div className="dashboard-card p-0">
        <div className="p-6 border-b border-v3-border">
          <h2 className="text-xl font-bold text-v3-text-lightest">
            Uninvoiced Jobs ({jobs.length})
          </h2>
          <p className="text-sm text-v3-text-muted mt-1">
            Select jobs to include in your invoice
          </p>
        </div>
        
        {jobs.length === 0 ? (
          <div className="text-center p-12 space-y-4">
            <Briefcase className="mx-auto h-12 w-12 text-v3-text-muted mb-4" />
            <h3 className="text-lg font-medium text-v3-text-lightest">No Jobs to Invoice</h3>
            <p className="text-v3-text-muted mt-1">You have no accepted jobs that are pending an invoice.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
              <Link to="/agent/invoices/new/misc">
                <button className="button-refresh">
                  Create Misc Invoice
                </button>
              </Link>
              <Link to="/agent/invoices/new">
                <button className="px-4 py-2 border border-v3-border text-v3-text-muted hover:text-v3-text-lightest hover:border-v3-orange rounded-md transition-colors">
                  Back to Type Selection
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-v3-border">
            {jobs.map(job => (
              <div key={job.id} className={`p-4 flex flex-col md:flex-row items-start md:items-center gap-4 transition-colors ${selected[job.id] ? 'bg-v3-bg-dark' : 'hover:bg-v3-bg-card'}`}>
                <div className="flex items-center gap-4 flex-shrink-0 cursor-pointer" onClick={() => handleToggleJob(job)}>
                  {selected[job.id] ? <CheckSquare className="w-6 h-6 text-v3-orange" /> : <Square className="w-6 h-6 text-v3-text-muted hover:text-v3-orange transition-colors" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-v3-text-muted" />
                      <p className="font-semibold text-v3-text-lightest">{job.address}</p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-v3-text-muted">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(job.arrival_time).toLocaleDateString('en-GB')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {job.job_type || 'Service Call'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Status: {job.status || 'Accepted'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex-grow flex items-center justify-end gap-2 w-full md:w-auto">
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="£/hr"
                      value={selected[job.id]?.rate || ''}
                      onChange={(e) => handleRateChange(job.id, e.target.value)}
                      disabled={!selected[job.id]}
                      className="w-full text-center bg-v3-bg-input border border-v3-border rounded-md shadow-sm py-2 px-2 text-v3-text-lightest focus:outline-none focus:ring-2 focus:ring-v3-orange focus:border-v3-orange disabled:bg-v3-bg-card disabled:opacity-50 text-sm"
                    />
                    <p className="text-xs text-v3-text-muted text-center mt-1">Rate</p>
                  </div>
                  <div className="w-24">
                    <input
                      type="text"
                      placeholder="Hours"
                      value={selected[job.id]?.hours || ''}
                      onChange={(e) => handleHoursChange(job.id, e.target.value)}
                      disabled={!selected[job.id]}
                      className="w-full text-center bg-v3-bg-input border border-v3-border rounded-md shadow-sm py-2 px-2 text-v3-text-lightest focus:outline-none focus:ring-2 focus:ring-v3-orange focus:border-v3-orange disabled:bg-v3-bg-card disabled:opacity-50 text-sm"
                    />
                    <p className="text-xs text-v3-text-muted text-center mt-1">Hours</p>
                  </div>
                  {selected[job.id] && selected[job.id].hours && selected[job.id].rate && (
                    <div className="w-20 text-right">
                      <p className="text-sm font-semibold text-v3-orange">
                        £{((parseFloat(selected[job.id].hours) || 0) * (parseFloat(selected[job.id].rate) || 0)).toFixed(2)}
                      </p>
                      <p className="text-xs text-v3-text-muted">Subtotal</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invoice Summary */}
      <div className="dashboard-card p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-v3-text-lightest">Invoice Summary</h3>
              <p className="text-sm text-v3-text-muted">
                {Object.keys(selected).length} job{Object.keys(selected).length !== 1 ? 's' : ''} selected
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-v3-text-muted">Total Amount</p>
              <p className="text-3xl font-bold text-v3-orange">£{totalAmount.toFixed(2)}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-v3-text-lightest mb-2">
                Your Invoice Number *
              </label>
              <input
                type="text"
                placeholder="e.g., INV-001"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-v3-bg-input border border-v3-border rounded-md shadow-sm py-3 px-4 text-v3-text-lightest focus:outline-none focus:ring-2 focus:ring-v3-orange focus:border-v3-orange"
              />
            </div>
            
            <button 
              onClick={handleReviewInvoice} 
              className="button-refresh px-8 py-3 min-w-[200px]" 
              disabled={totalAmount === 0 || creating || !invoiceNumber.trim()}
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creating Invoice...
                </>
              ) : (
                'Create Invoice'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Debug Information - only in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="dashboard-card p-4 border border-yellow-600">
          <h3 className="text-lg font-bold text-yellow-400 mb-2">Debug Information</h3>
          <p className="text-sm text-v3-text-muted">
            Jobs fetched: {jobs.length} | Selected: {Object.keys(selected).length}
          </p>
          <p className="text-sm text-v3-text-muted">
            Endpoint: {jobs.some(j => j.__force_endpoint) ? '/agent/force-invoiceable-jobs (fallback)' : '/agent/jobs?invoiced=false'}
          </p>
          <details className="mt-2">
            <summary className="text-sm text-v3-text-muted cursor-pointer">Raw job data</summary>
            <pre className="text-xs text-v3-text-muted mt-2 overflow-auto max-h-40">
              {JSON.stringify(jobs, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default CreateInvoiceFromJobs;