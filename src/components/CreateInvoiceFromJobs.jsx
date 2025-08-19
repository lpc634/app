import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertCircle, CheckSquare, Square } from 'lucide-react';

const CreateInvoiceFromJobs = () => {
  const { apiCall } = useAuth();
  const navigate = useNavigate();
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
        const data = await apiCall('/agent/invoiceable-jobs');
        setJobs(data);
      } catch (error) {
        toast.error('Failed to load invoiceable jobs', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [apiCall]);

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
    const itemsToInvoice = Object.entries(selected)
      .filter(([_, job]) => parseFloat(job.hours) > 0 && parseFloat(job.rate) > 0)
      .map(([jobId, jobData]) => ({
        jobId: parseInt(jobId),
        hours: parseFloat(jobData.hours),
        rate: parseFloat(jobData.rate)
      }));

    if (itemsToInvoice.length === 0) {
      toast.error("No jobs selected", { description: "Please select at least one job and enter the hours and rate." });
      return;
    }

    if (!invoiceNumber.trim()) {
      toast.error("Invoice number required", { description: "Please enter your invoice number." });
      return;
    }

    try {
      setCreating(true);
      
      // Call the invoice creation endpoint
      const response = await apiCall('/agent/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: itemsToInvoice,
          agent_invoice_number: invoiceNumber.trim()
        })
      });

      toast.success("Invoice created successfully!", { 
        description: `Invoice ${response.invoice_number} has been generated.` 
      });

      // Navigate back to invoices page
      navigate('/agent/invoices');
      
    } catch (error) {
      console.error('Invoice creation error:', error);
      toast.error('Failed to create invoice', { 
        description: error.message || 'An error occurred while creating the invoice.'
      });
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/agent/invoices/new" className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors w-fit mb-4">
          <ArrowLeft size={20} />
          <span>Back to Invoice Type Selection</span>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice from Jobs</h1>
        <p className="text-muted-foreground">Select completed jobs and enter the hours worked for each.</p>
      </div>
      
      <div className="dashboard-card p-0">
         <div className="p-6">
            <h2 className="text-xl font-bold text-v3-text-lightest">Uninvoiced Jobs</h2>
        </div>
        
        {jobs.length === 0 ? (
          <div className="text-center p-12 border-t border-v3-border space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-v3-text-muted mb-4" />
            <h3 className="text-lg font-medium text-v3-text-lightest">No Jobs to Invoice</h3>
            <p className="text-v3-text-muted mt-1">You have no completed jobs that are pending an invoice.</p>
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
          <div className="divide-y divide-v3-border border-t border-v3-border">
            {jobs.map(job => (
              <div key={job.id} className={`p-4 flex flex-col md:flex-row items-start md:items-center gap-4 ${selected[job.id] ? 'bg-v3-bg-dark' : ''}`}>
                <div className="flex items-center gap-4 flex-shrink-0 cursor-pointer" onClick={() => handleToggleJob(job)}>
                  {selected[job.id] ? <CheckSquare className="w-6 h-6 text-v3-orange" /> : <Square className="w-6 h-6 text-v3-text-muted" />}
                  <div>
                    <p className="font-semibold text-v3-text-lightest">{job.address}</p>
                    <p className="text-sm text-v3-text-muted">Completed: {new Date(job.arrival_time).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
                <div className="flex-grow flex items-center justify-end gap-2 w-full md:w-auto">
                    <div className="w-20">
                       <input
                          type="text"
                          placeholder="£/hr"
                          value={selected[job.id]?.rate || ''}
                          onChange={(e) => handleRateChange(job.id, e.target.value)}
                          disabled={!selected[job.id]}
                          className="w-full text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-2 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange disabled:bg-v3-bg-card disabled:opacity-50 text-sm"
                        />
                        <p className="text-xs text-v3-text-muted text-center mt-1">Rate</p>
                    </div>
                    <div className="w-20">
                       <input
                          type="text"
                          placeholder="Hours"
                          value={selected[job.id]?.hours || ''}
                          onChange={(e) => handleHoursChange(job.id, e.target.value)}
                          disabled={!selected[job.id]}
                          className="w-full text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-2 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange disabled:bg-v3-bg-card disabled:opacity-50 text-sm"
                        />
                        <p className="text-xs text-v3-text-muted text-center mt-1">Hours</p>
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-semibold text-v3-text-lightest">Invoice Total:</p>
            <p className="text-2xl font-bold text-v3-orange">£{totalAmount.toFixed(2)}</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <label className="text-sm font-medium text-v3-text-lightest whitespace-nowrap">
              Your Invoice Number:
            </label>
            <input
              type="text"
              placeholder="Enter invoice number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="flex-1 bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
          <button 
            onClick={handleReviewInvoice} 
            className="button-refresh w-full sm:w-auto" 
            disabled={totalAmount === 0 || creating}
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
  );
};

export default CreateInvoiceFromJobs;
