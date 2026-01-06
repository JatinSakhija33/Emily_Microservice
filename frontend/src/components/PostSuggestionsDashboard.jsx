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

  // Fetch suggested posts from post_contents table
  const fetchSuggestedPosts = async () => {
    try {
      const result = await contentAPI.getPostContents(50, 0)

      if (result.error) throw new Error(result.error)

      const posts = result.data || []
      console.log('Fetched post contents data:', posts.slice(0, 3)) // Log first 3 posts to see structure
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
    const colorClass = isDarkMode ? 'text-gray-400' : 'text-gray-600'

    switch (platformName?.toLowerCase()) {
      case 'facebook':
        return <Facebook className={`${iconSize} text-blue-600`} />
      case 'instagram':
        return <Instagram className={`${iconSize} text-pink-500`} />
      case 'linkedin':
        return <Linkedin className={`${iconSize} text-blue-700`} />
      case 'youtube':
        return <Youtube className={`${iconSize} text-red-600`} />
      case 'twitter':
      case 'x':
        return <X className={`${iconSize} text-black`} />
      case 'tiktok':
        return <div className={`${iconSize} bg-black rounded-sm flex items-center justify-center text-white text-xs`}>TT</div>
      default:
        return <Building2 className={`${iconSize} ${colorClass}`} />
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
                              {post.status || 'Generated'}
                            </span>
                          </div>

                          {/* Generated Image */}
                          {post.generated_image_url && (
                            <img
                              src={post.generated_image_url}
                              alt="Generated post image"
                              className="w-full aspect-square object-cover rounded-lg mb-3"
                              onError={(e) => {
                                console.log('Post image failed to load:', e.target.src, 'for post:', post.id)
                                e.target.style.display = 'none'
                              }}
                            />
                          )}

                          {/* Topic */}
                          {post.topic && (
                            <h3 className={`font-semibold mb-2 line-clamp-2 ${
                              isDarkMode ? 'text-gray-100' : 'text-gray-900'
                            }`}>
                              {post.topic}
                            </h3>
                          )}

                          {/* Generated Caption */}
                          {post.generated_caption && (
                            <p className={`text-sm line-clamp-3 mb-3 ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-600'
                            }`}>
                              {post.generated_caption}
                            </p>
                          )}

                          {/* Image Prompt */}
                          {post.image_prompt && (
                            <div className={`text-xs mb-2 p-2 rounded ${
                              isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-blue-50 text-blue-700'
                            }`}>
                              <strong>Image:</strong> {post.image_prompt}
                            </div>
                          )}

                          {/* Post Date/Time */}
                          {(post.post_date || post.post_time) && (
                            <div className={`text-xs mb-2 ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {post.post_date && <span>📅 {new Date(post.post_date).toLocaleDateString()}</span>}
                              {post.post_time && <span className="ml-2">🕒 {post.post_time}</span>}
                            </div>
                          )}

                          <div className={`flex items-center justify-between text-xs ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            <span>{new Date(post.created_at).toLocaleDateString()}</span>
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
                          }`}>
                            Blog
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(blog.status)} ${
                            isDarkMode ? 'bg-gray-700' : 'bg-gray-100'
                          }`}>
                            {blog.status || 'Draft'}
                          </span>
                        </div>

                        <h3 className={`font-semibold mb-2 line-clamp-2 ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {blog.title || 'Untitled Blog'}
                        </h3>

                        <p className={`text-sm line-clamp-3 mb-3 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {blog.content || 'No content available'}
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

          {/* Section 3: Suggested Videos */}
          <div className="space-y-4">
            <h2 className={`text-2xl font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Suggested Videos</h2>

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

                        <h3 className={`font-semibold mb-2 line-clamp-2 ${
                          isDarkMode ? 'text-gray-100' : 'text-gray-900'
                        }`}>
                          {video.title || 'Untitled Video'}
                        </h3>

                        <p className={`text-sm line-clamp-3 mb-3 ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {video.content || 'No content available'}
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
        </div>
      </div>
    </div>
  )
}

export default PostSuggestionsDashboard