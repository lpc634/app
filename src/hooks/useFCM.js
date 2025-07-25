/**
 * Firebase Cloud Messaging (FCM) React Hook
 * Handles FCM initialization, token registration, and notification handling
 */

import { useState, useEffect } from 'react';
import { fcmClient } from '../services/firebaseClient';
import { useAuth } from '../useAuth';

export const useFCM = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [fcmSupported, setFcmSupported] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState('default');
  const [token, setToken] = useState(null);
  const [error, setError] = useState(null);
  const { apiCall, user } = useAuth();

  useEffect(() => {
    // Only initialize FCM for logged-in users
    if (user && user.role === 'agent') {
      initializeFCM();
    }
  }, [user]);

  const initializeFCM = async () => {
    try {
      setError(null);
      
      // Check if FCM is supported
      const supported = fcmClient.isFirebaseSupported();
      setFcmSupported(supported);

      if (!supported) {
        console.log('FCM not supported in this browser/environment');
        return;
      }

      // Initialize FCM
      const result = await fcmClient.initializeFCM(apiCall);
      
      if (result.success) {
        setToken(result.token);
        setIsInitialized(true);
        setPermissionStatus('granted');
        console.log('FCM initialized successfully');
      } else {
        console.warn('FCM initialization failed:', result.reason);
        if (result.reason === 'no_token') {
          setPermissionStatus('denied');
        }
        setError(`FCM initialization failed: ${result.reason}`);
      }
    } catch (error) {
      console.error('FCM initialization error:', error);
      setError(`FCM error: ${error.message}`);
    }
  };

  const requestPermission = async () => {
    try {
      const hasPermission = await fcmClient.requestNotificationPermission();
      if (hasPermission) {
        setPermissionStatus('granted');
        // Re-initialize to get token
        await initializeFCM();
        return true;
      } else {
        setPermissionStatus('denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      setError(`Permission error: ${error.message}`);
      return false;
    }
  };

  const refreshToken = async () => {
    try {
      const newToken = await fcmClient.getRegistrationToken();
      if (newToken) {
        await fcmClient.sendTokenToBackend(newToken, apiCall);
        setToken(newToken);
        return newToken;
      }
      return null;
    } catch (error) {
      console.error('Error refreshing FCM token:', error);
      setError(`Token refresh error: ${error.message}`);
      return null;
    }
  };

  const cleanup = async () => {
    try {
      if (token) {
        await fcmClient.deleteToken(apiCall);
        setToken(null);
        setIsInitialized(false);
      }
    } catch (error) {
      console.error('Error cleaning up FCM:', error);
    }
  };

  return {
    isInitialized,
    fcmSupported,
    permissionStatus,
    token,
    error,
    initializeFCM,
    requestPermission,
    refreshToken,
    cleanup
  };
};