import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  Loader2, FileText, PlusCircle, AlertCircle, Download, Calendar, 
  PoundSterling, TrendingUp, Eye, Trash2, ChevronDown, ChevronRight,
  Search, Filter, DollarSign, CreditCard, Clock, Receipt
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

const AgentInvoices = () => {
  const { apiCall } = useAuth();
  
  // State for data
  const [data, setData] = useState({
    invoices: [],
    analytics: {},
    grouped_by_month: {},
    monthly_trend: []
  });
  
  // State for UI
  const [loading, setLoading] = useState(true);
  const [downloadingInvoices, setDownloadingInvoices] = useState(new Set());
  const [deletingInvoices, setDeletingInvoices] = useState(new Set());
  const [expandedMonths, setExpandedMonths] = useState(new Set());
  
  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  
  // State for delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchInvoiceData();
  }, []);

  const fetchInvoiceData = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/agent/invoices/analytics');
      setData(response);
      
      // Auto-expand current month
      const currentMonth = new Date().toISOString().slice(0, 7);
      setExpandedMonths(new Set([currentMonth]));
      
    } catch (error) {
      console.error('Error fetching invoice data:', error);
      toast.error('Failed to load invoice data', { description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId, invoiceNumber) => {
    try {
      setDeletingInvoices(prev => new Set([...prev, invoiceId]));
      await apiCall(`/agent/invoices/${invoiceId}`, { method: 'DELETE' });
      
      toast.success(`Invoice ${invoiceNumber} deleted successfully`);
      setDeleteConfirm(null);
      
      // Refresh data
      await fetchInvoiceData();
      
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Failed to delete invoice', { description: error.message });
    } finally {
      setDeletingInvoices(prev => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  const handleDownloadInvoice = async (invoiceId) => {
    try {
      setDownloadingInvoices(prev => new Set([...prev, invoiceId]));
      
      // EMERGENCY FIX: Use direct download URL instead of API response
      const downloadUrl = `/agent/invoices/${invoiceId}/download-direct`;
      window.open(downloadUrl, '_blank');
      
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice', { description: error.message });
    } finally {
      setDownloadingInvoices(prev => {
        const newSet = new Set(prev);
        newSet.delete(invoiceId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (invoice) => {
    const { status, is_overdue, days_outstanding } = invoice;
    
    if (status === 'paid') {
      return <Badge className="bg-green-600 text-white">PAID</Badge>;
    }
    
    if (is_overdue) {
      return <Badge className="bg-red-600 text-white">OVERDUE ({days_outstanding}d)</Badge>;
    }
    
    return <Badge className="bg-yellow-600 text-white">PENDING</Badge>;
  };

  const formatCurrency = (amount) => {
    return `£${parseFloat(amount).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const toggleMonth = (monthKey) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const filteredAndGroupedInvoices = () => {
    const filtered = Object.entries(data.grouped_by_month).reduce((acc, [monthKey, monthData]) => {
      const filteredInvoices = monthData.invoices.filter(invoice => {
        // Search filter
        const matchesSearch = searchTerm === '' || 
          invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase());
        
        // Status filter
        const matchesStatus = statusFilter === 'all' ||
          (statusFilter === 'paid' && invoice.status === 'paid') ||
          (statusFilter === 'pending' && invoice.status !== 'paid' && !invoice.is_overdue) ||
          (statusFilter === 'overdue' && invoice.is_overdue);
        
        return matchesSearch && matchesStatus;
      });

      if (filteredInvoices.length > 0) {
        acc[monthKey] = {
          ...monthData,
          invoices: filteredInvoices,
          total: filteredInvoices.reduce((sum, inv) => sum + parseFloat(inv.total_amount), 0),
          count: filteredInvoices.length
        };
      }
      
      return acc;
    }, {});
    
    return filtered;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-v3-orange" />
      </div>
    );
  }

  const { analytics } = data;
  const groupedInvoices = filteredAndGroupedInvoices();

  return (
    <div className="min-h-screen-ios w-full max-w-full prevent-horizontal-scroll">
      <div className="space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-v3-text-lightest truncate">My Invoices</h1>
            <p className="text-v3-text-muted text-sm sm:text-base">Manage your invoices and track earnings</p>
          </div>
          <div className="flex-shrink-0">
            <Link to="/agent/invoices/new">
              <Button className="button-refresh tap-target w-full sm:w-auto">
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          </div>
        </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="dashboard-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-v3-text-muted">
              <PoundSterling className="h-4 w-4 mr-2" />
              Total Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {formatCurrency(analytics.total_earned || 0)}
            </div>
            <p className="text-xs text-v3-text-muted">All-time earnings</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-v3-text-muted">
              <Clock className="h-4 w-4 mr-2" />
              Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {formatCurrency(analytics.total_pending || 0)}
            </div>
            <p className="text-xs text-v3-text-muted">Unpaid invoices</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-v3-text-muted">
              <Calendar className="h-4 w-4 mr-2" />
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-v3-orange">
              {formatCurrency(analytics.this_month || 0)}
            </div>
            <p className="text-xs text-v3-text-muted">Current month earnings</p>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-sm font-medium text-v3-text-muted">
              <TrendingUp className="h-4 w-4 mr-2" />
              Monthly Avg
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-v3-text-lightest">
              {formatCurrency(analytics.avg_monthly || 0)}
            </div>
            <p className="text-xs text-v3-text-muted">Last 12 months</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="dashboard-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-v3-text-muted">Total Invoices</p>
                <p className="text-xl font-semibold text-v3-text-lightest">{analytics.invoice_count || 0}</p>
              </div>
              <Receipt className="h-8 w-8 text-v3-text-muted" />
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-v3-text-muted">Paid</p>
                <p className="text-xl font-semibold text-green-400">{analytics.paid_count || 0}</p>
              </div>
              <div className="h-2 w-16 bg-green-400 rounded"></div>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-v3-text-muted">Pending</p>
                <p className="text-xl font-semibold text-yellow-400">{analytics.pending_count || 0}</p>
              </div>
              <div className="h-2 w-16 bg-yellow-400 rounded"></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="dashboard-card">
        <CardContent className="pt-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-v3-text-muted" />
                <Input
                  placeholder="Search invoices..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-v3-bg-dark border-v3-border text-v3-text-lightest"
                />
              </div>
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-v3-bg-dark border border-v3-border rounded-md text-v3-text-lightest"
            >
              <option value="all">All Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="overdue">Overdue</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-2 bg-v3-bg-dark border border-v3-border rounded-md text-v3-text-lightest"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="amount-desc">Highest Amount</option>
              <option value="amount-asc">Lowest Amount</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Monthly Grouped Invoices */}
      <div className="space-y-4">
        {Object.entries(groupedInvoices).map(([monthKey, monthData]) => (
          <Card key={monthKey} className="dashboard-card">
            <CardHeader>
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleMonth(monthKey)}
              >
                <div className="flex items-center space-x-2">
                  {expandedMonths.has(monthKey) ? (
                    <ChevronDown className="h-4 w-4 text-v3-text-muted" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-v3-text-muted" />
                  )}
                  <h3 className="text-lg font-semibold text-v3-text-lightest">
                    {monthData.month_name}
                  </h3>
                  <Badge className="bg-v3-bg-dark text-v3-text-muted">
                    {monthData.count} invoice{monthData.count !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-v3-orange">
                    {formatCurrency(monthData.total)}
                  </p>
                  <p className="text-xs text-v3-text-muted">Monthly total</p>
                </div>
              </div>
            </CardHeader>
            
            {expandedMonths.has(monthKey) && (
              <CardContent>
                <div className="space-y-3">
                  {monthData.invoices.map((invoice) => (
                    <div 
                      key={invoice.id}
                      className="w-full max-w-full p-4 bg-v3-bg-dark/30 rounded-lg border border-v3-border/30 hover:border-v3-border transition-colors overflow-hidden"
                    >
                      {/* Mobile-first stacked layout */}
                      <div className="w-full max-w-full min-w-0">
                        {/* Header row with invoice number and status */}
                        <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-v3-text-lightest truncate">
                              {invoice.invoice_number}
                            </p>
                            <p className="text-xs text-v3-text-muted">Invoice #</p>
                          </div>
                          <div className="flex-shrink-0">
                            {getStatusBadge(invoice)}
                            {invoice.days_outstanding > 0 && (
                              <p className="text-xs text-red-400 mt-1 text-right">
                                {invoice.days_outstanding} days overdue
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {/* Mobile: 2-column grid for dates and amount */}
                        <div className="grid grid-cols-2 gap-4 mb-3 sm:grid-cols-3">
                          <div className="min-w-0">
                            <p className="text-v3-text-lightest text-sm truncate">{formatDate(invoice.issue_date)}</p>
                            <p className="text-xs text-v3-text-muted">Issue Date</p>
                          </div>
                          
                          <div className="min-w-0">
                            <p className="text-v3-text-lightest text-sm truncate">{formatDate(invoice.due_date)}</p>
                            <p className="text-xs text-v3-text-muted">Due Date</p>
                          </div>
                          
                          <div className="min-w-0 col-span-2 sm:col-span-1">
                            <p className="font-semibold text-v3-orange text-lg">
                              {formatCurrency(invoice.total_amount)}
                            </p>
                            <p className="text-xs text-v3-text-muted">Amount</p>
                          </div>
                        </div>
                        
                        {/* Actions row */}
                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-v3-border/20">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadInvoice(invoice.id)}
                            disabled={downloadingInvoices.has(invoice.id)}
                            className="text-v3-text-muted hover:text-v3-text-lightest tap-target"
                          >
                            {downloadingInvoices.has(invoice.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm({ id: invoice.id, number: invoice.invoice_number })}
                            disabled={deletingInvoices.has(invoice.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 tap-target"
                          >
                            {deletingInvoices.has(invoice.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {Object.keys(groupedInvoices).length === 0 && (
        <Card className="dashboard-card">
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 text-v3-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-v3-text-lightest mb-2">No invoices found</h3>
            <p className="text-v3-text-muted mb-4">
              {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first invoice to get started'}
            </p>
            <Link to="/agent/invoices/new">
              <Button className="button-refresh">
                <PlusCircle className="h-4 w-4 mr-2" />
                Create Invoice
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md bg-v3-bg-card border-v3-border">
            <CardHeader>
              <CardTitle className="text-v3-text-lightest">Delete Invoice</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-8 w-8 text-red-400 flex-shrink-0" />
                <div>
                  <p className="text-v3-text-lightest">
                    Are you sure you want to delete Invoice #{deleteConfirm.number}?
                  </p>
                  <p className="text-sm text-v3-text-muted mt-1">
                    This action cannot be undone.
                  </p>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                  className="text-v3-text-muted border-v3-border hover:bg-v3-bg-dark"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleDeleteInvoice(deleteConfirm.id, deleteConfirm.number)}
                  disabled={deletingInvoices.has(deleteConfirm.id)}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {deletingInvoices.has(deleteConfirm.id) ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete Invoice
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};

export default AgentInvoices;
