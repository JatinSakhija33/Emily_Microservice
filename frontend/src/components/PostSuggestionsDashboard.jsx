import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { contentAPI } from '../services/content'
import { onboardingAPI } from '../services/onboarding'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
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
  const { showError } = useNotifications()

  // Profile state
  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // State for different sections
  const [suggestedPosts, setSuggestedPosts] = useState([])
  const [suggestedBlogs, setSuggestedBlogs] = useState([])
  const [suggestedVideos, setSuggestedVideos] = useState([])


  // Filter states
  const [postsFilter, setPostsFilter] = useState('all')

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

  // Fetch suggested posts using the same API as ContentDashboard
  const fetchSuggestedPosts = async () => {
    try {
      const result = await contentAPI.getAllContent(50, 0)

      if (result.error) throw new Error(result.error)

      const posts = result.data || []
      console.log('Fetched posts data:', posts.slice(0, 3)) // Log first 3 posts to see structure
      setSuggestedPosts(posts)
    } catch (error) {
      console.error('Error fetching suggested posts:', error)
      showError('Failed to load suggested posts')
    }
  }

  // Fetch suggested blogs using the same API, then filter for Blog channel
  const fetchSuggestedBlogs = async () => {
    try {
      const result = await contentAPI.getAllContent(50, 0)

      if (result.error) throw new Error(result.error)

      // Filter for Blog channel content
      const blogs = (result.data || []).filter(content =>
        content.channel?.toLowerCase() === 'blog'
      )

      setSuggestedBlogs(blogs.slice(0, 10))
    } catch (error) {
      console.error('Error fetching suggested blogs:', error)
      showError('Failed to load suggested blogs')
    }
  }

  // Fetch suggested videos (placeholder)
  const fetchSuggestedVideos = async () => {
    try {
      // Placeholder - to be implemented
      setSuggestedVideos([])
    } catch (error) {
      console.error('Error fetching suggested videos:', error)
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

  // Filter posts by platform
  const getFilteredPosts = () => {
    if (postsFilter === 'all') return suggestedPosts

    return suggestedPosts.filter(post => {
      const postPlatform = post.platform?.toLowerCase()?.trim() || ''
      const filterPlatform = postsFilter.toLowerCase().trim()

      // Handle Twitter/X normalization
      if (filterPlatform === 'twitter' && (postPlatform === 'x' || postPlatform === 'twitter')) {
        return true
      }

      return postPlatform === filterPlatform
    })
  }

  // State to track which container mouse is over
  const [activeContainer, setActiveContainer] = useState(null)

  // Global wheel handler - prevent default and scroll horizontally
  const handleGlobalWheel = useRef((e) => {
    console.log('Global wheel event triggered, activeContainer:', !!activeContainer)
    if (activeContainer) {
      console.log('Preventing default and scrolling horizontally')
      e.preventDefault()
      e.stopImmediatePropagation()

      const scrollAmount = e.deltaY * 0.8 // Adjust scroll sensitivity
      activeContainer.scrollLeft += scrollAmount
      console.log('Scrolled by:', scrollAmount, 'new scrollLeft:', activeContainer.scrollLeft)
    }
  })

  // Handle mouse entering cards section
  const handleMouseEnter = (e) => {
    console.log('Mouse entered cards section')
    const container = e.currentTarget
    setActiveContainer(container)
    document.body.style.overflow = 'hidden'
    // Add global wheel listener with capture
    window.addEventListener('wheel', handleGlobalWheel.current, {
      passive: false,
      capture: true,
      once: false
    })
    console.log('Added global wheel listener')
  }

  // Handle mouse leaving cards section
  const handleMouseLeave = (e) => {
    console.log('Mouse left cards section')
    setActiveContainer(null)
    document.body.style.overflow = 'auto'
    // Remove global wheel listener
    window.removeEventListener('wheel', handleGlobalWheel.current, { capture: true })
    console.log('Removed global wheel listener')
  }

  // Platform icon helper with theme support
  const getPlatformIcon = (platform, isInButton = false) => {
    const platformLower = platform?.toLowerCase()
    const iconClass = `w-4 h-4 ${isInButton ? (isDarkMode ? 'text-gray-300' : 'text-gray-600') : (isDarkMode ? 'text-gray-400' : 'text-gray-500')}`

    switch (platformLower) {
      case 'facebook':
        return <Facebook className={iconClass} />
      case 'instagram':
        return <Instagram className={iconClass} />
      case 'linkedin':
        return <Linkedin className={iconClass} />
      case 'youtube':
        return <Youtube className={iconClass} />
      case 'x':
      case 'twitter':
        return <X className={iconClass} />
      case 'google business':
      case 'google':
        return <Building2 className={iconClass} />
      default:
        return <Hash className={iconClass} />
    }
  }

  // Status color helper with dark mode support
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return isDarkMode ? 'text-green-400' : 'text-green-600'
      case 'scheduled':
        return isDarkMode ? 'text-blue-400' : 'text-blue-600'
      case 'draft':
        return isDarkMode ? 'text-gray-400' : 'text-gray-600'
      default:
        return isDarkMode ? 'text-gray-400' : 'text-gray-500'
    }
  }

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
    return () => {
      document.body.style.overflow = 'auto'
      window.removeEventListener('wheel', handleGlobalWheel.current, { capture: true })
    }
  }, [])

  if (!user) {
    console.log('User not authenticated, showing login message')
    return (
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'} flex items-center justify-center`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authenticated</h1>
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
      <div className={`md:ml-48 xl:ml-64 p-4 lg:p-6 overflow-y-auto custom-scrollbar ${
        isDarkMode ? 'dark-mode' : 'light-mode'
      }`}>
        <div className="space-y-8">

          {/* Section 1: Suggested Posts */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Suggested Posts</h2>
            </div>

            {/* Platform Filter Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setPostsFilter('all')}
                className={`px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                  postsFilter === 'all'
                    ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                    : isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-500'
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
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
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm font-medium ${
                      isSelected
                        ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm'
                        : isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:border-gray-500'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
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
                    getFilteredPosts().map((post) => {
                      const contentPlatform = post.platform?.toLowerCase().trim() || ''
                      const normalizedPlatform = contentPlatform === 'twitter' ? 'x' : contentPlatform

                      return (
                        <div
                          key={post.id}
                          className={`flex-shrink-0 w-80 rounded-xl shadow-md border p-4 hover:shadow-lg transition-shadow cursor-pointer ${
                            isDarkMode
                              ? 'bg-gray-800 border-gray-700 shadow-gray-900/50 hover:shadow-gray-900/70'
                              : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            {getPlatformIcon(normalizedPlatform, false)}
                            <span className={`text-sm font-medium capitalize ${
                              isDarkMode ? 'text-gray-200' : 'text-gray-700'
                            }`}>
                              {normalizedPlatform}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(post.status)} ${
                              isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                            }`}>
                              {post.status || 'Draft'}
                            </span>
                          </div>

                              {(post.primary_image_url || post.media_url || post.image_url) && (
                                <img
                                  src={post.primary_image_url || post.media_url || post.image_url}
                                  alt="Post preview"
                                  className="w-full aspect-square object-cover rounded-lg mb-3"
                                  onError={(e) => {
                                    console.log('Post image failed to load:', e.target.src, 'for post:', post.id)
                                    e.target.style.display = 'none'
                                  }}
                                />
                              )}

                              <h3 className={`font-semibold mb-2 line-clamp-2 ${
                                isDarkMode ? 'text-gray-100' : 'text-gray-900'
                              }`}>
                                {post.title || 'Untitled Post'}
                              </h3>

                              <p className={`text-sm line-clamp-3 mb-3 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {post.content || post.description || 'No content available'}
                              </p>

                          <div className={`flex items-center justify-between text-xs ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            <span>{new Date(post.scheduled_date || post.created_at).toLocaleDateString()}</span>
                            <button className="text-purple-600 hover:text-purple-700 font-medium">
                              View Details →
                            </button>
                          </div>
                        </div>
                      )
                    })
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

          {/* Section 2: Suggested Blogs */}
          <div className="space-y-4">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Suggested Blogs</h2>

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
                          }`}>Blog Post</span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(blog.status)} ${
                            isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                          }`}>
                            {blog.status || 'Draft'}
                          </span>
                        </div>

                              {(blog.primary_image_url || blog.media_url || blog.image_url) && (
                                <img
                                  src={blog.primary_image_url || blog.media_url || blog.image_url}
                                  alt="Blog preview"
                                  className="w-full h-32 object-cover rounded-lg mb-3"
                                  onError={(e) => {
                                    console.log('Blog image failed to load:', e.target.src)
                                    e.target.style.display = 'none'
                                  }}
                                />
                              )}

                              <h3 className={`font-semibold mb-2 line-clamp-2 ${
                                isDarkMode ? 'text-gray-100' : 'text-gray-900'
                              }`}>
                                {blog.title || 'Untitled Blog'}
                              </h3>

                              <p className={`text-sm line-clamp-3 mb-3 ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-600'
                              }`}>
                                {blog.content || blog.description || 'No content available'}
                              </p>

                        <div className={`flex items-center justify-between text-xs ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>
                          <span>{new Date(blog.scheduled_date || blog.created_at).toLocaleDateString()}</span>
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
                      Loading suggested content...
                    </div>
                  )}
                </div>
              </div>
          </div>

          {/* Section 3: Suggested Videos */}
          <div className="space-y-4">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Suggested Videos</h2>

            <div className={`rounded-xl shadow-md border p-8 ${
              isDarkMode
                ? 'bg-gray-800 border-gray-700 shadow-gray-900/50'
                : 'bg-white border-gray-200'
            }`}>
                <div className="text-center">
                  <Video className={`w-16 h-16 mx-auto mb-4 ${
                    isDarkMode ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                  <h3 className={`text-lg font-semibold mb-2 ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>Coming Soon</h3>
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                    Video suggestions will be available in a future update.
                  </p>
                </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default PostSuggestionsDashboard
