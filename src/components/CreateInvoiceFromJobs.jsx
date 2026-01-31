import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertCircle, CheckSquare, Square, Plus, Trash2 } from 'lucide-react';

const CreateInvoiceFromJobs = () => {
  const { apiCall, user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // State to track selected jobs: { jobId: { rate: '', days: [{ date: '', hours: '' }] } }
  const [selected, setSelected] = useState({});

  // State for custom invoice number (agents can specify their own numbering)
  const [customInvoiceNumber, setCustomInvoiceNumber] = useState('');

  // State for suggested next invoice number (fetched from backend)
  const [suggestedInvoiceNumber, setSuggestedInvoiceNumber] = useState(null);

  // State for First Hour Premium charge (Lance Carstairs only)
  const [firstHourRate, setFirstHourRate] = useState('');

  // State for Extra Agents Onsite bonus (Lance Carstairs only - £5/hr per extra agent)
  const [extraAgentsCount, setExtraAgentsCount] = useState('');

  // State for Extras (Lance Carstairs only - additional charges with description)
  const [extrasAmount, setExtrasAmount] = useState('');
  const [extrasDescription, setExtrasDescription] = useState('');

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

  // Fetch suggested next invoice number for this agent
  useEffect(() => {
    const fetchSuggestedNumber = async () => {
      try {
        const data = await apiCall('/agent/next-invoice-number');
        setSuggestedInvoiceNumber(data.suggested);
      } catch (error) {
        console.error('Failed to fetch suggested invoice number:', error);
      }
    };
    fetchSuggestedNumber();
  }, [apiCall]);

  const handleToggleJob = (job) => {
    setSelected(prev => {
      const newSelected = { ...prev };
      if (newSelected[job.id]) {
        delete newSelected[job.id]; // Uncheck
      } else {
        // Default first day to the job's arrival date
        const jobDate = job.arrival_time ? job.arrival_time.split('T')[0] : new Date().toISOString().split('T')[0];
        newSelected[job.id] = { rate: '', days: [{ date: jobDate, hours: '' }] };
      }
      return newSelected;
    });
  };

  const handleRateChange = (jobId, rate) => {
    if (/^\d*\.?\d*$/.test(rate)) {
      setSelected(prev => ({
        ...prev,
        [jobId]: { ...prev[jobId], rate: rate }
      }));
    }
  };

  const handleDayDateChange = (jobId, dayIndex, date) => {
    setSelected(prev => {
      const job = { ...prev[jobId] };
      const days = [...job.days];
      days[dayIndex] = { ...days[dayIndex], date };
      return { ...prev, [jobId]: { ...job, days } };
    });
  };

  const handleDayHoursChange = (jobId, dayIndex, hours) => {
    if (/^\d*\.?\d*$/.test(hours)) {
      setSelected(prev => {
        const job = { ...prev[jobId] };
        const days = [...job.days];
        days[dayIndex] = { ...days[dayIndex], hours };
        return { ...prev, [jobId]: { ...job, days } };
      });
    }
  };

  const handleAddDay = (jobId) => {
    setSelected(prev => {
      const jobData = { ...prev[jobId] };
      const days = [...jobData.days];
      // Default new day to day after the last entry
      const lastDate = days[days.length - 1]?.date;
      let nextDate = '';
      if (lastDate) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + 1);
        nextDate = d.toISOString().split('T')[0];
      }
      days.push({ date: nextDate, hours: '' });
      return { ...prev, [jobId]: { ...jobData, days } };
    });
  };

  const handleRemoveDay = (jobId, dayIndex) => {
    setSelected(prev => {
      const jobData = { ...prev[jobId] };
      const days = [...jobData.days];
      days.splice(dayIndex, 1);
      return { ...prev, [jobId]: { ...jobData, days } };
    });
  };

  const handleInvoiceNumberChange = (value) => {
    if (/^\d*$/.test(value)) {
      setCustomInvoiceNumber(value);
    }
  };

  const handleFirstHourRateChange = (value) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setFirstHourRate(value);
    }
  };

  const handleExtraAgentsChange = (value) => {
    if (/^\d*$/.test(value)) {
      setExtraAgentsCount(value);
    }
  };

  const handleExtrasAmountChange = (value) => {
    if (/^\d*\.?\d*$/.test(value)) {
      setExtrasAmount(value);
    }
  };

  // Calculate total hours from all selected jobs and all days
  const totalHours = useMemo(() => {
    return Object.values(selected).reduce((acc, job) => {
      const jobHours = job.days.reduce((dayAcc, day) => dayAcc + (parseFloat(day.hours) || 0), 0);
      return acc + jobHours;
    }, 0);
  }, [selected]);

  // Calculate extra agents bonus (£5/hr per extra agent × remaining hours after first hour)
  const EXTRA_AGENT_RATE = 5;
  const extraAgentsBonus = useMemo(() => {
    const agents = parseInt(extraAgentsCount) || 0;
    const firstHourFee = parseFloat(firstHourRate) || 0;
    const hoursForBonus = firstHourFee > 0 ? Math.max(0, totalHours - 1) : totalHours;
    return agents * EXTRA_AGENT_RATE * hoursForBonus;
  }, [extraAgentsCount, totalHours, firstHourRate]);

  const totalAmount = useMemo(() => {
    const firstHourFee = parseFloat(firstHourRate) || 0;
    const hasFirstHourPremium = firstHourFee > 0;

    // Calculate jobs total from all days
    const jobsTotal = Object.values(selected).reduce((acc, job) => {
      const rate = parseFloat(job.rate) || 0;
      const jobHours = job.days.reduce((dayAcc, day) => dayAcc + (parseFloat(day.hours) || 0), 0);
      return acc + (jobHours * rate);
    }, 0);

    // If First Hour Premium is used, subtract 1 hour worth of the standard rate
    let adjustedJobsTotal = jobsTotal;
    if (hasFirstHourPremium && totalHours >= 1) {
      const selectedJobs = Object.values(selected).filter(j => parseFloat(j.rate) > 0 && j.days.some(d => parseFloat(d.hours) > 0));
      if (selectedJobs.length > 0) {
        const firstJobRate = parseFloat(selectedJobs[0].rate) || 0;
        adjustedJobsTotal = jobsTotal - firstJobRate;
      }
    }

    const extras = parseFloat(extrasAmount) || 0;
    return (hasFirstHourPremium ? firstHourFee : 0) + adjustedJobsTotal + extraAgentsBonus + extras;
  }, [selected, firstHourRate, extraAgentsBonus, totalHours, extrasAmount]);

  const showVat = !!(user?.vat_number);
  const VAT_RATE = 0.20;
  const vatAmount = useMemo(() => showVat ? totalAmount * VAT_RATE : 0, [showVat, totalAmount]);
  const grandTotal = useMemo(() => totalAmount + vatAmount, [totalAmount, vatAmount]);

  const handleReviewInvoice = () => {
    // Build time_entries format for multi-day support
    const timeEntries = [];

    Object.entries(selected).forEach(([jobId, jobData]) => {
      const rate = parseFloat(jobData.rate);
      if (!rate || rate <= 0) return;

      const entries = jobData.days
        .filter(day => parseFloat(day.hours) > 0 && day.date)
        .map(day => ({
          work_date: day.date,
          hours: parseFloat(day.hours),
          rate_net: rate,
          notes: ''
        }));

      if (entries.length > 0) {
        timeEntries.push({
          jobId: parseInt(jobId),
          entries
        });
      }
    });

    if (timeEntries.length === 0) {
      toast.error("No jobs selected", { description: "Please select at least one job and enter a rate and hours for each day." });
      return;
    }

    // Build the payload using time_entries format
    const payload = { time_entries: timeEntries };

    // Include custom invoice number if provided
    if (customInvoiceNumber && parseInt(customInvoiceNumber) > 0) {
      payload.custom_invoice_number = parseInt(customInvoiceNumber);
    }

    // Include First Hour Premium charge if applicable
    const firstHourFee = parseFloat(firstHourRate);
    if (firstHourFee && firstHourFee > 0) {
      payload.first_hour_rate = firstHourFee;
    }

    // Include Extra Agents Bonus if applicable
    const extraAgents = parseInt(extraAgentsCount);
    if (extraAgents && extraAgents > 0) {
      payload.extra_agents_count = extraAgents;
      const hoursForBonus = firstHourFee > 0 ? Math.max(0, totalHours - 1) : totalHours;
      payload.extra_agents_total_hours = hoursForBonus;
    }

    // Include Extras if applicable
    const extras = parseFloat(extrasAmount);
    if (extras && extras > 0) {
      payload.extras_amount = extras;
      payload.extras_description = extrasDescription.trim() || 'Additional charges';
    }

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

  // Helper to get total hours for a specific job
  const getJobTotalHours = (jobData) => {
    return jobData.days.reduce((acc, day) => acc + (parseFloat(day.hours) || 0), 0);
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
        <p className="text-muted-foreground">Select completed jobs and enter the hours worked for each day.</p>
      </div>

      <div className="dashboard-card p-0">
         <div className="p-6 border-b border-v3-border">
            <h2 className="text-xl font-bold text-v3-text-lightest mb-4">Uninvoiced Jobs</h2>
            <div className="flex items-end gap-4 justify-end">
              <div className="w-32">
                <label htmlFor="invoice-number" className="block text-sm font-medium text-v3-text-muted mb-1">Invoice #</label>
                <input
                  id="invoice-number"
                  type="text"
                  placeholder={suggestedInvoiceNumber ? `e.g., ${suggestedInvoiceNumber}` : "e.g., 337"}
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
              <div key={job.id} className={`p-4 ${selected[job.id] ? 'bg-v3-bg-dark' : ''}`}>
                {/* Job header row - checkbox, address, rate */}
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                  <div className="flex items-center gap-4 flex-shrink-0 cursor-pointer" onClick={() => handleToggleJob(job)}>
                    {selected[job.id] ? <CheckSquare className="w-6 h-6 text-v3-orange" /> : <Square className="w-6 h-6 text-v3-text-muted" />}
                    <div>
                      <p className="font-semibold text-v3-text-lightest">{job.address}</p>
                      <p className="text-sm text-v3-text-muted">Job Date: {new Date(job.arrival_time).toLocaleDateString('en-GB')}</p>
                    </div>
                  </div>
                  {selected[job.id] && (
                    <div className="flex items-center gap-2 ml-auto">
                      <label className="text-sm text-v3-text-muted">Rate (£/hr):</label>
                      <input
                        type="text"
                        placeholder="0.00"
                        value={selected[job.id]?.rate || ''}
                        onChange={(e) => handleRateChange(job.id, e.target.value)}
                        className="w-24 text-center bg-v3-bg-dark border border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                      />
                    </div>
                  )}
                </div>

                {/* Day entries */}
                {selected[job.id] && (
                  <div className="mt-3 ml-10 space-y-2">
                    {selected[job.id].days.map((day, dayIndex) => (
                      <div key={dayIndex} className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium text-v3-text-muted w-14">Day {dayIndex + 1}:</span>
                        <input
                          type="date"
                          value={day.date || ''}
                          onChange={(e) => handleDayDateChange(job.id, dayIndex, e.target.value)}
                          className="bg-v3-bg-dark border border-v3-border rounded-md shadow-sm py-1.5 px-3 text-sm text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                        />
                        <input
                          type="text"
                          placeholder="Hours"
                          value={day.hours || ''}
                          onChange={(e) => handleDayHoursChange(job.id, dayIndex, e.target.value)}
                          className="w-20 text-center bg-v3-bg-dark border border-v3-border rounded-md shadow-sm py-1.5 px-3 text-sm text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                        />
                        <span className="text-sm text-v3-text-muted">hrs</span>
                        {selected[job.id].days.length > 1 && (
                          <button
                            onClick={() => handleRemoveDay(job.id, dayIndex)}
                            className="text-red-500 hover:text-red-400 p-1"
                            title="Remove day"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddDay(job.id)}
                      className="flex items-center gap-1.5 text-sm text-v3-orange hover:text-orange-400 mt-1 py-1"
                    >
                      <Plus size={16} />
                      Add Day
                    </button>
                    {/* Job hours subtotal */}
                    {selected[job.id].days.length > 1 && (
                      <p className="text-sm text-v3-text-muted mt-1">
                        Total: {getJobTotalHours(selected[job.id])} hrs × £{selected[job.id].rate || '0'} = £{(getJobTotalHours(selected[job.id]) * (parseFloat(selected[job.id].rate) || 0)).toFixed(2)}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-card p-4">
        {/* First Hour Premium Rate - Only for Lance Carstairs */}
        {user && (user.first_name === 'Lance' && user.last_name === 'Carstairs') && (
          <div className="mb-3 pb-3 border-b border-v3-border">
            <div className="flex items-center justify-between">
              <label htmlFor="first-hour-rate" className="text-lg font-semibold text-v3-text-lightest">
                First Hour Rate:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-v3-text-muted">£</span>
                <input
                  id="first-hour-rate"
                  type="text"
                  placeholder="0.00"
                  value={firstHourRate}
                  onChange={(e) => handleFirstHourRateChange(e.target.value)}
                  className="w-24 text-right bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                />
              </div>
            </div>
            <p className="text-xs text-v3-text-muted mt-2">
              Enter your total hours worked above. The first hour will be charged at this premium rate, remaining hours at your standard rate.
            </p>
          </div>
        )}

        {/* Extra Agents Onsite Bonus - Only for Lance Carstairs */}
        {user && (user.first_name === 'Lance' && user.last_name === 'Carstairs') && (
          <div className="mb-3 pb-3 border-b border-v3-border">
            <div className="flex items-center justify-between">
              <label htmlFor="extra-agents" className="text-lg font-semibold text-v3-text-lightest">
                Extra Agents Onsite:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="extra-agents"
                  type="text"
                  placeholder="0"
                  value={extraAgentsCount}
                  onChange={(e) => handleExtraAgentsChange(e.target.value)}
                  className="w-16 text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                />
                <span className="text-v3-text-muted">agents</span>
              </div>
            </div>
            {extraAgentsBonus > 0 && (
              <p className="text-sm text-v3-orange mt-2">
                Bonus: {extraAgentsCount} agent{parseInt(extraAgentsCount) !== 1 ? 's' : ''} × £5/hr × {parseFloat(firstHourRate) > 0 ? Math.max(0, totalHours - 1) : totalHours} hrs = £{extraAgentsBonus.toFixed(2)}
              </p>
            )}
            <p className="text-xs text-v3-text-muted mt-1">
              £5 per hour per extra agent will be added as a separate line item.
            </p>
          </div>
        )}

        {/* Extras - Only for Lance Carstairs */}
        {user && (user.first_name === 'Lance' && user.last_name === 'Carstairs') && (
          <div className="mb-3 pb-3 border-b border-v3-border">
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="extras-amount" className="text-lg font-semibold text-v3-text-lightest">
                Extras:
              </label>
              <div className="flex items-center gap-2">
                <span className="text-v3-text-muted">£</span>
                <input
                  id="extras-amount"
                  type="text"
                  placeholder="0.00"
                  value={extrasAmount}
                  onChange={(e) => handleExtrasAmountChange(e.target.value)}
                  className="w-24 text-right bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                />
              </div>
            </div>
            <div>
              <input
                id="extras-description"
                type="text"
                placeholder="Brief description (e.g., Performance bonus, Equipment hire)"
                value={extrasDescription}
                onChange={(e) => setExtrasDescription(e.target.value)}
                className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange text-sm"
              />
            </div>
            <p className="text-xs text-v3-text-muted mt-2">
              Any additional charges will appear as a separate line item on your invoice.
            </p>
          </div>
        )}

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
