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

// Telegram integration API functions
export const getTelegramStatus = async () => {
  try {
    const response = await makeApiCall('/agent/telegram/status');
    return response;
  } catch (error) {
    console.error('Error getting Telegram status:', error);
    throw error;
  }
};

export const createTelegramLink = async () => {
  try {
    const response = await makeApiCall('/agent/telegram/link/start', {
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
    const response = await makeApiCall('/agent/telegram/disconnect', {
      method: 'POST'
    });
    return response;
  } catch (error) {
    console.error('Error disconnecting Telegram:', error);
    throw error;
  }
};

// Agent profile functions
export const getAgentProfile = async () => {
  try {
    const response = await makeApiCall('/agent/profile');
    return response;
  } catch (error) {
    console.error('Error getting agent profile:', error);
    throw error;
  }
};

export const updateAgentProfile = async (profileData) => {
  try {
    const response = await makeApiCall('/agent/profile', {
      method: 'POST',
      body: JSON.stringify(profileData)
    });
    return response;
  } catch (error) {
    console.error('Error updating agent profile:', error);
    throw error;
  }
};
