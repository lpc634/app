import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '../useAuth.jsx';
import { useToast } from '../use-toast.js';
import FCMNotificationSetup from '../components/FCMNotificationSetup.jsx';
import { 
  Bell, 
  CheckCircle, 
  Clock, 
  Briefcase,
  AlertTriangle,
  Info,
  Trash2
} from 'lucide-react'

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const { apiCall } = useAuth()
  const { toast } = useToast()
  const [tg, setTg] = useState({ enabled: false, linked: false, bot_username: null })
  const [tgLink, setTgLink] = useState({ code: null, urlWeb: null, urlApp: null, generating: false })

  useEffect(() => {
    fetchNotifications()
    fetchTelegramStatus()
  }, [])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const data = await apiCall('/notifications')
      setNotifications(Array.isArray(data) ? data : (data.notifications || []))
    } catch (error) {
      console.error('Notifications error:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTelegramStatus = async () => {
    try {
      const data = await apiCall('/telegram/status')
      setTg({
        enabled: !!data.enabled,
        linked: !!data.linked,
        bot_username: data.bot_username || 'V3JobsBot'
      })
    } catch (e) {
      console.error('Telegram status error:', e)
    }
  }

  const startTelegramLink = async () => {
    try {
      setTgLink(prev => ({ ...prev, generating: true }))
      const data = await apiCall('/telegram/link/start', { method: 'POST' })
      const bot = data.bot_username || tg.bot_username || 'V3JobsBot'
      const code = data.code
      const urlWeb = `https://t.me/${bot}?start=${encodeURIComponent(code)}`
      const urlApp = `tg://resolve?domain=${bot}&start=${encodeURIComponent(code)}`
      setTgLink({ code, urlWeb, urlApp, generating: false })
      toast({ title: 'Telegram link ready', description: 'Tap Open Telegram to finish linking.' })
    } catch (e) {
      console.error('Telegram link error:', e)
      toast({ title: 'Failed to start Telegram link', description: e.message || 'Try again', variant: 'destructive' })
      setTgLink({ code: null, urlWeb: null, urlApp: null, generating: false })
    }
  }

  const disconnectTelegram = async () => {
    try {
      await apiCall('/telegram/disconnect', { method: 'POST' })
      setTgLink({ code: null, urlWeb: null, urlApp: null, generating: false })
      await fetchTelegramStatus()
      toast({ title: 'Telegram disconnected' })
    } catch (e) {
      toast({ title: 'Failed to disconnect', description: e.message || 'Try again', variant: 'destructive' })
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}/read`, {
        method: 'PUT'
      })
      
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, is_read: true } : n
      ))
    } catch (error) {
      console.error('Mark as read error:', error)
    }
  }

  const markAllAsRead = async () => {
    try {
      await apiCall('/notifications/read-all', {
        method: 'PUT'
      })
      
      toast({
        title: "All notifications marked as read",
        description: "Your notification list has been updated",
      })
      
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to mark notifications as read",
        variant: "destructive",
      })
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}`, {
        method: 'DELETE'
      })
      
      setNotifications(notifications.filter(n => n.id !== notificationId))
      
      toast({
        title: "Notification deleted",
        description: "The notification has been removed",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete notification",
        variant: "destructive",
      })
    }
  }

  const getNotificationIcon = (type) => {
    const iconConfig = {
      job_assignment: { icon: Briefcase, className: 'text-blue-500' },
      job_reminder: { icon: Clock, className: 'text-orange-500' },
      system: { icon: Info, className: 'text-gray-500' },
      urgent: { icon: AlertTriangle, className: 'text-red-500' }
    }

    const config = iconConfig[type] || iconConfig.system
    const Icon = config.icon

    return <Icon className={`h-5 w-5 ${config.className}`} />
  }

  const getNotificationBadge = (type) => {
    const badgeConfig = {
      job_assignment: { variant: 'default', label: 'Job' },
      job_reminder: { variant: 'secondary', label: 'Reminder' },
      system: { variant: 'outline', label: 'System' },
      urgent: { variant: 'destructive', label: 'Urgent' }
    }

    const config = badgeConfig[type] || badgeConfig.system

    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    )
  }

  const formatTimeAgo = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) return `${diffInHours}h ago`
    
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) return `${diffInDays}d ago`
    
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-40 bg-muted animate-pulse rounded"></div>
          <div className="h-4 w-56 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
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

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'All caught up!'}
          </p>
        </div>
        
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No notifications</h3>
                <p className="text-muted-foreground">
                  You'll receive notifications here about job assignments and updates.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          notifications.map((notification) => (
            <Card 
              key={notification.id} 
              className={`${!notification.is_read ? 'border-primary bg-primary/5' : ''}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getNotificationIcon(notification.type)}
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{notification.title}</CardTitle>
                        {!notification.is_read && (
                          <div className="h-2 w-2 bg-primary rounded-full"></div>
                        )}
                      </div>
                      <CardDescription>
                        {notification.message}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getNotificationBadge(notification.type)}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    {formatTimeAgo(notification.sent_at)}
                  </p>
                  <div className="flex gap-2">
                    {!notification.is_read && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark read
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* FCM Push Notification Setup */}
      <FCMNotificationSetup />

      {/* Telegram linking - simple deep link flow */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Telegram Notifications</CardTitle>
          <CardDescription>
            Link your Telegram in two taps. We’ll open the bot with your code pre-filled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!tg.enabled ? (
            <p className="text-sm text-muted-foreground">Telegram integration is currently unavailable.</p>
          ) : tg.linked ? (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-medium">Status: <span className="text-green-500">Linked</span></p>
                <p className="text-sm text-muted-foreground">You will receive Telegram notifications.</p>
              </div>
              <Button variant="outline" onClick={disconnectTelegram}>Disconnect</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Not linked yet.</p>
              {!tgLink.code ? (
                <Button onClick={startTelegramLink} disabled={tgLink.generating}>
                  {tgLink.generating ? 'Preparing…' : 'Link Telegram'}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <a href={tgLink.urlApp} className="inline-flex">
                      <Button>Open Telegram App</Button>
                    </a>
                    <a href={tgLink.urlWeb} target="_blank" rel="noopener noreferrer" className="inline-flex">
                      <Button variant="outline">Open in Telegram Web</Button>
                    </a>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        navigator.clipboard.writeText(tgLink.urlWeb)
                        toast({ title: 'Link copied' })
                      }}
                    >Copy Link</Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={fetchTelegramStatus}>I’ve pressed Start – Refresh Status</Button>
                    <Button variant="ghost" onClick={() => setTgLink({ code: null, urlWeb: null, urlApp: null, generating: false })}>Start again</Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Bot: @{tg.bot_username || 'V3JobsBot'}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Additional Settings
          </CardTitle>
          <CardDescription>
            Configure other notification preferences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Weekly Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Get reminded to update your availability every Sunday
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Job Reminders</p>
                <p className="text-sm text-muted-foreground">
                  Receive reminders before your scheduled jobs
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive important updates via email
                </p>
              </div>
              <Badge variant="default">Enabled</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

