import React from 'react'
import { Check, Shield, Key, ExternalLink, Clock, AlertCircle } from 'lucide-react'
import { socialMediaService } from '../services/socialMedia'

const ConnectionStatus = ({ connection, onDisconnect }) => {
  const platformInfo = socialMediaService.getPlatformInfo(connection.platform)
  const methodInfo = socialMediaService.getConnectionMethodInfo(connection.connection_method)
  
  const formatDate = (dateString) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusIcon = () => {
    if (connection.is_active) {
      return <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-green-600" />
    }
    return <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-red-600" />
  }

  const getStatusText = () => {
    if (connection.is_active) {
      return 'Connected'
    }
    return 'Disconnected'
  }

  const getStatusColor = () => {
    if (connection.is_active) {
      return 'text-green-600'
    }
    return 'text-red-600'
  }

  const getMethodIcon = () => {
    return connection.connection_method === 'oauth' 
      ? <Shield className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
      : <Key className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4" />
  }

  return (
    <div className="group relative bg-white rounded-xl sm:rounded-2xl md:rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-500 overflow-hidden border border-gray-100 hover:border-gray-200">
      {/* Card Header */}
      <div className="relative p-4 sm:p-5 md:p-6 pb-3 sm:pb-4">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 ${platformInfo.color} rounded-lg sm:rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}>
            {platformInfo.icon ? (
              typeof platformInfo.icon === 'string' ? (
                <img 
                  src={platformInfo.icon} 
                  alt={`${platformInfo.name} logo`}
                  className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 object-contain"
                  onError={(e) => {
                    console.log(`${platformInfo.name} icon failed to load:`, platformInfo.icon)
                    // Hide the broken image and show fallback
                    e.target.style.display = 'none'
                  }}
                  onLoad={() => {
                    console.log(`${platformInfo.name} icon loaded successfully:`, platformInfo.icon)
                  }}
                />
              ) : (
                <platformInfo.icon className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-white" />
              )
            ) : (
              <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-white/20 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xs sm:text-sm">?</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <span className="px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full flex items-center bg-green-100 text-green-800 font-medium whitespace-nowrap">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full mr-1 sm:mr-2 flex-shrink-0"></div>
              <span className="truncate">Connected</span>
            </span>
          </div>
        </div>
        <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-gray-900 mb-1.5 sm:mb-2 group-hover:text-gray-700 transition-colors">{platformInfo.name}</h3>
        <p className="text-gray-600 text-xs sm:text-sm leading-relaxed truncate">{connection.account_name || connection.page_name || 'Connected Account'}</p>
      </div>

      {/* Card Body */}
      <div className="px-4 sm:px-5 md:px-6 pb-4 sm:pb-5 md:pb-6">
        {/* Account Info - Inline Values */}
        <div className="space-y-2 sm:space-y-2.5 md:space-y-3 mb-3 sm:mb-4">
          {(connection.account_type || connection.page_username) && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Account Type:</span>
              <span className="text-xs sm:text-sm font-semibold text-gray-900 capitalize bg-blue-100 text-blue-800 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg truncate">
                {connection.account_type || (connection.page_username ? 'Business' : 'Personal')}
              </span>
            </div>
          )}
          {(connection.account_id || connection.page_id) && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Account ID:</span>
              <span className="text-[10px] sm:text-xs font-mono text-gray-700 bg-gray-100 px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-md sm:rounded-lg max-w-[120px] sm:max-w-[150px] md:max-w-[200px] truncate">
                {connection.account_id || connection.page_id}
              </span>
            </div>
          )}
          {connection.connected_at && (
            <div className="flex justify-between items-center gap-2">
              <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Connected:</span>
              <span className="text-xs sm:text-sm text-gray-700 flex items-center">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 mr-1 text-gray-500 flex-shrink-0" />
                <span className="truncate">{formatDate(connection.connected_at)}</span>
              </span>
            </div>
          )}
        </div>

          {/* Platform Stats - Only show if we have meaningful data (not demo/placeholder values) */}
          {((connection.follower_count && connection.follower_count > 10) || (connection.subscriber_count && connection.subscriber_count > 10) || connection.last_posted_at) && (
            <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
              {((connection.follower_count && connection.follower_count > 10) || (connection.subscriber_count && connection.subscriber_count > 10)) && (
                <div className="bg-green-50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 text-center">
                  <div className="text-sm sm:text-base md:text-lg font-bold text-green-700">
                    {connection.follower_count || connection.subscriber_count}
                  </div>
                  <div className="text-[10px] sm:text-xs text-green-600">
                    {connection.platform === 'youtube' ? 'Subscribers' : 'Followers'}
                  </div>
                </div>
              )}
              {connection.last_posted_at && (
                <div className="bg-blue-50 rounded-lg sm:rounded-xl p-2 sm:p-2.5 md:p-3 text-center">
                  <div className="text-sm sm:text-base md:text-lg font-bold text-blue-700">Active</div>
                  <div className="text-[10px] sm:text-xs text-blue-600">Status</div>
                </div>
              )}
            </div>
          )}

        {/* Permissions */}
        {connection.permissions && Object.keys(connection.permissions).length > 0 && (
          <div className="mb-4 sm:mb-5 md:mb-6">
            <h4 className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3 flex items-center">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-purple-500 rounded-full mr-1.5 sm:mr-2 flex-shrink-0"></div>
              <span>Permissions</span>
            </h4>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {Object.entries(connection.permissions).map(([permission, granted]) => (
                <span
                  key={permission}
                  className={`px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded-full font-medium ${
                    granted 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {permission.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-gray-100 gap-2">
          <a
            href={`https://${connection.platform}.com`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-blue-600 bg-blue-50 rounded-lg sm:rounded-xl hover:bg-blue-100 transition-colors flex-1 sm:flex-none justify-center"
          >
            <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 mr-1 sm:mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate hidden sm:inline">Visit {platformInfo.name}</span>
            <span className="truncate sm:hidden">Visit</span>
          </a>
          
          <button
            onClick={() => onDisconnect(connection.id)}
            className="flex items-center px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-red-600 bg-red-50 rounded-lg sm:rounded-xl hover:bg-red-100 transition-colors flex-1 sm:flex-none justify-center"
          >
            <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 mr-1 sm:mr-1.5 md:mr-2 flex-shrink-0" />
            <span className="truncate">Disconnect</span>
          </button>
        </div>
      </div>

      {/* Hover gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-gray-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
    </div>
  )
}

export default ConnectionStatus
