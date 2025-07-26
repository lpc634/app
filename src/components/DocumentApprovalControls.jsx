import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  X, 
  AlertTriangle, 
  FileText,
  User,
  Mail,
  Loader2
} from 'lucide-react';

const DocumentApprovalControls = ({ 
  agent, 
  isOpen, 
  onClose, 
  onApprove, 
  onReject, 
  isProcessing 
}) => {
  const [action, setAction] = useState('');
  const [notes, setNotes] = useState('');
  const [documentFeedback, setDocumentFeedback] = useState({});
  const [showConfirmation, setShowConfirmation] = useState(false);

  const handleSubmit = () => {
    if (!action) return;
    
    setShowConfirmation(true);
  };

  const handleConfirmAction = async () => {
    try {
      if (action === 'approve') {
        await onApprove(notes, documentFeedback);
      } else if (action === 'reject') {
        await onReject(notes, documentFeedback);
      }
      
      // Reset form
      setAction('');
      setNotes('');
      setDocumentFeedback({});
      setShowConfirmation(false);
    } catch (error) {
      console.error('Error processing action:', error);
    }
  };

  const handleCancel = () => {
    setAction('');
    setNotes('');
    setDocumentFeedback({});
    setShowConfirmation(false);
    onClose();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDocumentType = (type) => {
    const types = {
      'id_card': 'ID Card',
      'passport': 'Passport',
      'driver_license': 'Driver License',
      'sia_license': 'SIA License',
      'other': 'Other Document'
    };
    return types[type] || 'Unknown';
  };

  const hasDocuments = agent?.documents_metadata && agent.documents_metadata.length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold">
                {showConfirmation ? 'Confirm Action' : 'Agent Document Verification'}
              </DialogTitle>
              <DialogDescription className="mt-1">
                {showConfirmation 
                  ? `Confirm ${action} for ${agent?.name}`
                  : `Review and verify documents for ${agent?.name}`
                }
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isProcessing}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {!showConfirmation ? (
          <div className="space-y-6">
            {/* Agent Information */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Agent Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium">{agent?.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Mail className="h-4 w-4 text-gray-600" />
                  <span className="text-sm text-gray-600">{agent?.email}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Current Status:</span>
                  <Badge className={`${getStatusColor(agent?.verification_status)} border text-xs`}>
                    {agent?.verification_status}
                  </Badge>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Documents:</span>
                  <span className="text-sm font-medium">{agent?.document_count || 0}</span>
                </div>
              </div>
            </div>

            {/* Documents Summary */}
            {hasDocuments && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">Document Summary</h3>
                <div className="space-y-2">
                  {agent.documents_metadata.map((document, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        <FileText className="h-4 w-4 text-gray-600" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDocumentType(document.metadata?.document_type)}
                          </p>
                          <p className="text-xs text-gray-600">{document.filename}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Previous Notes */}
            {agent?.verification_notes && (
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-2">Previous Notes</h3>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">{agent.verification_notes}</p>
                </div>
              </div>
            )}

            {/* Action Selection */}
            <div>
              <h3 className="text-sm font-medium text-gray-900 mb-3">Verification Decision</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setAction('approve')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    action === 'approve'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <CheckCircle className={`h-5 w-5 ${
                      action === 'approve' ? 'text-green-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">Approve Agent</p>
                      <p className="text-sm text-gray-600">Documents are valid and complete</p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAction('reject')}
                  className={`p-4 border-2 rounded-lg text-left transition-all ${
                    action === 'reject'
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-red-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <XCircle className={`h-5 w-5 ${
                      action === 'reject' ? 'text-red-600' : 'text-gray-400'
                    }`} />
                    <div>
                      <p className="font-medium text-gray-900">Reject Agent</p>
                      <p className="text-sm text-gray-600">Documents need correction</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Notes Section */}
            <div>
              <label className="text-sm font-medium text-gray-900 block mb-2">
                Admin Notes {action === 'reject' && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                placeholder={
                  action === 'approve'
                    ? "Optional: Add any notes about the verification..."
                    : action === 'reject'
                    ? "Required: Explain what needs to be corrected..."
                    : "Add notes about your verification decision..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="w-full"
              />
              {action === 'reject' && !notes.trim() && (
                <p className="text-xs text-red-600 mt-1">
                  Please provide feedback for rejected applications
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={!action || (action === 'reject' && !notes.trim()) || isProcessing}
                className={
                  action === 'approve'
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : action === 'reject'
                    ? "bg-red-600 hover:bg-red-700 text-white"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }
              >
                {action === 'approve' ? 'Approve Agent' : action === 'reject' ? 'Reject Agent' : 'Select Action'}
              </Button>
            </div>
          </div>
        ) : (
          /* Confirmation Dialog */
          <div className="space-y-6">
            <Alert className={action === 'approve' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
              <AlertTriangle className={`h-4 w-4 ${action === 'approve' ? 'text-green-600' : 'text-red-600'}`} />
              <AlertDescription className={action === 'approve' ? 'text-green-800' : 'text-red-800'}>
                {action === 'approve' 
                  ? `You are about to approve ${agent?.name} for verification. This will grant them full access to the system.`
                  : `You are about to reject ${agent?.name}'s verification. They will be notified and may need to resubmit documents.`
                }
              </AlertDescription>
            </Alert>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Review Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Agent:</span>
                  <span className="font-medium">{agent?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Action:</span>
                  <Badge className={action === 'approve' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                    {action === 'approve' ? 'Approve' : 'Reject'}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Documents:</span>
                  <span className="font-medium">{agent?.document_count || 0}</span>
                </div>
                {notes && (
                  <div className="pt-2 border-t">
                    <span className="text-gray-600 block mb-1">Notes:</span>
                    <p className="text-gray-900 bg-white p-2 rounded border text-xs">{notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmation(false)}
                disabled={isProcessing}
              >
                Back
              </Button>
              <Button
                type="button"
                onClick={handleConfirmAction}
                disabled={isProcessing}
                className={
                  action === 'approve'
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Confirm ${action === 'approve' ? 'Approval' : 'Rejection'}`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DocumentApprovalControls;