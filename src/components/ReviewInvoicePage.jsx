import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';

const ReviewInvoicePage = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { apiCall } = useAuth();
  
  const [agentProfile, setAgentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  
  // Manual input fields
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [hours, setHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');

  const { items, invoiceNumber: presetInvoiceNumber } = state || {};

  useEffect(() => {
    if (!items || items.length === 0) {
      toast.error("No invoice data found.");
      navigate('/agent/invoices');
      return;
    }
    
    // Set preset invoice number if provided (from CreateMiscInvoice)
    if (presetInvoiceNumber) {
      setInvoiceNumber(presetInvoiceNumber);
    }
    
    // Calculate default hours from items
    const totalHours = items.reduce((sum, item) => sum + (item.hours || 0), 0);
    setHours(totalHours.toString());
    
    // Set default rate if available
    if (items[0]?.rate) {
      setHourlyRate(items[0].rate.toString());
    }
    
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await apiCall('/agent/profile');
        setAgentProfile(data);
      } catch (error) {
        toast.error('Failed to load profile', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [apiCall, items, navigate]);

  const calculateTotal = () => {
    const h = parseFloat(hours) || 0;
    const r = parseFloat(hourlyRate) || 0;
    return h * r;
  };

  const handleSubmit = async () => {
    // Validation
    if (!invoiceNumber.trim()) {
      toast.error('Please enter an invoice number');
      return;
    }
    if (!hours || parseFloat(hours) <= 0) {
      toast.error('Please enter valid hours');
      return;
    }
    if (!hourlyRate || parseFloat(hourlyRate) <= 0) {
      toast.error('Please enter a valid hourly rate');
      return;
    }

    setIsSending(true);
    try {
      // Separate jobs and miscellaneous items
      const jobItems = items.filter(item => !item.isMiscItem && item.job_id > 0);
      const miscItems = items.filter(item => item.isMiscItem || item.job_id <= 0);

      // Create payload for the unified invoice creation endpoint
      const payload = {
        invoice_number: invoiceNumber.trim(),
        jobs: jobItems.map(item => ({
          job_id: item.job_id,
          hours: parseFloat(hours) / items.length, // Distribute hours evenly across jobs
          rate: parseFloat(hourlyRate)
        })),
        miscellaneous_items: miscItems.map(item => ({
          description: item.title || item.address,
          quantity: item.hours,
          unit_price: item.rate
        }))
      };

      // Call the unified invoice creation endpoint
      const result = await apiCall('/agent/invoices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });
      
      toast.success("Invoice created successfully!", {
        description: `Invoice #${result.invoice_number} has been created and is ready for download.`
      });

      navigate('/agent/invoices');

    } catch (error) {
      if (error.status === 409 && error.suggested) {
        toast.error('Invoice number already used', { 
          description: `Invoice number ${invoiceNumber} has already been used. Try ${error.suggested} instead.`
        });
        setInvoiceNumber(error.suggested.toString());
      } else {
        toast.error('Failed to create invoice', { description: error.message });
      }
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

  const total = calculateTotal();

  return (
    <div className="space-y-8">
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors w-fit mb-4">
          <ArrowLeft size={20} />
          <span>Back</span>
        </button>
        <h1 className="text-3xl font-bold tracking-tight">Create Invoice</h1>
        <p className="text-muted-foreground">Enter invoice details below</p>
      </div>

      <div className="dashboard-card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-v3-text-light mb-2">
              Invoice Number *
            </label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-001"
              className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-v3-text-light mb-2">
              Total Hours *
            </label>
            <input
              type="number"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 8"
              className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-v3-text-light mb-2">
              Hourly Rate (£) *
            </label>
            <input
              type="number"
              step="0.01"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              placeholder="e.g. 25.00"
              className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
            />
          </div>
        </div>

        <div className="border-t border-v3-border pt-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold text-v3-text-light">Total Amount:</span>
            <span className="text-2xl font-bold text-v3-orange">£{total.toFixed(2)}</span>
          </div>
        </div>

        {items && items.length > 0 && (
          <div className="border-t border-v3-border pt-4">
            <h3 className="text-sm font-medium text-v3-text-light mb-2">Jobs included:</h3>
            <ul className="text-sm text-v3-text-muted space-y-1">
              {items.map((item, idx) => (
                <li key={idx}>• {item.address || item.title}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div className="flex justify-end gap-4">
        <button 
          onClick={() => navigate(-1)} 
          className="px-6 py-2 border border-v3-border rounded-md text-v3-text-light hover:bg-v3-bg-dark"
        >
          Cancel
        </button>
        <button 
          onClick={handleSubmit} 
          className="button-refresh" 
          disabled={isSending}
        >
          {isSending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating...</>
          ) : (
            'Create Invoice'
          )}
        </button>
      </div>
    </div>
  );
};

export default ReviewInvoicePage;