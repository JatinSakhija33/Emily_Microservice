import { supabase } from '../lib/supabase'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

// Helper function to build API URLs
const buildApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_BASE_URL}${cleanEndpoint}`
}

class ConnectionsAPI {
  // Get all connections for current user
  async getConnections() {
    try {
      const authToken = await this.getAuthToken()
      console.log('Fetching connections with token:', authToken ? 'present' : 'missing')
      
      const response = await fetch(buildApiUrl('/connections/'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('Connections response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Connections API error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Connections data:', data)
      
      // Handle both array response and object with connections property
      const connections = Array.isArray(data) ? data : (data.connections || [])
      console.log('Processed connections:', connections)
      return { data: connections, error: null }
    } catch (error) {
      console.error('Error fetching connections:', error)
      return { data: null, error: error.message }
    }
  }

  // Initiate OAuth connection for a platform
  async initiateConnection(platform) {
    try {
      const response = await fetch(buildApiUrl(`/connections/auth/${platform}/connect`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data.auth_url, error: null }
    } catch (error) {
      console.error('Error initiating connection:', error)
      return { data: null, error: error.message }
    }
  }

  // Handle OAuth callback (this will be called by the backend)
  async handleCallback(platform, code, state) {
    try {
      const response = await fetch(buildApiUrl(`/connections/auth/${platform}/callback`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify({ code, state })
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data.connection, error: null }
    } catch (error) {
      console.error('Error handling callback:', error)
      return { data: null, error: error.message }
    }
  }

  // Disconnect an account
  async disconnectAccount(connectionId) {
    try {
      const response = await fetch(buildApiUrl(`/connections/${connectionId}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data, error: null }
    } catch (error) {
      console.error('Error disconnecting account:', error)
      return { data: null, error: error.message }
    }
  }

  // Refresh connection tokens
  async refreshConnection(connectionId) {
    try {
      const response = await fetch(buildApiUrl(`/connections/${connectionId}/refresh`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data, error: null }
    } catch (error) {
      console.error('Error refreshing connection:', error)
      return { data: null, error: error.message }
    }
  }

  // Update connection settings
  async updateConnectionSettings(connectionId, settings) {
    try {
      const response = await fetch(buildApiUrl(`/connections/${connectionId}/settings`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(settings)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data, error: null }
    } catch (error) {
      console.error('Error updating settings:', error)
      return { data: null, error: error.message }
    }
  }

  // Get connection analytics
  async getConnectionAnalytics(connectionId) {
    try {
      const response = await fetch(buildApiUrl(`/connections/${connectionId}/analytics`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      return { data: data.analytics, error: null }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      return { data: null, error: error.message }
    }
  }

  // Helper method to get auth token
  async getAuthToken() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error getting session:', error)
        // If there's an error getting the session, try to refresh
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError) {
          console.error('Error refreshing session:', refreshError)
          return null
        }
        return refreshedSession?.access_token
      }
      return session?.access_token
    } catch (error) {
      console.error('Error in getAuthToken:', error)
      return null
    }
  }
}

export const connectionsAPI = new ConnectionsAPI()
