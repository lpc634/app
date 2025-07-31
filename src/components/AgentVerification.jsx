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
  RotateCw,
  Maximize2,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

// Simple image URL function - use Flask image proxy route
const getImageUrl = (documentPath) => {
  if (!documentPath) return null;
  // Use the simple Flask proxy route that returns actual images
  console.log('Creating image URL for document path:', documentPath);
  return `/api/images/${documentPath}`;
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
    error: null,
    zoom: 1,
    isFullscreen: false
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
        body: JSON.stringify({ action })
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

  const openDocumentViewer = (documentUrl, title) => {
    console.log('Opening document viewer for:', documentUrl);
    const imageUrl = getImageUrl(documentUrl);
    console.log('Generated image URL:', imageUrl);
    
    setDocumentViewer({
      isOpen: true,
      document: {
        url: imageUrl,
        originalPath: documentUrl
      },
      title,
      loading: false,
      error: null,
      zoom: 1,
      isFullscreen: false
    });
  };

  const closeDocumentViewer = () => {
    setDocumentViewer({
      isOpen: false,
      document: null,
      title: '',
      loading: false,
      error: null,
      zoom: 1,
      isFullscreen: false
    });
  };

  const handleZoom = (direction) => {
    setDocumentViewer(prev => ({
      ...prev,
      zoom: direction === 'in' 
        ? Math.min(prev.zoom * 1.25, 3) 
        : Math.max(prev.zoom * 0.8, 0.25)
    }));
  };

  const toggleFullscreen = () => {
    setDocumentViewer(prev => ({
      ...prev,
      isFullscreen: !prev.isFullscreen
    }));
  };

  const retryDocumentLoad = () => {
    if (documentViewer.document?.originalPath) {
      openDocumentViewer(documentViewer.document.originalPath, documentViewer.title);
    }
  };

  const getStatusBadge = (agent) => {
    const hasDocuments = agent.id_document_url || agent.sia_document_url;
    
    if (!hasDocuments) {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" 
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
          <XCircle className="w-3 h-3 mr-1" />
          No Documents
        </span>
      );
    }
    
    if (agent.verification_status === 'pending') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" 
              style={{ background: 'rgba(255, 87, 34, 0.1)', color: 'var(--v3-orange)', border: '1px solid rgba(255, 87, 34, 0.3)' }}>
          <Clock className="w-3 h-3 mr-1" />
          Pending Review
        </span>
      );
    }
    
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium" 
            style={{ background: 'rgba(34, 197, 94, 0.1)', color: '#4ade80', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
        <CheckCircle className="w-3 h-3 mr-1" />
        Verified
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" style={{ color: 'var(--v3-orange)' }} />
          <span className="text-v3-text-muted">Loading pending verifications...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-v3-text-lightest">Agent Verification</h2>
        <p className="text-v3-text-muted">
          Review and verify agent identification documents
        </p>
      </div>

      {agents.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="mx-auto h-12 w-12 mb-4" style={{ color: '#4ade80' }} />
          <h3 className="text-lg font-semibold mb-2 text-v3-text-lightest">All caught up!</h3>
          <p className="text-v3-text-muted">No agents pending verification at the moment.</p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Agents List */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-v3-text-lightest">Pending Verifications ({agents.length})</h3>
            {agents.map((agent) => (
              <div 
                key={agent.id}
                className={`dashboard-card p-4 cursor-pointer transition-all duration-300 ${
                  selectedAgent?.id === agent.id 
                    ? 'ring-2 ring-orange-500 ring-opacity-50 border-orange-500' 
                    : ''
                }`}
                style={{
                  background: selectedAgent?.id === agent.id 
                    ? 'linear-gradient(135deg, var(--v3-bg-card) 0%, rgba(255, 87, 34, 0.1) 100%)'
                    : 'var(--v3-bg-card)',
                  border: selectedAgent?.id === agent.id 
                    ? '1px solid var(--v3-orange)'
                    : '1px solid var(--v3-border)'
                }}
                onClick={() => setSelectedAgent(agent)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-v3-orange" />
                    <div>
                      <p className="font-medium text-v3-text-lightest">
                        {agent.first_name} {agent.last_name}
                      </p>
                      <p className="text-sm text-v3-text-muted">{agent.email}</p>
                    </div>
                  </div>
                  {getStatusBadge(agent)}
                </div>
                
                <div className="flex items-center text-sm text-v3-text-muted space-x-4">
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
          <div className="dashboard-card p-6">
            {selectedAgent ? (
              <div className="space-y-6">
                <div className="border-b border-v3-border pb-4">
                  <h3 className="text-lg font-medium mb-2 text-v3-text-lightest">
                    {selectedAgent.first_name} {selectedAgent.last_name}
                  </h3>
                  <p className="text-sm text-v3-text-muted">{selectedAgent.email}</p>
                </div>

                {/* Documents Section */}
                <div className="space-y-4">
                  <h4 className="font-medium text-v3-text-lightest">Uploaded Documents</h4>
                  
                  {selectedAgent.id_document_url ? (
                    <div className="dashboard-card rounded-lg p-4" style={{ background: 'var(--v3-bg-dark)', border: '1px solid var(--v3-border)' }}>
                      <div className="flex items-center justify-between mb-3">
                        <h5 className="font-medium text-v3-text-lightest flex items-center gap-2">
                          <FileText className="w-4 h-4 text-v3-orange" />
                          ID Document
                        </h5>
                        <button
                          onClick={() => openDocumentViewer(selectedAgent.id_document_url, `ID Document - ${selectedAgent.first_name} ${selectedAgent.last_name}`)}
                          className="flex items-center gap-2 px-3 py-1 bg-v3-orange hover:bg-v3-orange-dark text-white rounded-md text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Document
                        </button>
                      </div>
                      <div className="bg-v3-bg-darkest rounded-lg p-3 border border-v3-border">
                        <div className="flex items-center gap-2 text-sm text-v3-text-muted mb-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span>Document uploaded and ready for review</span>
                        </div>
                        <p className="text-xs text-v3-text-muted break-all">
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
                        <h5 className="font-medium text-v3-text-lightest flex items-center gap-2">
                          <FileText className="w-4 h-4 text-v3-orange" />
                          SIA Badge
                        </h5>
                        <button
                          onClick={() => openDocumentViewer(selectedAgent.sia_document_url, `SIA Badge - ${selectedAgent.first_name} ${selectedAgent.last_name}`)}
                          className="flex items-center gap-2 px-3 py-1 bg-v3-orange hover:bg-v3-orange-dark text-white rounded-md text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Document
                        </button>
                      </div>
                      <div className="bg-v3-bg-darkest rounded-lg p-3 border border-v3-border">
                        <div className="flex items-center gap-2 text-sm text-v3-text-muted mb-2">
                          <CheckCircle className="w-4 h-4 text-green-400" />
                          <span>SIA badge document uploaded and ready for review</span>
                        </div>
                        <p className="text-xs text-v3-text-muted break-all">
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
                <div className="bg-v3-bg-dark rounded-lg p-4 border border-v3-border">
                  <h4 className="font-medium mb-3 text-v3-text-lightest">Agent Information</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-v3-text-muted">Phone</p>
                      <p className="text-v3-text-light">{selectedAgent.phone || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-v3-text-muted">Address</p>
                      <p className="text-v3-text-light">{selectedAgent.address_line_1 || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-v3-text-muted">City</p>
                      <p className="text-v3-text-light">{selectedAgent.city || 'Not provided'}</p>
                    </div>
                    <div>
                      <p className="text-v3-text-muted">Postcode</p>
                      <p className="text-v3-text-light">{selectedAgent.postcode || 'Not provided'}</p>
                    </div>
                  </div>
                </div>

                {/* Verification Actions */}
                <div className="flex space-x-3 pt-4 border-t border-v3-border">
                  <button
                    onClick={() => handleVerifyAgent(selectedAgent.id, 'approve')}
                    disabled={verifying}
                    className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
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
                    className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
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
                <Eye className="mx-auto h-12 w-12 text-v3-text-muted mb-4" />
                <h3 className="text-lg font-medium mb-2 text-v3-text-lightest">Select an agent</h3>
                <p className="text-v3-text-muted">
                  Choose an agent from the list to review their documents
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Enhanced Document Viewer Modal */}
      {documentViewer.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className={`dashboard-card overflow-hidden transition-all duration-300 ${
              documentViewer.isFullscreen 
                ? 'w-full h-full max-w-none max-h-none' 
                : 'max-w-6xl w-full max-h-[95vh]'
            }`}
            style={{
              background: 'var(--v3-bg-card)',
              border: '1px solid var(--v3-border)',
              borderRadius: documentViewer.isFullscreen ? '0' : '12px'
            }}
          >
            {/* Enhanced Modal Header */}
            <div 
              className="p-4 border-b flex items-center justify-between"
              style={{
                background: 'linear-gradient(135deg, var(--v3-bg-dark) 0%, #1F1F1F 100%)',
                borderBottom: '1px solid var(--v3-border)'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-v3-orange rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-v3-text-lightest">
                    {documentViewer.title}
                  </h3>
                  <p className="text-sm text-v3-text-muted">
                    Document Verification Review
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleFullscreen}
                  className="p-2 hover:bg-v3-bg-dark rounded-lg transition-colors"
                  title={documentViewer.isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  <Maximize2 className="w-5 h-5 text-v3-text-muted hover:text-v3-text-light" />
                </button>
                <button
                  onClick={closeDocumentViewer}
                  className="p-2 hover:bg-v3-bg-dark rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-v3-text-muted hover:text-v3-text-light" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto" style={{ maxHeight: documentViewer.isFullscreen ? 'calc(100vh - 120px)' : 'calc(95vh - 120px)' }}>
              {documentViewer.loading ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-v3-border rounded-full animate-spin mx-auto mb-4"
                           style={{ borderTopColor: 'var(--v3-orange)' }}></div>
                      <FileText className="w-6 h-6 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-v3-orange" />
                    </div>
                    <p className="text-v3-text-muted">Loading document...</p>
                    <p className="text-xs text-v3-text-muted mt-1">This may take a few moments</p>
                  </div>
                </div>
              ) : documentViewer.error ? (
                <div className="flex items-center justify-center py-20">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 bg-red-500 bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-8 h-8 text-red-400" />
                    </div>
                    <h4 className="text-lg font-semibold text-v3-text-lightest mb-2">
                      Failed to Load Document
                    </h4>
                    <p className="text-v3-text-muted mb-4">
                      {documentViewer.error}
                    </p>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={retryDocumentLoad}
                        className="px-4 py-2 bg-v3-orange hover:bg-v3-orange-dark text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <RotateCw className="w-4 h-4" />
                        Try Again
                      </button>
                      <button
                        onClick={closeDocumentViewer}
                        className="px-4 py-2 bg-v3-bg-dark hover:bg-gray-600 text-v3-text-light rounded-lg border border-v3-border transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              ) : documentViewer.document ? (
                <div className="p-6 space-y-4">
                  {/* Document Controls */}
                  <div className="flex items-center justify-between p-3 bg-v3-bg-dark rounded-lg border border-v3-border">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 text-sm text-v3-text-muted">
                        <FileText className="w-4 h-4 text-v3-orange" />
                        <span>Document ready for review</span>
                        {documentViewer.document.isLegacy && (
                          <span className="px-2 py-1 bg-yellow-500 bg-opacity-10 text-yellow-400 rounded text-xs">
                            Legacy Format
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-v3-text-muted">
                        <span>Zoom: {Math.round(documentViewer.zoom * 100)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleZoom('out')}
                        disabled={documentViewer.zoom <= 0.25}
                        className="p-2 bg-v3-bg-card hover:bg-gray-600 rounded border border-v3-border disabled:opacity-50 transition-colors"
                      >
                        <ZoomOut className="w-4 h-4 text-v3-text-light" />
                      </button>
                      <button
                        onClick={() => handleZoom('in')}
                        disabled={documentViewer.zoom >= 3}
                        className="p-2 bg-v3-bg-card hover:bg-gray-600 rounded border border-v3-border disabled:opacity-50 transition-colors"
                      >
                        <ZoomIn className="w-4 h-4 text-v3-text-light" />
                      </button>
                      <button
                        onClick={() => window.open(documentViewer.document.url, '_blank')}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                      <button
                        onClick={() => window.open(documentViewer.document.url, '_blank')}
                        className="flex items-center gap-2 px-3 py-2 bg-v3-orange hover:bg-v3-orange-dark text-white rounded text-sm transition-colors"
                      >
                        <Maximize2 className="w-4 h-4" />
                        Full Size
                      </button>
                    </div>
                  </div>

                  {/* Document Preview */}
                  <div className="bg-v3-bg-darkest rounded-lg border border-v3-border overflow-hidden">
                    <div className="p-4 text-center">
                      <img
                        src={documentViewer.document.url}
                        alt={documentViewer.title}
                        className="max-w-full h-auto rounded-lg transition-transform duration-200"
                        style={{ 
                          transform: `scale(${documentViewer.zoom})`,
                          maxHeight: documentViewer.isFullscreen ? '70vh' : '60vh',
                          objectFit: 'contain'
                        }}
                        onError={(e) => {
                          console.error('Image failed to load:', e.target.src);
                          console.error('Original document path:', documentViewer.document.originalPath);
                          setDocumentViewer(prev => ({
                            ...prev,
                            error: 'Failed to load image. The file may be corrupted, in an unsupported format, or the server may be experiencing issues.'
                          }));
                        }}
                        onLoad={() => console.log('Image loaded successfully:', documentViewer.document.url)}
                      />
                    </div>
                  </div>

                  {/* Document Metadata */}
                  <div className="bg-v3-bg-dark rounded-lg border border-v3-border p-4">
                    <h4 className="font-semibold text-v3-text-lightest mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-v3-orange" />
                      Document Information
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-v3-text-muted">Original Path:</span>
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
                      <div>
                        <span className="text-v3-text-muted">File Key Used:</span>
                        <p className="text-v3-text-light font-mono text-xs break-all mt-1">
                          {documentViewer.document.fileKey}
                        </p>
                      </div>
                      <div>
                        <span className="text-v3-text-muted">Format:</span>
                        <p className="text-v3-text-light mt-1">
                          {documentViewer.document.isLegacy ? 'Legacy Storage' : 'New Storage'}
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
                <div className="flex gap-2">
                  {selectedAgent && (
                    <>
                      <button
                        onClick={() => {
                          handleVerifyAgent(selectedAgent.id, 'approve');
                          closeDocumentViewer();
                        }}
                        disabled={verifying}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          handleVerifyAgent(selectedAgent.id, 'reject');
                          closeDocumentViewer();
                        }}
                        disabled={verifying}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </>
                  )}
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
        </div>
      )}
    </div>
  );
};

export default AgentVerification;