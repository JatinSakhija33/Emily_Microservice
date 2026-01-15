import { supabase } from '../lib/supabase'
import { Facebook, Instagram, Linkedin, Youtube, Globe, Mail, Chrome, FileText } from 'lucide-react'

const API_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

class SocialMediaService {
  async getAuthHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw new Error('No active session')
    }
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    }
  }

  async connectWithToken(platform, accessToken, connectionMethod = 'token') {
    try {
      const headers = await this.getAuthHeaders()
      
      console.log(`Connecting ${platform} with token: ${accessToken.substring(0, 20)}...`)
      
      const response = await fetch(`${API_URL}/api/social-media/connect-token`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          platform,
          account_type: 'business', // Default, will be updated by backend
          account_id: '', // Will be set by backend
          account_name: '', // Will be set by backend
          access_token: accessToken,
          connection_method: connectionMethod
        })
      })

      const result = await response.json()
      console.log('Connection response:', result)

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to connect account')
      }

      return result
    } catch (error) {
      console.error('Error connecting social media account:', error)
      throw error
    }
  }

  async connectTwitterWithOAuth() {
    try {
      const headers = await this.getAuthHeaders()
      
      console.log('Initiating Twitter OAuth connection...')
      
      const response = await fetch(`${API_URL}/connections/auth/twitter/connect`, {
        method: 'POST',
        headers
      })

      const result = await response.json()
      console.log('Twitter OAuth response:', result)

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to initiate Twitter OAuth')
      }

      return result
    } catch (error) {
      console.error('Error initiating Twitter OAuth:', error)
      throw error
    }
  }

  async getTwitterPosts(limit = 10) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/twitter/posts?limit=${limit}`, {
        method: 'GET',
        headers
      })

      const result = await response.json()
      console.log('Twitter posts response:', result)

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch Twitter posts')
      }

      return result
    } catch (error) {
      console.error('Error fetching Twitter posts:', error)
      throw error
    }
  }

  async postToTwitter(content, mediaIds = []) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/twitter/post`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          text: content,
          media_ids: mediaIds
        })
      })

      const result = await response.json()
      console.log('Twitter post response:', result)

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to post to Twitter')
      }

      return result
    } catch (error) {
      console.error('Error posting to Twitter:', error)
      throw error
    }
  }

  async postToYouTube(postData) {
    try {
      const headers = await this.getAuthHeaders()
      
      console.log('Posting to YouTube:', postData)
      
      const response = await fetch(`${API_URL}/connections/youtube/post`, {
        method: 'POST',
        headers,
        body: JSON.stringify(postData)
      })

      const result = await response.json()
      console.log('YouTube post response:', result)

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to post to YouTube')
      }

      return result
    } catch (error) {
      console.error('Error posting to YouTube:', error)
      throw error
    }
  }

  async debugValidateToken(platform, accessToken) {
    try {
      const response = await fetch(`${API_URL}/api/social-media/debug/validate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform,
          access_token: accessToken
        })
      })

      const result = await response.json()
      console.log('Debug validation result:', result)
      return result
    } catch (error) {
      console.error('Error debugging token:', error)
      throw error
    }
  }

  async getConnections() {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/connections`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch connections')
      }

      return result.connections || []
    } catch (error) {
      console.error('Error fetching connections:', error)
      throw error
    }
  }

  async disconnectAccount(connectionId) {
    try {
      const headers = await this.getAuthHeaders()
      
      // Try OAuth connections endpoint first (for LinkedIn, Facebook, Instagram OAuth)
      const response = await fetch(`${API_URL}/connections/${connectionId}`, {
        method: 'DELETE',
        headers
      })

      if (response.ok) {
        const result = await response.json()
        return result
      }

      // If OAuth endpoint fails, try social media connections endpoint (for token-based connections)
      const socialResponse = await fetch(`${API_URL}/api/social-media/disconnect/${connectionId}`, {
        method: 'DELETE',
        headers
      })

      const result = await socialResponse.json()

      if (!socialResponse.ok) {
        throw new Error(result.detail || 'Failed to disconnect account')
      }

      return result
    } catch (error) {
      console.error('Error disconnecting account:', error)
      throw error
    }
  }

  async getInstagramProfile(userId) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/instagram/profile/${userId}`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch Instagram profile')
      }

      return result
    } catch (error) {
      console.error('Error fetching Instagram profile:', error)
      throw error
    }
  }

  async getInstagramMedia(userId) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/instagram/media/${userId}`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch Instagram media')
      }

      return result
    } catch (error) {
      console.error('Error fetching Instagram media:', error)
      throw error
    }
  }

  async getInstagramInsights(userId) {
    try {
      const headers = await this.getAuthHeaders()
      
      const response = await fetch(`${API_URL}/api/social-media/instagram/insights/${userId}`, {
        method: 'GET',
        headers
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to fetch Instagram insights')
      }

      return result
    } catch (error) {
      console.error('Error fetching Instagram insights:', error)
      throw error
    }
  }

  async initializeConnections() {
    try {
      const connections = await this.getConnections()
      console.log('Initialized social media connections:', connections)
      return connections
    } catch (error) {
      console.error('Error initializing connections:', error)
      return []
    }
  }

  // OAuth connection methods (for future implementation)
  async connectWithOAuth(platform) {
    try {
      const headers = await this.getAuthHeaders()
      
      console.log(`Initiating ${platform} OAuth connection...`)
      
      const response = await fetch(`${API_URL}/connections/auth/${platform}/connect`, {
        method: 'POST',
        headers
      })

      const result = await response.json()
      console.log(`${platform} OAuth response:`, result)

      if (!response.ok) {
        throw new Error(result.detail || `Failed to initiate ${platform} OAuth`)
      }

      // Open OAuth URL in new window
      if (result.auth_url) {
        const popup = window.open(
          result.auth_url,
          'oauth-connection',
          'width=600,height=700,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
        )
        
        // Listen for popup messages (for OAuth completion)
        const messageHandler = (event) => {
          // Allow messages from the same origin or from the callback page
          const allowedOrigins = [
            window.location.origin,
            'https://emily.atsnai.com',
            'https://agent-emily.onrender.com'
          ]
          
          if (!allowedOrigins.includes(event.origin)) {
            console.log('Ignoring message from origin:', event.origin)
            return
          }
          
          console.log('Received OAuth message:', event.data, 'from origin:', event.origin)
          
          if (event.data.type === 'OAUTH_SUCCESS') {
            console.log('OAuth successful:', event.data)
            popup.close()
            window.removeEventListener('message', messageHandler)
            
            // Show success message and refresh connections
            const platformName = event.data.platform || platform
            const successMessage = `${platformName.charAt(0).toUpperCase() + platformName.slice(1)} account connected successfully!`
            
            // Dispatch a custom event to notify the parent component
            window.dispatchEvent(new CustomEvent('oauthSuccess', {
              detail: {
                platform: platformName,
                message: successMessage
              }
            }))
            
            // Also try to show a browser notification if possible
            if (Notification.permission === 'granted') {
              new Notification(successMessage)
            }
            
            // Refresh the page to show updated connections
            setTimeout(() => {
              window.location.reload()
            }, 1000)
          } else if (event.data.type === 'OAUTH_ERROR') {
            console.error('OAuth error:', event.data.error)
            popup.close()
            window.removeEventListener('message', messageHandler)
            
            // Dispatch a custom event to notify the parent component
            window.dispatchEvent(new CustomEvent('oauthError', {
              detail: {
                platform: platform,
                error: event.data.error || 'OAuth connection failed'
              }
            }))
            
            throw new Error(event.data.error || 'OAuth connection failed')
          }
        }
        
        window.addEventListener('message', messageHandler)
        
        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
          }
        }, 1000)
      } else {
        throw new Error('No OAuth URL received from server')
      }

      return result
    } catch (error) {
      console.error(`Error initiating ${platform} OAuth:`, error)
      throw error
    }
  }

  // Platform-specific connection methods
  async connectInstagram(accessToken, method = 'token') {
    return this.connectWithToken('instagram', accessToken, method)
  }

  async connectFacebook(accessToken, method = 'token') {
    return this.connectWithToken('facebook', accessToken, method)
  }

  async connectTwitter(accessToken, method = 'token') {
    return this.connectWithToken('twitter', accessToken, method)
  }

  async connectLinkedIn(accessToken, method = 'token') {
    return this.connectWithToken('linkedin', accessToken, method)
  }

  async connectYouTube() {
    return this.connectWithOAuth('youtube')
  }

  // Utility methods
  getPlatformInfo(platform) {
    const platforms = {
      instagram: {
        name: 'Instagram',
        color: 'bg-gradient-to-r from-purple-500 to-pink-500',
        icon: Instagram,
        description: 'Post content, get insights, manage ads'
      },
      facebook: {
        name: 'Facebook',
        color: 'bg-blue-600',
        icon: Facebook,
        description: 'Manage pages, post content, run ads'
      },
      twitter: {
        name: 'X (Twitter)',
        color: 'bg-black',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4LjI0NDcgMTkuMzU0OUgxNi4zMTU5TDEyLjQzNzcgMTQuOTQ0M0w4LjU1OTU0IDE5LjM1NDlINi42MzA3M0wxMS4xNjQxIDE0LjI0MDFMNi42MzA3MyA5LjEyNTUzSDguNTU5NTRMMTIuNDM3NyAxMy41MzU5TDE2LjMxNTkgOS4xMjU1M0gxOC4yNDQ3TDEzLjcxMTMgMTQuMjQwMUwxOC4yNDQ3IDE5LjM1NDlaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
        description: 'Tweet, get analytics, manage campaigns'
      },
      linkedin: {
        name: 'LinkedIn',
        color: 'bg-blue-700',
        icon: Linkedin,
        description: 'Share content, get professional insights'
      },
      youtube: {
        name: 'YouTube',
        color: 'bg-red-600',
        icon: Youtube,
        description: 'Upload videos, create shorts, community posts'
      },
      wordpress: {
        name: 'WordPress',
        color: 'bg-white',
        icon: 'https://logo.svgcdn.com/d/wordpress-original.svg',
        description: 'Automate blog posting and content management'
      },
      google: {
        name: 'Google',
        color: 'bg-white',
        icon: 'https://logo.svgcdn.com/d/google-original.svg',
        description: 'Connect Gmail, Drive, Sheets, and Docs'
      },
      whatsapp: {
        name: 'WhatsApp Business',
        color: 'bg-green-600',
        icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTguNTQ1IDYuODg3QzguNTQ1IDYuNzE5IDguMzc3IDYuNTUxIDguMjA5IDYuNTUxSDYuNDc5QzYuMzExIDYuNTUxIDYuMTQzIDYuNzE5IDYuMTQzIDYuODg3VjguOTU2QzYuMTQzIDkuMTI0IDYuMzExIDkuMzAyIDYuNDc5IDkuMzAySDguMjA5QzguMzc3IDkuMzAyIDguNTQ1IDkuMTI0IDguNTQ1IDguOTU2VjYuODg3Wk0xMS42NjMgMTIuNzIyQzEwLjM1OCAxMi43MjIgOC4zNTggMTEuNTY5IDguMzU4IDEwLjE3N1Y5Ljg0MUM4LjM1OCA4LjQ1NCA5LjU2MiA3LjMwMSA5Ljk5NyAzLjM3MUM5Ljg0NyAyLjc4MiA5LjY5OCAyLjE5MiA5LjU0OCAyLjE5Mkg5LjM5OUM5LjI0OSAyLjE5MiA5LjA5OSAyLjM4IDUuOTUgMi41ODlMMTEuNjYzIDEyLjcyMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPg==',
        description: 'Send and receive WhatsApp messages'
      }
    }
    return platforms[platform] || { name: platform, color: 'bg-gray-500', icon: Globe, description: 'Social media platform' }
  }

  getConnectionMethodInfo(method) {
    const methods = {
      oauth: {
        name: 'OAuth',
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        description: 'Secure, one-click connection'
      },
      token: {
        name: 'Token',
        color: 'text-blue-600',
        bgColor: 'bg-blue-100',
        description: 'Manual token input'
      }
    }
    return methods[method] || { name: method, color: 'text-gray-600', bgColor: 'bg-gray-100', description: 'Connection method' }
  }
}

// Create and export a singleton instance
export const socialMediaService = new SocialMediaService()
export default socialMediaService
