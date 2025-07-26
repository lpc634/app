import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  User, 
  Mail, 
  Calendar,
  Download,
  AlertTriangle
} from 'lucide-react';
import DocumentApprovalControls from './DocumentApprovalControls';

const AgentVerificationCard = ({ agent, onViewDocument, onVerifyAgent }) => {
  const [showApprovalControls, setShowApprovalControls] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800 border-green-200';
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified': return <CheckCircle className="h-4 w-4" />;
      case 'rejected': return <XCircle className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
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

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleApproval = async (action, notes, documentFeedback) => {
    try {
      setIsProcessing(true);
      await onVerifyAgent(agent.id, action, notes, documentFeedback);
      setShowApprovalControls(false);
    } catch (error) {
      console.error('Error processing approval:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const hasDocuments = agent.documents_metadata && agent.documents_metadata.length > 0;
  const hasLegacyDocuments = agent.has_id_document || agent.has_sia_document;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <User className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">{agent.name}</CardTitle>
              <div className="flex items-center text-sm text-gray-600 mt-1">
                <Mail className="h-4 w-4 mr-1" />
                {agent.email}
              </div>
              {agent.created_at && (
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  <Calendar className="h-4 w-4 mr-1" />
                  Registered: {new Date(agent.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Badge className={`${getStatusColor(agent.verification_status)} border`}>
              {getStatusIcon(agent.verification_status)}
              <span className="ml-1 capitalize">{agent.verification_status}</span>
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Document Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <FileText className="h-6 w-6 text-blue-600 mx-auto mb-1" />
            <p className="text-lg font-semibold text-blue-900">{agent.document_count || 0}</p>
            <p className="text-sm text-blue-700">Documents</p>
          </div>
          
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <div className="h-6 w-6 mx-auto mb-1 text-gray-600">
              {agent.document_types?.length > 0 ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>
            <p className="text-lg font-semibold text-gray-900">
              {agent.document_types?.length || 0}
            </p>
            <p className="text-sm text-gray-700">Types</p>
          </div>
          
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="h-6 w-6 mx-auto mb-1">
              {agent.verification_status === 'verified' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <Clock className="h-6 w-6 text-yellow-600" />
              )}
            </div>
            <p className="text-lg font-semibold text-green-900">
              {agent.verification_status === 'verified' ? 'Complete' : 'Pending'}
            </p>
            <p className="text-sm text-green-700">Status</p>
          </div>
        </div>

        {/* Documents List */}
        {hasDocuments && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Uploaded Documents</h4>
            <div className="space-y-2">
              {agent.documents_metadata.map((document, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-gray-600" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {formatDocumentType(document.metadata?.document_type)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {document.filename} • {formatFileSize(document.size)}
                      </p>
                      {document.last_modified && (
                        <p className="text-xs text-gray-500">
                          Uploaded: {new Date(document.last_modified).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewDocument(agent, document)}
                    className="shrink-0"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Documents */}
        {hasLegacyDocuments && !hasDocuments && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Legacy Documents</h4>
            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                This agent has documents uploaded to the legacy system. 
                {agent.has_id_document && ' ID Document uploaded.'}
                {agent.has_sia_document && ' SIA Document uploaded.'}
              </AlertDescription>
            </Alert>
          </div>
        )}

        {/* No Documents */}
        {!hasDocuments && !hasLegacyDocuments && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              No documents have been uploaded by this agent yet.
            </AlertDescription>
          </Alert>
        )}

        {/* Verification Notes - Temporarily disabled until database migration */}
        {false && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-1">Admin Notes</h4>
            <p className="text-sm text-gray-700">Notes will be available after database migration</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-gray-600">
            {agent.verification_status === 'verified' && (
              <span>
                Status: Verified
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            {agent.verification_status === 'pending' && (hasDocuments || hasLegacyDocuments) && (
              <Button
                onClick={() => setShowApprovalControls(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Review & Verify'}
              </Button>
            )}
            
            {agent.verification_status !== 'pending' && (
              <Button
                variant="outline"
                onClick={() => setShowApprovalControls(true)}
                disabled={isProcessing}
              >
                Update Status
              </Button>
            )}
          </div>
        </div>

        {/* Approval Controls Modal */}
        {showApprovalControls && (
          <DocumentApprovalControls
            agent={agent}
            isOpen={showApprovalControls}
            onClose={() => setShowApprovalControls(false)}
            onApprove={(notes, feedback) => handleApproval('approve', notes, feedback)}
            onReject={(notes, feedback) => handleApproval('reject', notes, feedback)}
            isProcessing={isProcessing}
          />
        )}
      </CardContent>
    </Card>
  );
};

export default AgentVerificationCard;