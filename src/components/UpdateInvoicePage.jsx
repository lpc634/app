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
              <Label className="text-v3-text-muted">Job Title</Label>
              <p className="text-v3-text-lightest font-medium">{job.title}</p>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdateInvoicePage; 