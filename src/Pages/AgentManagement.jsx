import { useState, useEffect } from 'react'
import AgentVerification from '../components/AgentVerification';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '../useAuth.jsx';
import { 
  Users, 
  Search, 
  Calendar,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Mail,
  Phone,
  Shield
} from 'lucide-react'

export default function AgentManagement() {
  const [agents, setAgents] = useState([])
  const [availableAgents, setAvailableAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [activeTab, setActiveTab] = useState('agents') // 'agents' or 'verification'
  const [selectedAgentForDetails, setSelectedAgentForDetails] = useState(null)
  const [showAgentDetails, setShowAgentDetails] = useState(false)
  const [agentDetails, setAgentDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const { apiCall } = useAuth()

  useEffect(() => {
    fetchAgents()
    fetchAvailableAgents()
  }, [selectedDate])

  const fetchAgents = async () => {
    try {
      setLoading(true)
      const data = await apiCall('/users?role=agent')
      setAgents(data.users || [])
    } catch (error) {
      setError('Failed to load agents')
      console.error('Agents error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableAgents = async () => {
    try {
      const data = await apiCall(`/agents/available?date=${selectedDate}`)
      setAvailableAgents(data.available_agents || [])
    } catch (error) {
      console.error('Available agents error:', error)
    }
  }

  const filteredAgents = agents.filter(agent => {
    const fullName = `${agent.first_name} ${agent.last_name}`.toLowerCase()
    const email = agent.email.toLowerCase()
    const search = searchTerm.toLowerCase()
    
    return fullName.includes(search) || email.includes(search)
  })

  const getAvailabilityStatus = (agentId) => {
    const available = availableAgents.find(a => a.id === agentId)
    return available ? 'available' : 'unavailable'
  }

  const getStatusBadge = (status) => {
    const statusConfig = {
      available: { variant: 'default', icon: CheckCircle, label: 'Available', className: 'bg-green-500' },
      unavailable: { variant: 'secondary', icon: XCircle, label: 'Unavailable' },
      away: { variant: 'destructive', icon: AlertCircle, label: 'Away' }
    }

    const config = statusConfig[status] || statusConfig.unavailable
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className || ''}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const handleViewDetails = async (agent) => {
    setSelectedAgentForDetails(agent)
    setShowAgentDetails(true)
    setLoadingDetails(true)
    setAgentDetails(null)
    console.log('Viewing details for:', agent.first_name, agent.last_name)
    
    try {
      const data = await apiCall(`/admin/agent-management/${agent.id}/details`)
      setAgentDetails(data)
      console.log('Agent details loaded:', data)
    } catch (error) {
      console.error('Failed to load agent details:', error)
      setError('Failed to load agent details')
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleMarkAsPaid = async (invoiceId) => {
    try {
      console.log('Marking invoice as paid:', invoiceId)
      
      // Call the backend API
      await apiCall(`/admin/invoices/${invoiceId}/mark-paid`, {
        method: 'PUT'
      })
      
      // Refresh agent details to show updated status
      if (selectedAgentForDetails) {
        await handleViewDetails(selectedAgentForDetails)
      }
      
      console.log('Invoice marked as paid successfully')
    } catch (error) {
      console.error('Failed to mark invoice as paid:', error)
      setError('Failed to mark invoice as paid. Please try again.')
    }
  }

  if (loading && activeTab === 'agents') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Agent Management</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                  <div className="h-3 w-2/3 bg-muted animate-pulse rounded"></div>
                  <div className="h-3 w-1/3 bg-muted animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agent Management</h1>
        <p className="text-muted-foreground">Manage agents and verify their documents</p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('agents')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'agents'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Users className="h-4 w-4" />
            All Agents
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'verification'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Shield className="h-4 w-4" />
            Verification Queue
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'agents' ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Registered field agents
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Available Today</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{availableAgents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Ready for deployment
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unavailable</CardTitle>
                <XCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{agents.length - availableAgents.length}</div>
                <p className="text-xs text-muted-foreground">
                  Not available today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">85%</div>
                <p className="text-xs text-muted-foreground">
                  Average this month
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search agents by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>

          {/* Agents Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No agents found</h3>
                      <p className="text-muted-foreground">
                        {searchTerm ? 'Try adjusting your search terms' : 'No agents registered yet'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              filteredAgents.map((agent) => {
                const status = getAvailabilityStatus(agent.id)
                const availabilityData = availableAgents.find(a => a.id === agent.id)
                
                return (
                  <Card key={agent.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">
                            {agent.first_name} {agent.last_name}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Mail className="h-4 w-4" />
                            {agent.email}
                          </CardDescription>
                          {agent.phone && (
                            <CardDescription className="flex items-center gap-2">
                              <Phone className="h-4 w-4" />
                              {agent.phone}
                            </CardDescription>
                          )}
                        </div>
                        {getStatusBadge(status)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium mb-1">Availability Status</p>
                          <p className="text-sm text-muted-foreground">
                            {status === 'available' 
                              ? `Available for ${selectedDate}`
                              : `Not available for ${selectedDate}`
                            }
                          </p>
                          {availabilityData?.availability?.notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Note: {availabilityData.availability.notes}
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-medium mb-1">Account Info</p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>Role: {agent.role}</p>
                            <p>Joined: {new Date(agent.created_at).toLocaleDateString()}</p>
                            <p>Last updated: {new Date(agent.updated_at).toLocaleDateString()}</p>
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1"
                            onClick={() => handleViewDetails(agent)}
                          >
                            View Details
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            Send Message
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>

          {/* Weekly Calendar View */}
          <Card>
            <CardHeader>
              <CardTitle>Weekly Availability Overview</CardTitle>
              <CardDescription>
                Agent availability for the week of {selectedDate}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="mx-auto h-12 w-12 mb-4" />
                <p>Weekly calendar view coming soon</p>
                <p className="text-sm">This will show a detailed weekly view of all agent availability</p>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <AgentVerification />
      )}

      {/* Enhanced Agent Details Modal */}
      {showAgentDetails && selectedAgentForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold">
                    {selectedAgentForDetails.first_name} {selectedAgentForDetails.last_name}
                  </h2>
                  <p className="text-blue-100 mt-1">{selectedAgentForDetails.email}</p>
                </div>
                <Button 
                  variant="outline" 
                  className="bg-white text-blue-600 hover:bg-blue-50 border-white"
                  onClick={() => setShowAgentDetails(false)}
                >
                  ✕ Close
                </Button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
            
            {loadingDetails ? (
              <div className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Loading agent details...</p>
              </div>
            ) : agentDetails ? (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Agent Info Sidebar */}
                <div className="xl:col-span-1 space-y-4">
                  {/* Contact Card */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-gray-800 flex items-center gap-2">
                      <Mail className="h-5 w-5 text-blue-600" />
                      📞 Contact
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium text-gray-600">Phone:</span> {agentDetails.agent.phone}</p>
                      <p><span className="font-medium text-gray-600">Address:</span> {agentDetails.agent.address_line_1}</p>
                      {agentDetails.agent.address_line_2 && agentDetails.agent.address_line_2 !== '' && (
                        <p className="ml-16">{agentDetails.agent.address_line_2}</p>
                      )}
                      <p><span className="font-medium text-gray-600">City:</span> {agentDetails.agent.city} {agentDetails.agent.postcode}</p>
                    </div>
                  </div>
                  
                  {/* Banking Card */}
                  <div className="bg-green-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-green-800 flex items-center gap-2">
                      <Users className="h-5 w-5 text-green-600" />
                      🏦 Banking
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium text-gray-600">Bank:</span> {agentDetails.agent.bank_name}</p>
                      <p><span className="font-medium text-gray-600">Account:</span> <span className="font-mono">{agentDetails.agent.bank_account_number}</span></p>
                      <p><span className="font-medium text-gray-600">Sort Code:</span> <span className="font-mono">{agentDetails.agent.bank_sort_code}</span></p>
                      <p><span className="font-medium text-gray-600">UTR:</span> <span className="font-mono">{agentDetails.agent.utr_number}</span></p>
                    </div>
                  </div>
                  
                  {/* Account Status Card */}
                  <div className="bg-purple-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-purple-800 flex items-center gap-2">
                      <Shield className="h-5 w-5 text-purple-600" />
                      🛡️ Status
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-600">Verification:</span>
                        <Badge 
                          variant={agentDetails.agent.verification_status === 'verified' ? 'default' : 'secondary'}
                          className={`ml-2 ${agentDetails.agent.verification_status === 'verified' ? 'bg-green-500 hover:bg-green-600' : ''}`}
                        >
                          {agentDetails.agent.verification_status || 'Pending'}
                        </Badge>
                      </div>
                      <p><span className="font-medium text-gray-600">Role:</span> <span className="capitalize">{agentDetails.agent.role}</span></p>
                      <p><span className="font-medium text-gray-600">Joined:</span> {new Date(agentDetails.agent.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Stats Card */}
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h3 className="font-semibold text-lg mb-3 text-blue-800 flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-blue-600" />
                      📊 Statistics
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p><span className="font-medium text-gray-600">Total Invoices:</span> <span className="font-bold">{agentDetails.stats.total_invoices}</span></p>
                      <p><span className="font-medium text-gray-600">Total Earnings:</span> <span className="text-green-600 font-bold">£{agentDetails.stats.total_earnings.toFixed(2)}</span></p>
                      <p><span className="font-medium text-gray-600">Paid:</span> <span className="text-blue-600 font-bold">£{agentDetails.stats.paid_amount.toFixed(2)}</span></p>
                      <p><span className="font-medium text-gray-600">Pending:</span> <span className="text-orange-600 font-bold">£{agentDetails.stats.pending_amount.toFixed(2)}</span></p>
                    </div>
                  </div>
                </div>
                
                {/* Invoice History */}
                <div className="xl:col-span-3">
                  <div className="bg-white rounded-lg border">
                    <div className="p-4 border-b bg-gray-50">
                      <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <Calendar className="h-5 w-5 text-blue-600" />
                        💼 Invoice History ({agentDetails.invoices.length})
                      </h3>
                    </div>
                    <div className="p-4">
                      {agentDetails.invoices.length > 0 ? (
                        <div className="space-y-4">
                          {agentDetails.invoices.map(invoice => (
                            <div key={invoice.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 className="text-lg font-semibold text-gray-800">{invoice.invoice_number}</h4>
                                    <Badge 
                                      variant={invoice.status === 'paid' ? 'default' : invoice.status === 'sent' ? 'secondary' : 'outline'}
                                      className={
                                        invoice.status === 'paid' 
                                          ? 'bg-green-500 hover:bg-green-600' 
                                          : invoice.status === 'sent' 
                                          ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                                          : ''
                                      }
                                    >
                                      {invoice.status.toUpperCase()}
                                    </Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                    <div>
                                      <span className="font-medium">Issue Date:</span><br />
                                      {new Date(invoice.issue_date).toLocaleDateString()}
                                    </div>
                                    <div>
                                      <span className="font-medium">Due Date:</span><br />
                                      {new Date(invoice.due_date).toLocaleDateString()}
                                    </div>
                                    <div>
                                      <span className="font-medium">Amount:</span><br />
                                      <span className="text-lg font-bold text-green-600">£{parseFloat(invoice.total_amount).toFixed(2)}</span>
                                    </div>
                                    <div>
                                      <span className="font-medium">Jobs:</span><br />
                                      {invoice.jobs ? invoice.jobs.length : 'N/A'} job(s)
                                    </div>
                                  </div>
                                  
                                  {/* Job Addresses */}
                                  {invoice.jobs && invoice.jobs.length > 0 && (
                                    <div className="mt-3 p-3 bg-gray-50 rounded">
                                      <p className="font-medium text-sm text-gray-700 mb-2 flex items-center gap-1">
                                        🗺️ Job Locations:
                                      </p>
                                      {invoice.jobs.map((job, idx) => (
                                        <div key={idx} className="text-sm text-gray-600 mb-1">
                                          • <span className="font-medium">{job.address}</span> ({job.hours_worked}h @ £{job.hourly_rate_at_invoice}/hr)
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-col gap-2 ml-4">
                                  {invoice.status !== 'paid' && (
                                    <Button 
                                      size="sm" 
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                      onClick={() => handleMarkAsPaid(invoice.id)}
                                    >
                                      ✓ Mark as Paid
                                    </Button>
                                  )}
                                  <Button size="sm" variant="outline">
                                    👁️ View Details
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12 text-gray-500">
                          <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                          <p className="text-lg">📄 No invoices found</p>
                          <p className="text-sm">This agent hasn't created any invoices yet.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-red-500">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
                <p className="text-lg">❌ Failed to load agent details</p>
                <p className="text-gray-500 text-sm mt-2">Please try again or contact support if the problem persists.</p>
                <Button 
                  onClick={() => handleViewDetails(selectedAgentForDetails)} 
                  className="mt-4 bg-blue-600 hover:bg-blue-700"
                >
                  🔄 Retry
                </Button>
              </div>
            )}
            
            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t">
              <Button variant="outline" className="flex-1">
                Send Message
              </Button>
              <Button variant="outline" className="flex-1">
                View Jobs
              </Button>
              <Button 
                onClick={() => setShowAgentDetails(false)}
                className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              >
                Close
              </Button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}