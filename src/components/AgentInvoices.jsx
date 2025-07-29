import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, FileText, PlusCircle, AlertCircle, Edit, Download, Calendar, PoundSterling } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

const AgentInvoices = () => {
  const { apiCall } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingInvoices, setDownloadingInvoices] = useState(new Set());

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const data = await apiCall('/agent/invoices');
        console.log('Invoice API response:', data); // Debug log
        // Handle both old format (array) and new format (object with invoices property)
        if (Array.isArray(data)) {
          setInvoices(data);
        } else if (data && Array.isArray(data.invoices)) {
          setInvoices(data.invoices);
        } else {
          console.error('Unexpected API response format:', data);
          setInvoices([]);
        }
      } catch (error) {
        console.error('Error fetching invoices:', error);
        toast.error('Failed to load invoices', { description: error.message });
        setError(error.message || 'Failed to load invoices');
        setInvoices([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };
    fetchInvoices();
  }, [apiCall]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-900/50 text-green-400 border-green-500/50';
      case 'sent': return 'bg-blue-900/50 text-blue-400 border-blue-500/50';
      case 'draft': return 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50';
      default: return 'bg-gray-700 text-gray-400';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'paid': return 'Paid';
      case 'sent': return 'Sent';
      case 'draft': return 'Draft';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP'
    }).format(amount);
  };

  const handleDownload = async (invoiceId, invoiceNumber) => {
    try {
      // Add to downloading set
      setDownloadingInvoices(prev => new Set([...prev, invoiceId]));
      
      // Get download URL from API
      const response = await apiCall(`/agent/invoices/${invoiceId}/download`);
      
      if (response && response.download_url) {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = response.download_url;
        link.download = response.filename || `${invoiceNumber}.pdf`;
        link.target = '_blank'; // Open in new tab as fallback
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        toast.success('Download started', { 
          description: `${invoiceNumber}.pdf` 
        });
      } else {
        throw new Error('Invalid download response');
      }
    } catch (error) {
      console.error('Download failed:', error);
      toast.error('Download failed', { 
        description: error.message || 'Unable to download invoice PDF' 
      });
    } finally {
      // Remove from downloading set
      setDownloadingInvoices(prev => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  // Handle loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange mb-2" />
          <p className="text-v3-text-muted">Loading your invoices...</p>
        </div>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-v3-text-lightest mb-2">Error Loading Invoices</h3>
          <p className="text-v3-text-muted mb-4">{error}</p>
          <Button onClick={() => window.location.reload()} className="button-refresh">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Wrap the main render in try-catch to prevent black screens
  try {
    return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>
          <p className="text-muted-foreground">Manage and track your invoices here.</p>
        </div>
        <Link to="/agent/invoices/new" className="button-refresh w-full sm:w-auto flex items-center justify-center gap-2">
          <PlusCircle className="w-5 h-5" />
          Create New Invoice
        </Link>
      </div>
      
      <div className="dashboard-card p-0">
        <div className="p-6">
            <h2 className="text-xl font-bold text-v3-text-lightest">Invoice History</h2>
        </div>
        
        {invoices.length === 0 ? (
            <div className="text-center p-12 border-t border-v3-border">
                <AlertCircle className="mx-auto h-12 w-12 text-v3-text-muted mb-4" />
                <h3 className="text-lg font-medium text-v3-text-lightest">No Invoices Found</h3>
                <p className="text-v3-text-muted mt-1">Invoices will appear here when you accept jobs.</p>
            </div>
        ) : (
            <div className="border-t border-v3-border">
                <div className="divide-y divide-v3-border">
                    {invoices.map((invoice, index) => (
                        <div key={invoice.id || index} className="p-6 hover:bg-v3-bg-dark/50 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-v3-text-lightest">
                                            {invoice.invoice_number || `Invoice #${invoice.id}`}
                                        </h3>
                                        <Badge className={getStatusClass(invoice.status)}>
                                            {getStatusText(invoice.status)}
                                        </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                        <div className="flex items-center gap-2 text-v3-text-muted">
                                            <Calendar className="h-4 w-4" />
                                            <span>Issue: {invoice.issue_date ? formatDate(invoice.issue_date) : 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-v3-text-muted">
                                            <Calendar className="h-4 w-4" />
                                            <span>Due: {invoice.due_date ? formatDate(invoice.due_date) : 'N/A'}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-v3-text-lightest font-medium">
                                            <PoundSterling className="h-4 w-4" />
                                            <span>{invoice.total_amount ? formatCurrency(invoice.total_amount) : '£0.00'}</span>
                                        </div>
                                    </div>
                                    
                                    {invoice.jobs && invoice.jobs.length > 0 && (
                                        <div className="mt-3 text-sm text-v3-text-muted">
                                            {invoice.jobs.map((job, index) => (
                                                <div key={job.id} className="flex items-center gap-2">
                                                    <span>• {job.job?.title || `Job ${job.job_id}`}</span>
                                                    {job.hours_worked > 0 && (
                                                        <span>({job.hours_worked}h @ £{job.hourly_rate_at_invoice}/hr)</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    {invoice.status === 'draft' ? (
                                        <Link to={`/agent/invoices/update/${invoice.id}`}>
                                            <Button className="button-refresh">
                                                <Edit className="h-4 w-4 mr-2" />
                                                Complete & Send
                                            </Button>
                                        </Link>
                                    ) : (
                                        <Button 
                                            variant="outline" 
                                            className="border-v3-border text-v3-text-lightest hover:bg-v3-bg-dark"
                                            onClick={() => handleDownload(invoice.id, invoice.invoice_number)}
                                            disabled={downloadingInvoices.has(invoice.id)}
                                        >
                                            {downloadingInvoices.has(invoice.id) ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            ) : (
                                                <Download className="h-4 w-4 mr-2" />
                                            )}
                                            {downloadingInvoices.has(invoice.id) ? 'Downloading...' : 'Download PDF'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>
    </div>
  );
  } catch (renderError) {
    console.error('Error rendering AgentInvoices component:', renderError);
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-medium text-v3-text-lightest mb-2">Display Error</h3>
          <p className="text-v3-text-muted mb-4">There was an error displaying your invoices.</p>
          <Button onClick={() => window.location.reload()} className="button-refresh">
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }
};

export default AgentInvoices;