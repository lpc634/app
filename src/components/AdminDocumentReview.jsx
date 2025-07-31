import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Search, Eye, CheckCircle, XCircle, Clock, FileText, Users } from 'lucide-react';
import DocumentViewer from './DocumentViewer';
import AgentVerificationCard from './AgentVerificationCard';
import DocumentApprovalControls from './DocumentApprovalControls';

const AdminDocumentReview = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [showDocumentViewer, setShowDocumentViewer] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    rejected: 0
  });

  useEffect(() => {
    fetchAgentsDocuments();
  }, []);

  const fetchAgentsDocuments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/agents/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAgents(data.agents || []);
      
      // Calculate stats
      const stats = data.agents.reduce((acc, agent) => {
        acc.total++;
        if (agent.verification_status === 'pending') acc.pending++;
        else if (agent.verification_status === 'verified') acc.verified++;
        else if (agent.verification_status === 'rejected') acc.rejected++;
        return acc;
      }, { total: 0, pending: 0, verified: 0, rejected: 0 });
      
      setStats(stats);
    } catch (error) {
      console.error('Error fetching agents documents:', error);
      setError('Failed to load agents documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAgent = async (agentId, action, notes = '', documentFeedback = {}) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/agents/${agentId}/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          notes,
          document_feedback: documentFeedback
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Refresh the agents list
      await fetchAgentsDocuments();
      
      // Close any open modals
      setSelectedAgent(null);
      
      return result;
    } catch (error) {
      console.error('Error verifying agent:', error);
      throw error;
    }
  };

  const handleViewDocument = (agent, document) => {
    setSelectedAgent(agent);
    setSelectedDocument(document);
    setShowDocumentViewer(true);
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || agent.verification_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-v3-orange mx-auto"></div>
          <p className="mt-4 text-v3-text-muted">Loading agent documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-v3-text-lightest mb-2">Document Verification Center</h1>
        <p className="text-v3-text-muted">Review and manage agent document submissions</p>
      </div>

      {error && (
        <div className="mb-6 p-4 border border-red-500 border-opacity-30 bg-red-500 bg-opacity-10 rounded-lg">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="dashboard-card p-4 text-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-v3-text-muted">Total Agents</p>
              <p className="text-2xl font-bold text-v3-orange">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-v3-orange" />
          </div>
        </div>

        <div className="dashboard-card p-4 text-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-v3-text-muted">Pending Review</p>
              <p className="text-2xl font-bold text-v3-orange">{stats.pending}</p>
            </div>
            <Clock className="h-8 w-8 text-v3-orange" />
          </div>
        </div>

        <div className="dashboard-card p-4 text-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-v3-text-muted">Verified</p>
              <p className="text-2xl font-bold text-v3-orange">{stats.verified}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-400" />
          </div>
        </div>

        <div className="dashboard-card p-4 text-center">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-v3-text-muted">Rejected</p>
              <p className="text-2xl font-bold text-v3-orange">{stats.rejected}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="dashboard-card p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-v3-text-muted h-4 w-4" />
            <input
              placeholder="Search agents by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-v3-bg-dark border border-v3-border rounded-lg text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:ring-1 focus:ring-v3-orange focus:outline-none"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-v3-border rounded-lg bg-v3-bg-dark text-v3-text-lightest text-sm focus:outline-none focus:ring-2 focus:ring-v3-orange focus:border-v3-orange"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Agents List */}
      <div className="grid gap-4">
        {filteredAgents.length === 0 ? (
          <div className="dashboard-card p-8 text-center">
            <FileText className="h-12 w-12 text-v3-text-muted mx-auto mb-4" />
            <h3 className="text-lg font-medium text-v3-text-lightest mb-2">No agents found</h3>
            <p className="text-v3-text-muted">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search criteria.' 
                : 'No agents have been registered yet.'}
            </p>
          </div>
        ) : (
          filteredAgents.map((agent) => (
            <AgentVerificationCard
              key={agent.id}
              agent={agent}
              onViewDocument={handleViewDocument}
              onVerifyAgent={handleVerifyAgent}
            />
          ))
        )}
      </div>

      {/* Document Viewer Modal */}
      {showDocumentViewer && selectedDocument && (
        <DocumentViewer
          document={selectedDocument}
          agent={selectedAgent}
          isOpen={showDocumentViewer}
          onClose={() => {
            setShowDocumentViewer(false);
            setSelectedDocument(null);
            setSelectedAgent(null);
          }}
        />
      )}
    </div>
  );
};

export default AdminDocumentReview;