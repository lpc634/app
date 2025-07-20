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
  Loader2
} from 'lucide-react';

const AgentVerification = () => {
  const { apiCall } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [verifying, setVerifying] = useState(false);

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

                {/* Documents */}
                <div className="space-y-4">
                  <h4 className="font-medium">Uploaded Documents</h4>
                  
                  {selectedAgent.id_document_url ? (
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium mb-2">ID Document</h5>
                      <div className="bg-gray-100 rounded-lg h-40 flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">Document uploaded</p>
                          <p className="text-xs text-gray-400 break-all">
                            {selectedAgent.id_document_url}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <div className="text-center text-gray-500">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                        <p>No ID document uploaded</p>
                      </div>
                    </div>
                  )}

                  {selectedAgent.sia_document_url ? (
                    <div className="border rounded-lg p-4">
                      <h5 className="font-medium mb-2">SIA Badge</h5>
                      <div className="bg-gray-100 rounded-lg h-40 flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                          <p className="text-sm text-gray-500">Document uploaded</p>
                          <p className="text-xs text-gray-400 break-all">
                            {selectedAgent.sia_document_url}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                      <div className="text-center text-gray-500">
                        <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
                        <p>No SIA document uploaded</p>
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
    </div>
  );
};

export default AgentVerification;