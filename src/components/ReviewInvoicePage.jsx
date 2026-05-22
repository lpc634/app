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

  // Support both 'total' and 'totalAmount' field names from different callers
  const { items, total, totalAmount, invoiceNumber, bill_to } = state || {};
  const resolvedTotal = total ?? totalAmount ?? 0;

  useEffect(() => {
    if (!items || items.length === 0) {
      toast.error("No invoice data found.");
      navigate('/agent/invoices/new');
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
        // Pre-fill with the invoice number from the misc invoice form if provided
        const suggested = nextNumberData.suggested || nextNumberData.next || '';
        setSuggestedNext(suggested);
        // If the user already typed a number on the previous page, use that
        if (invoiceNumber) {
          setAgentInvoiceNumber(invoiceNumber.toString());
        } else {
          setAgentInvoiceNumber(suggested.toString());
        }
      } catch (error) {
        toast.error('Failed to load data', { description: error.message });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [apiCall, items, navigate, invoiceNumber]);

  const handleConfirmAndSend = async () => {
    setIsSending(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Build payload for the /agent/invoice endpoint.
      // Misc items have negative jobIds — the backend treats those as
      // non-job line items (no InvoiceJob record created).
      const payload = {
        items: items.map(item => ({
          jobId:     item.jobId,
          hours:     item.hours,
          rate:      item.rate,
          title:     item.title || item.description || 'Service',
          work_date: item.date || today,
        })),
        bill_to: bill_to || 'v3',
        custom_invoice_number: agentInvoiceNumber ? parseInt(agentInvoiceNumber) : undefined,
      };

      const result = await apiCall('/agent/invoice', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      toast.success("Invoice created successfully!", {
        description: `Invoice has been saved and is ready to download.`
      });

      navigate('/agent/invoices');

    } catch (error) {
      if (error.status === 409) {
        toast.error('Duplicate Invoice Number', {
          description: `That number is already in use. Please try a different one.`
        });
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

  // Label for "Bill To" in the preview
  const billToLabel = bill_to === 'lh1_global'
    ? 'LH1 Global — INDEX HOUSE, St George\'s Ln, Ascot SL5 7ET'
    : 'V3 Services Ltd — 117 Dartford Road, Dartford, England, DA1 3EN';

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

          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">INVOICE</h1>
              <p className="text-gray-500">Invoice #DRAFT</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-bold text-gray-900">
                {bill_to === 'lh1_global' ? 'LH1 GLOBAL' : 'V3 Services Ltd'}
              </h2>
              <p className="text-sm text-gray-600">
                {bill_to === 'lh1_global'
                  ? 'INDEX HOUSE, St George\'s Ln, Ascot SL5 7ET'
                  : '117 Dartford Road, Dartford, England, DA1 3EN'}
              </p>
            </div>
          </div>

          {/* Agent + Invoice Meta */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="font-semibold text-gray-500 mb-1">FROM</p>
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
              <p className="font-semibold text-gray-500 mt-2">Invoice Number:</p>
              <input
                type="text"
                value={agentInvoiceNumber}
                onChange={(e) => setAgentInvoiceNumber(e.target.value)}
                placeholder="e.g. 338"
                className="text-gray-800 bg-gray-50 border border-gray-300 rounded px-3 py-2 text-sm w-28"
              />
              <p className="text-xs text-gray-500 mt-1">Your own invoice number.</p>
            </div>
          </div>

          {/* Line items table */}
          <table className="w-full text-left">
            <thead className="border-b-2 border-gray-300">
              <tr>
                <th className="py-2 font-semibold">Description</th>
                <th className="py-2 text-center font-semibold">Qty / Hrs</th>
                <th className="py-2 text-center font-semibold">Rate</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.jobId} className="border-b border-gray-200">
                  <td className="py-3 pr-2">
                    <p className="font-medium text-gray-900">{item.title || item.description}</p>
                    {item.date && (
                      <p className="text-sm text-gray-600">
                        Date: {new Date(item.date).toLocaleDateString('en-GB')}
                      </p>
                    )}
                  </td>
                  <td className="py-3 text-center">{(item.hours ?? 0).toFixed(2)}</td>
                  <td className="py-3 text-center">£{(item.rate ?? 0).toFixed(2)}</td>
                  <td className="py-3 text-right font-semibold">£{((item.hours ?? 0) * (item.rate ?? 0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-2">
              <div className="flex justify-between text-lg">
                <span className="font-semibold text-gray-600">Subtotal</span>
                <span>£{resolvedTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="font-semibold text-gray-600">VAT (0%)</span>
                <span>£0.00</span>
              </div>
              <div className="flex justify-between text-2xl font-bold text-gray-900 pt-2 border-t-2 border-gray-300">
                <span>Total</span>
                <span>£{resolvedTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment details */}
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
          {isSending
            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating Invoice...</>
            : 'Confirm & Create Invoice'}
        </button>
      </div>
    </div>
  );
};

export default ReviewInvoicePage;
