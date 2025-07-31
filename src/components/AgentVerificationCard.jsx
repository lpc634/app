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
      case 'verified': return 'bg-green-900/50 text-green-400 border-green-500/50';
      case 'rejected': return 'bg-red-900/50 text-red-400 border-red-500/50';
      case 'pending': return 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50';
      default: return 'bg-gray-900/50 text-gray-400 border-gray-500/50';
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
    <div className="dashboard-card p-6 mb-6 hover:shadow-lg transition-shadow">
      <div className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-v3-orange bg-opacity-20 rounded-full">
              <User className="h-5 w-5 text-v3-orange" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-v3-text-lightest">{agent.name}</h3>
              <div className="flex items-center text-sm text-v3-text-muted mt-1">
                <Mail className="h-4 w-4 mr-1" />
                {agent.email}
              </div>
              {agent.created_at && (
                <div className="flex items-center text-sm text-v3-text-muted mt-1">
                  <Calendar className="h-4 w-4 mr-1" />
                  Registered: {new Date(agent.created_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(agent.verification_status)}`}>
              {getStatusIcon(agent.verification_status)}
              <span className="ml-1 capitalize">{agent.verification_status}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Document Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="dashboard-card p-4 text-center">
            <FileText className="h-6 w-6 text-v3-orange mx-auto mb-1" />
            <p className="text-lg font-semibold text-v3-orange">{agent.document_count || 0}</p>
            <p className="text-sm text-v3-text-muted">Documents</p>
          </div>
          
          <div className="dashboard-card p-4 text-center">
            <div className="h-6 w-6 mx-auto mb-1 text-v3-text-muted">
              {agent.document_types?.length > 0 ? (
                <CheckCircle className="h-6 w-6 text-v3-orange" />
              ) : (
                <AlertTriangle className="h-6 w-6" />
              )}
            </div>
            <p className="text-lg font-semibold text-v3-orange">
              {agent.document_types?.length || 0}
            </p>
            <p className="text-sm text-v3-text-muted">Types</p>
          </div>
          
          <div className="dashboard-card p-4 text-center">
            <div className="h-6 w-6 mx-auto mb-1">
              {agent.verification_status === 'verified' ? (
                <CheckCircle className="h-6 w-6 text-green-400" />
              ) : (
                <Clock className="h-6 w-6 text-v3-orange" />
              )}
            </div>
            <p className="text-lg font-semibold text-v3-orange">
              {agent.verification_status === 'verified' ? 'Complete' : 'Pending'}
            </p>
            <p className="text-sm text-v3-text-muted">Status</p>
          </div>
        </div>

        {/* Documents List */}
        {hasDocuments && (
          <div>
            <h4 className="text-sm font-medium text-v3-text-lightest mb-2">Uploaded Documents</h4>
            <div className="space-y-2">
              {agent.documents_metadata.map((document, index) => (
                <div
                  key={index}
                  className="dashboard-card p-4 border border-v3-border flex items-center justify-between hover:border-v3-orange transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <FileText className="h-4 w-4 text-v3-orange" />
                    <div>
                      <p className="text-sm font-medium text-v3-text-lightest">
                        {formatDocumentType(document.metadata?.document_type)}
                      </p>
                      <p className="text-xs text-v3-text-muted">
                        {document.filename} • {formatFileSize(document.size)}
                      </p>
                      {document.last_modified && (
                        <p className="text-xs text-v3-text-muted">
                          Uploaded: {new Date(document.last_modified).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onViewDocument(agent, document)}
                    className="px-4 py-2 bg-v3-bg-dark border border-v3-orange text-v3-orange hover:bg-v3-orange hover:text-white transition-colors rounded-lg text-sm shrink-0"
                  >
                    <Eye className="h-4 w-4 mr-1 inline" />
                    View
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Legacy Documents */}
        {hasLegacyDocuments && !hasDocuments && (
          <div>
            <h4 className="text-sm font-medium text-v3-text-lightest mb-2">Legacy Documents</h4>
            <div className="p-4 border border-blue-500 border-opacity-30 bg-blue-500 bg-opacity-10 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-blue-400 mt-0.5" />
                <p className="text-blue-400 text-sm">
                  This agent has documents uploaded to the legacy system. 
                  {agent.has_id_document && ' ID Document uploaded.'}
                  {agent.has_sia_document && ' SIA Document uploaded.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* No Documents */}
        {!hasDocuments && !hasLegacyDocuments && (
          <div className="p-4 border border-yellow-500 border-opacity-30 bg-yellow-500 bg-opacity-10 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5" />
              <p className="text-yellow-400 text-sm">
                No documents have been uploaded by this agent yet.
              </p>
            </div>
          </div>
        )}

        {/* Verification Notes - Temporarily disabled until database migration */}
        {false && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <h4 className="text-sm font-medium text-gray-900 mb-1">Admin Notes</h4>
            <p className="text-sm text-gray-700">Notes will be available after database migration</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-v3-border">
          <div className="text-sm text-v3-text-muted">
            {agent.verification_status === 'verified' && (
              <span>
                Status: Verified
              </span>
            )}
          </div>
          
          <div className="flex space-x-2">
            {agent.verification_status === 'pending' && (hasDocuments || hasLegacyDocuments) && (
              <button
                onClick={() => setShowApprovalControls(true)}
                className="button-refresh"
                disabled={isProcessing}
              >
                {isProcessing ? 'Processing...' : 'Review & Verify'}
              </button>
            )}
            
            {agent.verification_status !== 'pending' && (
              <button
                onClick={() => setShowApprovalControls(true)}
                className="button-refresh"
                disabled={isProcessing}
              >
                Update Status
              </button>
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
      </div>
    </div>
  );
};

export default AgentVerificationCard;