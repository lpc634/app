import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, X } from 'lucide-react';
import { useAuth } from '../useAuth';

const CreateMiscInvoice = () => {
  const navigate = useNavigate();
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lineItems, setLineItems] = useState([
    { id: 1, description: '', quantity: '1', unit_price: '' }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalAmount = useMemo(() => {
    return lineItems.reduce((acc, item) => {
      const quantity = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unit_price) || 0;
      return acc + (quantity * price);
    }, 0);
  }, [lineItems]);

  const handleItemChange = (id, field, value) => {
    setLineItems(prevItems =>
      prevItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: Date.now(), description: '', quantity: '1', unit_price: '' }
    ]);
  };

  const removeLineItem = (id) => {
    if (lineItems.length > 1) {
      setLineItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleReviewInvoice = () => {
    if (!invoiceNumber.trim()) {
      toast.error("Invoice Number Required", { description: "Please enter an invoice number before proceeding." });
      return;
    }

    const validItems = lineItems.filter(item => 
      item.description.trim() !== '' &&
      parseFloat(item.quantity) > 0 &&
      parseFloat(item.unit_price) > 0
    );

    if (validItems.length === 0) {
      toast.error("Invalid Line Items", { description: "Please ensure at least one line item has a description, quantity, and price." });
      return;
    }

    // Navigate to review page with invoice data
    const reviewData = {
      invoiceNumber: invoiceNumber.trim(),
      items: validItems.map((item, index) => ({
        jobId: -(index + 1), // Negative IDs for misc items
        title: item.description,
        hours: parseFloat(item.quantity),
        rate: parseFloat(item.unit_price)
      })),
      totalAmount: totalAmount
    };

    navigate('/agent/invoices/review', { state: reviewData });
  };

  const isReviewDisabled = !invoiceNumber.trim() || totalAmount === 0 || isSubmitting;

  return (
    <div className="space-y-8">
      <div>
        <Link to="/agent/invoices/new" className="flex items-center space-x-2 text-v3-text-muted hover:text-v3-orange transition-colors w-fit mb-4">
          <ArrowLeft size={20} />
          <span>Back to Invoice Type Selection</span>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Miscellaneous Invoice</h1>
        <p className="text-muted-foreground">Manually add line items for expenses or other charges.</p>
      </div>

      {/* Invoice Number Field */}
      <div className="dashboard-card p-6">
        <h2 className="text-xl font-bold text-v3-text-lightest mb-4">Invoice Details</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-v3-text-lightest mb-2">
              Invoice Number *
            </label>
            <input
              id="invoiceNumber"
              type="text"
              placeholder="Enter your invoice number (e.g., INV-2024-001)"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
              required
            />
            <p className="text-sm text-v3-text-muted mt-1">
              This will be displayed on your invoice. Make sure it's unique.
            </p>
          </div>
        </div>
      </div>
      
      <div className="dashboard-card p-0">
         <div className="p-6">
            <h2 className="text-xl font-bold text-v3-text-lightest">Line Items</h2>
        </div>
        
        <div className="divide-y divide-v3-border border-t border-v3-border">
          {lineItems.map((item, index) => (
            <div key={item.id} className="p-4 flex flex-col md:flex-row items-center gap-4">
              <span className="text-v3-text-muted font-bold">{index + 1}</span>
              <div className="flex-grow">
                <input
                  type="text"
                  placeholder="Description (e.g., Fuel, Equipment Rental)"
                  value={item.description}
                  onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                  className="w-full bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                />
              </div>
              <div className="flex items-center gap-4">
                <input
                  type="number"
                  placeholder="Qty"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(item.id, 'quantity', e.target.value)}
                  className="w-20 text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                />
                <span className="text-v3-text-muted">x</span>
                 <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-v3-text-muted">£</span>
                  <input
                    type="number"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(item.id, 'unit_price', e.target.value)}
                    className="w-32 text-center bg-v3-bg-dark border-v3-border rounded-md shadow-sm py-2 px-3 pl-8 text-v3-text-lightest focus:outline-none focus:ring-v3-orange focus:border-v3-orange"
                  />
                 </div>
              </div>
              <button onClick={() => removeLineItem(item.id)} disabled={lineItems.length <= 1} className="text-v3-text-muted hover:text-red-500 disabled:opacity-50">
                  <X size={20}/>
              </button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-v3-border">
          <button onClick={addLineItem} className="button-refresh flex items-center space-x-2 w-full sm:w-auto">
              <Plus size={16}/>
              <span>Add Line Item</span>
          </button>
        </div>
      </div>

      <div className="dashboard-card p-4 flex items-center justify-between">
          <p className="text-lg font-semibold text-v3-text-lightest">Invoice Total:</p>
          <p className="text-2xl font-bold text-v3-orange">£{totalAmount.toFixed(2)}</p>
      </div>

      <div className="flex justify-end">
          <button 
            onClick={handleReviewInvoice} 
            className="button-refresh w-full sm:w-auto" 
            disabled={isReviewDisabled}
          >
              {isSubmitting ? <Loader2 className="animate-spin"/> : 'Review Invoice'}
          </button>
      </div>

      {isReviewDisabled && (
        <div className="text-center text-sm text-v3-text-muted">
          {!invoiceNumber.trim() && "Please enter an invoice number. "}
          {totalAmount === 0 && "Please add at least one line item with valid values."}
        </div>
      )}

    </div>
  );
};

export default CreateMiscInvoice;
