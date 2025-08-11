import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Input } from './ui/input';  
import { Textarea } from './ui/textarea';
import { 
  X, 
  Download, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle,
  DollarSign,
  Calendar,
  FileText,
  User,
  Building,
  Hash,
  MapPin,
  Phone,
  Mail
} from 'lucide-react';

const AdminInvoiceDetails = ({ invoice, agent, isOpen, onClose, onMarkAsPaid, onRefresh }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [adminNotes, setAdminNotes] = useState('');
  const [error, setError] = useState(null);

  const handleMarkAsPaid = async () => {
    try {
      setIsProcessing(true);
      setError(null);
      
      await onMarkAsPaid(invoice.id, paymentDate, adminNotes);
      
      setShowPaymentForm(false);
      setAdminNotes('');
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      setError('Failed to mark invoice as paid. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadInvoice = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/invoices/${invoice.id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Open the download URL in a new window
      window.open(data.download_url, '_blank');
    } catch (error) {
      console.error('Error downloading invoice:', error);
      setError('Failed to download invoice. Please try again.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800 border-green-200';
      case 'unpaid': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'overdue': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4" />;
      case 'overdue': return <AlertTriangle className="h-4 w-4" />;
      case 'unpaid': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  if (!isOpen || !invoice) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <FileText className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Invoice Details</h2>
              <p className="text-gray-600">{invoice.invoice_number}</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Badge className={`${getStatusColor(invoice.payment_status)} border px-3 py-1`}>
              {getStatusIcon(invoice.payment_status)}
              <span className="ml-2 capitalize font-medium">{invoice.payment_status}</span>
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Invoice Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Hash className="h-5 w-5 mr-2" />
                  Invoice Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Invoice Number</label>
                    <p className="font-mono text-lg font-semibold">{invoice.invoice_number}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Total Amount</label>
                    <p className="text-2xl font-bold text-green-600">
                      £{parseFloat(invoice.total_amount).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Issue Date</label>
                    <p className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                      {new Date(invoice.issue_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Due Date</label>
                    <p className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                      {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'Not set'}
                    </p>
                  </div>
                </div>

                {invoice.generated_at && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Generated</label>
                    <p className="flex items-center text-sm text-gray-700">
                      <Clock className="h-4 w-4 mr-1 text-gray-400" />
                      {new Date(invoice.generated_at).toLocaleString()}
                    </p>
                  </div>
                )}

                {invoice.download_count > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Downloads</label>
                    <p className="text-sm text-gray-700">
                      Downloaded {invoice.download_count} time(s)
                      {invoice.last_downloaded && (
                        <span className="block text-xs text-gray-500">
                          Last: {new Date(invoice.last_downloaded).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Agent Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Name</label>
                  <p className="font-semibold">{agent?.name || 'Unknown Agent'}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <p className="flex items-center">
                    <Mail className="h-4 w-4 mr-1 text-gray-400" />
                    {agent?.email || 'Not available'}
                  </p>
                </div>

                {agent?.verification_status && (
                  <div>
                    <label className="text-sm font-medium text-gray-600">Verification Status</label>
                    <Badge className={`${getStatusColor(agent.verification_status)} border mt-1`}>
                      {agent.verification_status}
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Job Details */}
            {invoice.jobs && invoice.jobs.length > 0 && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building className="h-5 w-5 mr-2" />
                    Job Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {invoice.jobs.map((jobItem, index) => (
                      <div key={index} className="p-4 bg-gray-50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-600">Job Address</label>
                            <p className="font-medium">{jobItem.job?.address || 'N/A'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Hours Worked</label>
                            <p className="font-medium">{parseFloat(jobItem.hours_worked).toFixed(2)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Hourly Rate</label>
                            <p className="font-medium">£{parseFloat(jobItem.hourly_rate_at_invoice || 0).toFixed(2)}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-600">Amount</label>
                            <p className="font-bold text-green-600">
                              £{(parseFloat(jobItem.hours_worked) * parseFloat(jobItem.hourly_rate_at_invoice || 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        {jobItem.job?.address && (
                          <div className="mt-2">
                            <label className="text-sm font-medium text-gray-600">Location</label>
                            <p className="flex items-center text-sm">
                              <MapPin className="h-4 w-4 mr-1 text-gray-400" />
                              {jobItem.job.address}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payment Information */}
            {invoice.payment_status === 'paid' && (
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center text-green-700">
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-600">Payment Date</label>
                      <p className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                        {invoice.payment_date 
                          ? new Date(invoice.payment_date).toLocaleDateString()
                          : 'Not recorded'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-600">Marked Paid By</label>
                      <p>{invoice.paid_by_admin || 'System'}</p>
                    </div>
                  </div>
                  
                  {invoice.admin_notes && (
                    <div>
                      <label className="text-sm font-medium text-gray-600">Admin Notes</label>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded">
                        {invoice.admin_notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Payment Form */}
          {showPaymentForm && invoice.payment_status !== 'paid' && (
            <Card className="mt-6 border-green-200">
              <CardHeader>
                <CardTitle className="text-green-700">Mark Invoice as Paid</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Payment Date
                    </label>
                    <Input
                      type="date"
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Admin Notes (Optional)
                  </label>
                  <Textarea
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Add any notes about this payment..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end space-x-3">
                  <Button
                    variant="outline"
                    onClick={() => setShowPaymentForm(false)}
                    disabled={isProcessing}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleMarkAsPaid}
                    disabled={isProcessing}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isProcessing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Confirm Payment
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center mt-8 pt-6 border-t">
            <div>
              <Button variant="outline" onClick={handleDownloadInvoice}>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </div>

            <div className="flex space-x-3">
              {invoice.payment_status === 'unpaid' && !showPaymentForm && (
                <Button
                  onClick={() => setShowPaymentForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Mark as Paid
                </Button>
              )}
              
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminInvoiceDetails;