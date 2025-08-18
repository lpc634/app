// Helper function to get API base URL
const API_BASE_URL = import.meta.env.PROD
  ? 'https://v3-app-49c3d1eff914.herokuapp.com/api'
  : 'http://localhost:5001/api';

// Helper function to make API calls
const makeApiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    ...options.headers,
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers: headers,
  };

  try {
    const response = await fetch(url, config);
    
    if (response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
      throw new Error('Authentication required');
    }

    if (!response.ok) {
      try {
        const errorData = await response.json();
        throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
      } catch {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    } else {
      return await response.text();
    }
  } catch (error) {
    console.error(`API call failed for ${endpoint}:`, error);
    throw error;
  }
};

// Notification API functions
export const sendTestTelegram = async () => {
  try {
    const response = await makeApiCall('/agent/telegram/test', {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error sending test Telegram notification:', error);
    throw error;
  }
};

export const getNotifications = async () => {
  try {
    const response = await makeApiCall('/notifications');
    return response;
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await makeApiCall(`/notifications/${notificationId}/read`, {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

export const markAllNotificationsAsRead = async () => {
  try {
    const response = await makeApiCall('/notifications/read-all', {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};
