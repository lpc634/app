import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../useAuth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, AlertCircle, CheckSquare, Square, 
  Briefcase, CheckCircle, PoundSterling, Search, Calendar, 
  MapPin, Clock, Check, FileText, User
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-v3-orange mb-4" />
          <p className="text-gray-600 font-medium">Loading your jobs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header Section */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <Link to="/agent/invoices/new" className="inline-flex items-center space-x-2 text-gray-600 hover:text-v3-orange transition-colors mb-3">
                <ArrowLeft size={20} />
                <span className="font-medium">Back to Invoice Options</span>
              </Link>
              <h1 className="text-3xl font-bold text-gray-900">Create Invoice from Jobs</h1>
              <p className="text-gray-600 mt-1">Select completed jobs and specify hours to generate your invoice</p>
            </div>
            
            {/* Progress Indicator */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-v3-orange text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <span className="text-sm font-medium text-gray-700">Select Jobs</span>
              </div>
              <div className="w-8 h-px bg-gray-300"></div>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gray-300 text-gray-500 rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <span className="text-sm font-medium text-gray-500">Create Invoice</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
        {/* Stats Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Available Jobs</p>
                  <p className="text-3xl font-bold">{filteredJobs.length}</p>
                </div>
                <Briefcase className="h-10 w-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-green-500 to-green-600 border-0 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Selected Jobs</p>
                  <p className="text-3xl font-bold">{getSelectedJobsCount()}</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 border-0 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Estimated Total</p>
                  <p className="text-3xl font-bold">£{totalAmount.toFixed(2)}</p>
                </div>
                <PoundSterling className="h-10 w-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search by address or job type..."
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange transition-colors"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select 
                className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange bg-white text-gray-700"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">All Jobs</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="older">Older Jobs</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Jobs Grid */}
        {filteredJobs.length === 0 ? (
          <Card className="text-center py-16">
            <CardContent>
              <Briefcase className="mx-auto h-16 w-16 text-gray-400 mb-6" />
              <h3 className="text-xl font-semibold text-gray-900 mb-3">
                {jobs.length === 0 ? 'No Uninvoiced Jobs' : 'No Matching Jobs'}
              </h3>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                {jobs.length === 0 
                  ? 'All your completed jobs have been invoiced. Great work!' 
                  : 'Try adjusting your search terms or filters to find more jobs.'
                }
              </p>
              <div className="flex justify-center gap-4">
                <Link to="/agent/invoices/new/misc">
                  <Button className="bg-v3-orange hover:bg-orange-600 text-white">
                    Create Miscellaneous Invoice
                  </Button>
                </Link>
                <Link to="/agent/invoices/new">
                  <Button variant="outline">
                    Back to Options
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredJobs.map(job => (
              <Card
                key={job.id}
                className={`cursor-pointer transition-all duration-200 hover:shadow-lg ${
                  isJobSelected(job.id) 
                    ? 'ring-2 ring-v3-orange bg-orange-50 shadow-lg transform scale-[1.02]' 
                    : 'hover:shadow-md border-gray-200 bg-white'
                }`}
                onClick={() => handleJobToggle(job)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <MapPin className="h-5 w-5 text-gray-400" />
                        <h3 className="font-semibold text-gray-900 text-lg">{job.address}</h3>
                      </div>
                      
                      <div className="space-y-2 ml-8">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="h-4 w-4" />
                          <span>{formatDate(job.arrival_time)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Briefcase className="h-4 w-4" />
                          <span>{job.job_type || 'Service Call'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User className="h-4 w-4" />
                          <span>Completed Job</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-3">
                      <div className={`
                        w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors
                        ${isJobSelected(job.id) 
                          ? 'border-v3-orange bg-v3-orange' 
                          : 'border-gray-300 bg-white hover:border-gray-400'
                        }
                      `}>
                        {isJobSelected(job.id) && (
                          <Check className="h-5 w-5 text-white" />
                        )}
                      </div>
                    </div>
                  </div>

                  {isJobSelected(job.id) && (
                    <div className="mt-6 pt-4 border-t border-gray-200 space-y-4" onClick={(e) => e.stopPropagation()}>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">£</span>
                            <input
                              type="number"
                              placeholder="0.00"
                              className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange"
                              value={getJobRate(job.id)}
                              onChange={(e) => updateJobRate(job.id, e.target.value)}
                              step="0.01"
                              min="0"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Hours Worked</label>
                          <input
                            type="number"
                            placeholder="0.0"
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange"
                            value={getJobHours(job.id)}
                            onChange={(e) => updateJobHours(job.id, e.target.value)}
                            step="0.5"
                            min="0"
                          />
                        </div>
                      </div>
                      
                      {getJobHours(job.id) && getJobRate(job.id) && (
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                          <span className="text-sm text-gray-600">Subtotal</span>
                          <span className="text-lg font-semibold text-v3-orange">
                            £{((parseFloat(getJobHours(job.id)) || 0) * (parseFloat(getJobRate(job.id)) || 0)).toFixed(2)}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* Summary Stats */}
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-500 font-medium">Selected</p>
                <p className="text-2xl font-bold text-gray-900">{getSelectedJobsCount()}</p>
              </div>
              <div className="h-8 w-px bg-gray-300"></div>
              <div className="text-center">
                <p className="text-sm text-gray-500 font-medium">Total Hours</p>
                <p className="text-2xl font-bold text-gray-900">{getTotalHours()}</p>
              </div>
              <div className="h-8 w-px bg-gray-300"></div>
              <div className="text-center">
                <p className="text-sm text-gray-500 font-medium">Invoice Total</p>
                <p className="text-3xl font-bold text-v3-orange">£{totalAmount.toFixed(2)}</p>
              </div>
            </div>

            {/* Invoice Creation */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <label className="absolute -top-2 left-3 bg-white px-1 text-xs text-gray-500 font-medium">
                  Invoice Number
                </label>
                <input
                  type="text"
                  placeholder="e.g., INV-001"
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-v3-orange focus:border-v3-orange font-mono text-lg w-48"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                />
              </div>
              
              <Button
                onClick={handleReviewInvoice}
                disabled={getSelectedJobsCount() === 0 || !invoiceNumber || totalAmount === 0 || creating}
                className="bg-v3-orange hover:bg-orange-600 text-white px-8 py-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 min-w-[200px] justify-center"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Creating Invoice...
                  </>
                ) : (
                  <>
                    <FileText className="h-5 w-5" />
                    Create Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateInvoiceFromJobs;
