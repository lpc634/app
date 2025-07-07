import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, FileText, PlusCircle, AlertCircle } from 'lucide-react';

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

  if (loading) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Invoices</h1>
          <p className="text-muted-foreground">Create and track your invoices here.</p>
        </div>
        {/* We will build the /new page in the next step */}
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
                <p className="text-v3-text-muted mt-1">Click 'Create New Invoice' to get started.</p>
            </div>
        ) : (
            <div className="border-t border-v3-border">
                {/* We will build out the list of invoices here in a future step */}
                <p className="p-6 text-v3-text-muted">Invoice list will appear here.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default AgentInvoices;