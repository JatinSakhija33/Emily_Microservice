import axios from 'axios'
import { supabase } from '../lib/supabase'

// Get API URL from environment or use fallback
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    // If it starts with :, it's just a port, prepend localhost
    if (envUrl.startsWith(':')) {
      return `http://localhost${envUrl}`
    }
    // If it doesn't have a protocol, add http://
    if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
      return `http://${envUrl}`
    }
    return envUrl
  }
  // Default fallback for local development
  return 'http://localhost:8000'
}

const API_BASE_URL = getApiBaseUrl()

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add token to requests - always get fresh token from Supabase session
api.interceptors.request.use(async (config) => {
  // Always get the latest session token to ensure it's fresh
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
      // Also update localStorage to keep it in sync
      localStorage.setItem('authToken', session.access_token)
    } else {
      // Fallback to localStorage token if session is not available
      const token = localStorage.getItem('authToken')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
  } catch (error) {
    // If session check fails, use localStorage token as fallback
    const token = localStorage.getItem('authToken')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Handle token expiration with automatic refresh and retry
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Only handle 401 errors and avoid infinite retry loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        console.log('🔄 401 error detected, attempting to refresh session...')

        // Try to get a fresh session (Supabase auto-refreshes tokens)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError || !session) {
          console.log('❌ No valid session found after 401 error')
          // Only logout if we're sure there's no valid session
          // Check if this is a real authentication failure or just a token refresh issue
          const { data: { session: retrySession } } = await supabase.auth.getSession()
          if (!retrySession) {
            console.log('🚪 No session available, redirecting to login...')
            localStorage.removeItem('authToken')
            window.location.href = '/login'
            return Promise.reject(error)
          }
        }

        // Update token in localStorage
        if (session?.access_token) {
          localStorage.setItem('authToken', session.access_token)
          originalRequest.headers.Authorization = `Bearer ${session.access_token}`

          console.log('✅ Session refreshed, retrying original request...')
          // Retry the original request with the new token
          return api(originalRequest)
        } else {
          // No token available - logout
          console.log('🚪 No access token available, redirecting to login...')
          localStorage.removeItem('authToken')
          window.location.href = '/login'
          return Promise.reject(error)
        }
      } catch (refreshError) {
        console.error('❌ Token refresh failed:', refreshError)
        // Only logout if refresh completely fails
        // Give it one more chance by checking session again
        try {
          const { data: { session: finalSession } } = await supabase.auth.getSession()
          if (!finalSession) {
            console.log('🚪 Final session check failed, redirecting to login...')
            localStorage.removeItem('authToken')
            window.location.href = '/login'
          } else {
            // Session exists, update token and retry
            localStorage.setItem('authToken', finalSession.access_token)
            originalRequest.headers.Authorization = `Bearer ${finalSession.access_token}`
            return api(originalRequest)
          }
        } catch (finalError) {
          console.error('❌ Final session check error:', finalError)
          localStorage.removeItem('authToken')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    }

    // For non-401 errors or if retry already attempted, just reject
    return Promise.reject(error)
  }
)

export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (email, password, name) => api.post('/auth/register', { email, password, name }),
  verifyToken: () => api.get('/auth/verify'),
  logout: () => api.post('/auth/logout'),
  checkEmail: (email) => api.get(`/auth/check-email?email=${encodeURIComponent(email)}`),
}

export const mediaAPI = {
  uploadLogo: (file) => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/media/upload-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  uploadMedia: (file) => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/media/upload-media', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  extractColorsFromLogo: (logoUrl) => {
    const formData = new FormData()
    formData.append('logo_url', logoUrl)

    return api.post('/media/extract-colors-from-logo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}


export const documentAPI = {
  parseSignupDoc: (file) => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/document-parser/parse-signup-doc', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
  parseOnboardingDoc: (file) => {
    const formData = new FormData()
    formData.append('file', file)

    return api.post('/document-parser/parse-onboarding-doc', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },
}


export const smartSearchAPI = {
  search: (query, type, google_place_id) => {
    return api.post('/smart-search/', { query, type, google_place_id }, {
      timeout: 60000 // 60s timeout for web search + parsing
    })
  },
  autocomplete: (query) => {
    return api.get(`/smart-search/autocomplete?query=${encodeURIComponent(query)}`)
  }
}

export default api

