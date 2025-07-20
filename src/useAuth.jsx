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

      if (response.ok) {
        const { access_token, user } = data;
        const parsedUser = typeof user === 'string' ? JSON.parse(user) : user;

        localStorage.setItem('token', access_token);
        setUser(parsedUser);
        
        // Return success and user data so the LoginPage can handle navigation
        return { success: true, user: parsedUser };
      } else {
        return { success: false, error: data.error || 'Login failed' };
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

      // Handle responses that might not have a JSON body
      const contentType = response.headers.get("content-type");
      let data = null;
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      }

      if (!response.ok) {
        throw new Error(data?.error || `HTTP error! status: ${response.status}`);
      }

      return data;
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