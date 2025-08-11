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
  const [agentInvoiceNumber, setAgentInvoiceNumber] = useState('');
  const [suggestedNext, setSuggestedNext] = useState(null);

  const { items, total } = state || {};

  useEffect(() => {
    if (!items || items.length === 0) {
      toast.error("No invoice data found.");
      navigate('/agent/invoices/new/from-jobs');
      return;
    }
    const fetchData = async () => {
      try {
        setLoading(true);
        const [profileData, nextNumberData] = await Promise.all([
          apiCall('/agent/profile'),
          apiCall('/agent/next-invoice-number')
        ]);
        setAgentProfile(profileData);
        setSuggestedNext(nextNumberData.next);
        setAgentInvoiceNumber(nextNumberData.next.toString());
      } catch (error) {
        toast.error('Failed to load data', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [apiCall, items, navigate]);

  // This function is now fully implemented
  const handleConfirmAndSend = async () => {
    setIsSending(true);
    try {
      const payload = {
        items: items,
        total: total,
        agent_invoice_number: agentInvoiceNumber ? parseInt(agentInvoiceNumber) : undefined,
      };

      const result = await apiCall('/agent/invoices', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      toast.success("Invoice created successfully!", {
        description: `Invoice ${result.invoice_number} has been saved.`
      });

      // Navigate back to the main invoices page after success
      navigate('/agent/invoices');

    } catch (error) {
      if (error.status === 409 && error.suggestedNext) {
        toast.error('Duplicate Agent Invoice Number', { 
          description: `Number ${agentInvoiceNumber} is already in use. Try ${error.suggestedNext} instead.`
        });
        setAgentInvoiceNumber(error.suggestedNext.toString());
        setSuggestedNext(error.suggestedNext);
      } else {
        toast.error('Failed to create invoice', { description: error.message });
      }
    } finally {
      setIsSending(false);
    }
  };

  if (loading || !agentProfile) {
    return <div className="text-center p-8"><Loader2 className="h-8 w-8 animate-spin mx-auto text-v3-orange" /></div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors w-fit mb-4">
          <ArrowLeft size={20} />
          <span>Back to Edit Invoice</span>
        </button>
        <h1 className="text-3xl font-bold tracking-tight">Review Invoice</h1>
        <p className="text-muted-foreground">Please review the details below before confirming.</p>
      </div>

      <div className="dashboard-card p-8 md:p-12 bg-white text-gray-800">
        <div className="space-y-10">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-gray-500">Invoice #DRAFT</p>
            </div>
            <div className="text-right">
                <h2 className="text-xl font-bold text-gray-900">V3 Services Ltd</h2>
                <p className="text-sm text-gray-600">117 Dartford Road, Dartford, England, DA1 3EN</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-semibold text-gray-500 mb-1">BILL TO</p>
              <p className="font-bold text-gray-900">{agentProfile.first_name} {agentProfile.last_name}</p>
              <p className="text-sm text-gray-600">{agentProfile.address_line_1}</p>
              {agentProfile.address_line_2 && <p className="text-sm text-gray-600">{agentProfile.address_line_2}</p>}
              <p className="text-sm text-gray-600">{agentProfile.city}, {agentProfile.postcode}</p>
            </div>
            <div className="text-right">
               <p className="font-semibold text-gray-500">Issue Date:</p>
               <p className="text-gray-800">{new Date().toLocaleDateString('en-GB')}</p>
               <p className="font-semibold text-gray-500 mt-2">Due Date:</p>
               <p className="text-gray-800">{new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-GB')}</p>
               <p className="font-semibold text-gray-500 mt-2">Agent No:</p>
               <input 
                 type="number" 
                 value={agentInvoiceNumber}
                 onChange={(e) => setAgentInvoiceNumber(e.target.value)}
                 min="1"
                 max="999999999"
                 className="text-gray-800 bg-gray-50 border border-gray-300 rounded px-2 py-1 text-sm w-20"
                 placeholder={suggestedNext?.toString()}
               />
            </div>
          </div>
          <table className="w-full text-left">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 text-center font-semibold">Hours</th>
                <th className="py-2 text-center font-semibold">Rate</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.jobId} className="border-b border-gray-200">
                  <td className="py-3 pr-2">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <p className="text-sm text-gray-600">Date: {new Date(item.date).toLocaleDateString('en-GB')}</p>
                  </td>
                  <td className="py-3 text-center">{item.hours.toFixed(2)}</td>
                  <td className="py-3 text-center">£{item.rate.toFixed(2)}</td>
                  <td className="py-3 text-right font-semibold">£{(item.hours * item.rate).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
                <div className="flex justify-between text-lg">
                    <span className="font-semibold text-gray-600">Subtotal</span>
                    <span>£{total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg">
                    <span className="font-semibold text-gray-600">VAT (0%)</span>
                    <span>£0.00</span>
                </div>
                <div className="flex justify-between text-2xl font-bold text-gray-900 pt-2 border-t-2 border-gray-300">
                    <span>Total</span>
                    <span>£{total.toFixed(2)}</span>
                </div>
            </div>
          </div>
           <div>
              <p className="font-semibold text-gray-500 mb-2">Payment Details</p>
              <div className="text-sm text-gray-600 border p-4 rounded-lg bg-gray-50">
                <p><span className="font-semibold">Bank:</span> {agentProfile.bank_name}</p>
                <p><span className="font-semibold">Account Number:</span> {agentProfile.bank_account_number}</p>
                <p><span className="font-semibold">Sort Code:</span> {agentProfile.bank_sort_code}</p>
              </div>
           </div>
        </div>
      </div>
      
      <div className="flex justify-end">
          <button onClick={handleConfirmAndSend} className="button-refresh w-full sm:w-auto" disabled={isSending}>
              {isSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Creating Invoice...</> : 'Confirm & Create Invoice'}
          </button>
      </div>
    </div>
  );
};

export default ReviewInvoicePage;