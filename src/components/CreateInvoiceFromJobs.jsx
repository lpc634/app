import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertCircle, CheckSquare, Square } from 'lucide-react';

const CreateInvoiceFromJobs = () => {
  const { apiCall, user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // State to track selected jobs and their hours, e.g., { jobId: { hours: 8, rate: 25.50 }, ... }
  const [selected, setSelected] = useState({});

  // State for custom invoice number (agents can specify their own numbering)
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');

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
        newSelected[job.id] = { hours: '', rate: '' }; // Check - agent must input their own rate
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

  const handleInvoiceNumberChange = (value) => {
    // Allow only positive integers
    if (/^\d*$/.test(value)) {
      setCustomInvoiceNumber(value);
    }
  };

  const totalAmount = useMemo(() => {
    return Object.values(selected).reduce((acc, job) => {
      const hours = parseFloat(job.hours) || 0;
      const rate = parseFloat(job.rate) || 0;
      return acc + (hours * rate);
    }, 0);
  }, [selected]);

  const showVat = !!(user?.vat_number);
  const VAT_RATE = 0.20;
  const vatAmount = useMemo(() => showVat ? totalAmount * VAT_RATE : 0, [showVat, totalAmount]);
  const grandTotal = useMemo(() => totalAmount + vatAmount, [totalAmount, vatAmount]);

  const handleReviewInvoice = () => {
    const itemsToInvoice = Object.entries(selected)
      .filter(([_, job]) => parseFloat(job.hours) > 0 && parseFloat(job.rate) > 0)
      .map(([jobId, jobData]) => ({
        jobId: parseInt(jobId),
        hours: parseFloat(jobData.hours),
        rate: parseFloat(jobData.rate)
      }));

    if (itemsToInvoice.length === 0) {
      toast.error("No jobs selected", { description: "Please select at least one job and enter both hours worked and your rate." });
      return;
    }

    // Build the payload
    const payload = { items: itemsToInvoice };

    // Include custom invoice number if provided
    if (customInvoiceNumber && parseInt(customInvoiceNumber) > 0) {
      payload.custom_invoice_number = parseInt(customInvoiceNumber);
    }

    // Submit to backend to create invoice
    console.log("Invoice data to be reviewed:", {
      ...payload,
      total: grandTotal
    });
    apiCall('/agent/invoice', {
      method: 'POST',
      body: JSON.stringify(payload)
    }).then(() => {
      toast.success("Invoice submitted", { description: `Total £${grandTotal.toFixed(2)}`});
      navigate('/agent/invoices');
    }).catch(err => {
      toast.error('Failed to create invoice', { description: err.message });
    });
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
         <div className="p-6 border-b border-v3-border">
            <h2 className="text-xl font-bold text-v3-text-lightest mb-4">Uninvoiced Jobs</h2>
            <div className="flex items-end gap-4 justify-end">
              <div className="w-24">
                <label className="block text-sm font-medium text-v3-text-muted mb-1">Rate (£/h)</label>
              </div>
              <div className="w-24">
                <label className="block text-sm font-medium text-v3-text-muted mb-1">Hours</label>
              </div>
              <div className="w-32">
                <label htmlFor="invoice-number" className="block text-sm font-medium text-v3-text-muted mb-1">Invoice #</label>
                <input
                  id="invoice-number"
                  type="text"
                  placeholder="e.g., 337"
                  value={customInvoiceNumber}
                  onChange={(e) => handleInvoiceNumberChange(e.target.value)}
                  className="w-full text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                />
              </div>
            </div>
        </div>

        {jobs.length === 0 ? (
          <div className="text-center p-12">
            <AlertCircle className="mx-auto h-12 w-12 text-v3-text-muted mb-4" />
            <h3 className="text-lg font-medium text-v3-text-lightest">No Jobs to Invoice</h3>
            <p className="text-v3-text-muted mt-1">You have no completed jobs that are pending an invoice.</p>
          </div>
        ) : (
          <div className="divide-y divide-v3-border">
            {jobs.map(job => (
              <div key={job.id} className={`p-4 flex flex-col md:flex-row items-start md:items-center gap-4 ${selected[job.id] ? 'bg-v3-bg-dark' : ''}`}>
                <div className="flex items-center gap-4 flex-shrink-0 cursor-pointer" onClick={() => handleToggleJob(job)}>
                  {selected[job.id] ? <CheckSquare className="w-6 h-6 text-v3-orange" /> : <Square className="w-6 h-6 text-v3-text-muted" />}
                  <div>
                    <p className="font-semibold text-v3-text-lightest">{job.address}</p>
                    <p className="text-sm text-v3-text-muted">Completed: {new Date(job.arrival_time).toLocaleDateString('en-GB')}</p>
                  </div>
                </div>
                <div className="flex-grow flex items-center justify-end gap-4 w-full md:w-auto">
                    <div className="w-24">
                       <input
                          type="text"
                          placeholder="Rate (£/hr)"
                          value={selected[job.id]?.rate || ''}
                          onChange={(e) => handleRateChange(job.id, e.target.value)}
                          disabled={!selected[job.id]}
                          className="w-full text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange disabled:bg-v3-bg-card disabled:opacity-50"
                        />
                    </div>
                    <div className="w-24">
                       <input
                          type="text"
                          placeholder="Hours"
                          value={selected[job.id]?.hours || ''}
                          onChange={(e) => handleHoursChange(job.id, e.target.value)}
                          disabled={!selected[job.id]}
                          className="w-full text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange disabled:bg-v3-bg-card disabled:opacity-50"
                        />
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card p-4">
        <div className="flex items-center justify-between">
          <p className="text-lg font-semibold text-v3-text-lightest">Subtotal:</p>
          <p className="text-xl font-bold text-v3-text-lightest">£{totalAmount.toFixed(2)}</p>
        </div>
        {showVat && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-lg font-semibold text-v3-text-lightest">VAT 20%:</p>
            <p className="text-xl font-bold text-v3-text-lightest">£{vatAmount.toFixed(2)}</p>
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <p className="text-lg font-semibold text-v3-text-lightest">Grand Total:</p>
          <p className="text-2xl font-bold text-v3-orange">£{grandTotal.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex justify-end">
          <button onClick={handleReviewInvoice} className="button-refresh w-full sm:w-auto" disabled={totalAmount === 0}>
              Review Invoice
          </button>
      </div>

    </div>
  );
};

export default CreateInvoiceFromJobs;