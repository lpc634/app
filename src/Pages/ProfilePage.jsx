import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../useAuth.jsx';
import { useToast } from '../use-toast.js';
import { 
  User, 
  Mail, 
  Phone, 
  Calendar,
  Award,
  BarChart3,
  Settings,
  LogOut,
  Edit,
  Save,
  X
} from 'lucide-react'

export default function ProfilePage() {
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [loading, setLoading] = useState(true)
  const { user, apiCall, logout } = useAuth()
  const { toast } = useToast()
  const [tg, setTg] = useState({ enabled: false, linked: false, bot_username: null })
  const [tgLink, setTgLink] = useState({ code: null, urlWeb: null, urlApp: null, generating: false })

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchStats()
      fetchTelegramStatus()
    }
  }, [user])  // Depend on user to refetch if changed

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const data = await apiCall(`/users/${user.id}`)
      setProfile(data.user || {})  // Default to empty object if null
      setEditData({
        first_name: data.user?.first_name || '',
        last_name: data.user?.last_name || '',
        phone: data.user?.phone || ''
      })
    } catch (error) {
      console.error('Profile error:', error)
      toast({
        title: "Error",
        description: "Failed to load profile",
        variant: "destructive"
      })
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

  const fetchStats = async () => {
    try {
      const data = await apiCall(`/analytics/agents/${user.id}`)
      setStats(data.agent_metrics || {})  // Default to empty if null
    } catch (error) {
      console.error('Stats error:', error)
      toast({
        title: "Error",
        description: "Failed to load stats",
        variant: "destructive"
      })
    }
  }

  const updateProfile = async () => {
    try {
      await apiCall(`/users/${user.id}`, {
        method: 'PUT',
        body: JSON.stringify(editData)
      })

      toast({
        title: "Profile Updated",
        description: "Your profile information has been saved",
      })

      setEditing(false)
      fetchProfile()
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to update profile",
        variant: "destructive",
      })
    }
  }

  const handleLogout = () => {
    logout()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-8 w-32 bg-muted animate-pulse rounded"></div>
          <div className="h-4 w-48 bg-muted animate-pulse rounded"></div>
        </div>
        <div className="grid gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  <div className="h-4 w-1/2 bg-muted animate-pulse rounded"></div>
                  <div className="h-3 w-2/3 bg-muted animate-pulse rounded"></div>
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
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground">
          Manage your account information and view your performance
        </p>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </CardTitle>
            {!editing ? (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={updateProfile}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setEditing(false)
                    setEditData({
                      first_name: profile?.first_name || '',
                      last_name: profile?.last_name || '',
                      phone: profile?.phone || ''
                    })
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={editData.first_name}
                    onChange={(e) => setEditData({...editData, first_name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={editData.last_name}
                    onChange={(e) => setEditData({...editData, last_name: e.target.value})}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={editData.phone}
                  onChange={(e) => setEditData({...editData, phone: e.target.value})}
                  placeholder="Enter your phone number"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{profile?.first_name || 'Not provided'} {profile?.last_name || ''}</p>
                    <p className="text-sm text-muted-foreground">Full Name</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{profile?.email || 'Not provided'}</p>
                    <p className="text-sm text-muted-foreground">Email Address</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{profile?.phone || 'Not provided'}</p>
                    <p className="text-sm text-muted-foreground">Phone Number</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Invalid Date'}
                    </p>
                    <p className="text-sm text-muted-foreground">Member Since</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Performance Statistics
            </CardTitle>
            <CardDescription>
              Your performance over the last 30 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {stats.acceptance_rate || 0}%
                </div>
                <p className="text-sm text-muted-foreground">Acceptance Rate</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">
                  {stats.total_assignments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Total Jobs</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(stats.avg_response_time_minutes) || 0}m
                </div>
                <p className="text-sm text-muted-foreground">Avg Response</p>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold">
                  {stats.accepted_assignments || 0}
                </div>
                <p className="text-sm text-muted-foreground">Jobs Accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Account Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Account Type</p>
                <p className="text-sm text-muted-foreground">Field Agent</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Verification Status</p>
                <p className="text-sm text-muted-foreground">Identity verified</p>
              </div>
              <Badge variant="default" className="bg-green-500">Verified</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notification Preferences</p>
                <p className="text-sm text-muted-foreground">Push notifications enabled</p>
              </div>
              <Badge variant="outline">Configured</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* App Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            App Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Settings className="h-4 w-4 mr-2" />
              Notification Settings
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <Award className="h-4 w-4 mr-2" />
              Performance History
            </Button>
            
            <Button variant="outline" className="w-full justify-start">
              <Mail className="h-4 w-4 mr-2" />
              Contact Support
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Telegram Linking (at bottom) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">Telegram Notifications</CardTitle>
          <CardDescription>Link your Telegram in two taps. No searching or codes.</CardDescription>
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

      {/* Sign Out */}
      <Card>
        <CardContent className="pt-6">
          <Button 
            variant="destructive" 
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}