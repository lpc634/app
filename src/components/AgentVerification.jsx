import React, { useState, useEffect } from 'react';
import { useAuth } from '../useAuth';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  FileText, 
  Eye,
  AlertTriangle,
  Loader2,
  X,
  ZoomIn,
  ZoomOut,
  Download,
  RotateCw
} from 'lucide-react';

// Helper function to get document preview URLs using admin endpoint
const getDocumentPreviewUrl = async (documentUrl) => {
  if (!documentUrl) return null;
  
  try {
    // Use the secure admin document preview endpoint
    const fileKey = documentUrl.replace(/\//g, '__'); // Convert slashes to double underscores for URL encoding
    
    // Get auth token from useAuth hook context
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token available');
    }
    
    const response = await fetch(`/api/admin/documents/${fileKey}/preview`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      return data.preview_url;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to get document preview URL:', response.status, errorData);
      throw new Error(errorData.error || `HTTP ${response.status}: Failed to get preview URL`);
    }
  } catch (error) {
    console.error('Error getting document preview URL:', error);
    throw error;
  }
};

const AgentVerification = () => {
  const { apiCall } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [documentViewer, setDocumentViewer] = useState({
    isOpen: false,
    document: null,
    title: '',
    loading: false,
    error: null
  });

  useEffect(() => {
    fetchPendingAgents();
  }, []);

  const fetchPendingAgents = async () => {
    try {
      setLoading(true);
      const response = await apiCall('/admin/agents/verification-pending');
      setAgents(response.agents || []);
    } catch (error) {
      toast.error('Failed to load pending verifications');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAgent = async (agentId, action) => {
    try {
      setVerifying(true);
      await apiCall(`/admin/agents/${agentId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ action }) // 'approve' or 'reject'
      });
      
      toast.success(`Agent ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
      
      // Remove from pending list
      setAgents(agents.filter(agent => agent.id !== agentId));
      setSelectedAgent(null);
      
    } catch (error) {
      toast.error(`Failed to ${action} agent`);
      console.error(error);
    } finally {
      setVerifying(false);
    }
  };

  const openDocumentViewer = async (documentUrl, title) => {
    setDocumentViewer({
      isOpen: true,
      document: null,
      title,
      loading: true,
      error: null
    });

    try {
      const previewUrl = await getDocumentPreviewUrl(documentUrl);
      setDocumentViewer(prev => ({
        ...prev,
        document: {
          url: previewUrl,
          originalPath: documentUrl
        },
        loading: false
      }));
    } catch (error) {
      console.error('Error loading document:', error);
      setDocumentViewer(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to load document. The file may not be available.'
      }));
    }
  };

  const closeDocumentViewer = () => {
    setDocumentViewer({
      isOpen: false,
      document: null,
      title: '',
      loading: false,
      error: null
    });
  };

  const getStatusBadge = (agent) => {
    const hasDocuments = agent.id_document_url || agent.sia_document_url;
    
    if (!hasDocuments) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          No Documents
        </span>
      );
    }
    
    if (agent.verification_status === 'pending') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Clock className="w-3 h-3 mr-1" />
          Pending Review
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
        <CheckCircle className="w-3 h-3 mr-1" />
        Verified
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading pending verifications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Agent Verification</h2>
        <p className="text-muted-foreground">
          Review and verify agent identification documents
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
          <p className="text-muted-foreground">No agents pending verification at the moment.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Agents List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Pending Verifications ({agents.length})</h3>
            {agents.map((agent) => (
              <div 
                key={agent.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedAgent?.id === agent.id 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedAgent(agent)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium">
                        {agent.first_name} {agent.last_name}
                      </p>
                      <p className="text-sm text-gray-500">{agent.email}</p>
                    </div>
                  </div>
                  {getStatusBadge(agent)}
                </div>
                
                <div className="flex items-center text-sm text-gray-500 space-x-4">
                  <span className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    {[agent.id_document_url, agent.sia_document_url].filter(Boolean).length}/2 docs
                  </span>
                  <span>
                    Submitted: {new Date(agent.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Document Viewer */}
          <div className="border rounded-lg p-6">
            {selectedAgent ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-2">
                    {selectedAgent.first_name} {selectedAgent.last_name}
                  </h3>
                  <p className="text-sm text-gray-500">{selectedAgent.email}</p>
                </div>

                {/* Documents - UPDATED SECTION */}
                <div className="space-y-4">
                  <h4 className="font-medium">Uploaded Documents</h4>
                  
                  {selectedAgent.id_document_url ? (
                    <div className="dashboard-card rounded-lg p-4" style={{ background: 'var(--v3-bg-dark)', border: '1px solid var(--v3-border)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-v3-text-lightest">ID Document</h5>
                        <button
                          onClick={() => openDocumentViewer(selectedAgent.id_document_url, `ID Document - ${selectedAgent.first_name} ${selectedAgent.last_name}`)}
                          className="flex items-center gap-2 px-3 py-1 bg-v3-orange hover:bg-v3-orange-dark text-white rounded-md text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Document
                        </button>
                      </div>
                      <div className="bg-v3-bg-darkest rounded-lg p-3 border border-v3-border">
                        <div className="flex items-center gap-2 text-sm text-v3-text-muted">
                          <FileText className="w-4 h-4 text-v3-orange" />
                          <span>Document uploaded and ready for review</span>
                        </div>
                        <p className="text-xs text-v3-text-muted mt-2 break-all">
                          Path: {selectedAgent.id_document_url}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="dashboard-card rounded-lg p-4" style={{ background: 'var(--v3-bg-dark)', border: '2px dashed var(--v3-border)' }}>
                      <div className="text-center text-v3-text-muted">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                        <p className="text-v3-text-light">No ID document uploaded</p>
                        <p className="text-xs mt-1">Agent needs to upload identification document</p>
                      </div>
                    </div>
                  )}

                  {selectedAgent.sia_document_url ? (
                    <div className="dashboard-card rounded-lg p-4" style={{ background: 'var(--v3-bg-dark)', border: '1px solid var(--v3-border)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-v3-text-lightest">SIA Badge</h5>
                        <button
                          onClick={() => openDocumentViewer(selectedAgent.sia_document_url, `SIA Badge - ${selectedAgent.first_name} ${selectedAgent.last_name}`)}
                          className="flex items-center gap-2 px-3 py-1 bg-v3-orange hover:bg-v3-orange-dark text-white rounded-md text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Document
                        </button>
                      </div>
                      <div className="bg-v3-bg-darkest rounded-lg p-3 border border-v3-border">
                        <div className="flex items-center gap-2 text-sm text-v3-text-muted">
                          <FileText className="w-4 h-4 text-v3-orange" />
                          <span>SIA badge document uploaded and ready for review</span>
                        </div>
                        <p className="text-xs text-v3-text-muted mt-2 break-all">
                          Path: {selectedAgent.sia_document_url}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="dashboard-card rounded-lg p-4" style={{ background: 'var(--v3-bg-dark)', border: '2px dashed var(--v3-border)' }}>
                      <div className="text-center text-v3-text-muted">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                        <p className="text-v3-text-light">No SIA document uploaded</p>
                        <p className="text-xs mt-1">Agent needs to upload SIA badge document</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Agent Details */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium mb-3">Agent Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Phone</p>
                      <p>{selectedAgent.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Address</p>
                      <p>{selectedAgent.address_line_1 || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">City</p>
                      <p>{selectedAgent.city || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Postcode</p>
                      <p>{selectedAgent.postcode || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="flex space-x-3 pt-4 border-t">
                  <button
                    onClick={() => handleVerifyAgent(selectedAgent.id, 'approve')}
                    disabled={verifying}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle className="h-4 w-4 mr-2" />
                    )}
                    Approve Agent
                  </button>
                  
                  <button
                    onClick={() => handleVerifyAgent(selectedAgent.id, 'reject')}
                    disabled={verifying}
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                  >
                    {verifying ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <XCircle className="h-4 w-4 mr-2" />
                    )}
                    Reject Agent
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Eye className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Select an agent</h3>
                <p className="text-gray-500">
                  Choose an agent from the list to review their documents
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Document Viewer Modal */}
      {documentViewer.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="dashboard-card max-w-6xl w-full max-h-[95vh] overflow-hidden"
            style={{
              background: 'var(--v3-bg-card)',
              border: '1px solid var(--v3-border)',
              borderRadius: '12px'
            }}
          >
            {/* Modal Header */}
            <div 
              className="p-4 border-b flex items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, var(--v3-bg-dark) 0%, #1F1F1F 100%)',
                borderBottom: '1px solid var(--v3-border)'
              }}
            >
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-v3-orange" />
                <div>
                  <h3 className="text-lg font-semibold text-v3-text-lightest">
                    {documentViewer.title}
                  </h3>
                  <p className="text-sm text-v3-text-muted">
                    Document Verification Review
                  </p>
                </div>
              </div>
              <button
                onClick={closeDocumentViewer}
                className="p-2 hover:bg-v3-bg-dark rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-v3-text-muted hover:text-v3-text-light" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-1 max-h-[calc(95vh-120px)] overflow-auto">
              {documentViewer.loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-v3-orange" />
                    <p className="text-v3-text-muted">Loading document...</p>
                  </div>
                </div>
              ) : documentViewer.error ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-500" />
                    <h4 className="text-lg font-semibold text-v3-text-lightest mb-2">
                      Failed to Load Document
                    </h4>
                    <p className="text-v3-text-muted max-w-md">
                      {documentViewer.error}
                    </p>
                    <button
                      onClick={() => openDocumentViewer(documentViewer.document?.originalPath || selectedAgent?.id_document_url || selectedAgent?.sia_document_url, documentViewer.title)}
                      className="mt-4 px-4 py-2 bg-v3-orange hover:bg-v3-orange-dark text-white rounded-lg transition-colors"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              ) : documentViewer.document ? (
                <div className="space-y-4">
                  {/* Document Controls */}
                  <div className="flex items-center justify-between p-3 bg-v3-bg-dark rounded-lg border border-v3-border">
                    <div className="flex items-center gap-2 text-sm text-v3-text-muted">
                      <FileText className="w-4 h-4 text-v3-orange" />
                      <span>Document ready for review</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => window.open(documentViewer.document.url, '_blank')}
                        className="flex items-center gap-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      <button
                        onClick={() => window.open(documentViewer.document.url, '_blank')}
                        className="flex items-center gap-2 px-3 py-1 bg-v3-orange hover:bg-v3-orange-dark text-white rounded-md text-sm transition-colors"
                      >
                        <ZoomIn className="w-4 h-4" />
                        Full Size
                      </button>
                    </div>
                  </div>

                  {/* Document Preview */}
                  <div className="bg-v3-bg-darkest rounded-lg border border-v3-border overflow-hidden">
                    <div className="p-4">
                      <img
                        src={documentViewer.document.url}
                        alt={documentViewer.title}
                        className="w-full h-auto max-h-[60vh] object-contain mx-auto rounded-lg"
                        onError={(e) => {
                          setDocumentViewer(prev => ({
                            ...prev,
                            error: 'Failed to load image. The file may be corrupted or in an unsupported format.'
                          }));
                        }}
                      />
                    </div>
                  </div>

                  {/* Document Metadata */}
                  <div className="bg-v3-bg-dark rounded-lg border border-v3-border p-4">
                    <h4 className="font-semibold text-v3-text-lightest mb-3">Document Information</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-v3-text-muted">File Path:</span>
                        <p className="text-v3-text-light font-mono text-xs break-all mt-1">
                          {documentViewer.document.originalPath}
                        </p>
                      </div>
                      <div>
                        <span className="text-v3-text-muted">Document Type:</span>
                        <p className="text-v3-text-light mt-1">
                          {documentViewer.title.includes('ID') ? 'Identification Document' : 'SIA Badge'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-v3-border bg-v3-bg-dark">
              <div className="flex items-center justify-between">
                <p className="text-xs text-v3-text-muted">
                  Review document carefully before approving or rejecting agent verification
                </p>
                <button
                  onClick={closeDocumentViewer}
                  className="px-4 py-2 bg-v3-bg-card hover:bg-gray-600 text-v3-text-light rounded-lg border border-v3-border transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentVerification;