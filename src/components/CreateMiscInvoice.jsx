import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '../useAuth';

const CreateMiscInvoice = () => {
  const navigate = useNavigate();
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

  const { apiCall } = useAuth();

  const handleReviewInvoice = async () => {
    const validItems = lineItems.filter(item => 
      item.description.trim() !== '' &&
      parseFloat(item.quantity) > 0 &&
      parseFloat(item.unit_price) > 0
    );

    if (validItems.length === 0) {
      toast.error("Invalid Line Items", { description: "Please ensure at least one line item has a description, quantity, and price." });
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Create misc invoice directly
      const invoiceData = {
        items: validItems.map(item => ({
          description: item.description,
          quantity: parseFloat(item.quantity),
          unit_price: parseFloat(item.unit_price)
        }))
      };

      const response = await apiCall('/agent/invoice/misc', {
        method: 'POST',
        body: JSON.stringify(invoiceData)
      });

      toast.success("Invoice Created Successfully!", { 
        description: `Invoice ${response.invoice_number} for £${totalAmount.toFixed(2)} has been created.` 
      });
      
      // Navigate back to invoices list
      navigate('/agent/invoices');
      
    } catch (error) {
      console.error('Error creating misc invoice:', error);
      toast.error("Failed to Create Invoice", { description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };


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
          <button onClick={handleReviewInvoice} className="button-refresh w-full sm:w-auto" disabled={totalAmount === 0 || isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin"/> : 'Review Invoice'}
          </button>
      </div>

    </div>
  );
};

export default CreateMiscInvoice;
