import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useSocialMediaCache } from '../contexts/SocialMediaCacheContext'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import WebsiteAnalysisDashboard from './WebsiteAnalysisDashboard'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Facebook,
  Instagram,
  Linkedin,
  Twitter,
  Youtube,
  RefreshCw,
  BarChart3,
  Activity,
  Target,
  Zap,
  TrendingUp,
  Globe,
  Search,
  X,
  TestTube
} from 'lucide-react'

// Dark mode hook
const useDarkMode = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference, default to light mode
    return localStorage.getItem('darkMode') === 'true'
  })

  useEffect(() => {
    localStorage.setItem('darkMode', isDarkMode.toString())
    // Apply to document for global dark mode
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Listen for dark mode changes from navbar
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.detail && event.detail.key === 'darkMode') {
        const newValue = event.detail.value === 'true'
        setIsDarkMode(newValue)
      }
    }

    // Also listen for direct localStorage changes (for cross-tab sync)
    const handleLocalStorageChange = (e) => {
      if (e.key === 'darkMode') {
        const newValue = e.newValue === 'true'
        setIsDarkMode(newValue)
      }
    }

    window.addEventListener('localStorageChange', handleStorageChange)
    window.addEventListener('storage', handleLocalStorageChange)

    return () => {
      window.removeEventListener('localStorageChange', handleStorageChange)
      window.removeEventListener('storage', handleLocalStorageChange)
    }
  }, [])

  return [isDarkMode, setIsDarkMode]
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const AnalyticsDashboard = () => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const [isDarkMode, setIsDarkMode] = useDarkMode()
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
  const [insightsData, setInsightsData] = useState({})
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, content: null })
  const [activeTab, setActiveTab] = useState('website') // 'social' or 'website'
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 768)
  const tooltipRef = useRef(null)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testMessage, setTestMessage] = useState('')
  const [loadingTest, setLoadingTest] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  // Track window size for responsive behavior
  useEffect(() => {
    const handleResize = () => {
      setIsLargeScreen(window.innerWidth >= 768)
    }
    
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const fetchData = async () => {
    try {
      await fetchAllData()
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching data:', error)
      showError('Failed to load analytics data')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await fetchData()
      showSuccess('Analytics data refreshed successfully')
    } catch (error) {
      showError('Failed to refresh analytics data')
    } finally {
      setRefreshing(false)
    }
  }

  const handleTestMorningMessage = async () => {
    setLoadingTest(true)
    setTestMessage('')
    setShowTestModal(true)
    
    try {
      const session = await supabase.auth.getSession()
      if (!session.data.session) {
        showError('Please log in to test the morning message')
        setShowTestModal(false)
        return
      }

      const token = session.data.session.access_token
      const response = await fetch(`${API_BASE_URL}/chatbot/scheduled-messages/regenerate-morning`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Failed to generate morning message')
      }

      const data = await response.json()
      if (data.success && data.content) {
        setTestMessage(data.content)
        showSuccess('Morning message generated successfully!')
      } else {
        throw new Error(data.error || 'Failed to generate message')
      }
    } catch (error) {
      console.error('Error testing morning message:', error)
      showError(`Failed to generate morning message: ${error.message}`)
      setTestMessage('Error: ' + error.message)
    } finally {
      setLoadingTest(false)
    }
  }

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: <Facebook className="w-5 h-5" />,
      instagram: <Instagram className="w-5 h-5" />,
      linkedin: <Linkedin className="w-5 h-5" />,
      twitter: <Twitter className="w-5 h-5" />,
      youtube: <Youtube className="w-5 h-5" />
    }
    return icons[platform?.toLowerCase()] || <BarChart3 className="w-5 h-5" />
  }

  const getPlatformCardTheme = (platform) => {
    const themes = isDarkMode ? {
      // Dark mode themes
      facebook: {
        bg: 'bg-gray-800/80 backdrop-blur-sm',
        border: 'border-blue-700/50',
        iconBg: 'bg-blue-600',
        text: 'text-blue-400',
        accent: 'bg-blue-900/50'
      },
      instagram: {
        bg: 'bg-gray-800/80 backdrop-blur-sm',
        border: 'border-pink-700/50',
        iconBg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500',
        text: 'text-pink-400',
        accent: 'bg-pink-900/50'
      },
      linkedin: {
        bg: 'bg-gray-800/80 backdrop-blur-sm',
        border: 'border-blue-700/50',
        iconBg: 'bg-blue-700',
        text: 'text-blue-400',
        accent: 'bg-blue-900/50'
      },
      twitter: {
        bg: 'bg-gray-800/80 backdrop-blur-sm',
        border: 'border-sky-700/50',
        iconBg: 'bg-sky-500',
        text: 'text-sky-400',
        accent: 'bg-sky-900/50'
      },
      youtube: {
        bg: 'bg-gray-800/80 backdrop-blur-sm',
        border: 'border-red-700/50',
        iconBg: 'bg-red-600',
        text: 'text-red-400',
        accent: 'bg-red-900/50'
      }
    } : {
      // Light mode themes
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

    return themes[platform?.toLowerCase()] || (isDarkMode ? {
      bg: 'bg-gray-800/80 backdrop-blur-sm',
      border: 'border-gray-700/50',
      iconBg: 'bg-gray-500',
      text: 'text-gray-400',
      accent: 'bg-gray-900/50'
    } : {
      bg: 'bg-white/20 backdrop-blur-sm',
      border: 'border-gray-200/50',
      iconBg: 'bg-gray-500',
      text: 'text-gray-800',
      accent: 'bg-gray-100/50'
    })
  }

  const formatEngagement = (count) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`
    return count?.toString() || '0'
  }

  const showTooltip = (event, content) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 10,
      content
    })
  }

  const hideTooltip = () => {
    setTooltip({ visible: false, x: 0, y: 0, content: null })
  }

  // Tooltip Component
  const Tooltip = () => {
    if (!tooltip.visible || !tooltip.content) return null

    return (
      <div
        ref={tooltipRef}
        className="fixed z-50 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-full"
        style={{
          left: tooltip.x,
          top: tooltip.y,
        }}
      >
        <div className="space-y-1">
          <div className="font-semibold">{tooltip.content.metric}</div>
          <div className="text-gray-300">{tooltip.content.value}</div>
          <div className="text-xs text-gray-400">{tooltip.content.post}</div>
        </div>
        {/* Arrow */}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
      </div>
    )
  }

  const calculatePlatformInsights = (platform, posts) => {
    if (!posts || posts.length === 0) return null

    const last5Posts = posts.slice(-5)
    
    // Calculate platform-specific metrics
    let metrics = []
    
    switch (platform.toLowerCase()) {
      case 'facebook':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) },
          { name: 'Shares', data: last5Posts.map(post => post.shares_count || 0) }
        ]
        break
      case 'instagram':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) },
          { name: 'Shares', data: last5Posts.map(post => post.shares_count || 0) }
        ]
        break
      case 'linkedin':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) },
          { name: 'Shares', data: last5Posts.map(post => post.shares_count || 0) }
        ]
        break
      case 'twitter':
        metrics = [
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Retweets', data: last5Posts.map(post => post.retweets_count || 0) },
          { name: 'Replies', data: last5Posts.map(post => post.replies_count || 0) }
        ]
        break
      case 'youtube':
        metrics = [
          { name: 'Views', data: last5Posts.map(post => post.views_count || 0) },
          { name: 'Likes', data: last5Posts.map(post => post.likes_count || 0) },
          { name: 'Comments', data: last5Posts.map(post => post.comments_count || 0) }
        ]
        break
      default:
        metrics = [
          { name: 'Engagement', data: last5Posts.map(post => (post.likes_count || 0) + (post.comments_count || 0)) },
          { name: 'Reach', data: last5Posts.map(post => post.reach_count || 0) },
          { name: 'Impressions', data: last5Posts.map(post => post.impressions_count || 0) }
        ]
    }

    return {
      platform,
      posts: last5Posts,
      metrics,
      postTitles: last5Posts.map(post => 
        (post.message || post.text || 'Untitled').substring(0, 30) + '...'
      )
    }
  }

  const processInsightsData = () => {
    const insights = {}
    // Process insights for all platforms that have posts (both OAuth and API token connections)
    const platformsWithPosts = Object.keys(posts).filter(platform => posts[platform] && posts[platform].length > 0)
    
    platformsWithPosts.forEach(platform => {
      const platformPosts = posts[platform] || []
      const platformInsights = calculatePlatformInsights(platform, platformPosts)
      if (platformInsights) {
        insights[platform] = platformInsights
      }
    })
    setInsightsData(insights)
  }

  useEffect(() => {
    if (Object.keys(posts).length > 0) {
      processInsightsData()
    }
  }, [posts])

  // Remove the early return for loading - we'll handle it in the main content area

  // Get platforms that have posts (from both OAuth and API token connections)
  const platformsWithPosts = Object.keys(posts).filter(platform => posts[platform] && posts[platform].length > 0)
  const connectedPlatforms = connections ? connections.filter(conn => conn.is_active) : []
  const hasPosts = Object.keys(posts).length > 0

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'} overflow-x-hidden`}>
      {/* Tooltip */}
      <Tooltip />
      
      {/* Side Navbar */}
      <SideNavbar />
      <MobileNavigation />
      
      {/* Main Content */}
      <div className="ml-0 md:ml-48 xl:ml-64 flex flex-col min-h-screen pt-16 md:pt-0 overflow-x-hidden max-w-full">
        {/* Header - Not fixed on mobile, fixed on desktop */}
        <div className={`md:fixed md:top-0 md:right-0 md:left-48 xl:left-64 shadow-sm border-b md:z-30 max-w-full ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'
        }`}>
          <div className="px-1.5 sm:px-2 md:px-4 lg:px-6 pb-1.5 sm:pb-2 md:pb-3 lg:pb-4 max-w-full">
            <div className="flex flex-row items-center gap-1 sm:gap-1.5 md:gap-2 lg:gap-4 flex-nowrap max-w-full">
            {/* Tabs */}
              <div className={`flex space-x-0.5 sm:space-x-0.5 md:space-x-1 p-0.5 sm:p-0.5 md:p-1 rounded-lg flex-shrink-0 min-w-0 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
              }`}>
                <button
                  onClick={() => setActiveTab('website')}
                  className={`flex items-center justify-center space-x-0.5 sm:space-x-1 md:space-x-2 px-1 sm:px-1.5 md:px-2 lg:px-4 py-1 sm:py-1.5 md:py-2 rounded-md text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium transition-all duration-200 flex-shrink-0 ${
                    activeTab === 'website'
                      ? isDarkMode
                        ? 'bg-gray-600 text-purple-400 shadow-sm'
                        : 'bg-white text-purple-600 shadow-sm'
                      : isDarkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Globe className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline md:hidden truncate">Website</span>
                  <span className="hidden md:inline truncate">Website Analysis</span>
                </button>
                <button
                  onClick={() => setActiveTab('social')}
                  className={`flex items-center justify-center space-x-0.5 sm:space-x-1 md:space-x-2 px-1 sm:px-1.5 md:px-2 lg:px-4 py-1 sm:py-1.5 md:py-2 rounded-md text-[9px] sm:text-[10px] md:text-xs lg:text-sm font-medium transition-all duration-200 flex-shrink-0 ${
                    activeTab === 'social'
                      ? isDarkMode
                        ? 'bg-gray-600 text-purple-400 shadow-sm'
                        : 'bg-white text-purple-600 shadow-sm'
                      : isDarkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <BarChart3 className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                  <span className="hidden sm:inline md:hidden truncate">Social</span>
                  <span className="hidden md:inline truncate">Social Media</span>
                </button>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 ml-auto min-w-0">
                {/* Test Morning Message Button */}
                <button
                  onClick={handleTestMorningMessage}
                  className={`flex items-center justify-center bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-200 ${
                    isLargeScreen 
                      ? 'px-2 sm:px-2.5 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-1.5 lg:py-2 gap-1 sm:gap-1.5 md:gap-2' 
                      : 'w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9'
                  }`}
                  title="Test Morning Message"
                >
                  <TestTube className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0" />
                  {isLargeScreen && (
                    <span className="text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap">
                      Test Message
                    </span>
                  )}
                </button>
              
              {/* Refresh Button */}
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className={`flex items-center justify-center bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 ${
                    isLargeScreen 
                      ? 'px-2 sm:px-2.5 md:px-3 lg:px-4 py-1 sm:py-1.5 md:py-1.5 lg:py-2 gap-1 sm:gap-1.5 md:gap-2' 
                      : 'w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9'
                  }`}
                  title={refreshing ? 'Refreshing...' : 'Refresh'}
                >
                  <RefreshCw className={`w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 flex-shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
                  {isLargeScreen && (
                    <span className="text-[10px] sm:text-xs md:text-sm font-medium whitespace-nowrap">
                      {refreshing ? 'Refreshing...' : 'Refresh'}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pt-0 md:pt-20 lg:pt-24 p-2 sm:p-3 md:p-4 lg:p-6 overflow-x-hidden max-w-full">
          {activeTab === 'social' ? (
            loading ? (
              <>
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
                `}} />
                <div className="flex items-center justify-center min-h-[300px] sm:min-h-[350px] md:min-h-[400px]">
                  <p className={`text-xs sm:text-sm md:text-base lg:text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    Loading social media analytics
                    <span className="inline-block w-6 ml-1">
                      <span className="loading-dot-1">.</span>
                      <span className="loading-dot-2">.</span>
                      <span className="loading-dot-3">.</span>
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <>
                {platformsWithPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 sm:h-80 md:h-96 px-3 sm:px-4">
                    <BarChart3 className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 mb-3 sm:mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                    <h3 className={`text-base sm:text-lg md:text-xl font-semibold mb-1.5 sm:mb-2 text-center ${isDarkMode ? 'text-gray-100' : 'text-gray-600'}`}>No Analytics Data</h3>
                    <p className={`text-xs sm:text-sm md:text-base text-center max-w-md px-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Connect your social media accounts to see performance insights and analytics.
                    </p>
                  </div>
                ) : (
            <div className="overflow-x-hidden max-w-full">
              {/* Performance Insights Cards */}
              {insightsData && Object.keys(insightsData).length > 0 && (
                <div className="overflow-x-hidden max-w-full">
                  <h2 className={`text-base sm:text-lg md:text-xl font-bold mb-3 sm:mb-4 md:mb-6 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Performance Insights</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 md:gap-5 lg:gap-6 max-w-full">
                    {Object.entries(insightsData).map(([platform, data]) => {
                      const theme = getPlatformCardTheme(platform)
                      const maxValue = Math.max(...data.metrics.flatMap(metric => metric.data))
                      
                      return (
                        <div key={platform} className={`${theme.bg} ${theme.border} border rounded-lg sm:rounded-xl shadow-sm hover:shadow-lg transition-all duration-300`}>
                          {/* Card Header */}
                          <div className={`p-2 sm:p-2.5 md:p-3 lg:p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-3 min-w-0 flex-1">
                                <div className={`w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 ${theme.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                  <div className="text-white scale-75 sm:scale-90 md:scale-100">
                                    {getPlatformIcon(platform)}
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className={`text-xs sm:text-sm md:text-base font-semibold capitalize ${theme.text} truncate`}>
                                    {platform} Insights
                                  </h3>
                                  <p className={`text-[10px] sm:text-xs md:text-sm truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Last 5 posts performance</p>
                                </div>
                              </div>
                              <div className="flex items-center space-x-0.5 sm:space-x-1 flex-shrink-0 ml-1 sm:ml-2">
                                <BarChart3 className={`w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 lg:w-4 lg:h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                                <span className={`text-[9px] sm:text-[10px] md:text-xs hidden sm:inline ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Analytics</span>
                              </div>
                            </div>
                          </div>

                          {/* Bar Chart */}
                          <div className="p-2 sm:p-2.5 md:p-3 lg:p-4">
                            {/* Grouped Bar Chart */}
                            <div className="space-y-2 sm:space-y-2.5 md:space-y-3 lg:space-y-4">
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] sm:text-xs md:text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Performance Metrics</span>
                                <span className={`text-[9px] sm:text-[10px] md:text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Last 5 posts</span>
                              </div>
                              
                              {/* Grouped Bar Chart */}
                              <div className="space-y-1.5 sm:space-y-2">
                                {/* Chart Container */}
                                <div className="flex items-end space-x-0.5 sm:space-x-1 md:space-x-1.5 lg:space-x-2 h-20 sm:h-24 md:h-28 lg:h-32 overflow-x-hidden max-w-full">
                                  {data.posts.map((post, postIndex) => {
                                    const maxValue = Math.max(...data.metrics.map(metric => Math.max(...metric.data)))
                                    const colors = ['bg-gradient-to-br from-purple-300 to-purple-400', 'bg-violet-500', 'bg-blue-500']
                                    
                                    return (
                                      <div key={postIndex} className="flex-1 flex flex-col items-center space-y-0.5 sm:space-y-1 min-w-[35px] sm:min-w-[40px] md:min-w-[45px] lg:min-w-[50px]">
                                        {/* Bars for each metric */}
                                        <div className="flex items-end space-x-0.5 sm:space-x-0.5 md:space-x-1 h-16 sm:h-20 md:h-22 lg:h-24 w-full">
                                          {data.metrics.map((metric, metricIndex) => {
                                            const value = metric.data[postIndex] || 0
                                            const height = maxValue > 0 ? (value / maxValue) * 100 : 0
                                            const postTitle = (post.message || post.text || 'Untitled').substring(0, 20) + '...'
                                            
                                            return (
                                              <div
                                                key={metricIndex}
                                                className={`${colors[metricIndex]} rounded-t-sm flex-1 min-h-[2px] transition-all duration-300 hover:opacity-80 cursor-pointer`}
                                                style={{ height: `${Math.max(height, 2)}%` }}
                                                onMouseEnter={(e) => showTooltip(e, {
                                                  metric: metric.name,
                                                  value: formatEngagement(value),
                                                  post: postTitle
                                                })}
                                                onMouseLeave={hideTooltip}
                                              />
                                            )
                                          })}
                                        </div>
                                        
                                        {/* Post Date Label */}
                                        <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400 text-center truncate w-full">
                                          {(() => {
                                            const postDate = post.created_time || post.created_at || post.published_at || post.scheduled_date || post.date || post.timestamp
                                            
                                            if (postDate) {
                                              try {
                                                const date = new Date(postDate)
                                                return date.toLocaleDateString('en-US', { 
                                                  month: 'short', 
                                                  day: 'numeric'
                                                })
                                              } catch (error) {
                                                console.log('Date parsing error:', error, 'for post:', post)
                                                return `Post ${postIndex + 1}`
                                              }
                                            }
                                            
                                            return `Post ${postIndex + 1}`
                                          })()}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                
                                {/* Legend */}
                                <div className="flex justify-center flex-wrap gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 mt-1.5 sm:mt-2">
                                  {data.metrics.map((metric, index) => {
                                    const colors = ['bg-gradient-to-br from-purple-300 to-purple-400', 'bg-violet-500', 'bg-blue-500']
                                    return (
                                      <div key={index} className="flex items-center space-x-0.5 sm:space-x-1">
                                        <div className={`w-2 h-2 sm:w-2.5 sm:h-2.5 md:w-3 md:h-3 ${colors[index]} rounded-sm`}></div>
                                        <span className={`text-[9px] sm:text-[10px] md:text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{metric.name}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </div>

                            {/* Summary Stats */}
                            <div className={`mt-2 sm:mt-2.5 md:mt-3 lg:mt-4 pt-2 sm:pt-2.5 md:pt-3 lg:pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                              <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:gap-4 text-center">
                                {data.metrics.map((metric, index) => {
                                  const total = metric.data.reduce((a, b) => a + b, 0)
                                  const avg = total / metric.data.length
                                  return (
                                    <div key={index} className="space-y-0.5 sm:space-y-0.5 md:space-y-1">
                                      <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-500 truncate">{metric.name}</div>
                                      <div className={`text-[10px] sm:text-xs md:text-sm font-semibold ${theme.text}`}>
                                        {formatEngagement(Math.round(avg))}
                                      </div>
                                      <div className="text-[9px] sm:text-[10px] md:text-xs text-gray-400">avg</div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Last Updated Timestamp - Bottom Right - Hidden on mobile */}
          {lastRefresh && (
            <div className="hidden sm:flex fixed bottom-4 right-4 text-xs sm:text-sm text-gray-500 bg-white/80 backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm border">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
              </>
            )
          ) : (
            <WebsiteAnalysisDashboard />
          )}
          
          {/* Last Updated Timestamp - Bottom Right - Hidden on mobile */}
          {lastRefresh && activeTab === 'social' && (
            <div className={`hidden sm:flex fixed bottom-4 right-4 text-xs sm:text-sm backdrop-blur-sm px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg shadow-sm border ${
              isDarkMode
                ? 'text-gray-400 bg-gray-800/80 border-gray-700'
                : 'text-gray-500 bg-white/80'
            }`}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>

      {/* Test Morning Message Modal */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className={`rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between p-4 sm:p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h2 className={`text-lg sm:text-xl md:text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                Morning Message Test
              </h2>
              <button
                onClick={() => {
                  setShowTestModal(false)
                  setTestMessage('')
                }}
                className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
              >
                <X className={`w-5 h-5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
              </button>
            </div>

            {/* Modal Content */}
            <div className={`flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar ${
              isDarkMode ? 'dark-mode' : 'light-mode'
            }`}>
              {loadingTest ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
                    <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Generating morning message...</p>
                  </div>
                </div>
              ) : testMessage ? (
                <div className="prose prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ children }) => (
                        <div className={`overflow-x-auto my-4 custom-scrollbar ${
                          isDarkMode ? 'dark-mode' : 'light-mode'
                        }`}>
                          <table className={`min-w-full border-collapse border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}>
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="bg-gradient-to-r from-pink-500 to-purple-600 text-white">
                          {children}
                        </thead>
                      ),
                      th: ({ children }) => (
                        <th className={`border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'} px-4 py-2 text-left font-semibold`}>
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className={`border ${isDarkMode ? 'border-gray-600' : 'border-gray-300'} px-4 py-2`}>
                          {children}
                        </td>
                      ),
                      tbody: ({ children }) => (
                        <tbody className={isDarkMode ? 'bg-gray-800' : 'bg-white'}>
                          {children}
                        </tbody>
                      ),
                      tr: ({ children }) => (
                        <tr className={isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'}>
                          {children}
                        </tr>
                      ),
                      p: ({ children }) => (
                        <p className={`mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                          {children}
                        </p>
                      ),
                      strong: ({ children }) => (
                        <strong className={`font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {children}
                        </strong>
                      ),
                    }}
                  >
                    {testMessage}
                  </ReactMarkdown>
                </div>
              ) : (
                <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  Click "Generate" to test the morning message
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className={`flex items-center justify-end gap-3 p-4 sm:p-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <button
                onClick={() => {
                  setShowTestModal(false)
                  setTestMessage('')
                }}
                className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                  isDarkMode
                    ? 'text-gray-300 bg-gray-700 hover:bg-gray-600'
                    : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Close
              </button>
              {!loadingTest && (
                <button
                  onClick={handleTestMorningMessage}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all font-medium"
                >
                  Regenerate
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AnalyticsDashboard
