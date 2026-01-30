import React from 'react'
import { AlertTriangle, X, Loader2, Facebook, Instagram, Linkedin, Youtube, Globe, Mail, Chrome, FileText } from 'lucide-react'

const DisconnectConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  platform, 
  accountName, 
  isLoading = false 
}) => {
  if (!isOpen) return null

  const platformInfo = {
    facebook: {
      color: 'bg-blue-600',
      icon: Facebook,
      name: 'Facebook'
    },
    instagram: {
      color: 'bg-pink-500',
      icon: Instagram,
      name: 'Instagram'
    },
    twitter: {
      color: 'bg-black',
      icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE4LjI0NDcgMTkuMzU0OUgxNi4zMTU5TDEyLjQzNzcgMTQuOTQ0M0w4LjU1OTU0IDE5LjM1NDlINi42MzA3M0wxMS4xNjQxIDE0LjI0MDFMNi42MzA3MyA5LjEyNTUzSDguNTU5NTRMMTIuNDM3NyAxMy41MzU5TDE2LjMxNTkgOS4xMjU1M0gxOC4yNDQ3TDEzLjcxMTMgMTQuMjQwMUwxOC4yNDQ3IDE5LjM1NDlaIiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
      name: 'X (Twitter)'
    },
    linkedin: {
      color: 'bg-blue-700',
      icon: Linkedin,
      name: 'LinkedIn'
    },
    youtube: {
      color: 'bg-red-600',
      icon: Youtube,
      name: 'YouTube'
    },
      wordpress: {
        color: 'bg-gray-600',
        icon: 'https://logo.svgcdn.com/d/wordpress-original.svg',
        name: 'WordPress'
      },
      google: {
        color: 'bg-red-500',
        icon: 'https://logo.svgcdn.com/d/google-original.svg',
        name: 'Google'
      }
  }

  const currentPlatform = platformInfo[platform] || {
    color: 'bg-gray-600',
    icon: Globe,
    name: 'Platform'
  }

  const renderIcon = (icon, name) => {
    if (typeof icon === 'string') {
      return (
        <img 
          src={icon} 
          alt={`${name} logo`}
          className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8"
          onError={(e) => {
            e.target.style.display = 'none'
            e.target.nextSibling.style.display = 'block'
          }}
        />
      )
    }
    const IconComponent = icon
    return <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-3 md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="bg-white rounded-lg sm:rounded-xl md:rounded-2xl lg:rounded-3xl shadow-2xl max-w-md w-full overflow-hidden max-h-[calc(100vh-1rem)] sm:max-h-[calc(100vh-1.5rem)] md:max-h-[calc(100vh-2rem)] flex flex-col"
      >
        {/* Header with platform branding */}
        <div className={`${currentPlatform.color} px-3 sm:px-4 md:px-5 lg:px-6 py-3 sm:py-4 md:py-5 lg:py-6 ${currentPlatform.color === 'bg-white' ? 'text-gray-900' : 'text-white'} relative flex-shrink-0`}>
          <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 ${currentPlatform.color} rounded-lg sm:rounded-xl flex items-center justify-center flex-shrink-0 ${currentPlatform.color === 'bg-white' ? 'border border-gray-200' : ''}`}>
                {typeof currentPlatform.icon === 'string' ? (
                  <img 
                    src={currentPlatform.icon} 
                    alt={currentPlatform.name} 
                    className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 object-contain"
                    style={currentPlatform.color === 'bg-white' ? {} : { filter: 'brightness(0) invert(1)' }}
                  />
                ) : (
                  <currentPlatform.icon className={`w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 ${currentPlatform.color === 'bg-white' ? 'text-gray-900' : 'text-white'}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold truncate">Disconnect {currentPlatform.name}</h2>
                <p className={`text-[10px] sm:text-xs md:text-sm ${currentPlatform.color === 'bg-white' ? 'text-gray-600' : 'text-white/80'}`}>This action cannot be undone</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-50 flex-shrink-0 ${
                currentPlatform.color === 'bg-white' 
                  ? 'bg-gray-200 hover:bg-gray-300' 
                  : 'bg-white/20 backdrop-blur-sm hover:bg-white/30'
              }`}
            >
              <X className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 ${currentPlatform.color === 'bg-white' ? 'text-gray-600' : 'text-white'}`} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-5 lg:p-6 flex-1 min-h-0 flex flex-col">
          {/* Warning section */}
          <div className="flex items-start space-x-2 sm:space-x-3 mb-2 sm:mb-3 md:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base md:text-lg font-semibold text-gray-900 mb-1">
                Are you sure you want to disconnect?
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 leading-snug">
                You're about to disconnect your <span className="font-medium text-gray-900">{currentPlatform.name}</span> account.
              </p>
            </div>
          </div>

          {/* Account info */}
          <div className="bg-gray-50 rounded-lg sm:rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 md:mb-4">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 sm:w-9 sm:h-9 ${platform === 'google' || platform === 'wordpress' ? 'bg-white' : currentPlatform.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                {typeof currentPlatform.icon === 'string' ? (
                  <img src={currentPlatform.icon} alt={currentPlatform.name} className="w-4 h-4 sm:w-5 sm:h-5" />
                ) : (
                  <currentPlatform.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${platform === 'google' || platform === 'wordpress' ? 'text-gray-600' : 'text-white'}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-gray-900 text-xs sm:text-sm md:text-base truncate">{accountName}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">{currentPlatform.name} Account</p>
              </div>
            </div>
          </div>

          {/* Consequences */}
          <div className="bg-red-50 border border-red-200 rounded-lg sm:rounded-xl p-2 sm:p-3 mb-2 sm:mb-3 md:mb-4">
            <h4 className="font-semibold text-red-800 mb-1.5 sm:mb-2 flex items-center text-xs sm:text-sm">
              <AlertTriangle className="w-3 h-3 sm:w-3.5 sm:h-3.5 mr-1 sm:mr-1.5 flex-shrink-0" />
              <span>What happens when you disconnect:</span>
            </h4>
            <ul className="space-y-1 sm:space-y-1.5 text-[10px] sm:text-xs md:text-sm text-red-700">
              <li className="flex items-start">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full mt-1 sm:mt-1.5 mr-1.5 sm:mr-2 flex-shrink-0"></div>
                <span className="leading-snug">Automatic posting to {currentPlatform.name} will stop</span>
              </li>
              <li className="flex items-start">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full mt-1 sm:mt-1.5 mr-1.5 sm:mr-2 flex-shrink-0"></div>
                <span className="leading-snug">Access to your account data will be removed</span>
              </li>
              <li className="flex items-start">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-red-500 rounded-full mt-1 sm:mt-1.5 mr-1.5 sm:mr-2 flex-shrink-0"></div>
                <span className="leading-snug">You'll need to reconnect to use this platform again</span>
              </li>
            </ul>
          </div>

          {/* Action buttons */}
          <div className="flex flex-row space-x-2 flex-shrink-0 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 text-gray-700 bg-gray-100 rounded-lg sm:rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-50 font-medium text-xs sm:text-sm md:text-base whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={isLoading}
              className="flex-1 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 md:py-2.5 bg-red-600 text-white rounded-lg sm:rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 font-medium flex items-center justify-center space-x-1 sm:space-x-1.5 md:space-x-2 text-xs sm:text-sm md:text-base whitespace-nowrap"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin flex-shrink-0" />
                  <span className="truncate">Disconnecting...</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span>Disconnect</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DisconnectConfirmationModal
