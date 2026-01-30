import React, { useState, useEffect } from 'react'
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Mail,
  Hash,
  CheckCircle,
  XCircle,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  LogOut
} from 'lucide-react'
import { connectionsAPI } from '../services/connections'
import { socialMediaService } from '../services/socialMedia'

const ConnectionCards = ({ compact = false }) => {
  const [connections, setConnections] = useState([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(null)
  const [showLinkedInModal, setShowLinkedInModal] = useState(false)

  const platforms = [
    {
      id: 'facebook',
      name: 'Facebook',
      icon: Facebook,
      color: 'bg-blue-600',
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: Instagram,
      color: 'bg-pink-600',
      iconColor: 'text-pink-600',
      bgColor: 'bg-pink-50',
      borderColor: 'border-pink-200'
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      icon: Linkedin,
      color: 'bg-blue-700',
      iconColor: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      id: 'twitter',
      name: 'X (Twitter)',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4LjI0NDcgMTkuMzU0OUgxNi4zMTU5TDEyLjQzNzcgMTQuOTQ0M0w4LjU1OTU0IDE5LjM1NDlINi42MzA3M0wxMS4xNjQxIDE0LjI0MDFMNi42MzA3MyA5LjEyNTUzSDguNTU5NTRMMTIuNDM3NyAxMy41MzU5TDE2LjMxNTkgOS4xMjU1M0gxOC4yNDQ3TDEzLjcxMTMgMTQuMjQwMUwxOC4yNDQ3IDE5LjM1NDlaIiBmaWxsPSIjMDAwMDAwIi8+Cjwvc3ZnPgo=',
      color: 'bg-black',
      iconColor: 'text-black',
      bgColor: 'bg-gray-50',
      borderColor: 'border-gray-200'
    },
    {
      id: 'youtube',
      name: 'YouTube',
      icon: Youtube,
      color: 'bg-red-600',
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      id: 'google',
      name: 'Google',
      icon: Mail,
      color: 'bg-red-500',
      iconColor: 'text-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    }
  ]

  useEffect(() => {
    fetchConnections()
  }, [])

  // Refresh connections when the page becomes visible (handles OAuth redirects)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Page became visible, refreshing connections...')
        fetchConnections()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  const fetchConnections = async () => {
    try {
      setLoading(true)
      
      // Fetch OAuth connections
      const oauthResponse = await connectionsAPI.getConnections()
      const oauthConnections = oauthResponse.data || []
      
      // Fetch token-based connections
      let tokenConnections = []
      try {
        const tokenResponse = await socialMediaService.getConnections()
        tokenConnections = tokenResponse || []
      } catch (error) {
        console.log('No token connections found or error fetching:', error.message)
      }
      
      // Combine both types of connections
      const allConnections = [...oauthConnections, ...tokenConnections]
      setConnections(allConnections)
      
      console.log('OAuth connections:', oauthConnections)
      console.log('Token connections:', tokenConnections)
      console.log('All connections:', allConnections)
      console.log('Facebook connections:', allConnections.filter(c => c.platform === 'facebook'))
      console.log('Instagram connections:', allConnections.filter(c => c.platform === 'instagram'))
      
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleConnect = async (platformId) => {
    try {
      setConnecting(platformId)

      if (platformId === 'linkedin') {
        // Show LinkedIn account selection modal
        setShowLinkedInModal(true)
        setConnecting(null)
        return
      }

      if (platformId === 'google') {
        // Handle Google OAuth in popup window
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        // Ensure no double slashes in URL
        const cleanUrl = API_BASE_URL.replace(/\/+$/, '') + '/connections/google/auth/initiate'
        const response = await fetch(cleanUrl)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('Google auth error:', response.status, errorText)
          throw new Error(`Failed to get Google auth URL: ${response.status}`)
        }
        
        const data = await response.json()
        
        if (data.auth_url) {
          // Open Google OAuth in popup window
          const popup = window.open(
            data.auth_url,
            'google-oauth',
            'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
          )
          
          // Listen for popup messages
          const messageHandler = async (event) => {
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
            
            console.log('Received message:', event.data, 'from origin:', event.origin)
            
            if (event.data.type === 'GOOGLE_OAUTH_SUCCESS') {
              console.log('Google OAuth successful:', event.data)
              popup.close()
              window.removeEventListener('message', messageHandler)
              await fetchConnections() // Refresh connections
            } else if (event.data.type === 'GOOGLE_OAUTH_ERROR') {
              console.error('Google OAuth error:', event.data.error)
              popup.close()
              window.removeEventListener('message', messageHandler)
              alert(`Google OAuth failed: ${event.data.error}`)
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
        } else {
          throw new Error('Failed to get Google auth URL from response')
        }
      } else {
        // Handle other platforms
        const response = await connectionsAPI.connectPlatform(platformId)

        if (response.auth_url) {
          window.location.href = response.auth_url
        } else {
          throw new Error('Failed to get auth URL')
        }
      }
    } catch (error) {
      console.error(`Error connecting to ${platformId}:`, error)
      alert(`Failed to connect to ${platformId}. Please try again.`)
    } finally {
      setConnecting(null)
    }
  }

  const handleLinkedInConnect = async () => {
    try {
      setConnecting('linkedin')
      setShowLinkedInModal(false)

      const response = await connectionsAPI.connectPlatform('linkedin')

      if (response.auth_url) {
        window.location.href = response.auth_url
      } else {
        throw new Error('Failed to get LinkedIn auth URL')
      }
    } catch (error) {
      console.error('Error connecting to LinkedIn:', error)
      alert('Failed to connect to LinkedIn. Please try again.')
      setConnecting(null)
    }
  }

  const handleDisconnect = async (platformId) => {
    try {
      if (platformId === 'google') {
        // Handle Google disconnect
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        // Ensure no double slashes in URL
        const cleanUrl = API_BASE_URL.replace(/\/+$/, '') + '/connections/google/disconnect'
        const response = await fetch(cleanUrl, {
          method: 'GET'
        })
        const data = await response.json()
        
        if (data.success) {
          await fetchConnections()
        } else {
          throw new Error('Failed to disconnect Google')
        }
      } else {
        // Find the connection to determine its type
        const connection = connections.find(conn => conn.platform === platformId)
        
        if (connection && connection.page_id) {
          // Handle OAuth connections (platform_connections table)
          await connectionsAPI.disconnectPlatform(platformId)
          await fetchConnections()
        } else if (connection && connection.id) {
          // Handle token-based connections (social_media_connections table)
          await socialMediaService.disconnectAccount(connection.id)
          await fetchConnections()
        } else {
          throw new Error('Connection not found')
        }
      }
    } catch (error) {
      console.error(`Error disconnecting from ${platformId}:`, error)
      alert(`Failed to disconnect from ${platformId}. Please try again.`)
    }
  }

  const getConnectionStatus = (platformId) => {
    const connection = connections.find(conn => conn.platform === platformId)
    if (!connection) {
      return { connected: false, status: 'disconnected' }
    }
    
    // Handle OAuth connections (platform_connections table)
    if (connection.page_id) {
      return {
        connected: connection.is_active,
        status: connection.connection_status,
        pageName: connection.page_name,
        lastSync: connection.last_sync
      }
    }
    
    // Handle token-based connections (social_media_connections table)
    return {
      connected: connection.is_active,
      status: connection.connection_status || 'active',
      pageName: connection.account_name,
      lastSync: connection.last_sync
    }
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-3 h-3 text-green-500" />
      case 'expired':
      case 'revoked':
      case 'error':
        return <XCircle className="w-3 h-3 text-red-500" />
      default:
        return <XCircle className="w-3 h-3 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <RefreshCw className="w-4 h-4 animate-spin text-purple-600" />
        <span className="ml-2 text-gray-600 text-sm">Loading connections...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
        {platforms.map((platform) => {
        const { connected, status } = getConnectionStatus(platform.id)
        const IconComponent = platform.icon
        
        // Debug logging for X (Twitter)
        if (platform.id === 'twitter') {
          console.log('Twitter platform data:', platform);
          console.log('Icon type:', typeof platform.icon);
          console.log('Icon value:', platform.icon);
        }

          return (
            <div
              key={platform.id}
            className="relative group"
          >
            {compact ? (
              // Display-only mode for main dashboard
              <div
                className={`
                  w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200
                  ${connected ? `${platform.color}` : 'bg-white border-2 border-gray-200'}
                  ${connected ? 'ring-2 ring-green-400' : ''}
                `}
                title={`${platform.name} - ${connected ? 'Connected' : 'Not connected'}`}
              >
                  {typeof platform.icon === 'string' ? (
                    <img 
                      src={platform.icon} 
                      alt={platform.name} 
                      className={`w-6 h-6 ${connected ? 'text-white' : platform.iconColor}`}
                      onError={(e) => {
                        console.error('Image load error for', platform.name, ':', e);
                        console.log('Icon value:', platform.icon);
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully for', platform.name);
                      }}
                    />
                  ) : (
                    <IconComponent className={`w-6 h-6 ${connected ? 'text-white' : platform.iconColor}`} />
                  )}
                </div>
            ) : (
              // Interactive mode for settings/other pages
              <>
                <button
                  onClick={() => connected ? handleDisconnect(platform.id) : handleConnect(platform.id)}
                  disabled={connecting === platform.id}
                  className={`
                    w-12 h-12 rounded-lg flex items-center justify-center transition-all duration-200
                    ${connected ? `${platform.color}` : 'bg-white border-2 border-gray-200'}
                    hover:shadow-md hover:scale-105
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${connected ? 'ring-2 ring-green-400' : ''}
                  `}
                  title={`${connected ? 'Disconnect from' : 'Connect to'} ${platform.name}`}
                >
                  {typeof platform.icon === 'string' ? (
                    <img 
                      src={platform.icon} 
                      alt={platform.name} 
                      className={`w-6 h-6 ${connected ? 'text-white' : platform.iconColor}`}
                      onError={(e) => {
                        console.error('Image load error for', platform.name, ':', e);
                        console.log('Icon value:', platform.icon);
                      }}
                      onLoad={() => {
                        console.log('Image loaded successfully for', platform.name);
                      }}
                    />
                  ) : (
                    <IconComponent className={`w-6 h-6 ${connected ? 'text-white' : platform.iconColor}`} />
                  )}
                  
                  
                  {/* Status indicator dot */}
                  <div className="absolute -top-1 -right-1">
                    {getStatusIcon(status)}
                  </div>
                </button>

                {/* Loading spinner for connecting state */}
                {connecting === platform.id && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                  </div>
                )}
              </>
            )}

            {/* Google-specific dashboard button when connected */}
            {connected && platform.id === 'google' && !compact && (
              <div className="absolute top-14 left-0 bg-white rounded-lg shadow-lg border p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                <button
                  onClick={() => window.open('/google-dashboard', '_blank')}
                  className="text-xs text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  Open Dashboard
                </button>
                    </div>
                  )}
            </div>
          )
        })}
    </div>

    {/* LinkedIn Account Selection Modal */}
    {showLinkedInModal && (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div className="flex items-center mb-4">
            <Linkedin className="w-8 h-8 text-blue-700 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900">Connect LinkedIn Account</h3>
          </div>

          <div className="mb-6">
            <div className="flex items-start p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800 mb-1">
                  Account Selection Notice
                </h4>
                <p className="text-sm text-yellow-700">
                  LinkedIn will connect to your currently logged-in account. If you want to connect a different LinkedIn account, please log out of LinkedIn first and log in with the desired account.
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-800 mb-2">What will be connected:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Your LinkedIn profile and posts</li>
                <li>• Permission to share content on your behalf</li>
                <li>• Access to publish articles and updates</li>
              </ul>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => setShowLinkedInModal(false)}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLinkedInConnect}
              disabled={connecting === 'linkedin'}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {connecting === 'linkedin' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Connecting...
                </>
              ) : (
                <>
                  <Linkedin className="w-4 h-4 mr-2" />
                  Continue to LinkedIn
                </>
              )}
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-500 text-center">
            <p>
              Don't have the right LinkedIn account logged in?{' '}
              <a
                href="https://www.linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Open LinkedIn
              </a>{' '}
              to switch accounts.
            </p>
          </div>
        </div>
      </div>
    )}
  )
}

export default ConnectionCards