import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

const API_BASE_URL = import.meta.env.PROD
  ? 'https://v3-app-49c3d1eff914.herokuapp.com/api'
  : 'http://localhost:5001/api';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // This function runs on initial app load to check for an existing session.
  const fetchCurrentUser = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        // If the token is invalid, clear it
        localStorage.removeItem('token');
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
      localStorage.removeItem('token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // This useEffect runs only once when the AuthProvider is first mounted.
  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      
      console.log('Login response:', data); // Debug log

      if (response.ok && data.access_token) {
        const { access_token, user } = data;
        
        // Save token
        localStorage.setItem('token', access_token);
        console.log('Token saved successfully'); // Debug log
        
        // Set user (no need to parse - it's already an object)
        setUser(user);
        
        // Return success
        return { success: true, user: user };
      } else {
        return { success: false, error: data.msg || data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    // Clear user state and token from storage. 
    // The ProtectedRoute will automatically redirect to /login.
    const token = localStorage.getItem('token');
    if (token) {
        // Optional: Call backend logout endpoint, but don't wait for it.
        fetch(`${API_BASE_URL}/auth/logout`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
        }).catch(err => console.error("Backend logout failed:", err));
    }
    localStorage.removeItem('token');
    setUser(null);
  };
  
  // --- THIS FUNCTION HAS BEEN UPDATED ---
  const apiCall = async (endpoint, options = {}) => {
    const token = localStorage.getItem('token');
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Create a base headers object
    const headers = {
      ...options.headers,
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    // Conditionally set Content-Type. Do NOT set it for FormData.
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
        // If unauthorized, log the user out.
        logout();
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        // Try to get error message from JSON response
        try {
          const errorData = await response.json();
          throw new Error(errorData?.error || `HTTP error! status: ${response.status}`);
        } catch {
          // If JSON parsing fails, throw generic error
          throw new Error(`HTTP error! status: ${response.status}`);
        }
      }

      // Handle different response types
      if (options.responseType === 'blob') {
        // Return blob for binary data (like PDFs)
        return await response.blob();
      } else {
        // Handle JSON responses
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        } else {
          // Return text for non-JSON responses
          return await response.text();
        }
      }
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    apiCall,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}