// Shared function to fetch all connections from different sources
import { socialMediaService } from './socialMedia'
import { connectionsAPI } from './connections'
import { connectionsCache } from './connectionsCache'

const getAuthToken = async () => {
  try {
    const token = localStorage.getItem('authToken') || 
                  localStorage.getItem('token') || 
                  localStorage.getItem('access_token')
    
    if (token) {
      return token
    }
    
    const { supabase } = await import('../lib/supabase')
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (error) {
      console.error('Error getting Supabase session:', error)
      return null
    }
    
    return session?.access_token || null
  } catch (error) {
    console.error('Error getting auth token:', error)
    return null
  }
}

export const fetchAllConnections = async (useCache = true) => {
  // Check cache first if enabled
  if (useCache) {
    const cached = connectionsCache.getCachedConnections()
    if (cached) {
      console.log('Using cached connections')
      return cached
    }
  }

  try {
    // Fetch token-based connections
    let tokenConnections = []
    try {
      tokenConnections = await socialMediaService.getConnections()
    } catch (error) {
      console.log('No token connections found:', error.message)
    }
    
    // Fetch OAuth connections
    let oauthConnections = []
    try {
      const oauthResponse = await connectionsAPI.getConnections()
      oauthConnections = oauthResponse.data || []
    } catch (error) {
      console.log('No OAuth connections found:', error.message)
    }
    
    // Fetch WordPress connections
    let wordpressConnections = []
    try {
      const authToken = await getAuthToken()
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
      const response = await fetch(`${baseUrl}/connections/platform/?platform=wordpress`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      if (response.ok) {
        const data = await response.json()
        wordpressConnections = data.map(conn => ({
          ...conn,
          platform: 'wordpress',
          connection_status: 'active',
          page_name: conn.wordpress_site_name || conn.site_name,
          site_name: conn.wordpress_site_name || conn.site_name,
          wordpress_site_name: conn.wordpress_site_name || conn.site_name,
          page_username: conn.wordpress_username || conn.username
        }))
      }
    } catch (error) {
      console.log('No WordPress connections found:', error.message)
    }
    
    // Fetch Google connection status
    let googleConnections = []
    try {
      const authToken = await getAuthToken()
      if (authToken) {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
        const response = await fetch(`${baseUrl}/connections/google/connection-status`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        })
        
        if (response.ok) {
          const statusData = await response.json()
          if (statusData.connected === true || statusData.connected === 'true' || statusData.status === 'connected') {
            googleConnections = [{
              platform: 'google',
              connection_status: 'active',
              page_name: statusData.email || statusData.name || 'Google Account',
              page_username: statusData.email || statusData.name || 'Google Account'
            }]
          }
        }
      }
    } catch (error) {
      console.log('No Google connection found:', error.message)
    }
    
    // Check if Google is already in OAuth connections
    const existingGoogleConnection = oauthConnections.find(conn => conn.platform === 'google')
    if (existingGoogleConnection) {
      googleConnections = [existingGoogleConnection]
    }
    
    // Fetch WhatsApp connection status
    let whatsappConnections = []
    try {
      const authToken = await getAuthToken()
      if (authToken) {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const baseUrl = API_BASE_URL.replace(/\/+$/, '')

        const response = await fetch(`${baseUrl}/connections/whatsapp/connection-status`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        })

        if (response.ok) {
          const statusData = await response.json()
          if (statusData.connected === true || statusData.connected === 'true' || statusData.status === 'connected') {
            whatsappConnections = [{
              platform: 'whatsapp',
              connection_status: 'active',
              page_name: statusData.phone_number || 'WhatsApp Business',
              page_username: statusData.phone_number || 'WhatsApp Business'
            }]
          }
        }
      }
    } catch (error) {
      console.log('No WhatsApp connection found:', error.message)
    }
    
    // Combine all types of connections
    const allConnections = [
      ...tokenConnections.filter(conn => conn.platform !== 'google' && conn.platform !== 'wordpress' && conn.platform !== 'whatsapp'),
      ...oauthConnections.filter(conn => conn.platform !== 'google' && conn.platform !== 'wordpress' && conn.platform !== 'whatsapp'),
      ...wordpressConnections,
      ...googleConnections,
      ...whatsappConnections
    ]
    
    // Remove duplicates
    const uniqueConnections = allConnections.filter((connection, index, self) => {
      if (connection.platform === 'wordpress') {
        return index === self.findIndex(conn => 
          conn.platform === 'wordpress' && 
          conn.wordpress_site_url === connection.wordpress_site_url &&
          conn.wordpress_user_id === connection.wordpress_user_id
        )
      }
      return true
    })
    
    // Cache the connections
    if (useCache) {
      connectionsCache.setCachedConnections(uniqueConnections)
    }
    
    return uniqueConnections
  } catch (error) {
    console.error('Error fetching connections:', error)
    return []
  }
}

