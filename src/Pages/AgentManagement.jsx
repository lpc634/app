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

      {/* V3 Services Agent Details Modal */}
      {showAgentDetails && selectedAgentForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div 
            className="dashboard-card max-w-7xl w-full max-h-[95vh] overflow-hidden"
            style={{
              background: 'var(--v3-bg-card)',
              border: '1px solid var(--v3-border)',
              borderRadius: '12px'
            }}
          >
            {/* V3 Header with Orange Accent */}
            <div 
              className="p-6 border-b"
              style={{
                background: 'linear-gradient(135deg, var(--v3-bg-dark) 0%, #1F1F1F 100%)',
                borderBottom: '1px solid var(--v3-border)',
                borderImage: 'linear-gradient(90deg, transparent, var(--v3-orange), transparent) 1'
              }}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-bold" style={{ color: 'var(--v3-text-lightest)' }}>
                    {selectedAgentForDetails.first_name} {selectedAgentForDetails.last_name}
                  </h2>
                  <p className="mt-1" style={{ color: 'var(--v3-orange)' }}>
                    {selectedAgentForDetails.email}
                  </p>
                </div>
                <button 
                  className="button-refresh px-4 py-2"
                  onClick={() => setShowAgentDetails(false)}
                >
                  ✕ Close
                </button>
              </div>
            </div>
            
            <div 
              className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]"
              style={{ background: 'var(--v3-bg-card)' }}
            >
            
            {loadingDetails ? (
              <div className="text-center py-12">
                <div 
                  className="animate-spin w-8 h-8 border-4 border-t-transparent rounded-full mx-auto mb-4"
                  style={{ 
                    borderColor: 'var(--v3-orange)',
                    borderTopColor: 'transparent'
                  }}
                ></div>
                <p style={{ color: 'var(--v3-text-muted)' }}>Loading agent details...</p>
              </div>
            ) : agentDetails ? (
              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Agent Info Sidebar */}
                <div className="xl:col-span-1 space-y-4">
                  {/* Contact Card */}
                  <div 
                    className="dashboard-card rounded-lg p-4"
                    style={{
                      background: 'var(--v3-bg-dark)',
                      border: '1px solid var(--v3-border)'
                    }}
                  >
                    <h3 
                      className="font-semibold text-lg mb-3 flex items-center gap-2"
                      style={{ color: 'var(--v3-text-lightest)' }}
                    >
                      <Mail className="h-5 w-5" style={{ color: 'var(--v3-orange)' }} />
                      📞 Contact
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Phone:</span>{' '}
                        <span style={{ color: 'var(--v3-text-light)' }}>{agentDetails.agent.phone}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Address:</span>{' '}
                        <span style={{ color: 'var(--v3-text-light)' }}>{agentDetails.agent.address_line_1}</span>
                      </p>
                      {agentDetails.agent.address_line_2 && agentDetails.agent.address_line_2 !== '' && (
                        <p className="ml-16" style={{ color: 'var(--v3-text-light)' }}>
                          {agentDetails.agent.address_line_2}
                        </p>
                      )}
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>City:</span>{' '}
                        <span style={{ color: 'var(--v3-text-light)' }}>{agentDetails.agent.city} {agentDetails.agent.postcode}</span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Banking Card */}
                  <div 
                    className="dashboard-card rounded-lg p-4"
                    style={{
                      background: 'linear-gradient(135deg, var(--v3-bg-dark) 0%, #1E2A1E 100%)',
                      border: '1px solid var(--v3-border)',
                      boxShadow: '0 0 10px rgba(34, 197, 94, 0.1)'
                    }}
                  >
                    <h3 
                      className="font-semibold text-lg mb-3 flex items-center gap-2"
                      style={{ color: 'var(--v3-text-lightest)' }}
                    >
                      <Users className="h-5 w-5" style={{ color: '#22C55E' }} />
                      🏦 Banking
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Bank:</span>{' '}
                        <span style={{ color: 'var(--v3-text-light)' }}>{agentDetails.agent.bank_name}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Account:</span>{' '}
                        <span className="font-mono" style={{ color: '#22C55E' }}>{agentDetails.agent.bank_account_number}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Sort Code:</span>{' '}
                        <span className="font-mono" style={{ color: '#22C55E' }}>{agentDetails.agent.bank_sort_code}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>UTR:</span>{' '}
                        <span className="font-mono" style={{ color: '#22C55E' }}>{agentDetails.agent.utr_number}</span>
                      </p>
                    </div>
                  </div>
                  
                  {/* Account Status Card */}
                  <div 
                    className="dashboard-card rounded-lg p-4"
                    style={{
                      background: 'linear-gradient(135deg, var(--v3-bg-dark) 0%, #2A1E2A 100%)',
                      border: '1px solid var(--v3-border)',
                      boxShadow: '0 0 10px rgba(168, 85, 247, 0.1)'
                    }}
                  >
                    <h3 
                      className="font-semibold text-lg mb-3 flex items-center gap-2"
                      style={{ color: 'var(--v3-text-lightest)' }}
                    >
                      <Shield className="h-5 w-5" style={{ color: '#A855F7' }} />
                      🛡️ Status
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Verification:</span>
                        <Badge 
                          className={`ml-2 ${
                            agentDetails.agent.verification_status === 'verified' 
                              ? 'bg-green-600 text-white hover:bg-green-700' 
                              : 'bg-gray-600 text-white hover:bg-gray-700'
                          }`}
                        >
                          {agentDetails.agent.verification_status || 'Pending'}
                        </Badge>
                      </div>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Role:</span>{' '}
                        <span className="capitalize" style={{ color: 'var(--v3-text-light)' }}>{agentDetails.agent.role}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Joined:</span>{' '}
                        <span style={{ color: 'var(--v3-text-light)' }}>{new Date(agentDetails.agent.created_at).toLocaleDateString()}</span>
                      </p>
                    </div>
                  </div>

                  {/* Stats Card */}
                  <div 
                    className="dashboard-card rounded-lg p-4"
                    style={{
                      background: 'linear-gradient(135deg, var(--v3-bg-dark) 0%, #1E2A2E 100%)',
                      border: '1px solid var(--v3-orange)',
                      boxShadow: '0 0 15px var(--v3-orange-glow)'
                    }}
                  >
                    <h3 
                      className="font-semibold text-lg mb-3 flex items-center gap-2"
                      style={{ color: 'var(--v3-text-lightest)' }}
                    >
                      <CheckCircle className="h-5 w-5" style={{ color: 'var(--v3-orange)' }} />
                      📊 Statistics
                    </h3>
                    <div className="space-y-2 text-sm">
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Total Invoices:</span>{' '}
                        <span className="font-bold" style={{ color: 'var(--v3-orange)' }}>{agentDetails.stats.total_invoices}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Total Earnings:</span>{' '}
                        <span className="font-bold" style={{ color: '#22C55E' }}>£{agentDetails.stats.total_earnings.toFixed(2)}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Paid:</span>{' '}
                        <span className="font-bold" style={{ color: '#3B82F6' }}>£{agentDetails.stats.paid_amount.toFixed(2)}</span>
                      </p>
                      <p>
                        <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Pending:</span>{' '}
                        <span className="font-bold" style={{ color: 'var(--v3-orange)' }}>£{agentDetails.stats.pending_amount.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Invoice History */}
                <div className="xl:col-span-3">
                  <div 
                    className="dashboard-card rounded-lg"
                    style={{
                      background: 'var(--v3-bg-card)',
                      border: '1px solid var(--v3-border)'
                    }}
                  >
                    <div 
                      className="p-4 border-b"
                      style={{
                        background: 'linear-gradient(135deg, var(--v3-bg-dark) 0%, #1F1F1F 100%)',
                        borderBottom: '1px solid var(--v3-border)'
                      }}
                    >
                      <h3 
                        className="text-xl font-semibold flex items-center gap-2"
                        style={{ color: 'var(--v3-text-lightest)' }}
                      >
                        <Calendar className="h-5 w-5" style={{ color: 'var(--v3-orange)' }} />
                        💼 Invoice History ({agentDetails.invoices.length})
                      </h3>
                    </div>
                    <div className="p-4" style={{ background: 'var(--v3-bg-card)' }}>
                      {agentDetails.invoices.length > 0 ? (
                        <div className="space-y-4">
                          {agentDetails.invoices.map(invoice => (
                            <div 
                              key={invoice.id} 
                              className="dashboard-card rounded-lg p-4 transition-all duration-300"
                              style={{
                                background: 'var(--v3-bg-dark)',
                                border: '1px solid var(--v3-border)',
                                cursor: 'pointer'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = 'var(--v3-orange)';
                                e.currentTarget.style.boxShadow = '0 0 15px var(--v3-orange-glow)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = 'var(--v3-border)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <h4 
                                      className="text-lg font-semibold"
                                      style={{ color: 'var(--v3-text-lightest)' }}
                                    >
                                      {invoice.invoice_number}
                                    </h4>
                                    <Badge 
                                      className={`${
                                        invoice.status === 'paid' 
                                          ? 'bg-green-600 text-white hover:bg-green-700' 
                                          : invoice.status === 'sent' 
                                          ? 'text-white hover:bg-orange-700'
                                          : 'bg-gray-600 text-white hover:bg-gray-700'
                                      }`}
                                      style={{
                                        background: invoice.status === 'sent' ? 'var(--v3-orange)' : undefined
                                      }}
                                    >
                                      {invoice.status.toUpperCase()}
                                    </Badge>
                                  </div>
                                  
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Issue Date:</span><br />
                                      <span style={{ color: 'var(--v3-text-light)' }}>
                                        {new Date(invoice.issue_date).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Due Date:</span><br />
                                      <span style={{ color: 'var(--v3-text-light)' }}>
                                        {new Date(invoice.due_date).toLocaleDateString()}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Amount:</span><br />
                                      <span className="text-lg font-bold" style={{ color: '#22C55E' }}>
                                        £{parseFloat(invoice.total_amount).toFixed(2)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="font-medium" style={{ color: 'var(--v3-text-muted)' }}>Jobs:</span><br />
                                      <span style={{ color: 'var(--v3-text-light)' }}>
                                        {invoice.jobs ? invoice.jobs.length : 'N/A'} job(s)
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {/* Job Addresses */}
                                  {invoice.jobs && invoice.jobs.length > 0 && (
                                    <div 
                                      className="mt-3 p-3 rounded"
                                      style={{
                                        background: 'var(--v3-bg-darkest)',
                                        border: '1px solid var(--v3-border)'
                                      }}
                                    >
                                      <p 
                                        className="font-medium text-sm mb-2 flex items-center gap-1"
                                        style={{ color: 'var(--v3-text-light)' }}
                                      >
                                        🗺️ Job Locations:
                                      </p>
                                      {invoice.jobs.map((job, idx) => (
                                        <div key={idx} className="text-sm mb-1" style={{ color: 'var(--v3-text-muted)' }}>
                                          • <span className="font-medium" style={{ color: 'var(--v3-orange)' }}>
                                            {job.address}
                                          </span>{' '}
                                          <span style={{ color: 'var(--v3-text-light)' }}>
                                            ({job.hours_worked}h @ £{job.hourly_rate_at_invoice}/hr)
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                
                                <div className="flex flex-col gap-2 ml-4">
                                  {invoice.status !== 'paid' && (
                                    <button 
                                      className="button-refresh px-3 py-2 text-sm"
                                      style={{
                                        background: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
                                        border: '1px solid #22C55E'
                                      }}
                                      onClick={() => handleMarkAsPaid(invoice.id)}
                                    >
                                      ✓ Mark as Paid
                                    </button>
                                  )}
                                  <button 
                                    className="px-3 py-2 text-sm rounded-md transition-all duration-200"
                                    style={{
                                      background: 'transparent',
                                      border: '1px solid var(--v3-border)',
                                      color: 'var(--v3-text-light)'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'var(--v3-orange)';
                                      e.currentTarget.style.borderColor = 'var(--v3-orange)';
                                      e.currentTarget.style.color = 'white';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'transparent';
                                      e.currentTarget.style.borderColor = 'var(--v3-border)';
                                      e.currentTarget.style.color = 'var(--v3-text-light)';
                                    }}
                                  >
                                    👁️ View Details
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Calendar 
                            className="mx-auto h-12 w-12 mb-4" 
                            style={{ color: 'var(--v3-text-muted)' }} 
                          />
                          <p className="text-lg" style={{ color: 'var(--v3-text-light)' }}>
                            📄 No invoices found
                          </p>
                          <p className="text-sm" style={{ color: 'var(--v3-text-muted)' }}>
                            This agent hasn't created any invoices yet.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <AlertCircle 
                  className="mx-auto h-12 w-12 mb-4" 
                  style={{ color: '#EF4444' }} 
                />
                <p className="text-lg font-medium" style={{ color: '#EF4444' }}>
                  ❌ Failed to load agent details
                </p>
                <p className="text-sm mt-2" style={{ color: 'var(--v3-text-muted)' }}>
                  Please try again or contact support if the problem persists.
                </p>
                <button 
                  onClick={() => handleViewDetails(selectedAgentForDetails)} 
                  className="button-refresh mt-4 px-4 py-2"
                >
                  🔄 Retry
                </button>
              </div>
            )}
            
            {/* Action Buttons */}
            <div 
              className="flex gap-3 mt-6 pt-6"
              style={{ borderTop: '1px solid var(--v3-border)' }}
            >
              <button 
                className="flex-1 px-4 py-2 rounded-md transition-all duration-200"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--v3-border)',
                  color: 'var(--v3-text-light)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--v3-orange)';
                  e.currentTarget.style.borderColor = 'var(--v3-orange)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--v3-border)';
                  e.currentTarget.style.color = 'var(--v3-text-light)';
                }}
              >
                📧 Send Message
              </button>
              <button 
                className="flex-1 px-4 py-2 rounded-md transition-all duration-200"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--v3-border)',
                  color: 'var(--v3-text-light)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--v3-orange)';
                  e.currentTarget.style.borderColor = 'var(--v3-orange)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'var(--v3-border)';
                  e.currentTarget.style.color = 'var(--v3-text-light)';
                }}
              >
                💼 View Jobs
              </button>
              <button 
                onClick={() => setShowAgentDetails(false)}
                className="button-refresh flex-1 px-4 py-2"
              >
                ✕ Close
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}