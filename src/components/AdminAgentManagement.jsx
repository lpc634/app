import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  Users,
  DollarSign,
  CreditCard,
  Calendar,
  Mail,
  User,
  Phone,
  MapPin,
  Building,
  Hash,
  TrendingUp,
  X
} from 'lucide-react';

const AdminAgentManagement = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAgentDetails, setShowAgentDetails] = useState(false);
  const [stats, setStats] = useState({
    totalAgents: 0,
    pendingVerification: 0,
    verifiedAgents: 0,
    totalInvoices: 0,
    unpaidInvoices: 0,
    totalUnpaidAmount: 0
  });

  useEffect(() => {
    fetchAgentsData();
  }, []);

  const fetchAgentsData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Fetch agents with documents
      const agentsResponse = await fetch('/api/admin/agents/documents', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!agentsResponse.ok) {
        throw new Error(`HTTP error! status: ${agentsResponse.status}`);
      }

      const agentsData = await agentsResponse.json();
      
      // For now, just use basic agent data without invoice stats
      const agentsWithBasicStats = agentsData.agents.map(agent => ({
        ...agent,
        invoiceStats: {
          totalInvoices: 0,
          totalAmount: 0,
          paidInvoices: 0,
          unpaidInvoices: 0,
          overdueInvoices: 0,
          paidAmount: 0,
          unpaidAmount: 0
        }
      }));

      setAgents(agentsWithBasicStats);
      
      // Calculate basic stats
      const overallStats = agentsWithBasicStats.reduce((acc, agent) => {
        acc.totalAgents++;
        
        if (agent.verification_status === 'pending') acc.pendingVerification++;
        else if (agent.verification_status === 'verified') acc.verifiedAgents++;
        
        return acc;
      }, {
        totalAgents: 0,
        pendingVerification: 0,
        verifiedAgents: 0,
        totalInvoices: 0,
        unpaidInvoices: 0,
        totalUnpaidAmount: 0
      });
      
      setStats(overallStats);
    } catch (error) {
      console.error('Error fetching agents data:', error);
      setError('Failed to load agents data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAgentDetails = (agent) => {
    setSelectedAgent(agent);
    setShowAgentDetails(true);
  };

  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || agent.verification_status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading agent management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Management</h1>
        <p className="text-gray-600">Manage agent verification, documents, and invoices</p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {/* Dashboard Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Agents</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalAgents}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.verifiedAgents} verified, {stats.pendingVerification} pending
                </p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalInvoices}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.unpaidInvoices} unpaid
                </p>
              </div>
              <FileText className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Unpaid Amount</p>
                <p className="text-2xl font-bold text-red-600">
                  £{stats.totalUnpaidAmount.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.unpaidInvoices} invoices
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search agents by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Agents Grid */}
      <div className="grid gap-4">
        {filteredAgents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your search criteria.' 
                  : 'No agents have been registered yet.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAgents.map((agent) => (
            <Card 
              key={agent.id} 
              className="hover:shadow-lg transition-all cursor-pointer border-l-4 border-l-blue-500"
              onClick={() => handleViewAgentDetails(agent)}
            >
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 rounded-full">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg font-semibold text-blue-900 hover:text-blue-700">
                        {agent.name}
                      </CardTitle>
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
                  
                  <div className="flex flex-col items-end space-y-2">
                    <Badge className={`${getStatusColor(agent.verification_status)} border`}>
                      {getStatusIcon(agent.verification_status)}
                      <span className="ml-1 capitalize">{agent.verification_status}</span>
                    </Badge>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewAgentDetails(agent);
                      }}
                      className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Quick Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <FileText className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-blue-900">{agent.document_count || 0}</p>
                    <p className="text-xs text-blue-700">Documents</p>
                  </div>
                  
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <Hash className="h-5 w-5 text-green-600 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-green-900">
                      {agent.invoiceStats?.totalInvoices || 0}
                    </p>
                    <p className="text-xs text-green-700">Invoices</p>
                  </div>
                  
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <CreditCard className="h-5 w-5 text-yellow-600 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-yellow-900">
                      {agent.invoiceStats?.unpaidInvoices || 0}
                    </p>
                    <p className="text-xs text-yellow-700">Unpaid</p>
                  </div>
                  
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <DollarSign className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                    <p className="text-lg font-semibold text-purple-900">
                      £{agent.invoiceStats?.unpaidAmount?.toFixed(2) || '0.00'}
                    </p>
                    <p className="text-xs text-purple-700">Outstanding</p>
                  </div>
                </div>

                {/* Quick Action Indicators */}
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center space-x-3 text-sm">
                    {agent.verification_status === 'pending' && (
                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                        <Clock className="h-3 w-3 mr-1" />
                        Needs Review
                      </Badge>
                    )}
                    {agent.invoiceStats?.unpaidInvoices > 0 && (
                      <Badge variant="outline" className="text-red-700 border-red-300">
                        <CreditCard className="h-3 w-3 mr-1" />
                        {agent.invoiceStats.unpaidInvoices} Unpaid
                      </Badge>
                    )}
                    {agent.invoiceStats?.overdueInvoices > 0 && (
                      <Badge variant="outline" className="text-orange-700 border-orange-300">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        {agent.invoiceStats.overdueInvoices} Overdue
                      </Badge>
                    )}
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    Click to view full details →
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Basic Agent Detail Modal */}
      {showAgentDetails && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-2xl font-bold text-gray-900">Agent Details</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAgentDetails(false);
                  setSelectedAgent(null);
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Personal Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-600">Name</label>
                    <p className="font-semibold">{selectedAgent.name}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Email</label>
                    <p>{selectedAgent.email}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Status</label>
                    <Badge className={`${getStatusColor(selectedAgent.verification_status)} border`}>
                      {selectedAgent.verification_status}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-600">Registered</label>
                    <p>{selectedAgent.created_at ? new Date(selectedAgent.created_at).toLocaleDateString() : 'Unknown'}</p>
                  </div>
                </div>
              </div>
              
              {/* Document Information */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-blue-900">{selectedAgent.document_count || 0}</p>
                    <p className="text-sm text-blue-700">Total Documents</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-green-900">
                      {selectedAgent.verification_status === 'verified' ? 'Yes' : 'No'}
                    </p>
                    <p className="text-sm text-green-700">Verified</p>
                  </div>
                  <div className="text-center p-4 bg-yellow-50 rounded-lg">
                    <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-yellow-900">
                      {selectedAgent.verification_status === 'pending' ? 'Yes' : 'No'}
                    </p>
                    <p className="text-sm text-yellow-700">Pending Review</p>
                  </div>
                </div>
              </div>
              
              {/* Basic Stats */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Statistics</h3>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-gray-600">Invoice statistics will be available once the invoice management system is fully deployed.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAgentManagement;