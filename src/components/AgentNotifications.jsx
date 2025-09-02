import React, { useState, useEffect } from 'react';
import { 
  Bell, Briefcase, Calendar, DollarSign, AlertTriangle, 
  CheckCircle, X, Eye, EyeOff, Trash2, Filter, Search,
  MessageSquare, Star, Clock, MapPin, RefreshCw, ServerCrash
} from 'lucide-react';
import { useAuth } from "../useAuth";

const AgentNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [filteredNotifications, setFilteredNotifications] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { apiCall } = useAuth();

  useEffect(() => {
    loadNotifications();
  }, []);

  useEffect(() => {
    let filtered = notifications;
    
    if (searchTerm) {
      filtered = filtered.filter(notification => 
        notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        notification.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (filterType !== 'all') {
      if (filterType === 'unread') {
        filtered = filtered.filter(notification => !notification.read);
      } else {
        filtered = filtered.filter(notification => notification.type === filterType);
      }
    }
    
    setFilteredNotifications(filtered);
  }, [searchTerm, filterType, notifications]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      // Use backend notifications endpoint
      const data = await apiCall('/notifications');
      setNotifications(data);
      setFilteredNotifications(data);
    } catch (error) {
      setError('Failed to load notifications');
      console.error('Notifications error:', error);
      // Fallback to mock data for development
      const mockNotifications = [
        {
          id: 1,
          type: 'job_offer',
          title: 'New Job Opportunity',
          message: 'Event Security position available at Hyde Park Music Festival on June 16th. Rate: £25.50/hour',
          timestamp: '2025-06-16T10:30:00',
          read: false,
          priority: 'high',
          data: {
            jobId: 'JOB001',
            rate: 25.50,
            location: 'Hyde Park, London',
            startTime: '2025-06-16T18:00:00'
          }
        },
        {
          id: 2,
          type: 'job_update',
          title: 'Job Assignment Confirmed',
          message: 'Your assignment for Retail Security at Westfield Shopping Centre has been confirmed. Please arrive 15 minutes early.',
          timestamp: '2025-06-15T14:20:00',
          read: false,
          priority: 'medium',
          data: {
            jobId: 'JOB002',
            location: 'Westfield Shopping Centre'
          }
        },
        {
          id: 3,
          type: 'payment',
          title: 'Payment Processed',
          message: 'Payment of £342.75 has been processed for your work last week. Check your payment history for details.',
          timestamp: '2025-06-15T09:15:00',
          read: true,
          priority: 'low',
          data: {
            amount: 342.75,
            period: 'Week ending June 9th'
          }
        },
        {
          id: 4,
          type: 'reminder',
          title: 'Upcoming Assignment',
          message: 'Reminder: Corporate Security shift at Canary Wharf starts tomorrow at 8:00 PM. Duration: 12 hours.',
          timestamp: '2025-06-15T16:00:00',
          read: false,
          priority: 'medium',
          data: {
            jobId: 'JOB003',
            startTime: '2025-06-16T20:00:00',
            location: 'Canary Wharf Office Complex'
          }
        },
        {
          id: 5,
          type: 'system',
          title: 'Profile Update Required',
          message: 'Please update your SIA license expiration date in your profile to continue receiving job offers.',
          timestamp: '2025-06-14T11:30:00',
          read: true,
          priority: 'high',
          data: {}
        },
        {
          id: 6,
          type: 'rating',
          title: 'New Client Rating',
          message: 'You received a 5-star rating from MegaEvents Ltd for your excellent work at the music festival!',
          timestamp: '2025-06-14T08:45:00',
          read: true,
          priority: 'low',
          data: {
            rating: 5,
            client: 'MegaEvents Ltd'
          }
        }
      ];
      setNotifications(mockNotifications);
      setFilteredNotifications(mockNotifications);
    } finally {
      setLoading(false);
    }
  };

  const getNotificationIcon = (type) => {
    switch(type) {
      case 'job_offer': return Briefcase;
      case 'job_update': return Calendar;
      case 'payment': return DollarSign;
      case 'reminder': return Clock;
      case 'system': return AlertTriangle;
      case 'rating': return Star;
      case 'job_cancelled': return X;
      default: return Bell;
    }
  };

  const getNotificationColor = (type, priority) => {
    switch(type) {
      case 'job_offer': return 'bg-v3-orange';
      case 'job_update': return 'bg-blue-500';
      case 'payment': return 'bg-green-500';
      case 'reminder': return 'bg-yellow-500';
      case 'system': return 'bg-v3-text-muted';
      case 'rating': return 'bg-yellow-500';
      case 'job_cancelled': return 'bg-red-500';
      default: return 'bg-v3-text-muted';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'high': return 'bg-red-900/50 text-red-400 border-red-500/50';
      case 'medium': return 'bg-yellow-900/50 text-yellow-400 border-yellow-500/50';
      case 'low': return 'bg-green-900/50 text-green-400 border-green-500/50';
      default: return 'bg-gray-900/50 text-gray-400 border-gray-500/50';
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}/read`, { method: 'PUT' });
      setNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiCall('/notifications/read-all', { method: 'PUT' });
      setNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  const deleteNotification = async (notificationId) => {
    try {
      await apiCall(`/notifications/${notificationId}`, { method: 'DELETE' });
      setNotifications(prev => 
        prev.filter(notification => notification.id !== notificationId)
      );
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));
      return `${diffInMinutes} minutes ago`;
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      return `${diffInDays} days ago`;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading && notifications.length === 0) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex justify-between items-center">
          <div>
            <div className="h-8 w-48 bg-v3-bg-card rounded-md"></div>
            <div className="h-4 w-72 bg-v3-bg-card rounded-md mt-2"></div>
          </div>
          <div className="h-10 w-24 bg-v3-bg-card rounded-md"></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-v3-bg-card rounded-lg"></div>
          ))}
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 bg-v3-bg-card rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error && notifications.length === 0) {
    return (
      <div className="dashboard-card text-center p-8">
        <ServerCrash className="mx-auto h-16 w-16 text-v3-orange mb-4" />
        <h2 className="text-xl font-bold mb-2">Connection Error</h2>
        <p className="text-v3-text-muted mb-6">{error}</p>
        <button onClick={loadNotifications} className="button-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Stay updated with your assignments and messages</p>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <button onClick={markAllAsRead} className="button-refresh flex items-center space-x-2">
              <CheckCircle size={16} />
              <span>Mark All Read</span>
            </button>
          )}
          <button onClick={loadNotifications} className="button-refresh">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <div className="dashboard-card">
          <div className="flex justify-between items-start">
            <h3 className="text-v3-text-muted font-semibold">Total</h3>
            <Bell className="h-5 w-5 text-v3-text-muted" />
          </div>
          <div className="text-2xl font-bold text-v3-text-lightest mt-2">{notifications.length}</div>
        </div>
        
        <div className="dashboard-card">
          <div className="flex justify-between items-start">
            <h3 className="text-v3-text-muted font-semibold">Unread</h3>
            <EyeOff className="h-5 w-5 text-v3-text-muted" />
          </div>
          <div className="text-2xl font-bold text-v3-text-lightest mt-2">{unreadCount}</div>
        </div>
        
        {/* Removed priority summary from agent-facing UI */}
      </div>

      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-v3-text-muted" size={20} />
          <input
            type="text"
            placeholder="Search notifications..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-v3-bg-card border border-v3-border rounded-lg pl-10 pr-4 py-3 text-v3-text-lightest placeholder-v3-text-muted focus:border-v3-orange focus:ring-2 focus:ring-v3-orange-glow transition-all"
          />
        </div>
        
        <div className="flex space-x-2 overflow-x-auto pb-2">
          {[
            { value: 'all', label: 'All', icon: Bell },
            { value: 'unread', label: 'Unread', icon: EyeOff },
            { value: 'job_offer', label: 'Job Offers', icon: Briefcase },
            { value: 'payment', label: 'Payments', icon: DollarSign },
            { value: 'reminder', label: 'Reminders', icon: Clock },
            { value: 'system', label: 'System', icon: AlertTriangle }
          ].map((filter) => (
            <button
              key={filter.value}
              onClick={() => setFilterType(filter.value)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-all ${
                filterType === filter.value
                  ? 'bg-gradient-to-r from-v3-orange to-v3-orange-dark text-white'
                  : 'bg-v3-bg-card text-v3-text-light hover:bg-v3-bg-dark border border-v3-border'
              }`}
            >
              <filter.icon size={16} />
              <span>{filter.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="dashboard-card text-center p-8">
          <Bell className="mx-auto text-v3-text-muted mb-4" size={48} />
          <h3 className="text-v3-text-lightest text-xl font-semibold mb-2">No Notifications</h3>
          <p className="text-v3-text-muted">You're all caught up! Check back later for updates.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredNotifications.map((notification) => {
            const IconComponent = getNotificationIcon(notification.type);
            
            return (
              <div
                key={notification.id}
                className={`dashboard-card cursor-pointer group ${
                  !notification.read ? 'border-v3-orange shadow-lg shadow-v3-orange-glow' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className={`w-12 h-12 ${getNotificationColor(notification.type, notification.priority)} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <IconComponent className="text-white" size={24} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className={`font-semibold ${notification.read ? 'text-v3-text-light' : 'text-v3-text-lightest'}`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <div className="w-2 h-2 bg-v3-orange rounded-full"></div>
                        )}
                        {/* Priority badge removed */}
                      </div>
                      <p className={`leading-relaxed ${notification.read ? 'text-v3-text-muted' : 'text-v3-text-light'}`}>
                        {notification.message}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notification.id);
                    }}
                    className="text-v3-text-muted hover:text-red-500 p-1 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-v3-border">
                  <span className="text-v3-text-muted text-sm">{formatTimestamp(notification.timestamp)}</span>
                  
                  {/* Additional data based on notification type */}
                  {notification.type === 'job_offer' && notification.data.rate && (
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1 text-green-400">
                        <DollarSign size={14} />
                        <span>£{notification.data.rate}/hr</span>
                      </div>
                      <div className="flex items-center space-x-1 text-blue-400">
                        <MapPin size={14} />
                        <span>{notification.data.location}</span>
                      </div>
                    </div>
                  )}
                  
                  {notification.type === 'payment' && notification.data.amount && (
                    <div className="flex items-center space-x-1 text-green-400 text-sm font-medium">
                      <DollarSign size={14} />
                      <span>£{notification.data.amount}</span>
                    </div>
                  )}
                  
                  {notification.type === 'rating' && notification.data.rating && (
                    <div className="flex items-center space-x-1 text-yellow-400 text-sm">
                      {[...Array(notification.data.rating)].map((_, i) => (
                        <Star key={i} className="fill-current" size={14} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AgentNotifications;

