import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuth } from '../useAuth.jsx';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line
} from 'recharts'
import { 
  TrendingUp, 
  Users, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  Award,
  Calendar
} from 'lucide-react'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function Analytics() {
  const [analyticsData, setAnalyticsData] = useState(null)
  const [agentMetrics, setAgentMetrics] = useState([])
  const [jobStats, setJobStats] = useState(null)
  const [responseRates, setResponseRates] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timeRange, setTimeRange] = useState('30')
  const { apiCall } = useAuth()

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      
      const [agentData, jobData, responseData] = await Promise.all([
        apiCall(`/analytics/agents?days=${timeRange}`),
        apiCall(`/analytics/jobs?days=${timeRange}`),
        apiCall(`/analytics/response-rates?days=${timeRange}`)
      ])

      setAgentMetrics(agentData.agent_metrics || [])
      setJobStats(jobData.job_statistics || {})
      setResponseRates(responseData || {})
    } catch (error) {
      setError('Failed to load analytics data')
      console.error('Analytics error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTopAgents = () => {
    return agentMetrics
      .sort((a, b) => b.metrics.acceptance_rate - a.metrics.acceptance_rate)
      .slice(0, 5)
  }

  const getJobTypeData = () => {
    if (!jobStats.job_types) return []
    
    return Object.entries(jobStats.job_types).map(([type, count]) => ({
      name: type,
      value: count
    }))
  }

  const getResponseTimeData = () => {
    return agentMetrics.map(agent => ({
      name: `${agent.agent.first_name} ${agent.agent.last_name}`,
      responseTime: agent.metrics.avg_response_time_minutes,
      acceptanceRate: agent.metrics.acceptance_rate
    })).slice(0, 10)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                  <div className="h-8 w-1/3 bg-muted animate-pulse rounded"></div>
                  <div className="h-3 w-2/3 bg-muted animate-pulse rounded"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <Button onClick={fetchAnalytics}>Retry</Button>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to load analytics</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Performance insights and operational metrics
          </p>
        </div>
        
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <BarChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobStats.total_jobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {jobStats.fill_rate || 0}% fill rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responseRates.overall_metrics?.response_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Overall agent response rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acceptance Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{responseRates.overall_metrics?.acceptance_rate || 0}%</div>
            <p className="text-xs text-muted-foreground">
              Jobs accepted by agents
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(responseRates.overall_metrics?.avg_response_time_minutes || 0)}m</div>
            <p className="text-xs text-muted-foreground">
              Average response time
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job Types Distribution</CardTitle>
            <CardDescription>
              Breakdown of job types over the last {timeRange} days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getJobTypeData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getJobTypeData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agent Response Times</CardTitle>
            <CardDescription>
              Average response time vs acceptance rate
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getResponseTimeData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  fontSize={12}
                />
                <YAxis />
                <Tooltip />
                <Bar dataKey="responseTime" fill="#8884d8" name="Response Time (min)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Top Performing Agents
          </CardTitle>
          <CardDescription>
            Agents with highest acceptance rates over the last {timeRange} days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {getTopAgents().map((agentData, index) => (
              <div key={agentData.agent.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-medium">
                      {agentData.agent.first_name} {agentData.agent.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {agentData.agent.email}
                    </p>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {agentData.metrics.acceptance_rate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Acceptance</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">
                        {agentData.metrics.total_assignments}
                      </p>
                      <p className="text-xs text-muted-foreground">Total Jobs</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-semibold">
                        {Math.round(agentData.metrics.avg_response_time_minutes)}m
                      </p>
                      <p className="text-xs text-muted-foreground">Avg Response</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Urgency Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Response Rates by Urgency Level</CardTitle>
          <CardDescription>
            How agents respond to different urgency levels
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {responseRates.urgency_breakdown && Object.entries(responseRates.urgency_breakdown).map(([urgency, data]) => (
              <div key={urgency} className="p-4 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium">{urgency}</h4>
                  <Badge variant={urgency === 'URGENT' ? 'destructive' : urgency === 'Standard' ? 'default' : 'secondary'}>
                    {data.total_assignments} jobs
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Response Rate:</span>
                    <span className="font-medium">{Math.round(data.response_rate)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Acceptance Rate:</span>
                    <span className="font-medium">{Math.round(data.acceptance_rate)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Stale Availability Alert */}
      {responseRates.stale_availability_agents && responseRates.stale_availability_agents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Agents with Stale Availability
            </CardTitle>
            <CardDescription>
              These agents haven't updated their availability recently
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {responseRates.stale_availability_agents.map((staleAgent) => (
                <div key={staleAgent.agent.id} className="p-3 border border-orange-200 rounded-lg">
                  <p className="font-medium">
                    {staleAgent.agent.first_name} {staleAgent.agent.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {staleAgent.agent.email}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    {typeof staleAgent.days_stale === 'number' 
                      ? `${staleAgent.days_stale} days ago`
                      : staleAgent.days_stale
                    }
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

