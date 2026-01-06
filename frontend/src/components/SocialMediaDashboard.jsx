import React, { useState, useEffect, lazy, Suspense } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useSocialMediaCache } from '../contexts/SocialMediaCacheContext'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { 
  Facebook, 
  Instagram, 
  Linkedin, 
  Twitter, 
  Youtube,
  RefreshCw,
  ExternalLink,
  Heart,
  MessageCircle,
  Share2,
  Eye,
  Calendar,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  Activity,
  Target,
  Zap,
  Sparkles,
  X,
  BarChart3,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  Minus,
  FileText
} from 'lucide-react'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

// Get dark mode state from localStorage or default to light mode
const getDarkModePreference = () => {
  const saved = localStorage.getItem('darkMode')
  return saved !== null ? saved === 'true' : true // Default to true (dark mode)
}

// Listen for storage changes to sync dark mode across components
const useStorageListener = (key, callback) => {
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        callback(e.newValue === 'true')
      }
    }

    // Also listen for custom events for same-tab updates
    const handleCustomChange = (e) => {
      if (e.detail.key === key) {
        callback(e.detail.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('localStorageChange', handleCustomChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageChange', handleCustomChange)
    }
  }, [key, callback])
}

const SocialMediaDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const { 
    connections, 
    posts, 
    loading, 
    fetchAllData, 
    updatePostsInCache,
    getCacheStatus 
  } = useSocialMediaCache()
  const [refreshing, setRefreshing] = useState(false)
  const [lastRefresh, setLastRefresh] = useState(null)
  const [platformStats, setPlatformStats] = useState({})
  const [dataLoaded, setDataLoaded] = useState(false)
  const [showInsightsModal, setShowInsightsModal] = useState(false)
  const [insightsData, setInsightsData] = useState(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [selectedPostForInsights, setSelectedPostForInsights] = useState(null)
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 768)
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)
  const [profile, setProfile] = useState(null)
  const [expandedCaptions, setExpandedCaptions] = useState(new Set())

  // Apply dark mode class to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  useEffect(() => {
    setDataLoaded(false)
    fetchData()
    fetchProfile()
  }, [])

  // Listen for dark mode changes
  useStorageListener('darkMode', setIsDarkMode)

  const fetchProfile = async () => {
    try {
      if (!user?.id) return
      
      const { data, error } = await supabase
        .from('profiles')
        .select('logo_url, business_name')
        .eq('id', user.id)
        .single()
      
      if (error) {
        console.error('Error fetching profile:', error)
        return
      }
      
      if (data) {
        setProfile(data)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    }
  }

  // Track window size for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchData = async (forceRefresh = false) => {
    try {
      setDataLoaded(false)
      
      // Fetch posts only (stats fetching disabled)
      const result = await fetchAllData(forceRefresh)
      
      if (result.fromCache) {
        console.log('Data served from cache')
      } else {
        console.log('Data fetched from API')
      }
      
      setDataLoaded(true)
    } catch (error) {
      console.error('Error fetching data:', error)
      showError('Failed to load social media data', error.message)
      setDataLoaded(true) // Set to true even on error to prevent infinite loading
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const fetchPlatformStats = async () => {
    try {
      const authToken = await getAuthToken()
      console.log('🔍 Fetching platform stats...')
      
      const response = await fetch(`${API_BASE_URL}/social-media/platform-stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('📊 Platform stats response status:', response.status)
      
      if (response.ok) {
        const stats = await response.json()
        console.log('📊 Platform stats data:', stats)
        setPlatformStats(stats)
      } else {
        const errorText = await response.text()
        console.error('❌ Platform stats error:', response.status, errorText)
      }
    } catch (error) {
      console.error('❌ Error fetching platform stats:', error)
    }
  }


  const handleRefresh = async () => {
    try {
      setRefreshing(true)
      setDataLoaded(false)
      await fetchData(true) // Force refresh from API
      setLastRefresh(new Date())
      showSuccess('Social media data refreshed successfully!')
    } catch (error) {
      console.error('Error refreshing data:', error)
      showError('Failed to refresh data', error.message)
    } finally {
      setRefreshing(false)
    }
  }

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: <Facebook className="w-6 h-6 text-white" />,
      instagram: <Instagram className="w-6 h-6 text-white" />,
      linkedin: <Linkedin className="w-6 h-6 text-white" />,
      twitter: <Twitter className="w-6 h-6 text-white" />,
      youtube: <Youtube className="w-6 h-6 text-white" />
    }
    return icons[platform?.toLowerCase()] || <div className="w-6 h-6 bg-gray-500 rounded text-white flex items-center justify-center text-xs">?</div>
  }

  const getPlatformColor = (platform) => {
    const colors = {
      facebook: 'from-blue-500 to-blue-600',
      instagram: 'from-pink-500 to-purple-600',
      linkedin: 'from-blue-600 to-blue-700',
      twitter: 'from-sky-400 to-sky-500',
      youtube: 'from-red-500 to-red-600'
    }
    return colors[platform?.toLowerCase()] || 'from-gray-500 to-gray-600'
  }

  const getPlatformCardTheme = (platform) => {
    const themes = {
      facebook: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-blue-200/50',
        iconBg: 'bg-blue-600',
        text: 'text-blue-800',
        accent: 'bg-blue-100/50'
      },
      instagram: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-pink-200/50',
        iconBg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500',
        text: 'text-pink-800',
        accent: 'bg-pink-100/50'
      },
      linkedin: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-blue-200/50',
        iconBg: 'bg-blue-700',
        text: 'text-blue-800',
        accent: 'bg-blue-100/50'
      },
      twitter: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-sky-200/50',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-100/50'
      },
      youtube: {
        bg: 'bg-white/20 backdrop-blur-sm',
        border: 'border-red-200/50',
        iconBg: 'bg-red-600',
        text: 'text-red-800',
        accent: 'bg-red-100/50'
      }
    }
    return themes[platform?.toLowerCase()] || {
      bg: 'bg-white/20 backdrop-blur-sm',
      border: 'border-gray-200/50',
      iconBg: 'bg-gray-500',
      text: 'text-gray-800',
      accent: 'bg-gray-100/50'
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date'
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60))
    
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInHours < 48) return 'Yesterday'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const formatEngagement = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count?.toString() || '0'
  }

  const handleViewInsights = async (post, platform) => {
    try {
      setSelectedPostForInsights({ post, platform })
      setLoadingInsights(true)
      setShowInsightsModal(true)
      
      const authToken = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/api/social-media/post-insights?post_id=${post.id}&platform=${platform}`, {
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
      setInsightsData(data)
    } catch (error) {
      console.error('Error fetching insights:', error)
      setInsightsData({
        insights: `Error loading insights: ${error.message}`,
        error: true
      })
    } finally {
      setLoadingInsights(false)
    }
  }

  const handleCloseInsightsModal = () => {
    setShowInsightsModal(false)
    setInsightsData(null)
    setSelectedPostForInsights(null)
  }

  // Parse insights text into structured sections
  const parseInsights = (insightsText) => {
    if (!insightsText) return null
    
    const sections = {
      performance: null,
      content: null,
      sentiment: null,
      trends: null,
      recommendations: null
    }
    
    // Try to extract sections from the AI response
    const lines = insightsText.split('\n')
    let currentSection = null
    let currentContent = []
    
    lines.forEach(line => {
      const lowerLine = line.toLowerCase().trim()
      
      if (lowerLine.includes('performance analysis') || lowerLine.includes('performance:')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'performance'
        currentContent = [line.replace(/^.*?performance.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('content analysis') || lowerLine.includes('content:')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'content'
        currentContent = [line.replace(/^.*?content.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('sentiment analysis') || lowerLine.includes('sentiment:')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'sentiment'
        currentContent = [line.replace(/^.*?sentiment.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('trends') || lowerLine.includes('patterns')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'trends'
        currentContent = [line.replace(/^.*?trend.*?:/i, '').trim() || line]
      } else if (lowerLine.includes('recommendation')) {
        if (currentSection) sections[currentSection] = currentContent.join('\n').trim()
        currentSection = 'recommendations'
        currentContent = [line.replace(/^.*?recommendation.*?:/i, '').trim() || line]
      } else if (line.trim() && currentSection) {
        currentContent.push(line)
      } else if (line.trim() && !currentSection) {
        // If no section detected yet, add to first available
        if (!sections.performance && !sections.content) {
          sections.performance = sections.performance ? sections.performance + '\n' + line : line
        }
      }
    })
    
    if (currentSection) {
      sections[currentSection] = currentContent.join('\n').trim()
    }
    
    // If parsing didn't work well, return the full text
    const hasSections = Object.values(sections).some(v => v && v.length > 0)
    if (!hasSections) {
      return { raw: insightsText }
    }
    
    return sections
  }

  // Calculate sentiment score from text
  const calculateSentimentScore = (sentimentText) => {
    if (!sentimentText) return 0.5
    
    const lowerText = sentimentText.toLowerCase()
    const positiveWords = ['positive', 'good', 'great', 'excellent', 'amazing', 'love', 'happy', 'satisfied', 'praise', 'compliment']
    const negativeWords = ['negative', 'bad', 'poor', 'terrible', 'hate', 'angry', 'disappointed', 'complaint', 'criticism', 'unhappy']
    
    let positiveCount = 0
    let negativeCount = 0
    
    positiveWords.forEach(word => {
      if (lowerText.includes(word)) positiveCount++
    })
    
    negativeWords.forEach(word => {
      if (lowerText.includes(word)) negativeCount++
    })
    
    if (positiveCount === 0 && negativeCount === 0) return 0.5
    
    const total = positiveCount + negativeCount
    const score = positiveCount / total
    
    return Math.max(0, Math.min(1, score))
  }


  // Remove the early return for loading - we'll handle it in the main content area

  // Get platforms that have posts (from both OAuth and API token connections)
  const platformsWithPosts = Object.keys(posts).filter(platform => posts[platform] && posts[platform].length > 0)
  const connectedPlatforms = connections ? connections.filter(conn => conn.is_active) : []
  const hasPosts = Object.keys(posts).length > 0

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'}`}>
      {/* Side Navbar */}
      <SideNavbar />
      <MobileNavigation />
      
      {/* Main Content */}
      <div className="ml-0 md:ml-48 xl:ml-64 flex flex-col min-h-screen pt-16 md:pt-0">
        {/* Header - Part of Main Content */}
        <div className={`shadow-sm border-b ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}>
          <div className="px-3 sm:px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-center justify-between gap-2 sm:gap-3 md:gap-4 flex-wrap">
              {/* Heading - Matching main dashboard format */}
              <div className="flex items-center gap-2">
                <div className={`text-sm lg:text-base ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  Happenings
                            </div>
                <span className="text-gray-400">|</span>
                <div className={`text-sm lg:text-base ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {profile?.business_name || user?.user_metadata?.name || 'you'}
                          </div>
                <span className="text-gray-400">|</span>
                <div className={`text-sm lg:text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {new Date().toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </div>
              </div>
              
              {/* Refresh Button - Icon only on smaller devices, icon + text on larger devices */}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`flex items-center justify-center bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 flex-shrink-0 ${
                  isLargeScreen 
                    ? 'px-4 py-2 gap-2' 
                    : 'w-10 h-10 sm:w-11 sm:h-11'
                }`}
                title={refreshing ? 'Refreshing...' : 'Refresh'}
              >
                <RefreshCw className={`w-5 h-5 sm:w-6 sm:h-6 ${refreshing ? 'animate-spin' : ''}`} />
                {isLargeScreen && (
                  <span className="text-sm font-medium whitespace-nowrap">
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-hidden">
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes loading-dots {
                  0%, 20% { opacity: 0; }
                  50% { opacity: 1; }
                  100% { opacity: 0; }
                }
                .loading-dot-1 {
                  animation: loading-dots 1.4s infinite 0s;
                }
                .loading-dot-2 {
                  animation: loading-dots 1.4s infinite 0.2s;
                }
                .loading-dot-3 {
                  animation: loading-dots 1.4s infinite 0.4s;
                }
            @keyframes slide-in-right {
              from {
                transform: translateX(100%);
              }
              to {
                transform: translateX(0);
              }
            }
            .animate-slide-in-right {
              animation: slide-in-right 0.3s ease-out;
            }
            .chatbot-bubble-shadow {
              box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
            }
              `}} />
          
          <div className="relative h-full">
            {/* Main Content - Posts */}
            <div className="h-full overflow-y-auto">
              {loading || !dataLoaded ? (
              <div className="flex items-center justify-center min-h-[400px]">
                <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  Loading social media accounts
                  <span className="inline-block w-6 ml-1">
                    <span className="loading-dot-1">.</span>
                    <span className="loading-dot-2">.</span>
                    <span className="loading-dot-3">.</span>
                  </span>
                </p>
              </div>
          ) : platformsWithPosts.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-24 h-24 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className={`text-xl font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>No Social Media Posts</h3>
              <p className="text-gray-500 mb-6">Connect your social media accounts to see your latest posts</p>
              <button
                onClick={() => window.location.href = '/settings'}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-6 py-3 rounded-lg hover:from-indigo-600 hover:to-purple-500 transition-all duration-300"
              >
                Connect Accounts
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {/* Posts Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
                {/* Posts */}
                {platformsWithPosts.map((platform) => {
                  const platformPosts = posts[platform] || []
                  const latestPost = platformPosts[0] // Get the most recent post
                  const theme = getPlatformCardTheme(platform)
                  
                  // Find connection info for this platform (if available)
                  const connection = connectedPlatforms.find(conn => conn.platform === platform)
                  
                  const accountName = connection?.page_name || connection?.account_name || platform
                  const accountUsername = connection?.username || connection?.page_name || platform.toLowerCase()
                  
                  return (
                    <div key={platform} className={`${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden`}>
                      {latestPost ? (
                        <>
                          {/* Platform Header */}
                          <div className="px-4 py-3 flex items-center justify-between border-b border-gray-200">
                            <div className="flex items-center space-x-3">
                              {/* Platform Icon */}
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                              }`}>
                                {getPlatformIcon(platform)}
                                  </div>
                              {/* Platform Info */}
                              <div>
                                <h3 className={`font-normal text-sm capitalize ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {platform}
                                </h3>
                                <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                                  {accountName}
                                </p>
                                {accountUsername !== accountName && (
                                  <p className="text-xs text-gray-500">@{accountUsername}</p>
                                )}
                              </div>
                            </div>
                            {/* More options (three dots) */}
                            <button className={`hover:text-gray-900 ${isDarkMode ? 'text-gray-400 hover:text-gray-100' : 'text-gray-600 hover:text-gray-900'}`}>
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <circle cx="12" cy="12" r="1.5"/>
                                <circle cx="6" cy="12" r="1.5"/>
                                <circle cx="18" cy="12" r="1.5"/>
                              </svg>
                            </button>
                          </div>

                          {/* Post Media - Full Width */}
                          {latestPost.media_url && (
                            <div className="w-full bg-black">
                              {(() => {
                                const isVideo = latestPost.media_type === 'VIDEO' || 
                                               latestPost.media_type === 'REELS' ||
                                               (latestPost.thumbnail_url && latestPost.thumbnail_url !== latestPost.media_url) ||
                                               latestPost.media_url.match(/\.(mp4|mov|avi|webm|m4v)$/i)
                                
                                return isVideo ? (
                                  <video 
                                    src={latestPost.media_url} 
                                    controls
                                    className="w-full h-auto max-h-96 object-contain"
                                    poster={latestPost.thumbnail_url}
                                  >
                                    Your browser does not support the video tag.
                                  </video>
                                ) : (
                                  <img 
                                    src={latestPost.media_url} 
                                    alt="Post media"
                                    className="w-full h-auto max-h-96 object-contain"
                                  />
                                )
                              })()}
                            </div>
                          )}

                          {/* Action Buttons - Like Instagram/Facebook */}
                          <div className="px-4 py-2">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-4">
                                <button className={`hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                  <Heart className="w-6 h-6" fill="none" strokeWidth={2} />
                                </button>
                                <button className={`hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                  <MessageCircle className="w-6 h-6" fill="none" strokeWidth={2} />
                                </button>
                                <button className={`hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                  <Share2 className="w-6 h-6" fill="none" strokeWidth={2} />
                                </button>
                              </div>
                              <button className={`hover:opacity-70 transition-opacity ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                </svg>
                              </button>
                            </div>

                            {/* Likes Count */}
                            {latestPost.likes_count !== undefined && latestPost.likes_count > 0 && (
                              <div className="mb-1">
                                <p className={`text-sm font-normal ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                  {formatEngagement(latestPost.likes_count)} {latestPost.likes_count === 1 ? 'like' : 'likes'}
                                </p>
                              </div>
                            )}

                            {/* Caption */}
                            <div className="mb-2">
                              <p className={`text-sm ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                                <span className="font-semibold">{accountName}</span>{' '}
                                <span className={`${isDarkMode ? 'text-gray-200' : 'text-gray-800'} ${!expandedCaptions.has(`${platform}-${latestPost.id}`) ? 'line-clamp-2' : ''}`}>
                                  {latestPost.message || latestPost.text || ''}
                                </span>
                                {(latestPost.message || latestPost.text) && 
                                 (latestPost.message?.length > 100 || latestPost.text?.length > 100) && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const key = `${platform}-${latestPost.id}`
                                      setExpandedCaptions(prev => {
                                        const newSet = new Set(prev)
                                        if (newSet.has(key)) {
                                          newSet.delete(key)
                                        } else {
                                          newSet.add(key)
                                        }
                                        return newSet
                                      })
                                    }}
                                    className={`text-sm ml-1 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}
                                  >
                                    {expandedCaptions.has(`${platform}-${latestPost.id}`) ? 'less' : 'more'}
                                  </button>
                                )}
                              </p>
                            </div>

                            {/* Comments Count */}
                            {latestPost.comments_count !== undefined && latestPost.comments_count > 0 && (
                              <button className={`text-sm mb-2 ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
                                View all {formatEngagement(latestPost.comments_count)} {latestPost.comments_count === 1 ? 'comment' : 'comments'}
                              </button>
                            )}

                            {/* Timestamp */}
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                              {formatDate(latestPost.created_time || latestPost.created_at)}
                            </div>
                          </div>

                          {/* Bottom Actions */}
                          <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-between">
                            {latestPost.permalink_url && (
                              <a
                                href={latestPost.permalink_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center space-x-1 text-xs text-white hover:text-gray-200 transition-colors"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span>View on {platform}</span>
                              </a>
                            )}
                            <button
                              onClick={() => handleViewInsights(latestPost, platform)}
                              className="flex items-center space-x-1 text-xs text-white hover:text-gray-200 transition-colors"
                            >
                              <Sparkles className="w-3 h-3" />
                              <span>Insights</span>
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Eye className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-500 text-sm">No recent posts found</p>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
      </div>

            {/* Insights Right Panel - Overlay on top (Desktop) */}
      {showInsightsModal && (
        <div 
                className={`hidden md:flex fixed inset-y-0 right-0 w-96 border-l shadow-2xl flex-col flex-shrink-0 animate-slide-in-right overflow-hidden z-10 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'}`}
          >
            {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0">
                      <span className="text-white font-bold text-sm">O</span>
                </div>
                <div className="min-w-0">
                      <h3 className={`text-lg font-normal truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Insights by Orion</h3>
                      <p className="text-xs text-gray-600 truncate">
                    {selectedPostForInsights?.platform && (
                      <span className="capitalize">{selectedPostForInsights.platform}</span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseInsightsModal}
                    className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-2"
              >
                    <X className="w-5 h-5" />
              </button>
            </div>

                {/* Content - Message Bubbles */}
                <div className="flex-1 overflow-y-auto bg-gray-50 pt-4 pl-2 pr-0" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
              {loadingInsights ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Analyzing post and generating insights...</p>
                  </div>
                </div>
              ) : insightsData ? (
                <div className="space-y-4">
                  {insightsData.error ? (
                        <div className="flex flex-col items-start w-full">
                          <div className="flex items-start gap-2 w-full justify-start">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500">
                                <span className="text-white font-bold text-sm">O</span>
                    </div>
                          </div>
                            <div className={`px-4 py-3 rounded-lg chatbot-bubble-shadow text-sm ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'}`}>
                              <div className="text-red-800 text-sm">{insightsData.insights}</div>
                          </div>
                        </div>
                      </div>
                      ) : (() => {
                        const parsed = parseInsights(insightsData.insights)
                        
                        if (!parsed || parsed.raw) {
                          // Fallback to raw text if parsing failed
                          return (
                            <div className="flex flex-col items-start w-full">
                              <div className="flex items-start gap-2 w-full justify-start">
                                <div className="flex-shrink-0">
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500">
                                    <span className="text-white font-bold text-sm">O</span>
                                  </div>
                                </div>
                                <div className={`px-4 py-3 rounded-lg chatbot-bubble-shadow text-sm ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'}`}>
                                  <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      p: ({ children }) => <p className={`mb-2 last:mb-0 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</p>,
                                      h1: ({ children }) => <h1 className={`text-lg font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h1>,
                                      h2: ({ children }) => <h2 className={`text-base font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h2>,
                                      h3: ({ children }) => <h3 className={`text-sm font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h3>,
                                      ul: ({ children }) => <ul className={`list-disc list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ul>,
                                      ol: ({ children }) => <ol className={`list-decimal list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ol>,
                                      li: ({ children }) => <li className={`text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</li>,
                                      strong: ({ children }) => <strong className={`font-normal text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</strong>,
                                      em: ({ children }) => <em className={`italic text-sm ${isDarkMode ? 'text-gray-100/80' : 'text-black/80'}`}>{children}</em>,
                                    }}
                                  >
                                  {insightsData.insights}
                                  </ReactMarkdown>
                                </div>
                              </div>
                            </div>
                          )
                        }

                        const messages = []
                        
                        // Analysis Summary Message
                        if (insightsData.comments_analyzed || insightsData.previous_posts_compared) {
                          messages.push({
                            type: 'summary',
                            content: `Analyzed ${insightsData.comments_analyzed || 0} comments • Compared with ${insightsData.previous_posts_compared || 0} previous posts`
                          })
                        }

                        // Performance Analysis
                        if (parsed.performance) {
                          messages.push({
                            type: 'performance',
                            content: parsed.performance
                          })
                        }

                        // Content Analysis
                        if (parsed.content) {
                          messages.push({
                            type: 'content',
                            content: parsed.content
                          })
                        }

                        // Sentiment Analysis
                        if (parsed.sentiment) {
                                  const sentimentScore = calculateSentimentScore(parsed.sentiment)
                                  const percentage = Math.round(sentimentScore * 100)
                          messages.push({
                            type: 'sentiment',
                            content: parsed.sentiment,
                            sentimentScore,
                            percentage
                          })
                        }

                        // Trends & Patterns
                        if (parsed.trends) {
                          messages.push({
                            type: 'trends',
                            content: parsed.trends
                          })
                        }

                        // Recommendations
                        if (parsed.recommendations) {
                          messages.push({
                            type: 'recommendations',
                            content: parsed.recommendations
                          })
                        }

                                  return (
                          <>
                            {messages.map((message, index) => (
                              <div key={index} className="flex flex-col items-start w-full px-4">
                                <div className="flex items-start gap-2 w-full justify-start">
                                  <div className="flex-shrink-0">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500">
                                      <span className="text-white font-bold text-sm">O</span>
                                    </div>
                                  </div>
                                  <div className={`px-4 py-3 rounded-lg chatbot-bubble-shadow text-sm ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'}`}>
                                    {message.type === 'sentiment' && message.sentimentScore !== undefined && (
                                    <div className="mb-4">
                                      <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden mb-2">
                                        <div 
                                          className="absolute inset-0 rounded-full transition-all duration-500"
                                          style={{
                                            background: `linear-gradient(to right, 
                                                ${message.sentimentScore < 0.5 
                                                  ? `rgb(239, 68, 68) ${message.sentimentScore * 100}%, rgb(234, 179, 8) ${(message.sentimentScore + 0.2) * 100}%, rgb(34, 197, 94) 100%`
                                                  : `rgb(239, 68, 68) 0%, rgb(234, 179, 8) ${(message.sentimentScore - 0.2) * 100}%, rgb(34, 197, 94) ${message.sentimentScore * 100}%`
                                              })`
                                          }}
                                        />
                                        <div 
                                          className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                                            style={{ left: `${message.sentimentScore * 100}%`, transform: 'translateX(-50%)' }}
                                        />
                                      </div>
                                      <div className="flex items-center justify-between text-sm">
                                        <span className="text-red-600 font-medium">Negative</span>
                                          <span className="text-gray-600 font-semibold">{message.percentage}% Positive</span>
                                        <span className="text-green-600 font-medium">Positive</span>
                                      </div>
                                    </div>
                                    )}
                                    <ReactMarkdown
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({ children }) => <p className={`mb-2 last:mb-0 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</p>,
                                        h1: ({ children }) => <h1 className={`text-lg font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h1>,
                                        h2: ({ children }) => <h2 className={`text-base font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h2>,
                                        h3: ({ children }) => <h3 className={`text-sm font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h3>,
                                        ul: ({ children }) => <ul className={`list-disc list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ul>,
                                        ol: ({ children }) => <ol className={`list-decimal list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ol>,
                                        li: ({ children }) => <li className={`text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</li>,
                                        strong: ({ children }) => <strong className={`font-normal text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</strong>,
                                        em: ({ children }) => <em className={`italic text-sm ${isDarkMode ? 'text-gray-100/80' : 'text-black/80'}`}>{children}</em>,
                                      }}
                                    >
                                      {message.content}
                                    </ReactMarkdown>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </>
                                  )
                                })()}
                                </div>
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No insights available</p>
                              </div>
                            )}
                </div>
              </div>
            )}
          </div>
          
          {/* Last Updated Timestamp - Bottom Right */}
          {lastRefresh && (
            <div className="fixed bottom-4 right-2 sm:right-4 text-xs sm:text-sm text-gray-500 bg-white/80 backdrop-blur-sm px-2 sm:px-3 py-2 rounded-lg shadow-sm border">
              <span className="hidden sm:inline">Last updated: </span>
              {lastRefresh.toLocaleTimeString()}
                                  </div>
          )}
                                </div>
                                </div>

      {/* Insights Panel for Mobile - Full Screen Overlay */}
      {showInsightsModal && (
        <div className="md:hidden fixed inset-0 bg-white z-50 flex flex-col animate-slide-in-right overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50 flex-shrink-0">
            <div className="flex items-center space-x-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500 flex-shrink-0">
                <span className="text-white font-bold text-sm">O</span>
                              </div>
              <div className="min-w-0">
                <h3 className={`text-lg font-normal truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Insights by Orion</h3>
                <p className="text-xs text-gray-600 truncate">
                  {selectedPostForInsights?.platform && (
                    <span className="capitalize">{selectedPostForInsights.platform}</span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={handleCloseInsightsModal}
              className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content - Message Bubbles */}
          <div className="flex-1 overflow-y-auto bg-gray-50 pt-4 pl-2 pr-0" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
            {loadingInsights ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Analyzing post and generating insights...</p>
                                  </div>
                                </div>
            ) : insightsData ? (
              <div className="space-y-4">
                {insightsData.error ? (
                  <div className="flex flex-col items-start w-full px-4">
                    <div className="flex items-start gap-2 w-full justify-start">
                      <div className="flex-shrink-0">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500">
                          <span className="text-white font-bold text-sm">O</span>
                        </div>
                      </div>
                      <div className={`px-4 py-3 rounded-lg chatbot-bubble-shadow ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'}`}>
                        <div className="text-red-800">{insightsData.insights}</div>
                      </div>
                    </div>
                  </div>
                ) : (() => {
                  const parsed = parseInsights(insightsData.insights)
                  
                  if (!parsed || parsed.raw) {
                    // Fallback to raw text if parsing failed
                    return (
                      <div className="flex flex-col items-start w-full px-4">
                        <div className="flex items-start gap-2 w-full justify-start">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500">
                              <span className="text-white font-bold text-sm">O</span>
                            </div>
                          </div>
                          <div className={`px-4 py-3 rounded-lg chatbot-bubble-shadow ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'}`}>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className={`mb-2 last:mb-0 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</p>,
                                h1: ({ children }) => <h1 className={`text-lg font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h1>,
                                h2: ({ children }) => <h2 className={`text-base font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h2>,
                                h3: ({ children }) => <h3 className={`text-sm font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h3>,
                                ul: ({ children }) => <ul className={`list-disc list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ul>,
                                ol: ({ children }) => <ol className={`list-decimal list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ol>,
                                li: ({ children }) => <li className={`text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</li>,
                                strong: ({ children }) => <strong className={`font-normal text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</strong>,
                                em: ({ children }) => <em className={`italic text-sm ${isDarkMode ? 'text-gray-100/80' : 'text-black/80'}`}>{children}</em>,
                              }}
                            >
                              {insightsData.insights}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    )
                  }

                  const messages = []
                  
                  // Analysis Summary Message
                  if (insightsData.comments_analyzed || insightsData.previous_posts_compared) {
                    messages.push({
                      type: 'summary',
                      content: `Analyzed ${insightsData.comments_analyzed || 0} comments • Compared with ${insightsData.previous_posts_compared || 0} previous posts`
                    })
                  }

                  // Performance Analysis
                  if (parsed.performance) {
                    messages.push({
                      type: 'performance',
                      content: parsed.performance
                    })
                  }

                  // Content Analysis
                  if (parsed.content) {
                    messages.push({
                      type: 'content',
                      content: parsed.content
                    })
                  }

                  // Sentiment Analysis
                  if (parsed.sentiment) {
                    const sentimentScore = calculateSentimentScore(parsed.sentiment)
                    const percentage = Math.round(sentimentScore * 100)
                    messages.push({
                      type: 'sentiment',
                      content: parsed.sentiment,
                      sentimentScore,
                      percentage
                    })
                  }

                  // Trends & Patterns
                  if (parsed.trends) {
                    messages.push({
                      type: 'trends',
                      content: parsed.trends
                    })
                  }

                  // Recommendations
                  if (parsed.recommendations) {
                    messages.push({
                      type: 'recommendations',
                      content: parsed.recommendations
                    })
                  }

                  return (
                    <>
                      {messages.map((message, index) => (
                        <div key={index} className="flex flex-col items-start w-full px-4">
                          <div className="flex items-start gap-2 w-full justify-start">
                            <div className="flex-shrink-0">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center shadow-md bg-gradient-to-br from-pink-400 to-purple-500">
                                <span className="text-white font-bold text-sm">O</span>
                              </div>
                            </div>
                            <div className={`px-4 py-3 rounded-lg chatbot-bubble-shadow text-sm ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'}`}>
                              {message.type === 'sentiment' && message.sentimentScore !== undefined && (
                                <div className="mb-4">
                                  <div className="relative w-full h-6 bg-gray-200 rounded-full overflow-hidden mb-2">
                                    <div 
                                      className="absolute inset-0 rounded-full transition-all duration-500"
                                      style={{
                                        background: `linear-gradient(to right, 
                                          ${message.sentimentScore < 0.5 
                                            ? `rgb(239, 68, 68) ${message.sentimentScore * 100}%, rgb(234, 179, 8) ${(message.sentimentScore + 0.2) * 100}%, rgb(34, 197, 94) 100%`
                                            : `rgb(239, 68, 68) 0%, rgb(234, 179, 8) ${(message.sentimentScore - 0.2) * 100}%, rgb(34, 197, 94) ${message.sentimentScore * 100}%`
                                          })`
                                      }}
                                    />
                                    <div 
                                      className="absolute top-0 bottom-0 w-1 bg-white shadow-lg"
                                      style={{ left: `${message.sentimentScore * 100}%`, transform: 'translateX(-50%)' }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="text-red-600 font-medium">Negative</span>
                                    <span className="text-gray-600 font-semibold">{message.percentage}% Positive</span>
                                    <span className="text-green-600 font-medium">Positive</span>
                                </div>
                              </div>
                            )}
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ children }) => <p className={`mb-2 last:mb-0 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</p>,
                                  h1: ({ children }) => <h1 className={`text-lg font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h1>,
                                  h2: ({ children }) => <h2 className={`text-base font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h2>,
                                  h3: ({ children }) => <h3 className={`text-sm font-normal mb-2 ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</h3>,
                                  ul: ({ children }) => <ul className={`list-disc list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ul>,
                                  ol: ({ children }) => <ol className={`list-decimal list-inside mb-2 text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</ol>,
                                  li: ({ children }) => <li className={`text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</li>,
                                  strong: ({ children }) => <strong className={`font-normal text-sm ${isDarkMode ? 'text-gray-100' : 'text-black'}`}>{children}</strong>,
                                  em: ({ children }) => <em className={`italic text-sm ${isDarkMode ? 'text-gray-100/80' : 'text-black/80'}`}>{children}</em>,
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                          </div>
                          </div>
                        </div>
                      ))}
                    </>
                        )
                      })()}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No insights available</p>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SocialMediaDashboard