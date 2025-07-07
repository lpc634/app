import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '../useAuth.jsx';
import { useToast } from '../use-toast.js'
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Calendar as CalendarIcon
} from 'lucide-react'

export default function WeeklyCalendarView({ agentId, onAvailabilityChange }) {
  const [weeklyAvailability, setWeeklyAvailability] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStartDate())
  const { apiCall } = useAuth()
  const { toast } = useToast()

  // Get the start date of the current week (Sunday)
  function getWeekStartDate(date = new Date()) {
    const d = new Date(date)
    const day = d.getDay() // 0 for Sunday, 1 for Monday, etc.
    const diff = d.getDate() - day
    return new Date(d.setDate(diff))
  }

  // Format date as YYYY-MM-DD
  function formatDate(date) {
    return date.toISOString().split('T')[0]
  }

  // Get the end date of the week (Saturday)
  function getWeekEndDate(startDate) {
    const endDate = new Date(startDate)
    endDate.setDate(startDate.getDate() + 6)
    return endDate
  }

  // Get dates for the current week
  function getWeekDates(startDate) {
    const dates = []
    const currentDate = new Date(startDate)
    
    for (let i = 0; i < 7; i++) {
      dates.push(new Date(currentDate))
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return dates
  }

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newStartDate = new Date(currentWeekStart)
    newStartDate.setDate(newStartDate.getDate() - 7)
    setCurrentWeekStart(newStartDate)
  }

  // Navigate to next week
  const goToNextWeek = () => {
    const newStartDate = new Date(currentWeekStart)
    newStartDate.setDate(newStartDate.getDate() + 7)
    setCurrentWeekStart(newStartDate)
  }

  // Get day name
  const getDayName = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }

  // Format day and month
  const formatDayMonth = (date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
  }

  // Check if date is today
  const isToday = (date) => {
    const today = new Date()
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
  }

  // Fetch agent availability for the current week
  useEffect(() => {
    if (!agentId) return

    const fetchWeeklyAvailability = async () => {
      try {
        setLoading(true)
        const startDate = formatDate(currentWeekStart)
        const endDate = formatDate(getWeekEndDate(currentWeekStart))
        
        const data = await apiCall(`/availability/${agentId}?start_date=${startDate}&end_date=${endDate}`)
        setWeeklyAvailability(data.availability || [])
        setError('')
      } catch (error) {
        setError('Failed to load availability data')
        console.error('Availability error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchWeeklyAvailability()
  }, [agentId, currentWeekStart])

  // Toggle availability for a specific date
  const toggleAvailability = async (date) => {
    if (!agentId) return
    
    try {
      const formattedDate = formatDate(date)
      const existingAvailability = weeklyAvailability.find(a => a.date === formattedDate)
      const isCurrentlyAvailable = existingAvailability ? existingAvailability.is_available : false
      
      const response = await apiCall('/availability', {
        method: 'POST',
        body: JSON.stringify({
          agent_id: agentId,
          start_date: formattedDate,
          end_date: formattedDate,
          is_available: !isCurrentlyAvailable
        })
      })

      // Update local state
      const updatedAvailability = weeklyAvailability.map(a => {
        if (a.date === formattedDate) {
          return { ...a, is_available: !isCurrentlyAvailable }
        }
        return a
      })

      // If no existing record, add a new one
      if (!existingAvailability) {
        updatedAvailability.push({
          date: formattedDate,
          is_available: true,
          is_away: false,
          notes: null
        })
      }

      setWeeklyAvailability(updatedAvailability)
      
      toast({
        title: "Availability Updated",
        description: `Availability for ${formattedDate} has been updated.`,
      })

      // Notify parent component if callback provided
      if (onAvailabilityChange) {
        onAvailabilityChange(updatedAvailability)
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      })
    }
  }

  // Get availability status for a specific date
  const getAvailabilityStatus = (date) => {
    const formattedDate = formatDate(date)
    const availability = weeklyAvailability.find(a => a.date === formattedDate)
    
    if (!availability) return 'unknown'
    if (availability.is_away) return 'away'
    return availability.is_available ? 'available' : 'unavailable'
  }

  // Get status badge for a specific date
  const getStatusBadge = (status) => {
    const statusConfig = {
      available: { variant: 'default', icon: CheckCircle, label: 'Available', className: 'bg-green-500' },
      unavailable: { variant: 'secondary', icon: XCircle, label: 'Unavailable' },
      away: { variant: 'destructive', icon: AlertTriangle, label: 'Away' },
      unknown: { variant: 'outline', icon: CalendarIcon, label: 'Not Set' }
    }

    const config = statusConfig[status] || statusConfig.unknown
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className={`flex items-center gap-1 ${config.className || ''}`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  const weekDates = getWeekDates(currentWeekStart)

  if (loading && !weeklyAvailability.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
          <CardDescription>Loading availability data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !weeklyAvailability.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
          <CardDescription className="text-destructive">{error}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <Button onClick={() => setCurrentWeekStart(getWeekStartDate())}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Weekly Availability</CardTitle>
          <CardDescription>
            {formatDayMonth(currentWeekStart)} - {formatDayMonth(getWeekEndDate(currentWeekStart))}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentWeekStart(getWeekStartDate())}>
            <CalendarIcon className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const availabilityStatus = getAvailabilityStatus(date)
            const isCurrentDay = isToday(date)
            
            return (
              <div 
                key={index} 
                className={`flex flex-col items-center p-2 rounded-md border ${
                  isCurrentDay ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="text-sm font-medium mb-1">{getDayName(date)}</div>
                <div className={`text-lg font-bold mb-2 ${isCurrentDay ? 'text-primary' : ''}`}>
                  {date.getDate()}
                </div>
                <div className="mb-2">
                  {getStatusBadge(availabilityStatus)}
                </div>
                <Button 
                  variant={availabilityStatus === 'available' ? 'default' : 'outline'} 
                  size="sm"
                  className="w-full mt-auto"
                  onClick={() => toggleAvailability(date)}
                >
                  {availabilityStatus === 'available' ? 'Available' : 'Set Available'}
                </Button>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
