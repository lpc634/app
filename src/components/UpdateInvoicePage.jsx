import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Send, Calendar, MapPin, Clock, Plus, X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const UpdateInvoicePage = () => {
  const { invoiceId } = useParams();
  const navigate = useNavigate();
  const { apiCall, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [job, setJob] = useState(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [timeEntries, setTimeEntries] = useState([
    {
      id: Date.now(),
      work_date: new Date().toISOString().split('T')[0],
      hours: '',
      rate_net: '',
      notes: ''
    }
  ]);

  useEffect(() => {
    const fetchInvoiceDetails = async () => {
      try {
        setLoading(true);
        const data = await apiCall(`/agent/invoices/${invoiceId}`);
        setInvoice(data.invoice);
        setJob(data.job);
        
        // Pre-populate with existing values if available
        if (data.invoice_job) {
          // Check if we have time_entries format or legacy single entry
          if (data.invoice_job.time_entries && Array.isArray(data.invoice_job.time_entries)) {
            setTimeEntries(data.invoice_job.time_entries.map((entry, index) => ({
              id: Date.now() + index,
              work_date: entry.work_date || new Date().toISOString().split('T')[0],
              hours: entry.hours?.toString() || '',
              rate_net: entry.rate_net?.toString() || '',
              notes: entry.notes || ''
            })));
          } else {
            // Legacy single entry - convert to time_entries format
            setTimeEntries([{
              id: Date.now(),
              work_date: new Date().toISOString().split('T')[0],
              hours: data.invoice_job.hours_worked?.toString() || '',
              rate_net: data.invoice_job.hourly_rate_at_invoice?.toString() || '',
              notes: ''
            }]);
          }
        }
        
        // Agents must enter their own invoice number; do not prefill
        setInvoiceNumber('');
      } catch (error) {
        toast.error('Failed to load invoice details', { description: error.message });
        navigate('/agent/invoices');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoiceDetails();
  }, [invoiceId, apiCall, navigate]);

  // Helper functions for managing time entries
  const addTimeEntry = () => {
    setTimeEntries(prev => [
      ...prev,
      {
        id: Date.now(),
        work_date: new Date().toISOString().split('T')[0],
        hours: '',
        rate_net: '',
        notes: ''
      }
    ]);
  };

  const removeTimeEntry = (id) => {
    if (timeEntries.length > 1) {
      setTimeEntries(prev => prev.filter(entry => entry.id !== id));
    }
  };

  const updateTimeEntry = (id, field, value) => {
    setTimeEntries(prev =>
      prev.map(entry =>
        entry.id === id ? { ...entry, [field]: value } : entry
      )
    );
  };

  const validateTimeEntries = () => {
    for (const entry of timeEntries) {
      if (!entry.work_date) {
        toast.error('Please fill in all work dates');
        return false;
      }
      if (!entry.hours || parseFloat(entry.hours) <= 0) {
        toast.error('All hours must be greater than 0');
        return false;
      }
      if (!entry.rate_net || parseFloat(entry.rate_net) <= 0) {
        toast.error('All hourly rates must be greater than 0');
        return false;
      }
    }
    return true;
  };

  const calculateTotal = () => {
    return timeEntries.reduce((total, entry) => {
      const hours = parseFloat(entry.hours) || 0;
      const rate = parseFloat(entry.rate_net) || 0;
      return total + (hours * rate);
    }, 0).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!invoiceNumber.trim()) {
      toast.error('Please enter an invoice number');
      return;
    }

    if (!validateTimeEntries()) {
      return;
    }

    try {
      setSubmitting(true);

      // Prepare time entries for submission
      const entriesForSubmission = timeEntries.map(entry => ({
        work_date: entry.work_date,
        hours: parseFloat(entry.hours),
        rate_net: parseFloat(entry.rate_net),
        notes: entry.notes || null
      }));

      await apiCall(`/agent/invoices/${invoiceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          time_entries: entriesForSubmission,
          invoice_number: invoiceNumber.trim()
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
              {/* Time Entries Section */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-v3-text-lightest text-lg font-medium">
                    Time Entries
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addTimeEntry}
                    className="border-v3-border text-v3-text-lightest hover:bg-v3-bg-dark"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Another Day
                  </Button>
                </div>

                <div className="space-y-4">
                  {timeEntries.map((entry, index) => (
                    <div key={entry.id} className="p-4 border border-v3-border rounded-lg bg-v3-bg-dark/20">
                      <div className="flex items-center justify-between mb-3">
                        <Label className="text-v3-text-muted font-medium">
                          Day {index + 1}
                        </Label>
                        {timeEntries.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTimeEntry(entry.id)}
                            className="text-red-400 hover:text-red-300"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="space-y-2">
                          <Label className="text-v3-text-muted text-sm">Work Date</Label>
                          <Input
                            type="date"
                            value={entry.work_date}
                            onChange={(e) => updateTimeEntry(entry.id, 'work_date', e.target.value)}
                            className="bg-v3-bg-dark border-v3-border text-v3-text-lightest text-sm"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-v3-text-muted text-sm">Hours</Label>
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={entry.hours}
                            onChange={(e) => updateTimeEntry(entry.id, 'hours', e.target.value)}
                            placeholder="8.0"
                            className="bg-v3-bg-dark border-v3-border text-v3-text-lightest text-sm"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-v3-text-muted text-sm">Rate (£/hr)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={entry.rate_net}
                            onChange={(e) => updateTimeEntry(entry.id, 'rate_net', e.target.value)}
                            placeholder="25.00"
                            className="bg-v3-bg-dark border-v3-border text-v3-text-lightest text-sm"
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <Label className="text-v3-text-muted text-sm">Total</Label>
                          <div className="h-9 flex items-center px-3 py-1 border border-v3-border rounded-md bg-v3-bg-darker text-v3-text-lightest text-sm font-medium">
                            £{((parseFloat(entry.hours) || 0) * (parseFloat(entry.rate_net) || 0)).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3">
                        <Label className="text-v3-text-muted text-sm">Notes (Optional)</Label>
                        <Input
                          type="text"
                          value={entry.notes}
                          onChange={(e) => updateTimeEntry(entry.id, 'notes', e.target.value)}
                          placeholder="Optional notes for this day"
                          className="bg-v3-bg-dark border-v3-border text-v3-text-lightest text-sm mt-1"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceNumber" className="text-v3-text-lightest">
                  Invoice Number
                </Label>
                <Input
                  id="invoiceNumber"
                  type="text"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="Enter invoice number (e.g. INV-001)"
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
                disabled={submitting || !invoiceNumber.trim()}
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdateInvoicePage; 