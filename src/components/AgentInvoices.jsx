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

  useEffect(() => {
    const fetchInvoices = async () => {
      try {
        setLoading(true);
        const data = await apiCall('/agent/invoices');
        setInvoices(data);
      } catch (error) {
        toast.error('Failed to load invoices', { description: error.message });
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

  if (loading) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

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
                    {invoices.map((invoice) => (
                        <div key={invoice.id} className="p-6 hover:bg-v3-bg-dark/50 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="text-lg font-semibold text-v3-text-lightest">
                                            {invoice.invoice_number}
                                        </h3>
                                        <Badge className={getStatusClass(invoice.status)}>
                                            {getStatusText(invoice.status)}
                                        </Badge>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                                        <div className="flex items-center gap-2 text-v3-text-muted">
                                            <Calendar className="h-4 w-4" />
                                            <span>Issue: {formatDate(invoice.issue_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-v3-text-muted">
                                            <Calendar className="h-4 w-4" />
                                            <span>Due: {formatDate(invoice.due_date)}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-v3-text-lightest font-medium">
                                            <PoundSterling className="h-4 w-4" />
                                            <span>{formatCurrency(invoice.total_amount)}</span>
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
                                        <Button variant="outline" className="border-v3-border text-v3-text-lightest hover:bg-v3-bg-dark">
                                            <Download className="h-4 w-4 mr-2" />
                                            Download PDF
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
};

export default AgentInvoices;