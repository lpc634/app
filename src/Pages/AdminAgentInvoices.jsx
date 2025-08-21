import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '../useAuth.jsx';
import { toast } from 'sonner';
import {
  Loader2,
  FileText,
  Download,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  MapPin,
  Calendar,
  Users,
  Archive,
  AlertCircle
} from 'lucide-react';

const AdminAgentInvoices = () => {
  const { apiCall } = useAuth();
  
  // State management
  const [openJobs, setOpenJobs] = useState([]);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobInvoices, setJobInvoices] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [activeTab, setActiveTab] = useState('open');
  const [searchTerm, setSearchTerm] = useState('');

  // Load jobs on mount
  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      setLoadingJobs(true);
      // Single API call - apiCall already adds /api prefix
      const res = await apiCall('/jobs');
      
      // Handle both response formats: { jobs: [...] } or [...]
      const incoming = Array.isArray(res?.jobs) ? res.jobs : (Array.isArray(res) ? res : []);
      
      // Client-side filtering using Dashboard logic
      const isCompleted = (status) => (status || '').toLowerCase() === 'completed';
      const openJobs = incoming.filter(job => !isCompleted(job.status));
      const completedJobs = incoming.filter(job => isCompleted(job.status));
      
      setOpenJobs(openJobs);
      setCompletedJobs(completedJobs);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
      toast.error('Failed to load jobs', { description: error.message });
      setOpenJobs([]);
      setCompletedJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  // Select job and fetch its invoices
  const selectJob = async (job) => {
    try {
      setSelectedJob(job);
      setLoadingInvoices(true);
      const res = await apiCall(`/admin/jobs/${job.id}/invoices`);
      setJobInvoices(res.invoices || []);
    } catch (error) {
      console.error('Failed to fetch job invoices:', error);
      toast.error('Failed to load invoices', { description: error.message });
      setJobInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // Batch download all invoices for selected job
  const handleBatchDownload = async () => {
    if (!jobInvoices.length) {
      toast.error('No invoices to download');
      return;
    }

    try {
      setDownloadingZip(true);
      const safeName = (selectedJob.title || 'invoices')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      
      const payload = {
        invoice_ids: jobInvoices.map(inv => inv.id),
        batch_name: `job_${selectedJob.id}_${safeName}`
      };

      const res = await apiCall('/admin/invoices/batch-download', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res?.download_url) {
        window.open(res.download_url, '_blank');
        toast.success('Batch download started', {
          description: `ZIP file with ${jobInvoices.length} invoice(s)`
        });
      }
    } catch (error) {
      console.error('Batch download failed:', error);
      toast.error('Batch download failed', { description: error.message });
    } finally {
      setDownloadingZip(false);
    }
  };

  // Mark job as complete
  const markJobComplete = async () => {
    if (!selectedJob) return;

    try {
      await apiCall(`/jobs/${selectedJob.id}/complete`, { method: 'POST' });
      
      // Move job from open to completed optimistically
      setOpenJobs(prev => prev.filter(j => j.id !== selectedJob.id));
      setCompletedJobs(prev => [{ ...selectedJob, status: 'completed' }, ...prev]);
      setSelectedJob(prev => prev ? { ...prev, status: 'completed' } : prev);
      
      toast.success('Job marked as complete');
    } catch (error) {
      console.error('Failed to mark job complete:', error);
      toast.error('Failed to mark job complete', { description: error.message });
    }
  };

  // Download individual invoice
  const handleInvoiceDownload = async (invoice) => {
    try {
      const res = await apiCall(`/admin/invoices/${invoice.id}/download`);
      if (res?.download_url) {
        window.open(res.download_url, '_blank');
        toast.success('Download started', { description: `Invoice ${invoice.agent_invoice_number || invoice.invoice_number}` });
      }
    } catch (error) {
      console.error('Invoice download failed:', error);
      toast.error('Download failed', { description: error.message });
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  // Get status badge styling
  const getStatusBadge = (status) => {
    const styles = {
      open: 'bg-blue-900/50 text-blue-400 border-blue-500/50',
      completed: 'bg-green-900/50 text-green-400 border-green-500/50',
      cancelled: 'bg-red-900/50 text-red-400 border-red-500/50',
      paid: 'bg-green-900/50 text-green-400 border-green-500/50',
      sent: 'bg-blue-900/50 text-blue-400 border-blue-500/50',
      draft: 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50'
    };
    return styles[status] || 'bg-gray-700 text-gray-400';
  };

  // Filter jobs by search term
  const filterJobs = (jobs) => {
    if (!searchTerm) return jobs;
    return jobs.filter(job => 
      job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.job_type?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  const currentJobs = activeTab === 'open' ? filterJobs(openJobs) : filterJobs(completedJobs);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Invoices</h1>
        <p className="text-muted-foreground">
          Manage job invoices and download agent submissions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Panel - Jobs List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Jobs</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={activeTab === 'open' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('open')}
                    className="text-xs"
                  >
                    <Clock className="h-3 w-3 mr-1" />
                    Open ({openJobs.length})
                  </Button>
                  <Button
                    variant={activeTab === 'completed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveTab('completed')}
                    className="text-xs"
                  >
                    <Archive className="h-3 w-3 mr-1" />
                    Completed ({completedJobs.length})
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search jobs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {loadingJobs ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : currentJobs.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No {activeTab} jobs found</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {currentJobs.map((job) => (
                    <div
                      key={job.id}
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedJob?.id === job.id ? 'bg-muted' : ''
                      }`}
                      onClick={() => selectJob(job)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium text-sm truncate pr-2">
                          {job.title || 'Untitled Job'}
                        </h4>
                        <Badge className={getStatusBadge(job.status)} variant="outline">
                          {job.status}
                        </Badge>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{job.address}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{formatDate(job.arrival_time)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          <span>{job.job_type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Job Details & Invoices */}
        <div className="lg:col-span-2">
          {!selectedJob ? (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4" />
                  <p>Select a job to view its invoices</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Job Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-xl">{selectedJob.title || 'Untitled Job'}</CardTitle>
                      <CardDescription className="flex items-center gap-4 mt-2">
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {selectedJob.address}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(selectedJob.arrival_time)}
                        </span>
                        <Badge className={getStatusBadge(selectedJob.status)} variant="outline">
                          {selectedJob.status}
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {jobInvoices.length > 0 && (
                        <Button
                          onClick={handleBatchDownload}
                          disabled={downloadingZip}
                          variant="outline"
                        >
                          {downloadingZip ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-2" />
                          )}
                          Batch Download
                        </Button>
                      )}
                      {selectedJob.status !== 'completed' && (
                        <Button onClick={markJobComplete}>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Mark Complete
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Invoices Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Invoices ({jobInvoices.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingInvoices ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : jobInvoices.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2" />
                      <p>No invoices found for this job</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2 text-sm font-medium">Invoice #</th>
                            <th className="text-left p-2 text-sm font-medium">Agent</th>
                            <th className="text-left p-2 text-sm font-medium">Issue Date</th>
                            <th className="text-left p-2 text-sm font-medium">Amount</th>
                            <th className="text-left p-2 text-sm font-medium">Status</th>
                            <th className="text-left p-2 text-sm font-medium">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobInvoices.map((invoice) => (
                            <tr key={invoice.id} className="border-b hover:bg-muted/50">
                              <td className="p-2 text-sm">
                                {invoice.agent_invoice_number || invoice.invoice_number || `#${invoice.id}`}
                              </td>
                              <td className="p-2 text-sm">{invoice.agent_name || 'Unknown'}</td>
                              <td className="p-2 text-sm">{formatDate(invoice.issue_date)}</td>
                              <td className="p-2 text-sm font-medium">
                                {formatCurrency(invoice.total_amount)}
                              </td>
                              <td className="p-2">
                                <Badge className={getStatusBadge(invoice.status)} variant="outline">
                                  {invoice.status}
                                </Badge>
                              </td>
                              <td className="p-2">
                                <Button
                                  onClick={() => handleInvoiceDownload(invoice)}
                                  size="sm"
                                  variant="outline"
                                  disabled={!invoice.pdf_available}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  Download
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAgentInvoices;