import React, { useState, useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, Sparkles, RefreshCw } from 'lucide-react'

const NotificationWindow = ({ notifications, onClose, onMarkAsRead }) => {
  const [visibleNotifications, setVisibleNotifications] = useState([])

  useEffect(() => {
    setVisibleNotifications(notifications.filter(notif => !notif.read))
  }, [notifications])

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />
      case 'content_generation':
        return <Sparkles className="w-5 h-5 text-pink-500" />
      case 'loading':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      default:
        return <Info className="w-5 h-5 text-gray-500" />
    }
  }

  const getNotificationBgColor = (type) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200'
      case 'error':
        return 'bg-red-50 border-red-200'
      case 'info':
        return 'bg-blue-50 border-blue-200'
      case 'content_generation':
        return 'bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200'
      case 'loading':
        return 'bg-blue-50 border-blue-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const getNotificationTextColor = (type) => {
    switch (type) {
      case 'success':
        return 'text-green-800'
      case 'error':
        return 'text-red-800'
      case 'info':
        return 'text-blue-800'
      case 'content_generation':
        return 'text-gray-800'
      case 'loading':
        return 'text-blue-800'
      default:
        return 'text-gray-800'
    }
  }

  const handleClose = (notificationId) => {
    onMarkAsRead(notificationId)
    onClose(notificationId)
  }

  if (visibleNotifications.length === 0) {
    return null
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-3 max-w-sm">
      {visibleNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`${getNotificationBgColor(notification.type)} border rounded-lg shadow-lg p-4 transform transition-all duration-300 ease-in-out ${
            notification.animate ? 'animate-slide-in-right' : ''
          }`}
        >
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0">
              {getNotificationIcon(notification.type)}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className={`text-sm font-medium ${getNotificationTextColor(notification.type)}`}>
                  {notification.title}
                </h4>
                <button
                  onClick={() => handleClose(notification.id)}
                  className="flex-shrink-0 ml-2 p-1 hover:bg-white/50 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500 hover:text-gray-700" />
                </button>
              </div>
              
              <p className={`mt-1 text-sm ${getNotificationTextColor(notification.type)} opacity-90`}>
                {notification.message}
              </p>
              
              {notification.details && (
                <div className="mt-2 text-xs text-gray-600">
                  {notification.details}
                </div>
              )}
              
              {notification.actions && (
                <div className="mt-3 flex space-x-2">
                  {notification.actions.map((action, index) => (
                    <button
                      key={index}
                      onClick={action.onClick}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                        action.primary
                          ? 'bg-pink-500 text-white hover:bg-pink-600'
                          : 'bg-white/50 text-gray-700 hover:bg-white/70'
                      }`}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default NotificationWindow
