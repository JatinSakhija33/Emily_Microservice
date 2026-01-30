import React, { createContext, useContext, useState, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'

const SocialMediaCacheContext = createContext()

export function useSocialMediaCache() {
  const context = useContext(SocialMediaCacheContext)
  if (!context) {
    throw new Error('useSocialMediaCache must be used within a SocialMediaCacheProvider')
  }
  return context
}

export function SocialMediaCacheProvider({ children }) {
  const { user, isAuthenticated } = useAuth()
  const [connections, setConnections] = useState([])
  const [posts, setPosts] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastConnectionsFetchTime, setLastConnectionsFetchTime] = useState(null)
  const [lastPostsFetchTime, setLastPostsFetchTime] = useState(null)
  const [connectionsCacheValid, setConnectionsCacheValid] = useState(false)
  const [postsCacheValid, setPostsCacheValid] = useState(false)

  // Cache duration: 5 minutes (300000 ms)
  const CACHE_DURATION = 5 * 60 * 1000

  // Clear cache when user logs out
  useEffect(() => {
    if (!isAuthenticated || !user) {
      console.log('User logged out, clearing social media cache')
      setConnections([])
      setPosts({})
      setLastConnectionsFetchTime(null)
      setLastPostsFetchTime(null)
      setConnectionsCacheValid(false)
      setPostsCacheValid(false)
    }
  }, [isAuthenticated, user])

  // Check if connections cache is still valid
  const isConnectionsCacheValid = () => {
    if (!lastConnectionsFetchTime || !connectionsCacheValid) return false
    const now = Date.now()
    return (now - lastConnectionsFetchTime) < CACHE_DURATION
  }

  // Check if posts cache is still valid
  const isPostsCacheValid = () => {
    if (!lastPostsFetchTime || !postsCacheValid) return false
    const now = Date.now()
    return (now - lastPostsFetchTime) < CACHE_DURATION
  }

  // Fetch connections with caching
  const fetchConnections = async (forceRefresh = false) => {
    // If cache is valid and not forcing refresh, return cached data
    if (!forceRefresh && isConnectionsCacheValid()) {
      console.log('Using cached connections data')
      return { data: connections, fromCache: true }
    }

    try {
      setLoading(true)
      console.log('Fetching fresh connections data from API')
      
      const authToken = await getAuthToken()
      const response = await fetch(`${getApiBaseUrl()}/connections`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Connections fetched successfully, updating cache')
      
      // Handle both array and object responses
      const connectionsArray = Array.isArray(data) ? data : (data.connections || [])
      setConnections(connectionsArray)
      setLastConnectionsFetchTime(Date.now())
      setConnectionsCacheValid(true)
      
      return { 
        data: connectionsArray, 
        fromCache: false 
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
      // If we have cached data and API fails, return cached data
      if (connections.length > 0) {
        console.log('API failed, returning cached connections data as fallback')
        return { data: connections, fromCache: true }
      }
      return { data: [], fromCache: false }
    } finally {
      setLoading(false)
    }
  }

  // Fetch posts with caching
  const fetchPosts = async (forceRefresh = false) => {
    // If cache is valid and not forcing refresh, return cached data
    if (!forceRefresh && isPostsCacheValid()) {
      console.log('Using cached posts data')
      return { data: posts, fromCache: true }
    }

    try {
      setLoading(true)
      console.log('Fetching fresh posts data from API')
      
      const authToken = await getAuthToken()
      const response = await fetch(`${getApiBaseUrl()}/api/social-media/latest-posts`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Posts fetched successfully, updating cache')
      
      setPosts(data.posts || {})
      setLastPostsFetchTime(Date.now())
      setPostsCacheValid(true)
      
      return { 
        data: data.posts || {}, 
        fromCache: false 
      }
    } catch (error) {
      console.error('Error fetching posts:', error)
      // If we have cached data and API fails, return cached data
      if (Object.keys(posts).length > 0) {
        console.log('API failed, returning cached posts data as fallback')
        return { data: posts, fromCache: true }
      }
      return { data: {}, fromCache: false }
    } finally {
      setLoading(false)
    }
  }

  // Fetch both connections and posts with caching
  const fetchAllData = async (forceRefresh = false) => {
    try {
      setLoading(true)
      const [connectionsResult, postsResult] = await Promise.all([
        fetchConnections(forceRefresh),
        fetchPosts(forceRefresh)
      ])
      
      return {
        connections: connectionsResult.data,
        posts: postsResult.data,
        fromCache: connectionsResult.fromCache && postsResult.fromCache
      }
    } catch (error) {
      console.error('Error fetching all data:', error)
      return {
        connections: connections,
        posts: posts,
        fromCache: true
      }
    } finally {
      setLoading(false)
    }
  }

  // Update posts in cache (for when posts are refreshed)
  const updatePostsInCache = (newPosts) => {
    setPosts(newPosts)
    setLastPostsFetchTime(Date.now())
    setPostsCacheValid(true)
  }

  // Update connections in cache
  const updateConnectionsInCache = (newConnections) => {
    setConnections(newConnections)
    setLastConnectionsFetchTime(Date.now())
    setConnectionsCacheValid(true)
  }

  // Clear cache manually
  const clearCache = () => {
    console.log('Manually clearing social media cache')
    setConnections([])
    setPosts({})
    setLastConnectionsFetchTime(null)
    setLastPostsFetchTime(null)
    setConnectionsCacheValid(false)
    setPostsCacheValid(false)
  }

  // Get cache status
  const getCacheStatus = () => {
    return {
      hasConnections: connections.length > 0,
      hasPosts: Object.keys(posts).length > 0,
      connectionsValid: isConnectionsCacheValid(),
      postsValid: isPostsCacheValid(),
      lastConnectionsFetch: lastConnectionsFetchTime,
      lastPostsFetch: lastPostsFetchTime,
      connectionsCount: connections.length,
      postsCount: Object.keys(posts).length
    }
  }

  // Helper function to get auth token
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // Helper function to get API base URL
  const getApiBaseUrl = () => {
    return (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
  }

  const value = {
    connections,
    posts,
    loading,
    fetchConnections,
    fetchPosts,
    fetchAllData,
    updatePostsInCache,
    updateConnectionsInCache,
    clearCache,
    getCacheStatus,
    isConnectionsCacheValid: isConnectionsCacheValid(),
    isPostsCacheValid: isPostsCacheValid()
  }

  return (
    <SocialMediaCacheContext.Provider value={value}>
      {children}
    </SocialMediaCacheContext.Provider>
  )
}