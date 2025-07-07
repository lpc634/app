import { useState, useEffect } from 'react'
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
  Phone
} from 'lucide-react'

export default function AgentManagement() {
  const [agents, setAgents] = useState([])
  const [availableAgents, setAvailableAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
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

  if (loading) {
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agent Management</h1>
          <p className="text-muted-foreground">
            View and manage field agent availability and information
          </p>
        </div>
      </div>

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
                      <Button size="sm" variant="outline" className="flex-1">
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
    </div>
  )
}

