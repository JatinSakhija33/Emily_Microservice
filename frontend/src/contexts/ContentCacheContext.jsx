import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { contentAPI } from '../services/content'

const ContentCacheContext = createContext()

export function useContentCache() {
  const context = useContext(ContentCacheContext)
  if (!context) {
    throw new Error('useContentCache must be used within a ContentCacheProvider')
  }
  return context
}

export function ContentCacheProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [scheduledContent, setScheduledContent] = useState([])
  const [allContent, setAllContent] = useState([])
  const [contentDate, setContentDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [lastFetchTime, setLastFetchTime] = useState(null)
  const [lastAllContentFetchTime, setLastAllContentFetchTime] = useState(null)
  const [cacheValid, setCacheValid] = useState(false)
  const [allContentCacheValid, setAllContentCacheValid] = useState(false)

  // Cache duration: 5 minutes (300000 ms)
  const CACHE_DURATION = 5 * 60 * 1000

  // Clear cache when user logs out
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('User logged out, clearing content cache')
      setScheduledContent([])
      setAllContent([])
      setContentDate('')
      setLastFetchTime(null)
      setLastAllContentFetchTime(null)
      setCacheValid(false)
      setAllContentCacheValid(false)
    }
  }, [isAuthenticated, user])

  // Check if cache is still valid
  const isCacheValid = () => {
    if (!lastFetchTime || !cacheValid) return false
    const now = Date.now()
    return (now - lastFetchTime) < CACHE_DURATION
  }

  // Check if all content cache is still valid
  const isAllContentCacheValid = () => {
    if (!lastAllContentFetchTime || !allContentCacheValid) return false
    const now = Date.now()
    return (now - lastAllContentFetchTime) < CACHE_DURATION
  }

  // Fetch content with caching
  const fetchScheduledContent = async (forceRefresh = false) => {
    // If cache is valid and not forcing refresh, return cached data
    if (!forceRefresh && isCacheValid()) {
      console.log('Using cached content data')
      return { data: scheduledContent, date: contentDate, fromCache: true }
    }

    try {
      setLoading(true)
      console.log('Fetching fresh content data from API')
      
      const result = await contentAPI.getScheduledContent()
      
      if (result.data) {
        console.log('Content fetched successfully, updating cache')
        setScheduledContent(result.data)
        setContentDate(result.date)
        setLastFetchTime(Date.now())
        setCacheValid(true)
        
        return { 
          data: result.data, 
          date: result.date, 
          fromCache: false 
        }
      } else {
        console.error('No data received from API')
        return { data: [], date: '', fromCache: false }
      }
    } catch (error) {
      console.error('Error fetching scheduled content:', error)
      // If we have cached data and API fails, return cached data
      if (scheduledContent.length > 0) {
        console.log('API failed, returning cached data as fallback')
        return { data: scheduledContent, date: contentDate, fromCache: true }
      }
      return { data: [], date: '', fromCache: false }
    } finally {
      setLoading(false)
    }
  }

  // Fetch all content with caching
  const fetchAllContent = async (forceRefresh = false) => {
    // If cache is valid and not forcing refresh, return cached data
    if (!forceRefresh && isAllContentCacheValid()) {
      console.log('Using cached all content data')
      return { data: allContent, fromCache: true }
    }

    try {
      setLoading(true)
      console.log('Fetching fresh all content data from API')
      
      const result = await contentAPI.getAllContent()
      
      if (result.data) {
        console.log('All content fetched successfully, updating cache')
        setAllContent(result.data)
        setLastAllContentFetchTime(Date.now())
        setAllContentCacheValid(true)
        
        return { 
          data: result.data, 
          fromCache: false 
        }
      } else {
        console.error('No data received from all content API')
        return { data: [], fromCache: false }
      }
    } catch (error) {
      console.error('Error fetching all content:', error)
      // If we have cached data and API fails, return cached data
      if (allContent.length > 0) {
        console.log('API failed, returning cached all content data as fallback')
        return { data: allContent, fromCache: true }
      }
      return { data: [], fromCache: false }
    } finally {
      setLoading(false)
    }
  }

  // Update content in cache (for when content is posted/updated)
  const updateContentInCache = (contentId, updates) => {
    setScheduledContent(prev => 
      prev.map(item => 
        item.id === contentId 
          ? { ...item, ...updates }
          : item
      )
    )
    // Also update in allContent cache
    setAllContent(prev => 
      prev.map(item => 
        item.id === contentId 
          ? { ...item, ...updates }
          : item
      )
    )
  }

  // Add new content to cache
  const addContentToCache = (newContent) => {
    setScheduledContent(prev => [newContent, ...prev])
    setAllContent(prev => [newContent, ...prev])
  }

  // Remove content from cache
  const removeContentFromCache = (contentId) => {
    setScheduledContent(prev => prev.filter(item => item.id !== contentId))
    setAllContent(prev => prev.filter(item => item.id !== contentId))
  }

  // Clear cache manually
  const clearCache = () => {
    console.log('Manually clearing content cache')
    setScheduledContent([])
    setAllContent([])
    setContentDate('')
    setLastFetchTime(null)
    setLastAllContentFetchTime(null)
    setCacheValid(false)
    setAllContentCacheValid(false)
  }

  // Get cache status
  const getCacheStatus = () => {
    return {
      hasData: scheduledContent.length > 0,
      hasAllContentData: allContent.length > 0,
      isValid: isCacheValid(),
      allContentValid: isAllContentCacheValid(),
      lastFetch: lastFetchTime,
      lastAllContentFetch: lastAllContentFetchTime,
      itemCount: scheduledContent.length,
      allContentCount: allContent.length
    }
  }

  const value = {
    scheduledContent,
    allContent,
    contentDate,
    loading,
    fetchScheduledContent,
    fetchAllContent,
    updateContentInCache,
    addContentToCache,
    removeContentFromCache,
    clearCache,
    getCacheStatus,
    isCacheValid: isCacheValid(),
    isAllContentCacheValid: isAllContentCacheValid(),
    // Expose setters for direct cache manipulation
    setScheduledContent,
    setContentDate,
    setLastFetchTime,
    setCacheValid
  }

  return (
    <ContentCacheContext.Provider value={value}>
      {children}
    </ContentCacheContext.Provider>
  )
}
