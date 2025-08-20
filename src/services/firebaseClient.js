/**
 * Firebase Client Configuration for Web Push Notifications
 * Handles FCM token registration and message handling in the browser
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Firebase configuration - these should be set as environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// VAPID key for web push (should be set as environment variable)
const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Check if Firebase configuration is complete
const isFirebaseConfigured = firebaseConfig.projectId && firebaseConfig.apiKey && vapidKey;

// Initialize Firebase
let app;
let messaging;

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
} else {
  console.warn('Firebase not configured - some environment variables are missing. FCM notifications will be disabled.');
}

class FCMClientService {
  constructor() {
    this.isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    this.token = null;
    this.messaging = messaging;
  }

  /**
   * Check if FCM is supported in the current browser
   */
  isFirebaseSupported() {
    return this.isSupported && this.messaging && vapidKey && isFirebaseConfigured;
  }

  /**
   * Request notification permission from the user
   */
  async requestNotificationPermission() {
    try {
      if (!('Notification' in window)) {
        console.log('This browser does not support notifications');
        return false;
      }

      let permission = Notification.permission;

      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }

      if (permission === 'granted') {
        console.log('Notification permission granted');
        return true;
      } else {
        console.log('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  /**
   * Get FCM registration token
   */
  async getRegistrationToken() {
    try {
      if (!this.isFirebaseSupported()) {
        console.warn('FCM not supported or not configured properly');
        return null;
      }

      // Register service worker
      await this.registerServiceWorker();

      // Request permission first
      const hasPermission = await this.requestNotificationPermission();
      if (!hasPermission) {
        console.log('No notification permission, cannot get FCM token');
        return null;
      }

      // Get FCM token
      const token = await getToken(this.messaging, {
        vapidKey: vapidKey,
        serviceWorkerRegistration: await navigator.serviceWorker.getRegistration()
      });

      if (token) {
        console.log('FCM token obtained:', token.substring(0, 20) + '...');
        this.token = token;
        return token;
      } else {
        console.log('No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Register service worker for FCM
   */
  async registerServiceWorker() {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered:', registration);
        return registration;
      }
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  }

  /**
   * Send FCM token to backend
   */
  async sendTokenToBackend(token, apiCall) {
    try {
      const response = await apiCall('/notifications/fcm/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fcm_token: token,
          device_type: 'web',
          user_agent: navigator.userAgent
        })
      });

      console.log('FCM token registered with backend:', response);
      return response;
    } catch (error) {
      console.error('Error sending FCM token to backend:', error);
      throw error;
    }
  }

  /**
   * Initialize FCM for the current user
   */
  async initializeFCM(apiCall) {
    try {
      if (!this.isFirebaseSupported()) {
        console.warn('FCM not supported, skipping initialization');
        return { success: false, reason: 'not_supported' };
      }

      // Get FCM token
      const token = await this.getRegistrationToken();
      if (!token) {
        return { success: false, reason: 'no_token' };
      }

      // Send token to backend
      await this.sendTokenToBackend(token, apiCall);

      // Set up foreground message handler
      this.setupForegroundMessageHandler();

      return { success: true, token };
    } catch (error) {
      console.error('FCM initialization failed:', error);
      return { success: false, reason: 'error', error };
    }
  }

  /**
   * Handle messages when app is in foreground
   */
  setupForegroundMessageHandler() {
    if (!this.messaging) return;

    onMessage(this.messaging, (payload) => {
      console.log('Foreground message received:', payload);

      // Show notification manually since onMessage doesn't show notifications automatically
      if (payload.notification) {
        this.showNotification(payload.notification.title, {
          body: payload.notification.body,
          icon: '/logo-512x512.png',
          badge: '/logo-512x512.png',
          data: payload.data,
          tag: 'job-notification',
          requireInteraction: true
        });
      }
    });
  }

  /**
   * Show browser notification
   */
  async showNotification(title, options = {}) {
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification(title, options);
      } else {
        // Fallback for browsers without service worker
        new Notification(title, options);
      }
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  /**
   * Delete FCM token from backend
   */
  async deleteToken(apiCall) {
    try {
      if (this.token) {
        await apiCall('/notifications/fcm/unregister', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fcm_token: this.token
          })
        });
        console.log('FCM token deleted from backend');
      }
    } catch (error) {
      console.error('Error deleting FCM token:', error);
    }
  }
}

// Export singleton instance
export const fcmClient = new FCMClientService();
export default fcmClient;