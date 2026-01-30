import React, { useState, useEffect, lazy, Suspense } from 'react'
import { 
  Settings, 
  Plus, 
  Trash2, 
  Check, 
  ExternalLink,
  Shield,
  Key,
  AlertCircle,
  Loader2,
  Instagram,
  Facebook,
  Linkedin,
  Youtube,
  X,
  RefreshCw,
  Globe,
  Mail,
  Chrome,
  FileText
} from 'lucide-react'
import { socialMediaService } from '../services/socialMedia'
import { connectionsAPI } from '../services/connections'
import ConnectionStatus from './ConnectionStatus'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import MainContentLoader from './MainContentLoader'
import DisconnectConfirmationModal from './DisconnectConfirmationModal'
import WordPressInstructionsModal from './WordPressInstructionsModal'
// Using URL-based approach for logos

const SettingsDashboard = () => {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(false)
  const [showConnectionModal, setShowConnectionModal] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('')
  const [connectionMethod, setConnectionMethod] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [wordpressCredentials, setWordpressCredentials] = useState({
    siteName: '',
    siteUrl: '',
    username: '',
    password: ''
  })
  const [wordpressErrors, setWordpressErrors] = useState({
    siteName: '',
    siteUrl: '',
    username: '',
    password: ''
  })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [disconnectModal, setDisconnectModal] = useState({
    isOpen: false,
    connectionId: null,
    platform: '',
    accountName: '',
    isLoading: false
  })
  const [showWordPressInstructions, setShowWordPressInstructions] = useState(false)

  // Validation functions
  const validateWordPressCredentials = () => {
    const errors = {
      siteName: '',
      siteUrl: '',
      username: '',
      password: ''
    }

    // Site Name validation
    if (!wordpressCredentials.siteName.trim()) {
      errors.siteName = 'Site name is required'
    } else if (wordpressCredentials.siteName.trim().length < 2) {
      errors.siteName = 'Site name must be at least 2 characters'
    }

    // Site URL validation
    if (!wordpressCredentials.siteUrl.trim()) {
      errors.siteUrl = 'Site URL is required'
    } else {
      try {
        const url = new URL(wordpressCredentials.siteUrl)
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.siteUrl = 'URL must start with http:// or https://'
        }
      } catch {
        errors.siteUrl = 'Please enter a valid URL'
      }
    }

    // Username validation
    if (!wordpressCredentials.username.trim()) {
      errors.username = 'Username is required'
    } else if (wordpressCredentials.username.trim().length < 2) {
      errors.username = 'Username must be at least 2 characters'
    }

    // App Password validation
    if (!wordpressCredentials.password.trim()) {
      errors.password = 'App Password is required'
    } else if (wordpressCredentials.password.trim().length < 6) {
      errors.password = 'App Password must be at least 6 characters'
    }

    setWordpressErrors(errors)
    return !Object.values(errors).some(error => error !== '')
  }

  const clearFieldError = (fieldName) => {
    setWordpressErrors(prev => ({
      ...prev,
      [fieldName]: ''
    }))
  }

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600',
      description: 'Connect Facebook Pages',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.facebook.com/tools/explorer/'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      color: 'bg-gradient-to-r from-purple-500 to-pink-500',
      description: 'Connect Instagram Business accounts (via Facebook)',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.facebook.com/tools/explorer/'
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4LjI0NDcgMTkuMzU0OUgxNi4zMTU5TDEyLjQzNzcgMTQuOTQ0M0w4LjU1OTU0IDE5LjM1NDlINi42MzA3M0wxMS4xNjQxIDE0LjI0MDFMNi42MzA3MyA5LjEyNTUzSDguNTU5NTRMMTIuNDM3NyAxMy41MzU5TDE2LjMxNTkgOS4xMjU1M0gxOC4yNDQ3TDEzLjcxMTMgMTQuMjQwMUwxOC4yNDQ3IDE5LjM1NDlaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
      color: 'bg-black',
      description: 'Tweet, get analytics, manage campaigns',
      oauthSupported: true,
      tokenSupported: true,
      helpUrl: 'https://developer.twitter.com/en/portal/dashboard'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-blue-700',
      description: 'Share content, get professional insights',
      oauthSupported: true,
      tokenSupported: true,
      helpUrl: 'https://www.linkedin.com/developers/apps'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: Youtube,
      color: 'bg-red-600',
      description: 'Upload videos, manage comments, and get analytics',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.google.com/youtube/v3/getting-started'
    },
    {
      id: 'wordpress',
      name: 'WordPress',
      icon: 'https://logo.svgcdn.com/d/wordpress-original.svg',
      color: 'bg-gray-600',
      description: 'Automate blog posting and content management',
      oauthSupported: false,
      tokenSupported: false,
      credentialsSupported: true,
      helpUrl: 'https://wordpress.org/support/article/application-passwords/'
    },
    {
      id: 'google',
      name: 'Google',
      icon: 'https://logo.svgcdn.com/d/google-original.svg',
      color: 'bg-white',
      description: 'Connect Gmail, Drive, Sheets, and Docs',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://console.developers.google.com/'
    },
    {
      id: 'whatsapp',
      name: 'WhatsApp Business',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTguNTQ1IDYuODg3QzguNTQ1IDYuNzE5IDguMzc3IDYuNTUxIDguMjA5IDYuNTUxSDYuNDc5QzYuMzExIDYuNTUxIDYuMTQzIDYuNzE5IDYuMTQzIDYuODg3VjguOTU2QzYuMTQzIDkuMTI0IDYuMzExIDkuMzAyIDYuNDc5IDkuMzAySDguMjA5QzguMzc3IDkuMzAyIDguNTQ1IDkuMTI0IDguNTQ1IDguOTU2VjYuODg3Wk0xMS42NjMgMTIuNzIyQzEwLjM1OCAxMi43MjIgOC4zNTggMTEuNTY5IDguMzU4IDEwLjE3N1Y5Ljg0MUM4LjM1OCA4LjQ1NCA5LjU2MiA3LjMwMSA5Ljk5NyAzLjM3MUM5Ljg0NyAyLjc4MiA5LjY5OCAyLjE5MiA5LjU0OCAyLjE5Mkg5LjM5OUM5LjI0OSAyLjE5MiA5LjA5OSAyLjM4IDUuOTUgMi41ODlMMTEuNjYzIDEyLjcyMloiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPg==',
      color: 'bg-green-600',
      description: 'Connect WhatsApp Business account for messaging',
      oauthSupported: true,
      tokenSupported: false,
      helpUrl: 'https://developers.facebook.com/docs/whatsapp/'
    }
  ]


  useEffect(() => {
    fetchConnections()
    
    // Listen for OAuth success/error events from socialMediaService
    const handleOAuthSuccess = (event) => {
      console.log('OAuth success event received:', event.detail)
      setSuccess(event.detail.message)
      fetchConnections()
    }
    
    const handleOAuthError = (event) => {
      console.log('OAuth error event received:', event.detail)
      setError(event.detail.error)
    }
    
    window.addEventListener('oauthSuccess', handleOAuthSuccess)
    window.addEventListener('oauthError', handleOAuthError)
    
    return () => {
      window.removeEventListener('oauthSuccess', handleOAuthSuccess)
      window.removeEventListener('oauthError', handleOAuthError)
    }
  }, [])

  // Auto-close success messages after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('')
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [success])

  // Auto-close error messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('')
      }, 5000)
      
      return () => clearTimeout(timer)
    }
  }, [error])

  const fetchConnections = async () => {
    let timeoutId = null
    try {
      setLoading(true)
      
      // Add timeout to ensure loading doesn't stay true forever
      timeoutId = setTimeout(() => {
        setLoading(false)
      }, 30000) // 30 second timeout
      
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
        console.log('OAuth connections fetched:', oauthConnections)
      } catch (error) {
        console.log('No OAuth connections found:', error.message)
      }
      
      // Fetch WordPress connections
      let wordpressConnections = []
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/platform/?platform=wordpress`, {  
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`
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
        if (!authToken) {
          console.log('No auth token available for Google connections')
        } else {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
          const baseUrl = API_BASE_URL.replace(/\/+$/, '')
        
          const response = await fetch(`${baseUrl}/connections/google/connection-status`, {
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }
          })
          
          if (response.ok) {
            const statusData = await response.json()
            console.log('Google connection status data:', statusData)
            console.log('Google connection status response:', response.status)
            
            // Check if connected (handle different possible response formats)
            if (statusData.connected === true || statusData.connected === 'true' || statusData.status === 'connected') {
              googleConnections = [{
                platform: 'google',
                connection_status: 'active',
                page_name: statusData.email || statusData.name || 'Google Account',
                page_username: statusData.email || statusData.name || 'Google Account'
              }]
              console.log('Created Google connection:', googleConnections[0])
            } else {
              console.log('Google not connected. Status data:', statusData)
            }
          } else {
            console.log('Google connection status API error:', response.status, response.statusText)
          }
        }
      } catch (error) {
        console.log('No Google connection found:', error.message)
      }
      
      // Check if Google is already in OAuth connections
      const existingGoogleConnection = oauthConnections.find(conn => conn.platform === 'google')
      if (existingGoogleConnection) {
        console.log('Found existing Google connection in OAuth:', existingGoogleConnection)
        googleConnections = [existingGoogleConnection]
      }

      // Fetch WhatsApp connections
      let whatsappConnections = []
      try {
        const authToken = await getAuthToken()
        if (!authToken) {
          console.log('No auth token available for WhatsApp connections')
        } else {
          const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
          const baseUrl = API_BASE_URL.replace(/\/+$/, '')

          const response = await fetch(`${baseUrl}/connections/whatsapp/connection-status`, {
            headers: {
              'Content-Type': 'application/json',
              ...(authToken && { 'Authorization': `Bearer ${authToken}` })
            }
          })

          if (response.ok) {
            const statusData = await response.json()
            console.log('WhatsApp connection status data:', statusData)

            // Check if connected (handle different possible response formats)
            if (statusData.connected === true || statusData.connected === 'true' || statusData.status === 'connected') {
              whatsappConnections = [{
                platform: 'whatsapp',
                connection_status: 'active',
                page_name: statusData.phone_number_display || statusData.phone_number || 'WhatsApp Business',
                page_username: statusData.phone_number_display || statusData.phone_number || 'WhatsApp Business',
                phone_number_id: statusData.phone_number_id
              }]
              console.log('Created WhatsApp connection:', whatsappConnections[0])
            } else {
              console.log('WhatsApp not connected. Status data:', statusData)
            }
          } else {
            console.log('WhatsApp connection status API error:', response.status, response.statusText)
          }
        }
      } catch (error) {
        console.log('No WhatsApp connection found:', error.message)
      }
      
      // Combine all types of connections, filtering out duplicates
      const allConnections = [
        ...tokenConnections.filter(conn => conn.platform !== 'google' && conn.platform !== 'wordpress' && conn.platform !== 'whatsapp'),
        ...oauthConnections.filter(conn => conn.platform !== 'google' && conn.platform !== 'wordpress' && conn.platform !== 'whatsapp'),
        ...wordpressConnections,
        ...googleConnections,
        ...whatsappConnections
      ]
      
      // Remove duplicate WordPress connections based on site URL and user ID
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
      
      setConnections(uniqueConnections)
      
      console.log('Token connections:', tokenConnections.length)
      console.log('OAuth connections:', oauthConnections.length)
      console.log('WordPress connections:', wordpressConnections.length)
      console.log('Google connections:', googleConnections.length)
      console.log('WhatsApp connections:', whatsappConnections.length)
      console.log('Total connections:', allConnections.length)
      console.log('All connections platforms:', allConnections.map(c => c.platform))
      
    } catch (error) {
      console.error('Error fetching connections:', error)
      setError('Failed to load connections')
      // Don't crash the entire dashboard, just show empty connections
      setConnections([])
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      setLoading(false)
    }
  }

  const getPlatformInfo = (platformId) => {
    return platforms.find(p => p.id === platformId) || platforms[0]
  }

  const handleConnectionMethod = (platform, method) => {
    setSelectedPlatform(platform)
    setConnectionMethod(method)
    setError('')
    setSuccess('')
    
    // Show WordPress instructions first if WordPress is selected
    if (platform === 'wordpress') {
      setShowWordPressInstructions(true)
    } else {
      setShowConnectionModal(true)
    }
  }

  const handleOAuthConnect = async (platform) => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      // Clean up any existing failed connections before starting new OAuth
      try {
        const authToken = await getAuthToken()
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const baseUrl = API_BASE_URL.replace(/\/+$/, '')
        
        const cleanupResponse = await fetch(`${baseUrl}/connections/cleanup-failed/${platform}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          }
        })
        
        if (cleanupResponse.ok) {
          const cleanupData = await cleanupResponse.json()
          console.log(`✅ Cleaned up ${cleanupData.deleted_count || 0} failed ${platform} connections`)
        }
      } catch (cleanupError) {
        console.log(`⚠️ Cleanup warning: ${cleanupError.message}`)
        // Don't fail the OAuth process if cleanup fails
      }
      
      setSuccess(`${platform.charAt(0).toUpperCase() + platform.slice(1)} connection window opened. Please complete the authorization.`)
      await socialMediaService.connectWithOAuth(platform)
    } catch (error) {
      setError(`Failed to start OAuth for ${platform}: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const getAuthToken = async () => {
    try {
      // Try multiple token sources
      const token = localStorage.getItem('authToken') || 
                    localStorage.getItem('token') || 
                    localStorage.getItem('access_token')
      
      if (token) {
        return token
      }
      
      // Try to get token from Supabase session
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

  const handleWhatsAppConnect = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')

      const authToken = await getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      const response = await fetch(`${baseUrl}/connections/whatsapp/initiate`, {
        method: 'POST',
        headers
      })
      const initiateData = await response.json()

      if (initiateData.success) {
        const popup = window.open(
          initiateData.auth_url,
          'whatsapp-oauth',
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

          console.log('Received WhatsApp OAuth message:', event.data, 'from origin:', event.origin)

          if (event.data.type === 'OAUTH_SUCCESS') {
            console.log('WhatsApp OAuth successful:', event.data)
            popup.close()
            window.removeEventListener('message', messageHandler)
            setSuccess('WhatsApp Business account connected successfully!')
            // Refresh connections to show the new connection
            fetchConnections()
          } else if (event.data.type === 'OAUTH_ERROR') {
            console.error('WhatsApp OAuth error:', event.data.error)
            popup.close()
            window.removeEventListener('message', messageHandler)
            setError(event.data.error || 'WhatsApp OAuth connection failed')
          }
        }

        window.addEventListener('message', messageHandler)

        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            // Refresh connections when popup is closed (in case OAuth completed)
            console.log('Popup closed, refreshing connections...')
            fetchConnections()
          }
        }, 1000)

        setSuccess('WhatsApp connection window opened. Please complete the authorization.')
      } else {
        setError('Failed to initiate WhatsApp connection')
      }
    } catch (error) {
      setError(`Failed to start WhatsApp connection: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleConnect = async () => {
    try {
      setLoading(true)
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
      const baseUrl = API_BASE_URL.replace(/\/+$/, '')
      
      const authToken = await getAuthToken()
      const headers = {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` })
      }

      const response = await fetch(`${baseUrl}/connections/google/reconnect`, {
        method: 'POST',
        headers
      })
      const reconnectData = await response.json()
      
      if (reconnectData.success) {
        const popup = window.open(
          reconnectData.auth_url,
          'google-oauth',
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
            console.log('Google OAuth successful:', event.data)
            popup.close()
            window.removeEventListener('message', messageHandler)
            setSuccess('Google account connected successfully!')
            // Refresh connections to show the new connection
            fetchConnections()
          } else if (event.data.type === 'OAUTH_ERROR') {
            console.error('Google OAuth error:', event.data.error)
            popup.close()
            window.removeEventListener('message', messageHandler)
            setError(event.data.error || 'Google OAuth connection failed')
          }
        }
        
        window.addEventListener('message', messageHandler)
        
        // Check if popup was closed manually
        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed)
            window.removeEventListener('message', messageHandler)
            // Refresh connections when popup is closed (in case OAuth completed)
            console.log('Popup closed, refreshing connections...')
            fetchConnections()
          }
        }, 1000)
        
        setSuccess('Google connection window opened. Please complete the authorization.')
      } else {
        setError('Failed to initiate Google connection')
      }
    } catch (error) {
      setError(`Failed to start Google connection: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTokenConnect = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await socialMediaService.connectWithToken(
        selectedPlatform, 
        accessToken, 
        connectionMethod
      )
      
      setSuccess(result.message)
      setShowConnectionModal(false)
      setAccessToken('')
      setSelectedPlatform('')
      setConnectionMethod('')
      fetchConnections()
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDebugToken = async () => {
    if (!accessToken) {
      setError('Please enter a token first')
      return
    }

    try {
      setLoading(true)
      setError('')
      setSuccess('')
      
      const result = await socialMediaService.debugValidateToken(selectedPlatform, accessToken)
      
      if (result.valid) {
        setSuccess(`Token is valid! Found: ${result.me_data?.name || 'Unknown'}`)
        console.log('Debug result:', result)
      } else {
        setError(`Token validation failed: ${result.error}`)
        console.log('Debug error:', result)
      }
    } catch (err) {
      setError(`Debug failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleWordPressConnect = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')
    setWordpressErrors({
      siteName: '',
      siteUrl: '',
      username: '',
      password: ''
    })

    // Validate credentials first
    if (!validateWordPressCredentials()) {
      setLoading(false)
      return
    }

    try {
      const authToken = await getAuthToken()
      console.log('🔍 WordPress connection attempt:', {
        siteName: wordpressCredentials.siteName.trim(),
        siteUrl: wordpressCredentials.siteUrl.trim(),
        username: wordpressCredentials.username.trim(),
        hasPassword: !!wordpressCredentials.password.trim(),
        hasAuthToken: !!authToken
      })
      
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/platform/wordpress/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          site_name: wordpressCredentials.siteName.trim(),
          site_url: wordpressCredentials.siteUrl.trim(),
          username: wordpressCredentials.username.trim(),
          password: wordpressCredentials.password.trim()
        })
      })
      
      console.log('🔍 WordPress response status:', response.status)

      let result
      try {
        result = await response.json()
      } catch (parseError) {
        console.error('Error parsing response:', parseError)
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      if (!response.ok) {
        // Debug: Log the actual response for troubleshooting
        console.log('🔍 WordPress connection error response:', {
          status: response.status,
          statusText: response.statusText,
          result: result
        })
        
        // Convert technical errors to user-friendly messages
        let errorMessage = 'Failed to connect to WordPress'
        
        if (response.status === 400) {
          if (result.detail && result.detail.includes('Invalid credentials')) {
            errorMessage = '❌ Invalid WordPress credentials. Please check your username and app password.'
          } else if (result.detail && result.detail.includes('Invalid WordPress credentials')) {
            errorMessage = '❌ Invalid WordPress credentials. Please check your username and app password.'
          } else if (result.detail && result.detail.includes('Authentication failed')) {
            errorMessage = '❌ Authentication failed. Please check your WordPress username and app password.'
          } else if (result.detail && result.detail.includes('REST API')) {
            errorMessage = '❌ WordPress REST API is blocked. Please check your security plugins and enable REST API access.'
          } else if (result.detail && result.detail.includes('Application Password')) {
            errorMessage = '❌ Application Passwords not enabled. Please enable Application Passwords in your WordPress admin.'
          } else if (result.detail && result.detail.includes('site_url')) {
            errorMessage = '❌ Invalid site URL. Please check that your WordPress site URL is correct and accessible.'
          } else if (result.detail && result.detail.includes('credentials')) {
            errorMessage = '❌ Invalid WordPress credentials. Please check your username and app password.'
          } else {
            errorMessage = '❌ WordPress connection failed. Please verify your site URL, username, and app password are correct.'
          }
        } else if (response.status === 401) {
          // Use the specific error message from backend
          errorMessage = result.detail || '❌ Authentication failed. Please check your WordPress username and app password.'
        } else if (response.status === 403) {
          // Use the specific error message from backend
          errorMessage = result.detail || '❌ Access denied. Your WordPress user may not have sufficient permissions or REST API is blocked.'
        } else if (response.status === 404) {
          // Use the specific error message from backend
          errorMessage = result.detail || '❌ WordPress site not found. Please check that your site URL is correct and your site is accessible.'
        } else if (response.status === 500) {
          // Use the specific error message from backend
          errorMessage = result.detail || '❌ WordPress server error. Please try again later or contact your WordPress administrator.'
        } else {
          // Fallback to original error handling for other cases
          if (result.detail) {
            errorMessage = `❌ ${result.detail}`
          } else if (result.message) {
            errorMessage = `❌ ${result.message}`
          } else if (result.error) {
            errorMessage = `❌ ${result.error}`
          } else if (typeof result === 'string') {
            errorMessage = `❌ ${result}`
          } else if (Array.isArray(result)) {
            errorMessage = `❌ ${result.join(', ')}`
          }
        }
        
        throw new Error(errorMessage)
      }

      setSuccess(result.message || 'WordPress connected successfully!')
      setShowConnectionModal(false)
      setWordpressCredentials({
        siteName: '',
        siteUrl: '',
        username: '',
        password: ''
      })
      setSelectedPlatform('')
      setConnectionMethod('')
      
      // Safely refresh connections after successful WordPress connection
      try {
        await fetchConnections()
      } catch (error) {
        console.error('Error refreshing connections after WordPress connection:', error)
        // Don't show error to user since WordPress connection was successful
      }
      
    } catch (err) {
      console.error('WordPress connection error:', err)
      
      // Provide user-friendly error messages
      let userFriendlyError = err.message || 'Failed to connect WordPress'
      
      // Handle network/connection errors
      if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('Failed to fetch')) {
        userFriendlyError = '❌ Network error. Please check your internet connection and try again.'
      } else if (err.message.includes('Server error')) {
        userFriendlyError = '❌ Server error. Please try again later or contact support if the problem persists.'
      } else if (err.message.includes('timeout')) {
        userFriendlyError = '❌ Connection timeout. Your WordPress site may be slow to respond. Please try again.'
      }
      
      setError(userFriendlyError)
    } finally {
      setLoading(false)
    }
  }

  const handleWordPressDisconnect = async (connectionId) => {
    try {
      setLoading(true)
      setError('')
      setSuccess('')

      const authToken = await getAuthToken()
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/platform/wordpress/delete/${connectionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        }
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.detail || 'Failed to disconnect WordPress')
      }

      setSuccess(result.message || 'WordPress account disconnected successfully')
      
      // Refresh connections to update the UI
      await fetchConnections()
      
      // Close modal
      setDisconnectModal({
        isOpen: false,
        connectionId: null,
        platform: '',
        accountName: '',
        isLoading: false
      })
      
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDisconnect = async (connectionId, platform) => {
    // Find the connection to get account name
    const connection = connections.find(conn => conn.id === connectionId)
    const accountName = connection?.account_name || 
                       connection?.page_name || 
                       connection?.site_name || 
                       connection?.wordpress_site_name ||
                       'Unknown Account'
    
    // Show confirmation modal
    setDisconnectModal({
      isOpen: true,
      connectionId,
      platform,
      accountName,
      isLoading: false
    })
  }

  const confirmDisconnect = async () => {
    const { connectionId, platform } = disconnectModal
    
    try {
      setDisconnectModal(prev => ({ ...prev, isLoading: true }))
      setError('')
      setSuccess('')

      // Handle WordPress disconnect
      if (platform === 'wordpress') {
        await handleWordPressDisconnect(connectionId)
        return
      }

      // Handle WhatsApp disconnect
      if (platform === 'whatsapp') {
        const authToken = await getAuthToken()
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/connections/whatsapp/disconnect`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          }
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.detail || 'Failed to disconnect WhatsApp')
        }

        setSuccess(result.message || 'WhatsApp account disconnected successfully')
        fetchConnections()
        return
      }

      // Handle other platforms
      await socialMediaService.disconnectAccount(connectionId)
      setSuccess('Account disconnected successfully')
      fetchConnections()
      
      // Close modal
      setDisconnectModal({
        isOpen: false,
        connectionId: null,
        platform: '',
        accountName: '',
        isLoading: false
      })
    } catch (error) {
      console.error('Error disconnecting account:', error)
      setError(`Failed to disconnect account: ${error.message}`)
      setDisconnectModal(prev => ({ ...prev, isLoading: false }))
    }
  }

  const cancelDisconnect = () => {
    setDisconnectModal({
      isOpen: false,
      connectionId: null,
      platform: '',
      accountName: '',
      isLoading: false
    })
  }

  const closeModal = () => {
    setShowConnectionModal(false)
    setAccessToken('')
    setSelectedPlatform('')
    setConnectionMethod('')
    setError('')
    setSuccess('')
  }

  const handleWordPressInstructionsClose = () => {
    setShowWordPressInstructions(false)
    setShowConnectionModal(true)
    // Don't clear selectedPlatform and connectionMethod - keep them for the credential form
  }

  const handleWordPressInstructionsProceed = () => {
    setShowWordPressInstructions(false)
    setShowConnectionModal(true)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Mobile Navigation */}
      <MobileNavigation />
      
      {/* Main Content */}
      <div className="flex-1 ml-0 md:ml-48 xl:ml-64 pt-16 md:pt-0">
        {/* Header */}
        <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-gray-200/50">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="flex justify-between items-center py-3 md:py-4 lg:py-8 gap-2 md:gap-3 lg:gap-4">
              <div className="flex items-center space-x-2 md:space-x-3 lg:space-x-4 min-w-0 flex-1 pr-2">
                <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-16 md:h-16 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Settings className="w-5 h-5 sm:w-6 sm:h-6 md:w-8 md:h-8 text-white" />
                </div>
                <div className="min-w-0">
                  <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent truncate">
                    Settings Dashboard
                  </h1>
                  <p className="text-gray-600 text-xs sm:text-sm md:text-base lg:text-lg hidden md:block">Connect your social media accounts using OAuth or Access Tokens</p>
                </div>
              </div>
              
              <div className="flex items-center flex-shrink-0">
                {/* Refresh Button */}
                <button
                  onClick={fetchConnections}
                  disabled={loading}
                  className="flex items-center justify-center space-x-1 sm:space-x-2 px-2 sm:px-3 md:px-4 lg:px-6 py-1.5 sm:py-2 md:py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-md sm:rounded-lg md:rounded-xl hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 text-xs sm:text-sm md:text-base whitespace-nowrap"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 sm:w-4 sm:h-4 md:w-5 md:h-5" />
                  )}
                  <span className="font-medium hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 md:py-8">
            <>

              {/* Success/Error Messages */}
              {success && (
                <div className="mb-4 md:mb-6 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 text-green-600 px-3 sm:px-4 py-2 sm:py-3 rounded-md sm:rounded-lg flex items-center">
                  <Check className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                  <p className="text-xs sm:text-sm md:text-base">{success}</p>
                </div>
              )}

              {error && (
                <div className="mb-4 md:mb-6 bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 sm:py-3 rounded-md sm:rounded-lg flex items-center">
                  <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                  <p className="text-xs sm:text-sm md:text-base">{error}</p>
                </div>
              )}


              {/* Add New Connection */}
              <div className="bg-white/70 backdrop-blur-sm rounded-xl md:rounded-2xl shadow-xl border border-gray-200/50 p-4 md:p-6 lg:p-8 mb-6 md:mb-8 hover:shadow-2xl transition-all duration-300">
                <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 mb-3 md:mb-4">Add New Connection</h2>
                
                {platforms.filter(platform => !connections.some(c => c.platform === platform.id)).length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                    {platforms
                      .filter(platform => !connections.some(c => c.platform === platform.id))
                      .map((platform) => {
                      const Icon = platform.icon
                      
                      return (
                        <div key={platform.id} className="group relative bg-white rounded-xl sm:rounded-2xl md:rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-gray-200">
                          {/* Card Header */}
                          <div className="relative p-4 sm:p-5 md:p-6 pb-3 sm:pb-4">
                            <div className="flex items-center justify-between mb-3 sm:mb-4">
                              <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 ${platform.id === 'google' || platform.id === 'wordpress' ? 'bg-white' : platform.color} rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
                                {typeof Icon === 'string' ? (
                                  <img src={Icon} alt={platform.name} className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                                ) : (
                                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 ${platform.id === 'google' || platform.id === 'wordpress' ? 'text-gray-600' : 'text-white'}`} />
                                )}
                              </div>
                              <div className="flex space-x-1">
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-300 rounded-full group-hover:bg-gray-400 transition-colors"></div>
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-300 rounded-full group-hover:bg-gray-400 transition-colors"></div>
                                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-gray-300 rounded-full group-hover:bg-gray-400 transition-colors"></div>
                              </div>
                            </div>
                            <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2 group-hover:text-gray-700 transition-colors">{platform.name}</h3>
                            <p className="text-gray-600 text-xs sm:text-sm leading-relaxed">{platform.description}</p>
                          </div>

                          {/* Card Body */}
                          <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6">
                            <div className="space-y-2 sm:space-y-3">
                              {platform.oauthSupported && (
                                <button
                                  onClick={() => {
                                    if (platform.id === 'google') {
                                      handleGoogleConnect()
                                    } else if (platform.id === 'whatsapp') {
                                      handleWhatsAppConnect()
                                    } else {
                                      handleOAuthConnect(platform.id)
                                    }
                                  }}
                                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 transform group/btn"
                                  disabled={loading}
                                >
                                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 group-hover/btn:scale-110 transition-transform flex-shrink-0" />
                                  <span className="truncate">{loading ? 'Connecting...' : 'Connect with OAuth'}</span>
                                </button>
                              )}
                              {platform.tokenSupported && (
                                <button
                                  onClick={() => handleConnectionMethod(platform.id, 'token')}
                                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-blue-700 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 transform group/btn"
                                >
                                  <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 group-hover/btn:scale-110 transition-transform flex-shrink-0" />
                                  <span className="truncate">Connect with Token</span>
                                </button>
                              )}
                              {platform.credentialsSupported && (
                                <button
                                  onClick={() => handleConnectionMethod(platform.id, 'credentials')}
                                  className="w-full px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-violet-500 to-violet-600 text-white text-xs sm:text-sm font-semibold rounded-lg sm:rounded-xl hover:from-violet-600 hover:to-violet-700 flex items-center justify-center transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105 transform group/btn"
                                >
                                  <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 group-hover/btn:scale-110 transition-transform flex-shrink-0" />
                                  <span className="truncate">Connect with Credentials</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Hover gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 md:py-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                      <Check className="w-6 h-6 sm:w-8 sm:h-8 text-green-600" />
                    </div>
                    <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 mb-2">All platforms connected!</h3>
                    <p className="text-xs sm:text-sm md:text-base text-gray-500 px-4">You have successfully connected all available platforms</p>
                  </div>
                )}
              </div>

              {/* Connected Accounts */}
              <div className="mb-6 md:mb-8">
                <h2 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 mb-3 md:mb-4">Connected Accounts</h2>
                {connections.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
                    {connections.map((connection) => (
                      <ConnectionStatus
                        key={connection.id}
                        connection={connection}
                        onDisconnect={(connectionId) => handleDisconnect(connectionId, connection.platform)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 md:py-8">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 md:mb-4">
                      <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <h3 className="text-base sm:text-lg md:text-xl font-medium text-gray-900 mb-2">No connections yet</h3>
                    <p className="text-xs sm:text-sm md:text-base text-gray-500 px-4">Connect your social media accounts to get started</p>
                  </div>
                )}
              </div>
            </>
        </div>
      </div>

      {/* Connection Modal */}
      {showConnectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="mb-4 sm:mb-6">
              {selectedPlatform === 'wordpress' && (
                <div className="flex justify-center mb-3 sm:mb-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-lg sm:rounded-xl flex items-center justify-center shadow-xl border border-gray-200 hover:scale-105 transition-transform duration-300">
                    <img 
                      src="https://logo.svgcdn.com/d/wordpress-original.svg" 
                      alt="WordPress" 
                      className="w-8 h-8 sm:w-10 sm:h-10" 
                    />
                  </div>
                </div>
              )}
              
              <div className="flex justify-center">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-gray-800 text-center px-2">
                  {selectedPlatform === 'wordpress' 
                    ? 'Connect Your WordPress Site'
                    : `Connect ${getPlatformInfo(selectedPlatform).name} with Access Token`
                  }
                </h3>
              </div>
            </div>
            
            {selectedPlatform === 'wordpress' ? (
              <form onSubmit={handleWordPressConnect} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Site Name
                  </label>
                  <input
                    type="text"
                    value={wordpressCredentials.siteName}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, siteName: e.target.value }))
                      clearFieldError('siteName')
                    }}
                    placeholder="My WordPress Site"
                    className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border rounded-md sm:rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                      wordpressErrors.siteName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.siteName && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span>{wordpressErrors.siteName}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Site URL
                  </label>
                  <input
                    type="url"
                    value={wordpressCredentials.siteUrl}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, siteUrl: e.target.value }))
                      clearFieldError('siteUrl')
                    }}
                    placeholder="https://yoursite.com"
                    className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border rounded-md sm:rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                      wordpressErrors.siteUrl ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.siteUrl && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span>{wordpressErrors.siteUrl}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={wordpressCredentials.username}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, username: e.target.value }))
                      clearFieldError('username')
                    }}
                    placeholder="your_username"
                    className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border rounded-md sm:rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                      wordpressErrors.username ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.username && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span>{wordpressErrors.username}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    App Password
                  </label>
                  <input
                    type="password"
                    value={wordpressCredentials.password}
                    onChange={(e) => {
                      setWordpressCredentials(prev => ({ ...prev, password: e.target.value }))
                      clearFieldError('password')
                    }}
                    placeholder="Enter your WordPress App Password"
                    className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border rounded-md sm:rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors ${
                      wordpressErrors.password ? 'border-red-500' : 'border-gray-300'
                    }`}
                    required
                  />
                  {wordpressErrors.password && (
                    <p className="text-red-500 text-xs mt-1 flex items-center">
                      <AlertCircle className="w-3 h-3 mr-1 flex-shrink-0" />
                      <span>{wordpressErrors.password}</span>
                    </p>
                  )}
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                    Enter your WordPress App Password for API access. Generate one in WordPress Admin → Users → Profile → Application Passwords.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 text-gray-700 rounded-md sm:rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm md:text-base font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-md sm:rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-lg text-xs sm:text-sm md:text-base font-medium"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin flex-shrink-0" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      'Connect'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleTokenConnect} className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="Enter your access token"
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm border border-gray-300 rounded-md sm:rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-1 leading-relaxed">
                    Get your access token from{' '}
                    <a
                      href={getPlatformInfo(selectedPlatform).helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline inline-flex items-center"
                    >
                      {getPlatformInfo(selectedPlatform).name} Developer Tools
                      <ExternalLink className="w-3 h-3 ml-1 flex-shrink-0" />
                    </a>
                  </p>
                </div>

                <div className="space-y-2 sm:space-y-3">
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={handleDebugToken}
                      disabled={loading || !accessToken}
                      className="px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-600 text-white text-xs sm:text-sm rounded-md sm:rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      Debug Token
                    </button>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                    <button
                      type="button"
                      onClick={closeModal}
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 border border-gray-300 text-gray-700 rounded-md sm:rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm md:text-base font-medium"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !accessToken}
                      className="flex-1 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-md sm:rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:shadow-lg text-xs sm:text-sm md:text-base font-medium"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2 animate-spin flex-shrink-0" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        'Connect'
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      <DisconnectConfirmationModal
        isOpen={disconnectModal.isOpen}
        onClose={cancelDisconnect}
        onConfirm={confirmDisconnect}
        platform={disconnectModal.platform}
        accountName={disconnectModal.accountName}
        isLoading={disconnectModal.isLoading}
      />

      {/* WordPress Instructions Modal */}
      <WordPressInstructionsModal
        isOpen={showWordPressInstructions}
        onClose={handleWordPressInstructionsClose}
        onProceed={handleWordPressInstructionsProceed}
      />
    </div>
  )
}

export default SettingsDashboard
