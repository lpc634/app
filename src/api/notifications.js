import { apiCall } from '../useAuth';

// Notification API functions
export const sendTestTelegram = async () => {
  try {
    const response = await apiCall('/agent/telegram/test', {
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
    const response = await apiCall('/notifications');
    return response;
  } catch (error) {
    console.error('Error getting notifications:', error);
    throw error;
  }
};

export const markNotificationAsRead = async (notificationId) => {
  try {
    const response = await apiCall(`/notifications/${notificationId}/read`, {
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
    const response = await apiCall('/notifications/read-all', {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};
