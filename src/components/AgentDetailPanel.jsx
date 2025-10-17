import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Calendar,
  DollarSign,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle
} from 'lucide-react';

const AgentDetailPanel = ({ agent, isOpen, onClose, onRefresh }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [agentDetails, setAgentDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && agent) {
      fetchAgentDetails();
    }
  }, [isOpen, agent]);

  const fetchAgentDetails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/admin/agents/${agent.id}/details`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAgentDetails(data);
    } catch (error) {
      console.error('Error fetching agent details:', error);
      setError('Failed to load agent details');
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <User className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{agent.name}</h2>
              <p className="text-gray-600">{agent.email}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('documents')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'documents'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Documents ({agent.document_count || 0})
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 200px)' }}>
          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertDescription className="text-red-800">{error}</AlertDescription>
            </Alert>
          )}

          {/* Overview Tab */}
          {activeTab === 'overview' && agentDetails && (
            <div className="space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <User className="h-5 w-5 mr-2" />
                    Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">Email:</span>
                        <span className="ml-2 font-medium">{agentDetails.personal_info.email}</span>
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">Phone:</span>
                        <span className="ml-2 font-medium">{agentDetails.personal_info.phone || 'Not provided'}</span>
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">Registered:</span>
                        <span className="ml-2 font-medium">
                          {agentDetails.personal_info.created_at 
                            ? new Date(agentDetails.personal_info.created_at).toLocaleDateString()
                            : 'Unknown'}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <CheckCircle className="h-4 w-4 text-gray-400 mr-2" />
                        <span className="text-sm text-gray-600">Status:</span>
                        <Badge className={`ml-2 ${getStatusColor(agentDetails.personal_info.verification_status)}`}>
                          {agentDetails.personal_info.verification_status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Address Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="h-5 w-5 mr-2" />
                    Address
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm">
                    <p>{agentDetails.address.address_line_1 || 'Not provided'}</p>
                    {agentDetails.address.address_line_2 && <p>{agentDetails.address.address_line_2}</p>}
                    <p>
                      {agentDetails.address.city || 'City not provided'} {agentDetails.address.postcode || ''}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Bank Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building className="h-5 w-5 mr-2" />
                    Bank Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-600">Bank Name:</span>
                        <p className="font-medium">{agentDetails.bank_details.bank_name || 'Not provided'}</p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">Account Number:</span>
                        <p className="font-medium font-mono">
                          {agentDetails.bank_details.bank_account_number || 'Not provided'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="text-sm text-gray-600">Sort Code:</span>
                        <p className="font-medium font-mono">
                          {agentDetails.bank_details.bank_sort_code || 'Not provided'}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm text-gray-600">UTR Number:</span>
                        <p className="font-medium">{agentDetails.bank_details.utr_number || 'Not provided'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <DollarSign className="h-5 w-5 mr-2" />
                    Invoice Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-900">
                        {agentDetails.invoice_statistics.total_invoices}
                      </p>
                      <p className="text-sm text-blue-700">Total Invoices</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-900">
                        {agentDetails.invoice_statistics.paid_count}
                      </p>
                      <p className="text-sm text-green-700">Paid</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <p className="text-2xl font-bold text-yellow-900">
                        {agentDetails.invoice_statistics.unpaid_count}
                      </p>
                      <p className="text-sm text-yellow-700">Unpaid</p>
                    </div>
                    <div className="text-center p-4 bg-red-50 rounded-lg">
                      <p className="text-2xl font-bold text-red-900">
                        £{agentDetails.invoice_statistics.unpaid_amount.toFixed(2)}
                      </p>
                      <p className="text-sm text-red-700">Outstanding</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Documents Tab */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Document Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <FileText className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-900">{agent.document_count || 0}</p>
                      <p className="text-sm text-blue-700">Total Documents</p>
                    </div>
                    <div className="text-center p-4 bg-green-50 rounded-lg">
                      <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-green-900">
                        {agent.verification_status === 'verified' ? 'Yes' : 'No'}
                      </p>
                      <p className="text-sm text-green-700">Verified</p>
                    </div>
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-yellow-900">
                        {agent.verification_status === 'pending' ? 'Yes' : 'No'}
                      </p>
                      <p className="text-sm text-yellow-700">Pending Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {agent.document_count > 0 ? (
                <Alert className="border-blue-200 bg-blue-50">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-800">
                    This agent has {agent.document_count} document(s) uploaded. 
                    Use the Document Verification Center to review and manage these documents.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert className="border-yellow-200 bg-yellow-50">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    No documents have been uploaded by this agent yet.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentDetailPanel;