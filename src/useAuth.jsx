import { createContext, useContext, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const AuthContext = createContext()

// The standard way to set the API URL for production and development in Vite
const API_BASE_URL = import.meta.env.PROD
  ? 'https://v3-app-49c3d1eff914.herokuapp.com/api' // Explicit Heroku URL
  : 'http://localhost:5001/api'; // Use the full local URL for development

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState(localStorage.getItem('token'))
  const navigate = useNavigate()

  useEffect(() => {
    if (token) {
      // Verify token and get user info
      fetchCurrentUser()
    } else {
      setLoading(false)
    }
  }, [token])

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.user)
      } else {
        // Token is invalid
        logout()
      }
    } catch (error) {
      console.error('Error fetching current user:', error)
      logout()
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    try {
      console.log('Attempting login with email:', email);
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })

      const data = await response.json()
      console.log('Login response:', response.status, data);

      if (response.ok) {
        const { access_token, user } = data
        console.log('Parsed data:', { access_token, user });
        setToken(access_token)
        setUser(user)
        localStorage.setItem('token', access_token)
        
        if (user.role === 'agent') {
          navigate('/agent/dashboard')
        } else if (user.role === 'admin' || user.role === 'manager') {
          navigate('/')
        } else {
          navigate('/')
        }
        
        return { success: true }
      } else {
        console.log('Login failed with error:', data.error || 'Login failed');
        return { success: false, error: data.error || 'Login failed' }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: 'Network error. Please try again.' }
    }
  }

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setToken(null)
      setUser(null)
      localStorage.removeItem('token')
      navigate('/login')
    }
  }

  const apiCall = async (endpoint, options = {}) => {
    const url = `${API_BASE_URL}${endpoint}` // The /api prefix is now included in API_BASE_URL
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      },
      credentials: 'include',
      ...options
    }

    try {
      const response = await fetch(url, config)
      
      const contentType = response.headers.get("content-type");
      let data;
      if (contentType && contentType.indexOf("application/json") !== -1) {
          data = await response.json();
      }

      if (response.status === 401) {
        logout()
        throw new Error('Authentication required')
      }

      if (!response.ok) {
        throw new Error(data?.error || `HTTP error! status: ${response.status}`)
      }

      return data
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error)
      throw error
    }
  }

  const value = {
    user,
    loading,
    login,
    logout,
    apiCall
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}