import { apiCall } from '../useAuth';

// Telegram integration API functions
export const getTelegramStatus = async () => {
  try {
    const response = await apiCall('/agent/telegram/status');
    return response;
  } catch (error) {
    console.error('Error getting Telegram status:', error);
    throw error;
  }
};

export const createTelegramLink = async () => {
  try {
    const response = await apiCall('/agent/telegram/link', {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error creating Telegram link:', error);
    throw error;
  }
};

export const disconnectTelegram = async () => {
  try {
    const response = await apiCall('/agent/telegram/disconnect', {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error disconnecting Telegram:', error);
    throw error;
  }
};

export const sendTestTelegram = async () => {
  try {
    const response = await apiCall('/agent/telegram/test', {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error sending test Telegram message:', error);
    throw error;
  }
};

// Agent profile functions
export const getAgentProfile = async () => {
  try {
    const response = await apiCall('/agent/profile');
    return response;
  } catch (error) {
    console.error('Error getting agent profile:', error);
    throw error;
  }
};

export const updateAgentProfile = async (profileData) => {
  try {
    const response = await apiCall('/agent/profile', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
    return response;
  } catch (error) {
    console.error('Error updating agent profile:', error);
    throw error;
  }
};
