import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { contentAPI } from '../services/content'
import { onboardingAPI } from '../services/onboarding'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import PostContentCard from './PostContentCard'
import { Facebook, Instagram, Linkedin, Youtube, Building2, Hash, FileText, Video, X } from 'lucide-react'

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
        const newValue = event.detail.newValue === 'true'
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

const PostSuggestionsDashboard = () => {
  console.log('PostSuggestionsDashboard rendering...')

  const { user } = useAuth()
  const [isDarkMode, setIsDarkMode] = useDarkMode()

  // Custom scrollbar styles
  const scrollbarStyles = `
    .scrollbar-transparent::-webkit-scrollbar {
      height: 8px;
      background: transparent;
    }
    .scrollbar-transparent::-webkit-scrollbar-track {
      background: transparent;
    }
    .scrollbar-transparent::-webkit-scrollbar-thumb {
      background: ${isDarkMode ? 'rgba(107, 114, 128, 0.3)' : 'rgba(156, 163, 175, 0.3)'};
      border-radius: 4px;
    }
    .scrollbar-transparent::-webkit-scrollbar-thumb:hover {
      background: ${isDarkMode ? 'rgba(107, 114, 128, 0.5)' : 'rgba(156, 163, 175, 0.5)'};
    }
    .scrollbar-transparent {
      scrollbar-width: thin;
      scrollbar-color: ${isDarkMode ? 'rgba(107, 114, 128, 0.3)' : 'rgba(156, 163, 175, 0.3)'} transparent;
    }
  `
  const { showError, showSuccess } = useNotifications()

  // Profile state
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // State for different sections
  const [suggestedPosts, setSuggestedPosts] = useState([])
  const [suggestedBlogs, setSuggestedBlogs] = useState([])
  const [suggestedVideos, setSuggestedVideos] = useState([])

  // Filter states
  const [postsFilter, setPostsFilter] = useState('all')
  
  // Active tab state
  const [activeTab, setActiveTab] = useState('posts') // 'posts', 'blogs', 'videos'

  // Cache management helpers
  const getCacheKey = (type) => `suggested_${type}_${user?.id}_${new Date().toISOString().split('T')[0]}`
  const shouldRefreshCache = (type) => {
    const cacheKey = getCacheKey(type)
    const lastRefresh = localStorage.getItem(`${cacheKey}_timestamp`)
    if (!lastRefresh) return true

    const lastRefreshDate = new Date(parseInt(lastRefresh))
    const now = new Date()
    const timeDiff = now.getTime() - lastRefreshDate.getTime()
    const hoursDiff = timeDiff / (1000 * 3600)

    return hoursDiff >= 24 // Refresh every 24 hours
  }

  // Fetch profile data
  const fetchProfile = async () => {
    try {
      setLoadingProfile(true)
      const response = await onboardingAPI.getProfile()
      setProfile(response.data)
      console.log('Fetched profile:', response.data)
    } catch (error) {
      console.error('Error fetching profile:', error)
      setProfile(null)
    } finally {
      setLoadingProfile(false)
    }
  }

  // Get available platforms from user profile
  const getAvailablePlatforms = () => {
    console.log('Profile social_media_platforms:', profile?.social_media_platforms)
    if (!profile?.social_media_platforms) {
      console.log('No social_media_platforms found in profile')
      return []
    }

    // Parse the platforms from profile - could be array or string
    let platforms = []
    try {
      if (typeof profile.social_media_platforms === 'string') {
        platforms = JSON.parse(profile.social_media_platforms)
      } else if (Array.isArray(profile.social_media_platforms)) {
        platforms = profile.social_media_platforms
      }
    } catch (error) {
      console.error('Error parsing social media platforms:', error)
      return []
    }

    // Filter out invalid entries and ensure we have strings
    return platforms.filter(platform => platform && typeof platform === 'string')
  }

  console.log('User:', user)
  console.log('Profile:', profile)

  // Fetch suggested posts from post_contents table with caching
  const fetchSuggestedPosts = async () => {
    try {
      const cacheKey = getCacheKey('posts')

      // Check if we should refresh cache
      if (!shouldRefreshCache('posts')) {
        const cachedPosts = localStorage.getItem(cacheKey)
        if (cachedPosts) {
          console.log('Loading suggested posts from cache')
          setSuggestedPosts(JSON.parse(cachedPosts))
          return
        }
      }

      const result = await contentAPI.getPostContents(50, 0)

      if (result.error) throw new Error(result.error)

      const posts = result.data || []
      console.log('Fetched post contents data:', posts.slice(0, 3)) // Log first 3 posts to see structure

      // Cache the posts
      localStorage.setItem(cacheKey, JSON.stringify(posts))
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())

      setSuggestedPosts(posts)
    } catch (error) {
      console.error('Error fetching suggested posts:', error)
      showError('Failed to load suggested posts')
    }
  }

  // Fetch suggested blogs using the same API, then filter for Blog channel with caching
  const fetchSuggestedBlogs = async () => {
    try {
      const cacheKey = getCacheKey('blogs')

      // Check if we should refresh cache
      if (!shouldRefreshCache('blogs')) {
        const cachedBlogs = localStorage.getItem(cacheKey)
        if (cachedBlogs) {
          console.log('Loading suggested blogs from cache')
          setSuggestedBlogs(JSON.parse(cachedBlogs))
          return
        }
      }

      const result = await contentAPI.getAllContent(50, 0)

      if (result.error) throw new Error(result.error)

      // Filter for Blog channel content
      const blogs = (result.data || []).filter(content =>
        content.channel?.toLowerCase() === 'blog'
      ).slice(0, 10)

      // Cache the blogs
      localStorage.setItem(cacheKey, JSON.stringify(blogs))
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())

      setSuggestedBlogs(blogs)
    } catch (error) {
      console.error('Error fetching suggested blogs:', error)
      showError('Failed to load suggested blogs')
    }
  }

  // Fetch suggested videos using the same API, then filter for Video channel with caching
  const fetchSuggestedVideos = async () => {
    try {
      const cacheKey = getCacheKey('videos')

      // Check if we should refresh cache
      if (!shouldRefreshCache('videos')) {
        const cachedVideos = localStorage.getItem(cacheKey)
        if (cachedVideos) {
          console.log('Loading suggested videos from cache')
          setSuggestedVideos(JSON.parse(cachedVideos))
          return
        }
      }

      const result = await contentAPI.getAllContent(50, 0)

      if (result.error) throw new Error(result.error)

      // Filter for Video channel content
      const videos = (result.data || []).filter(content =>
        content.channel?.toLowerCase() === 'video'
      ).slice(0, 10)

      // Cache the videos
      localStorage.setItem(cacheKey, JSON.stringify(videos))
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString())

      setSuggestedVideos(videos)
    } catch (error) {
      console.error('Error fetching suggested videos:', error)
      showError('Failed to load suggested videos')
    }
  }

  // Handle message copying
  const handleCopyMessage = async (message) => {
    try {
      // Extract text content from message
      let textToCopy = message.text || message.content || ''

      // For bot messages, get the content
      if (message.sender === 'bot' && !textToCopy) {
        textToCopy = message.content || ''
      }

      await navigator.clipboard.writeText(textToCopy)

      showSuccess('Message copied to clipboard')
    } catch (error) {
      console.error('Error copying message:', error)
      showError('Failed to copy message')
    }
  }

  // Get status color for badges
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'scheduled':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'generated':
        return 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  // Get platform icon
  const getPlatformIcon = (platformName, small = false) => {
    const iconSize = small ? 'w-4 h-4' : 'w-5 h-5'

    switch (platformName?.toLowerCase()) {
      case 'instagram':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" fill="url(#instagram-gradient)"/>
            <defs>
              <linearGradient id="instagram-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#833ab4"/>
                <stop offset="50%" stopColor="#fd1d1d"/>
                <stop offset="100%" stopColor="#fcb045"/>
              </linearGradient>
            </defs>
          </svg>
        );
      case 'facebook':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
          </svg>
        );
      case 'linkedin':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0077B5"/>
          </svg>
        );
      case 'twitter':
      case 'x':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
          </svg>
        );
      case 'youtube':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
          </svg>
        );
      case 'tiktok':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#000000"/>
          </svg>
        );
      default:
        return <Building2 className={`${iconSize} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
    }
  }

  // Filter posts based on selected platform
  const getFilteredPosts = () => {
    if (postsFilter === 'all') {
      return suggestedPosts
    }

    return suggestedPosts.filter(post => {
      const postPlatform = post.platform?.toLowerCase().trim()
      const filterPlatform = postsFilter.toLowerCase().trim()
      return postPlatform === filterPlatform
    })
  }

  // Mouse enter/leave handlers for horizontal scrolling
  const [isMouseOver, setIsMouseOver] = useState(false)
  const handleMouseEnter = () => setIsMouseOver(true)
  const handleMouseLeave = () => setIsMouseOver(false)

  // Global wheel handler for horizontal scrolling
  const handleGlobalWheel = useRef((e) => {
    if (!isMouseOver) return

    const scrollContainer = document.querySelector('.scrollbar-transparent')
    if (scrollContainer && scrollContainer.contains(e.target)) {
      e.preventDefault()
      scrollContainer.scrollLeft += e.deltaY * 2
    }
  })

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchSuggestedPosts()
      fetchSuggestedBlogs()
      fetchSuggestedVideos()
    }
  }, [user])

  // Cleanup: restore scrolling and remove listeners when component unmounts
  useEffect(() => {
    window.addEventListener('wheel', handleGlobalWheel.current, { capture: true, passive: false })

    return () => {
      document.body.style.overflow = 'auto'
      window.removeEventListener('wheel', handleGlobalWheel.current, { capture: true })
    }
  }, [isMouseOver, handleGlobalWheel])

  if (!user) {
    console.log('User not authenticated, showing login message')
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className="text-2xl font-normal text-red-600 mb-4">Not Authenticated</h1>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Please log in to access the dashboard.</p>
        </div>
      </div>
    )
  }

  console.log('User authenticated, rendering main component')

  return (
    <div className={`h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'} overflow-hidden md:overflow-auto custom-scrollbar ${
      isDarkMode ? 'dark-mode' : 'light-mode'
    }`}>
      {/* Custom scrollbar styles */}
      <style dangerouslySetInnerHTML={{ __html: scrollbarStyles }} />

      {/* Mobile Navigation */}
      <MobileNavigation />

      {/* Side Navbar */}
      <SideNavbar />

      {/* Main Content */}
      <div className={`md:ml-48 xl:ml-64 flex flex-col h-screen overflow-hidden pt-16 md:pt-0 ${
        isDarkMode ? 'md:bg-gray-800' : 'md:bg-gray-50'
      }`}>
        {/* Header */}
        <div className={`hidden md:block shadow-sm border-b z-30 flex-shrink-0 ${
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                {/* Tab Navigation */}
                <div className="flex items-center gap-2">
                  {/* Posts Tab */}
                  <button
                    onClick={() => setActiveTab('posts')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-normal ${
                      activeTab === 'posts'
                        ? isDarkMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                        : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Hash className="w-4 h-4" />
                    <span>Posts</span>
                  </button>

                  {/* Blogs Tab */}
                  <button
                    onClick={() => setActiveTab('blogs')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-normal ${
                      activeTab === 'blogs'
                        ? isDarkMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                        : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Blogs</span>
                  </button>

                  {/* Videos Tab */}
                  <button
                    onClick={() => setActiveTab('videos')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all font-normal ${
                      activeTab === 'videos'
                        ? isDarkMode
                          ? 'bg-purple-600 text-white'
                          : 'bg-gradient-to-r from-purple-500 to-pink-600 text-white'
                        : isDarkMode
                        ? 'text-gray-300 hover:bg-gray-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Video className="w-4 h-4" />
                    <span>Videos</span>
                  </button>
                </div>
              </div>
              
              {/* Right side - Business Name */}
              <div className={`text-sm lg:text-base font-normal ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {profile?.business_name || user?.user_metadata?.name || 'Suggested Content'}
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-6">
        <div className="space-y-8">

          {/* Section 1: Suggested Posts */}
          {activeTab === 'posts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-normal ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Suggested Posts</h2>
            </div>

            {/* Platform Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPostsFilter('all')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                  postsFilter === 'all'
                    ? isDarkMode
                      ? 'bg-white text-gray-900 shadow-md'
                      : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md'
                    : isDarkMode
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                }`}
              >
                All Platforms
              </button>
              {getAvailablePlatforms().map((platform) => {
                const platformKey = platform.toLowerCase()
                const isSelected = postsFilter === platformKey

                return (
                  <button
                    key={platformKey}
                    onClick={() => setPostsFilter(platformKey)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-shrink-0 ${
                      isSelected
                        ? isDarkMode
                          ? 'bg-white text-gray-900 shadow-md'
                          : 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-md'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-200 hover:bg-gray-600 border border-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {getPlatformIcon(platform, true)}
                    <span className="capitalize">{platform}</span>
                  </button>
                )
              })}
            </div>

            <div
              className="overflow-x-auto pb-4 scrollbar-transparent"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
                <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                  {getFilteredPosts().length > 0 ? (
                    getFilteredPosts().map((post) => (
                      <PostContentCard
                        key={post.id}
                        post={post}
                        isDarkMode={isDarkMode}
                        onCopy={handleCopyMessage}
                      />
                    ))
                  ) : (
                    <div className={`flex items-center justify-center py-8 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      Loading suggested content...
                    </div>
                  )}
                </div>
              </div>
          </div>
          )}

          {/* Section 2: Suggested Blogs */}
          {activeTab === 'blogs' && (
          <div className="space-y-4">
            <h2 className={`text-2xl font-normal ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Suggested Blogs</h2>

            <div
              className="overflow-x-auto pb-4 scrollbar-transparent"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
                <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                  {suggestedBlogs.length > 0 ? (
                    suggestedBlogs.map((blog) => (
                      <div
                        key={blog.id}
                        className={`flex-shrink-0 w-80 rounded-xl shadow-md border p-4 hover:shadow-lg transition-shadow cursor-pointer ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50 hover:shadow-gray-900/70'
                            : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <FileText className={`w-4 h-4 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                          <span className={`text-sm font-medium ${
                            isDarkMode ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            Blog
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(blog.status)} ${
                            isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                          }`}>
                            {blog.status || 'Draft'}
                          </span>
                        </div>

                              <h3 className={`font-normal mb-2 line-clamp-2 ${
                                isDarkMode ? 'text-gray-100' : 'text-gray-900'
                              }`}>
                                {blog.title || 'Untitled Blog'}
                              </h3>

                              <p className={`text-sm line-clamp-3 mb-3 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                          {(() => {
                            let displayText = blog.content || 'No content available';
                            if (displayText !== 'No content available') {
                              // Remove trailing )} patterns (with or without whitespace)
                              displayText = displayText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                              // Remove any standalone )} patterns throughout the text
                              displayText = displayText.replace(/\s*\)\s*\}\s*/g, '');
                              // Remove other common stray patterns: (, {, [, ], *, etc. at start/end
                              displayText = displayText.replace(/^[\(\[\{\*\)\]\}\s]*/g, '').replace(/[\(\[\{\*\)\]\}\s]*$/g, '').trim();
                              // Remove multiple consecutive braces/brackets
                              displayText = displayText.replace(/[\(\)\{\}\[\]\*]{2,}/g, '').trim();
                            }
                            return displayText;
                          })()}
                              </p>

                        <div className={`flex items-center justify-between text-xs ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <span>{new Date(blog.created_at).toLocaleDateString()}</span>
                          <button className="text-purple-600 hover:text-purple-700 font-medium">
                            View Details →
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`flex items-center justify-center py-8 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      No suggested blogs available
                    </div>
                  )}
                </div>
              </div>
          </div>
          )}

          {/* Section 3: Suggested Videos */}
          {activeTab === 'videos' && (
          <div className="space-y-4">
            <h2 className={`text-2xl font-normal ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Suggested Videos</h2>

            <div
              className="overflow-x-auto pb-4 scrollbar-transparent"
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
                <div className="flex gap-4" style={{ minWidth: 'max-content' }}>
                  {suggestedVideos.length > 0 ? (
                    suggestedVideos.map((video) => (
                      <div
                        key={video.id}
                        className={`flex-shrink-0 w-80 rounded-xl shadow-md border p-4 hover:shadow-lg transition-shadow cursor-pointer ${
              isDarkMode
                            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50 hover:shadow-gray-900/70'
                : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <Video className={`w-4 h-4 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                          <span className={`text-sm font-medium ${
                            isDarkMode ? 'text-gray-200' : 'text-gray-700'
                          }`}>
                            Video
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(video.status)} ${
                            isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                          }`}>
                            {video.status || 'Draft'}
                          </span>
                        </div>

                        <h3 className={`font-normal mb-2 line-clamp-2 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {video.title || 'Untitled Video'}
                        </h3>

                        <p className={`text-sm line-clamp-3 mb-3 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {(() => {
                            let displayText = video.content || 'No content available';
                            if (displayText !== 'No content available') {
                              // Remove trailing )} patterns (with or without whitespace)
                              displayText = displayText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                              // Remove any standalone )} patterns throughout the text
                              displayText = displayText.replace(/\s*\)\s*\}\s*/g, '');
                              // Remove other common stray patterns: (, {, [, ], *, etc. at start/end
                              displayText = displayText.replace(/^[\(\[\{\*\)\]\}\s]*/g, '').replace(/[\(\[\{\*\)\]\}\s]*$/g, '').trim();
                              // Remove multiple consecutive braces/brackets
                              displayText = displayText.replace(/[\(\)\{\}\[\]\*]{2,}/g, '').trim();
                            }
                            return displayText;
                          })()}
                        </p>

                        <div className={`flex items-center justify-between text-xs ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <span>{new Date(video.created_at).toLocaleDateString()}</span>
                          <button className="text-purple-600 hover:text-purple-700 font-medium">
                            View Details →
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={`flex items-center justify-center py-8 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      No suggested videos available
                    </div>
                  )}
                </div>
              </div>
          </div>
          )}
        </div>
        </div>
      </div>
    </div>
  )
}

export default PostSuggestionsDashboard