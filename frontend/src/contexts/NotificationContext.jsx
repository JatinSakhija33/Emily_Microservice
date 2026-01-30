import React, { createContext, useContext, useState, useCallback } from 'react'

const NotificationContext = createContext()

export const useNotifications = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])

  const addNotification = useCallback((notification) => {
    const id = Date.now() + Math.random()
    const newNotification = {
      id,
      type: 'info',
      title: 'Notification',
      message: '',
      details: null,
      actions: null,
      read: false,
      animate: true,
      timestamp: new Date(),
      ...notification
    }

    setNotifications(prev => [newNotification, ...prev])

    // Auto-remove after 5 seconds for all notifications
    setTimeout(() => {
      removeNotification(id)
    }, 5000)

    return id
  }, [])

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id))
  }, [])

  const markAsRead = useCallback((id) => {
    setNotifications(prev => 
      prev.map(notif => 
        notif.id === id ? { ...notif, read: true } : notif
      )
    )
  }, [])

  const clearAllNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  const clearReadNotifications = useCallback(() => {
    setNotifications(prev => prev.filter(notif => !notif.read))
  }, [])

  // Helper methods for common notification types
  const showSuccess = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'success',
      title,
      message,
      ...options
    })
  }, [addNotification])

  const showError = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'error',
      title,
      message,
      persistent: false, // Errors will auto-close after 5 seconds
      ...options
    })
  }, [addNotification])

  const showInfo = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'info',
      title,
      message,
      ...options
    })
  }, [addNotification])

  const showContentGeneration = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'content_generation',
      title,
      message,
      persistent: false, // Content generation notifications will auto-close after 5 seconds
      ...options
    })
  }, [addNotification])

  const showLoading = useCallback((title, message, options = {}) => {
    return addNotification({
      type: 'loading',
      title,
      message,
      persistent: false, // Loading notifications will auto-close after 5 seconds
      ...options
    })
  }, [addNotification])

  const value = {
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    clearAllNotifications,
    clearReadNotifications,
    showSuccess,
    showError,
    showInfo,
    showContentGeneration,
    showLoading
  }

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  )
}
