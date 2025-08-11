import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Send, Calendar, MapPin, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const UpdateInvoicePage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { apiCall } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [job, setJob] = useState(null);
  const [hoursWorked, setHoursWorked] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [showInvoiceNoDialog, setShowInvoiceNoDialog] = useState(false);
  const [newInvoiceNo, setNewInvoiceNo] = useState('');
  const [updateNextMode, setUpdateNextMode] = useState('auto');
  const [updatingInvoiceNo, setUpdatingInvoiceNo] = useState(false);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      try {
        setLoading(true);
        const data = await apiCall(`/agent/invoices/${invoiceId}`);
        setInvoice(data.invoice);
        setJob(data.job);
        
        // Pre-populate with existing values if available
        if (data.invoice_job) {
          setHoursWorked(data.invoice_job.hours_worked.toString());
          setHourlyRate(data.invoice_job.hourly_rate_at_invoice.toString());
        }
      } catch (error) {
        toast.error('Failed to load invoice details', { description: error.message });
        navigate('/agent/invoices');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoiceId, apiCall, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!hoursWorked || !hourlyRate) {
      toast.error('Please fill in both hours worked and hourly rate');
      return;
    }

    const hours = parseFloat(hoursWorked);
    const rate = parseFloat(hourlyRate);

    if (hours <= 0 || rate <= 0) {
      toast.error('Hours worked and hourly rate must be greater than 0');
      return;
    }

    try {
      setSubmitting(true);
      await apiCall(`/agent/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          hours_worked: hours,
          hourly_rate: rate
        })
      });

      toast.success('Invoice sent successfully!');
      navigate('/agent/invoices');
    } catch (error) {
      toast.error('Failed to send invoice', { description: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  const calculateTotal = () => {
    const hours = parseFloat(hoursWorked) || 0;
    const rate = parseFloat(hourlyRate) || 0;
    return (hours * rate).toFixed(2);
  };

  const handleEditInvoiceNo = () => {
    setNewInvoiceNo(invoice.agent_invoice_number?.toString() || '');
    setShowInvoiceNoDialog(true);
  };

  const handleUpdateInvoiceNo = async () => {
    if (!newInvoiceNo || parseInt(newInvoiceNo) <= 0) {
      toast.error('Please enter a valid invoice number');
      return;
    }

    try {
      setUpdatingInvoiceNo(true);
      const result = await apiCall(`/agent/invoices/${invoiceId}/agent-number`, {
        method: 'PATCH',
        body: JSON.stringify({
          agent_invoice_number: parseInt(newInvoiceNo),
          update_next: updateNextMode
        })
      });

      setInvoice(result.invoice);
      setShowInvoiceNoDialog(false);
      toast.success('Invoice number updated successfully');
    } catch (error) {
      if (error.status === 409 && error.suggestedNext) {
        toast.error('Duplicate Invoice Number', {
          description: `Number ${newInvoiceNo} is already in use. Try ${error.suggestedNext} instead.`
        });
        setNewInvoiceNo(error.suggestedNext.toString());
      } else {
        toast.error('Failed to update invoice number', { description: error.message });
      }
    } finally {
      setUpdatingInvoiceNo(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-v3-orange" />
      </div>
    );
  }

  if (!invoice || !job) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500">Invoice or job not found</p>
        <Button onClick={() => navigate('/agent/invoices')} className="mt-4">
          Back to Invoices
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/agent/invoices')}
          className="text-v3-text-muted hover:text-v3-text-lightest"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Invoices
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-v3-text-lightest">Complete Invoice</h1>
          <p className="text-v3-text-muted">Invoice #{invoice.invoice_number}</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Job Details Card */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-v3-text-lightest">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-v3-text-muted">Job Address</Label>
              <p className="text-v3-text-lightest font-medium">{job.address}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-v3-text-muted flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Address
              </Label>
              <p className="text-v3-text-lightest">{job.address}</p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-v3-text-muted flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Job Date
              </Label>
              <p className="text-v3-text-lightest">
                {new Date(job.arrival_time).toLocaleDateString()}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-v3-text-muted flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Arrival Time
              </Label>
              <p className="text-v3-text-lightest">
                {new Date(job.arrival_time).toLocaleTimeString()}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Form Card */}
        <Card className="dashboard-card">
          <CardHeader>
            <CardTitle className="text-v3-text-lightest">Complete Invoice</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="hoursWorked" className="text-v3-text-lightest">
                  Hours Worked
                </Label>
                <Input
                  id="hoursWorked"
                  type="number"
                  step="0.5"
                  min="0"
                  value={hoursWorked}
                  onChange={(e) => setHoursWorked(e.target.value)}
                  placeholder="Enter hours worked"
                  className="bg-v3-bg-dark border-v3-border text-v3-text-lightest"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="hourlyRate" className="text-v3-text-lightest">
                  Hourly Rate (£)
                </Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(e.target.value)}
                  placeholder="Enter hourly rate"
                  className="bg-v3-bg-dark border-v3-border text-v3-text-lightest"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-v3-text-lightest">Total Amount</Label>
                <div className="text-2xl font-bold text-v3-orange">
                  £{calculateTotal()}
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || !hoursWorked || !hourlyRate}
                className="w-full button-refresh"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Send Invoice
              </Button>
            </form>

            {/* Agent Invoice Number Section */}
            <div className="border-t border-v3-border pt-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <Label className="text-v3-text-lightest text-base font-medium">Agent Invoice Number</Label>
                  <p className="text-sm text-v3-text-muted">Your personal invoice sequence number</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditInvoiceNo}
                  className="text-v3-text-lightest border-v3-border hover:bg-v3-bg-dark"
                >
                  Edit
                </Button>
              </div>
              <div className="text-lg font-semibold text-v3-orange">
                Invoice Number: {invoice.agent_invoice_number || 'Not set'}
              </div>
            </div>

            {/* Invoice Number Edit Dialog */}
            {showInvoiceNoDialog && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-v3-bg-card rounded-lg p-6 w-full max-w-md border border-v3-border">
                  <h3 className="text-lg font-semibold text-v3-text-lightest mb-4">Edit Agent Invoice Number</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="newInvoiceNo" className="text-v3-text-lightest">Invoice Number</Label>
                      <Input
                        id="newInvoiceNo"
                        type="number"
                        min="1"
                        max="999999999"
                        value={newInvoiceNo}
                        onChange={(e) => setNewInvoiceNo(e.target.value)}
                        placeholder="Enter new agent invoice number"
                        className="bg-v3-bg-dark border-v3-border text-v3-text-lightest mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-v3-text-lightest">Update next number</Label>
                      <select
                        value={updateNextMode}
                        onChange={(e) => setUpdateNextMode(e.target.value)}
                        className="w-full mt-1 bg-v3-bg-dark border-v3-border rounded-md px-3 py-2 text-v3-text-lightest"
                      >
                        <option value="auto">Auto (next = max(current, new + 1))</option>
                        <option value="force">Force (next = new + 1)</option>
                        <option value="nochange">No change (keep current next)</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="flex justify-end gap-2 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setShowInvoiceNoDialog(false)}
                      disabled={updatingInvoiceNo}
                      className="text-v3-text-muted border-v3-border hover:bg-v3-bg-dark"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleUpdateInvoiceNo}
                      disabled={updatingInvoiceNo || !newInvoiceNo}
                      className="button-refresh"
                    >
                      {updatingInvoiceNo ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      Update
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdateInvoicePage; 