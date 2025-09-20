import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, AlertCircle, CheckSquare, Square, Plus, Trash2 } from 'lucide-react';

const CreateInvoiceTimeEntries = () => {
  const { apiCall, user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // State for time entries: { jobId: { entries: [{ work_date, hours, rate_net, notes }] } }
  const [timeEntries, setTimeEntries] = useState({});

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
    setTimeEntries(prev => {
      const newEntries = { ...prev };
      if (newEntries[job.id]) {
        delete newEntries[job.id]; // Remove job
      } else {
        // Add job with one default entry for today
        const today = new Date().toISOString().split('T')[0];
        newEntries[job.id] = {
          job: job,
          entries: [{
            work_date: today,
            hours: '',
            rate_net: '',
            notes: ''
          }]
        };
      }
      return newEntries;
    });
  };

  const addTimeEntry = (jobId) => {
    setTimeEntries(prev => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        entries: [
          ...prev[jobId].entries,
          {
            work_date: new Date().toISOString().split('T')[0],
            hours: '',
            rate_net: '',
            notes: ''
          }
        ]
      }
    }));
  };

  const removeTimeEntry = (jobId, entryIndex) => {
    setTimeEntries(prev => {
      const updated = { ...prev };
      updated[jobId].entries = updated[jobId].entries.filter((_, index) => index !== entryIndex);

      // If no entries left, remove the job entirely
      if (updated[jobId].entries.length === 0) {
        delete updated[jobId];
      }

      return updated;
    });
  };

  const updateTimeEntry = (jobId, entryIndex, field, value) => {
    // Validate numeric fields
    if ((field === 'hours' || field === 'rate_net') && !/^\d*\.?\d*$/.test(value)) {
      return;
    }

    setTimeEntries(prev => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        entries: prev[jobId].entries.map((entry, index) =>
          index === entryIndex ? { ...entry, [field]: value } : entry
        )
      }
    }));
  };

  const totalAmount = useMemo(() => {
    return Object.values(timeEntries).reduce((jobAcc, jobData) => {
      return jobAcc + jobData.entries.reduce((entryAcc, entry) => {
        const hours = parseFloat(entry.hours) || 0;
        const rate = parseFloat(entry.rate_net) || 0;
        return entryAcc + (hours * rate);
      }, 0);
    }, 0);
  }, [timeEntries]);

  const totalHours = useMemo(() => {
    return Object.values(timeEntries).reduce((jobAcc, jobData) => {
      return jobAcc + jobData.entries.reduce((entryAcc, entry) => {
        return entryAcc + (parseFloat(entry.hours) || 0);
      }, 0);
    }, 0);
  }, [timeEntries]);

  const showVat = !!(user?.vat_number);
  const VAT_RATE = 0.20;
  const vatAmount = useMemo(() => showVat ? totalAmount * VAT_RATE : 0, [showVat, totalAmount]);
  const grandTotal = useMemo(() => totalAmount + vatAmount, [totalAmount, vatAmount]);

  const handleSubmitInvoice = () => {
    // Validate and prepare time entries
    const timeEntriesToSubmit = [];

    for (const [jobId, jobData] of Object.entries(timeEntries)) {
      const validEntries = jobData.entries.filter(entry => {
        const hasDate = entry.work_date;
        const hasHours = parseFloat(entry.hours) > 0;
        const hasRate = parseFloat(entry.rate_net) > 0;
        return hasDate && hasHours && hasRate;
      });

      if (validEntries.length > 0) {
        timeEntriesToSubmit.push({
          jobId: parseInt(jobId),
          entries: validEntries.map(entry => ({
            work_date: entry.work_date,
            hours: parseFloat(entry.hours),
            rate_net: parseFloat(entry.rate_net),
            notes: entry.notes || ''
          }))
        });
      }
    }

    if (timeEntriesToSubmit.length === 0) {
      toast.error("No valid time entries", {
        description: "Please add at least one complete time entry with date, hours, and rate."
      });
      return;
    }

    // Submit to backend using new time_entries format
    console.log("Time entries to be submitted:", {
      time_entries: timeEntriesToSubmit,
      total: grandTotal
    });

    apiCall('/agent/invoice', {
      method: 'POST',
      body: JSON.stringify({ time_entries: timeEntriesToSubmit })
    }).then(() => {
      toast.success("Invoice submitted", {
        description: `${totalHours} hours, £${grandTotal.toFixed(2)} total`
      });
      navigate('/agent/invoices');
    }).catch(err => {
      toast.error('Failed to create invoice', { description: err.message });
    });
  };

  if (loading) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/agent/invoices" className="text-gray-600 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-800">Create Invoice with Time Entries</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Available Jobs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Available Jobs</h2>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-2 text-gray-400" />
                <p>No completed jobs available for invoicing</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map(job => (
                  <div key={job.id} className="border rounded-lg p-4">
                    <div
                      className="flex items-start gap-3 cursor-pointer"
                      onClick={() => handleToggleJob(job)}
                    >
                      {timeEntries[job.id] ? (
                        <CheckSquare className="h-5 w-5 text-v3-orange mt-1 flex-shrink-0" />
                      ) : (
                        <Square className="h-5 w-5 text-gray-400 mt-1 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900">{job.title}</h3>
                        <p className="text-sm text-gray-600">{job.address}</p>
                        <p className="text-sm text-gray-500">
                          {new Date(job.arrival_time).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Time Entries for this job */}
                    {timeEntries[job.id] && (
                      <div className="mt-4 pl-8 space-y-3">
                        <h4 className="text-sm font-medium text-gray-700">Time Entries:</h4>
                        {timeEntries[job.id].entries.map((entry, entryIndex) => (
                          <div key={entryIndex} className="bg-gray-50 p-3 rounded border">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Date
                                </label>
                                <input
                                  type="date"
                                  value={entry.work_date}
                                  onChange={(e) => updateTimeEntry(job.id, entryIndex, 'work_date', e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-v3-orange focus:border-v3-orange"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Hours
                                </label>
                                <input
                                  type="text"
                                  placeholder="8.0"
                                  value={entry.hours}
                                  onChange={(e) => updateTimeEntry(job.id, entryIndex, 'hours', e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-v3-orange focus:border-v3-orange"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                  Rate (£/hr)
                                </label>
                                <input
                                  type="text"
                                  placeholder="25.00"
                                  value={entry.rate_net}
                                  onChange={(e) => updateTimeEntry(job.id, entryIndex, 'rate_net', e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-v3-orange focus:border-v3-orange"
                                />
                              </div>
                              <div className="flex items-end">
                                <button
                                  onClick={() => removeTimeEntry(job.id, entryIndex)}
                                  className="px-2 py-1 text-red-600 hover:bg-red-50 rounded text-sm"
                                  title="Remove this time entry"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            <div className="mt-2">
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Notes (optional)
                              </label>
                              <input
                                type="text"
                                placeholder="Additional notes for this day..."
                                value={entry.notes}
                                onChange={(e) => updateTimeEntry(job.id, entryIndex, 'notes', e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-v3-orange focus:border-v3-orange"
                              />
                            </div>
                            {entry.hours && entry.rate_net && (
                              <div className="mt-2 text-xs text-gray-600">
                                Line total: £{(parseFloat(entry.hours) * parseFloat(entry.rate_net)).toFixed(2)}
                              </div>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => addTimeEntry(job.id)}
                          className="flex items-center gap-2 text-sm text-v3-orange hover:text-v3-orange-dark"
                        >
                          <Plus className="h-4 w-4" />
                          Add another day
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow p-6 sticky top-6">
            <h2 className="text-lg font-semibold mb-4">Invoice Summary</h2>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total Hours:</span>
                <span className="font-medium">{totalHours.toFixed(1)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span>Subtotal:</span>
                <span className="font-medium">£{totalAmount.toFixed(2)}</span>
              </div>

              {showVat && (
                <div className="flex justify-between text-sm">
                  <span>VAT (20%):</span>
                  <span className="font-medium">£{vatAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="border-t pt-3">
                <div className="flex justify-between text-base font-semibold">
                  <span>Total:</span>
                  <span>£{grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmitInvoice}
              disabled={Object.keys(timeEntries).length === 0}
              className="w-full mt-6 bg-v3-orange text-white py-2 px-4 rounded-md hover:bg-v3-orange-dark disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              Submit Invoice
            </button>

            <p className="text-xs text-gray-500 mt-2 text-center">
              Invoice will be generated and emailed automatically
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoiceTimeEntries;