/**
 * FCM Notification Setup Component
 * Handles Firebase Cloud Messaging initialization and permission requests
 */

import React, { useEffect, useState } from 'react';
import { Bell, BellOff, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useFCM } from '../hooks/useFCM';
import { useToast } from '../use-toast';

const FCMNotificationSetup = () => {
  const {
    isInitialized,
    fcmSupported,
    permissionStatus,
    token,
    error,
    requestPermission,
    refreshToken
  } = useFCM();
  
  const { toast } = useToast();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Show success toast when FCM is initialized
    if (isInitialized && token) {
      toast({
        title: "Push notifications enabled",
        description: "You'll now receive instant job notifications",
        duration: 3000,
      });
    }
  }, [isInitialized, token, toast]);

  useEffect(() => {
    // Show error toast if there's an FCM error
    if (error) {
      toast({
        title: "Notification setup issue",
        description: error,
        variant: "destructive",
        duration: 5000,
      });
    }
  }, [error, toast]);

  const handleEnableNotifications = async () => {
    const granted = await requestPermission();
    if (granted) {
      toast({
        title: "Success!",
        description: "Push notifications have been enabled",
      });
    } else {
      toast({
        title: "Permission denied",
        description: "You can enable notifications later in your browser settings",
        variant: "destructive",
      });
    }
  };

  const handleRefreshToken = async () => {
    const newToken = await refreshToken();
    if (newToken) {
      toast({
        title: "Token refreshed",
        description: "Notification settings have been updated",
      });
    }
  };

  const getStatusIcon = () => {
    if (!fcmSupported) {
      return <BellOff className="h-5 w-5 text-gray-400" />;
    }
    
    if (isInitialized && token) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    
    if (permissionStatus === 'denied') {
      return <BellOff className="h-5 w-5 text-red-500" />;
    }
    
    return <Bell className="h-5 w-5 text-orange-500" />;
  };

  const getStatusText = () => {
    if (!fcmSupported) {
      return { status: 'Unsupported', description: 'Push notifications not available in this browser' };
    }
    
    if (isInitialized && token) {
      return { status: 'Active', description: 'Push notifications are working' };
    }
    
    if (permissionStatus === 'denied') {
      return { status: 'Blocked', description: 'Notifications are blocked by your browser' };
    }
    
    if (permissionStatus === 'default') {
      return { status: 'Setup Required', description: 'Enable notifications to receive job alerts' };
    }
    
    return { status: 'Setting up...', description: 'Configuring push notifications' };
  };

  const getStatusBadge = () => {
    if (isInitialized && token) {
      return <Badge variant="default" className="bg-green-500">Active</Badge>;
    }
    
    if (permissionStatus === 'denied') {
      return <Badge variant="destructive">Blocked</Badge>;
    }
    
    if (!fcmSupported) {
      return <Badge variant="secondary">Unsupported</Badge>;
    }
    
    return <Badge variant="outline">Setup Required</Badge>;
  };

  const statusInfo = getStatusText();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-lg">Push Notifications</CardTitle>
              <CardDescription>{statusInfo.description}</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          {/* Action buttons */}
          <div className="flex gap-2">
            {!isInitialized && fcmSupported && permissionStatus !== 'denied' && (
              <Button onClick={handleEnableNotifications} className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                Enable Notifications
              </Button>
            )}
            
            {isInitialized && (
              <Button variant="outline" onClick={handleRefreshToken} className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Refresh
              </Button>
            )}
            
            <Button variant="ghost" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Hide Details' : 'Show Details'}
            </Button>
          </div>

          {/* Browser permission instructions */}
          {permissionStatus === 'denied' && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-medium text-red-800">Notifications Blocked</h4>
                  <p className="text-sm text-red-700 mt-1">
                    To receive job notifications, please enable notifications in your browser settings:
                  </p>
                  <ul className="text-sm text-red-700 mt-2 ml-4 list-disc">
                    <li>Click on the lock/bell icon in your address bar</li>
                    <li>Select "Allow" for notifications</li>
                    <li>Refresh this page</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Success message */}
          {isInitialized && token && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <h4 className="font-medium text-green-800">Ready to receive notifications!</h4>
                  <p className="text-sm text-green-700">
                    You'll get instant alerts for new job assignments, even when this tab is closed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Technical details */}
          {showDetails && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-medium text-gray-800 mb-2">Technical Details</h4>
              <div className="space-y-1 text-sm text-gray-600">
                <div>FCM Supported: {fcmSupported ? 'Yes' : 'No'}</div>
                <div>Permission: {permissionStatus}</div>
                <div>Status: {statusInfo.status}</div>
                {token && (
                  <div>Token: {token.substring(0, 20)}...</div>
                )}
                {error && (
                  <div className="text-red-600">Error: {error}</div>
                )}
              </div>
            </div>
          )}

          {/* Mobile app note */}
          <div className="text-sm text-gray-500 italic">
            <Smartphone className="h-4 w-4 inline mr-1" />
            When this becomes a mobile app, push notifications will work even better with native mobile features.
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FCMNotificationSetup;