import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { useContentCache } from '../contexts/ContentCacheContext'
import { contentAPI } from '../services/content'
import mediaService from '../services/media'
import { supabase } from '../lib/supabase'
import ContentProgress from './ContentProgress'
import ContentGenerationModal from './ContentGenerationModal'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import CustomContentChatbot from './CustomContentChatbot'
import ChatbotImageEditor from './ChatbotImageEditor'
import MediaGenerationCelebration from './MediaGenerationCelebration'
import ContentModal from './ContentModal'
import DriveContentProcessingModal from './DriveContentProcessingModal'
import { fetchAllConnections } from '../services/fetchConnections'

const API_BASE_URL = (() => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '') // Remove all trailing slashes
  }
  
  // Fallback to production URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://agent-emily.onrender.com'
  }
  
  // Local development fallback
  return (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
})()
import { 
  Calendar, 
  Image, 
  Video,
  FileText, 
  Hash, 
  Clock, 
  TrendingUp, 
  Plus,
  RefreshCw,
  Edit,
  Edit3,
  Send,
  Download,
  Filter,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Target,
  Users,
  BarChart3,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Building2,
  Wand2,
  Loader2,
  Upload,
  X,
  CheckCircle,
  XCircle,
  Trash2,
  AlertTriangle,
  Share2,
  Play,
  Layers
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

const ContentDashboard = () => {
  const { user } = useAuth()
  const { showContentGeneration, showSuccess, showError, showLoading } = useNotifications()
  const [isDarkMode, setIsDarkMode] = useDarkMode()
  const {
    scheduledContent,
    contentDate,
    loading,
    fetchScheduledContent,
    updateContentInCache,
    getCacheStatus,
    clearCache,
    setScheduledContent,
    setContentDate,
    setLastFetchTime,
    setCacheValid
  } = useContentCache()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [generating, setGenerating] = useState(false)
  const [generationStatus, setGenerationStatus] = useState(null) // 'success', 'error', null
  const [generationMessage, setGenerationMessage] = useState('')
  const [showProgress, setShowProgress] = useState(false)
  const [showGenerationModal, setShowGenerationModal] = useState(false)
  const [showConfirmationModal, setShowConfirmationModal] = useState(false)
  const [generateImagesWithContent, setGenerateImagesWithContent] = useState(false)
  const [fetchingFreshData, setFetchingFreshData] = useState(false)
  const [fetchingContent, setFetchingContent] = useState(false) // Track if content is being fetched for selected channel
  const [loadingAllContent, setLoadingAllContent] = useState(false) // Track if loading all content
  const [hasMoreContent, setHasMoreContent] = useState(false) // Track if there's more content to load
  const [allDatesCount, setAllDatesCount] = useState(0) // Total number of dates found
  const [postingContent, setPostingContent] = useState(new Set()) // Track which content is being posted
  const [expandedCampaigns, setExpandedCampaigns] = useState(new Set()) // Track expanded campaigns
  const [selectedChannel, setSelectedChannel] = useState(null) // Current selected channel (null = not set yet, will default to first channel)
  const [availableChannels, setAvailableChannels] = useState([]) // Available channels from profile
  const [allContent, setAllContent] = useState([]) // All content fetched from API
  const [profile, setProfile] = useState(null) // User profile data
  const [channelContentCounts, setChannelContentCounts] = useState({}) // Content counts per channel
  const [editingContent, setEditingContent] = useState(null) // Content being edited
  const [editForm, setEditForm] = useState({}) // Edit form data
  const [saving, setSaving] = useState(false) // Saving state
  const [selectedContentForModal, setSelectedContentForModal] = useState(null) // Content selected for modal view
  
  // AI Edit state
  const [showAIEditModal, setShowAIEditModal] = useState(false) // AI edit modal
  const [aiEditInstruction, setAiEditInstruction] = useState('') // AI edit instruction
  const [aiEditing, setAiEditing] = useState(false) // AI editing state
  const [showAIConfirmModal, setShowAIConfirmModal] = useState(false) // AI edit confirmation modal
  const [aiEditedContent, setAiEditedContent] = useState('') // AI edited content to confirm
  const [aiEditType, setAiEditType] = useState(null) // 'title' or 'content'
  
  // Manual Edit state for modal
  const [editingTitleInModal, setEditingTitleInModal] = useState(false) // Editing title in modal
  const [editingContentInModal, setEditingContentInModal] = useState(false) // Editing content in modal
  const [editTitleValue, setEditTitleValue] = useState('') // Title edit value
  const [editContentValue, setEditContentValue] = useState('') // Content edit value
  const [savingModalEdit, setSavingModalEdit] = useState(false) // Saving modal edit state


  const [generatingMedia, setGeneratingMedia] = useState(new Set()) // Track which content is generating media
  
  // Refs to persist scheduled posts cache across renders
  const scheduledPostsCacheRef = useRef(new Map())
  const publishedPostsRef = useRef(new Set())
  const [uploadingImage, setUploadingImage] = useState(new Set()) // Track which content is uploading image
  const [showUploadModal, setShowUploadModal] = useState(null) // Track which content is showing upload modal
  const [lightboxImage, setLightboxImage] = useState(null) // Track which image to show in lightbox
  const [lightboxLoading, setLightboxLoading] = useState(false) // Track lightbox image loading state
  const [showScrollArrow, setShowScrollArrow] = useState(true) // Track if scroll arrow should be visible
  const [showImageEditor, setShowImageEditor] = useState(false) // Track if image editor is open
  const [imageEditorData, setImageEditorData] = useState(null) // Data for image editor
  const [selectedFile, setSelectedFile] = useState(null) // Selected file for upload
  const [previewUrl, setPreviewUrl] = useState(null) // Preview URL for selected file
  const [hoveredButton, setHoveredButton] = useState(null) // Track which button is being hovered
  const [imageLoading, setImageLoading] = useState(new Set()) // Track which images are loading
  const [showCustomContentChatbot, setShowCustomContentChatbot] = useState(false) // Custom content chatbot modal
  const [showDriveContentModal, setShowDriveContentModal] = useState(false) // Drive content processing modal
  const [deleteConfirm, setDeleteConfirm] = useState(null) // Content to delete confirmation
  const [deletingContent, setDeletingContent] = useState(new Set()) // Track which content is being deleted
  const [postNotification, setPostNotification] = useState(null) // Post success notification
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(null) // Track which content has status dropdown open
  const [updatingStatus, setUpdatingStatus] = useState(new Set()) // Track which content is updating status
  const [showCelebration, setShowCelebration] = useState(false) // Show celebration popup
  const [celebrationData, setCelebrationData] = useState(null) // Celebration data (imageUrl, generationTime)
  const [itemsToShow, setItemsToShow] = useState(4) // Number of content items to show initially (one row = 4 columns)
  const [carouselIndices, setCarouselIndices] = useState({}) // Track current slide index for each carousel post
  const [socialMediaConnections, setSocialMediaConnections] = useState([]) // Track connected social media accounts


  useEffect(() => {
    // Load all data asynchronously without blocking
    Promise.resolve().then(() => {
    fetchData()
    fetchAllContent()
      fetchConnections()
    })
  }, [])

  // Fetch social media connections
  const fetchConnections = async () => {
    try {
      const connections = await fetchAllConnections()
      setSocialMediaConnections(connections || [])
    } catch (error) {
      console.error('Error fetching connections:', error)
      setSocialMediaConnections([])
    }
  }

  // Check if a platform has a connected account
  const isPlatformConnected = (platform) => {
    if (!platform) return false
    
    const normalizedPlatform = platform.toLowerCase().trim()
    
    // Check if any connection matches this platform
    return socialMediaConnections.some(conn => {
      const connPlatform = conn.platform?.toLowerCase().trim() || ''
      
      // Direct match
      if (connPlatform === normalizedPlatform) {
        return conn.is_active !== false && (conn.connection_status === 'active' || !conn.connection_status)
      }
      
      // Special cases for platform name variations
      if (normalizedPlatform === 'twitter' || normalizedPlatform === 'x') {
        return (connPlatform === 'twitter' || connPlatform === 'x') && 
               conn.is_active !== false && 
               (conn.connection_status === 'active' || !conn.connection_status)
      }
      
      if (normalizedPlatform === 'youtube') {
        return connPlatform === 'youtube' && 
               conn.is_active !== false && 
               (conn.connection_status === 'active' || !conn.connection_status)
      }
      
      return false
    })
  }

  // Close status dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownOpen && !event.target.closest('.status-dropdown')) {
        setStatusDropdownOpen(null)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [statusDropdownOpen])

  // Cleanup preview URL when previewUrl changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  // Fetch profile to get available channels (Digital Marketing Platforms)
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!user?.id) return
        
        const { data, error } = await supabase
          .from('profiles')
          .select('social_media_platforms, logo_url, business_name')
          .eq('id', user.id)
          .single()
        
        if (error) {
          console.error('Error fetching profile:', error)
          return
        }
        
        if (data) {
          setProfile(data)
          // Extract channels from profile's social_media_platforms
          const platforms = data.social_media_platforms || []
          
          // Map profile platform names to content platform format
          const platformMapping = {
            'instagram': 'instagram',
            'facebook': 'facebook',
            'linkedin': 'linkedin',
            'youtube': 'youtube',
            'pinterest': 'pinterest',
            'x (twitter)': 'twitter',
            'x': 'twitter',
            'twitter': 'twitter',
            'tiktok': 'tiktok',
            'whatsapp business': 'whatsapp',
            'whatsapp': 'whatsapp',
            'google business profile': 'google business profile',
            'google business': 'google business profile',
            'snapchat': 'snapchat',
            'quora': 'quora',
            'reddit': 'reddit'
          }
          
          // Normalize platform names to match content platform format
          const normalizedPlatforms = platforms.map(p => {
            const platformKey = p.toLowerCase().trim()
            // Check if we have a mapping
            if (platformMapping[platformKey]) {
              return platformMapping[platformKey]
            }
            // Fallback: use lowercase version
            return platformKey
          })
          
          // Remove duplicates and sort
          const uniquePlatforms = Array.from(new Set(normalizedPlatforms)).sort()
          setAvailableChannels(uniquePlatforms)
          console.log('Channels from profile:', uniquePlatforms)
          console.log('Original platforms from profile:', platforms)
          
          // Auto-select first channel to show its content
          if (uniquePlatforms.length > 0 && selectedChannel === null) {
            setSelectedChannel(uniquePlatforms[0])
          }
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      }
    }
    
    fetchProfile()
  }, [user])

  // Calculate content counts for all channels using scheduledContent
  useEffect(() => {
    if (availableChannels.length > 0 && scheduledContent) {
      const counts = {}
      for (const channel of availableChannels) {
        const normalizedChannel = channel.toLowerCase().trim()
        const channelCount = scheduledContent.filter(content => {
          const contentPlatform = content.platform?.toLowerCase().trim() || ''
          return contentPlatform === normalizedChannel ||
            (normalizedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) ||
            (normalizedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) ||
            (normalizedChannel === 'google business profile' && contentPlatform.includes('google'))
        }).length
        
        if (channelCount > 0) {
          counts[channel] = channelCount
        }
      }
      setChannelContentCounts(counts)
    }
  }, [availableChannels, scheduledContent])

  // Refresh content when generation completes or channel changes
  useEffect(() => {
    if (!generating && !fetchingFreshData && selectedChannel) {
      // Reset load more state when channel changes
      setHasMoreContent(false)
      setLoadingAllContent(false)
      setItemsToShow(4) // Reset to show only one row (4 columns)
      // Load content asynchronously
      Promise.resolve().then(() => fetchAllContent())
    }
  }, [generating, fetchingFreshData, selectedChannel])

  // Auto-publish scheduled posts when their time arrives (client-side check with continuous monitoring)
  useEffect(() => {
    if (!allContent || allContent.length === 0) return

    const scheduledPostsCache = scheduledPostsCacheRef.current
    const publishedPosts = publishedPostsRef.current
    let checkInterval = null

    // Build cache of scheduled posts (always includes all scheduled posts)
    const buildCache = () => {
      // Update cache with current content
      allContent.forEach(content => {
        if (content.status === 'scheduled' && content.scheduled_at) {
          try {
            const scheduledTime = new Date(content.scheduled_at)
            if (!isNaN(scheduledTime.getTime())) {
              // Only add/update if not already published or being posted
              if (!publishedPosts.has(content.id) && !postingContent.has(content.id)) {
                scheduledPostsCache.set(content.id, {
                  content,
                  scheduledTime,
                  addedAt: Date.now()
                })
              }
            }
          } catch (error) {
            console.error(`Error parsing scheduled time for post ${content.id}:`, error)
          }
        } else {
          // Remove from cache if status changed from scheduled
          scheduledPostsCache.delete(content.id)
        }
      })
    }

    // Check and publish scheduled posts
    const checkAndPublishScheduledPosts = async () => {
      const now = new Date()
      const postsToPublish = []

      // Check all cached scheduled posts
      scheduledPostsCache.forEach((cached, postId) => {
        // Skip if already being posted or published
        if (postingContent.has(postId) || publishedPosts.has(postId)) {
          return
        }

        const { content, scheduledTime } = cached
        
        // Skip if post is already published (check status)
        const status = content.status?.toLowerCase()
        if (status === 'published') {
          console.log(`⏰ Skipping post ${postId} - already published`)
          publishedPosts.add(postId)
          scheduledPostsCache.delete(postId)
          return
        }
        
        // Check if backend is already publishing this post (prevent duplicate publishing)
        const isPublishing = content.metadata?._publishing === true
        if (isPublishing) {
          console.log(`⏰ Skipping post ${postId} - backend is already publishing`)
          return
        }
        
        const timeDiff = now - scheduledTime

        // Check if scheduled time has passed (with 10 minute window to catch late posts)
        if (timeDiff >= 0 && timeDiff < 600000) { // 10 minutes window
          postsToPublish.push(content)
          // Mark as published to avoid duplicate attempts
          publishedPosts.add(postId)
        }
      })

      // Publish each post that's ready
      for (const content of postsToPublish) {
        try {
          // Query database for fresh status before publishing (prevent duplicate publishing)
          const freshStatus = await fetchPostStatusFromDB(content.id)
          if (freshStatus === 'published') {
            console.log(`⏰ Skipping post ${content.id} - already published in database`)
            publishedPosts.add(content.id)
            scheduledPostsCache.delete(content.id)
            continue
          }
          
          // Double-check publishing flag from fresh data
          if (freshStatus === null) {
            // If we can't fetch status, check the content metadata again
            const isPublishing = content.metadata?._publishing === true
            if (isPublishing) {
              console.log(`⏰ Skipping post ${content.id} - backend is publishing (from metadata)`)
              continue
            }
          }
          
          console.log(`⏰ Auto-publishing scheduled post ${content.id} (scheduled for ${content.scheduled_at})`)
          await handlePostContent(content)
          // Remove from cache after successful publishing
          scheduledPostsCache.delete(content.id)
          // Refresh content after successful publishing
          setTimeout(() => {
            fetchAllContent()
          }, 2000) // Wait 2 seconds for backend to update
        } catch (error) {
          console.error(`Error auto-publishing post ${content.id}:`, error)
          // Remove from published set on error so it can be retried after cache rebuild
          publishedPosts.delete(content.id)
        }
      }
    }

    // Build cache immediately when content changes
    buildCache()

    // Check immediately
    checkAndPublishScheduledPosts()

    // Check every 10 seconds for very responsive publishing (catches posts scheduled 3 min before)
    checkInterval = setInterval(() => {
      // Rebuild cache to pick up newly scheduled posts
      buildCache()
      checkAndPublishScheduledPosts()
    }, 10000) // Check every 10 seconds for continuous monitoring

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContent, postingContent]) // Re-run when content or posting state changes

  // Set first channel as default when channels become available
  useEffect(() => {
    if (availableChannels.length > 0 && selectedChannel === null) {
      setSelectedChannel(availableChannels[0])
    }
  }, [availableChannels, selectedChannel])

  const fetchData = async (forceRefresh = false) => {
    try {
      const result = await fetchScheduledContent(forceRefresh)
      
      console.log('Fetched content data:', result)
      console.log('Cache status:', getCacheStatus())
      
      if (result.data) {
        console.log('Content items:', result.data)
        console.log('Platform values in content:', result.data.map(item => ({ id: item.id, platform: item.platform })))
        console.log('Data source:', result.fromCache ? 'cache' : 'API')
        
        // Images are now loaded directly from content_posts.primary_image_url
        
        // Refresh all content and channels after content is loaded
        await fetchAllContent()
      }
    } catch (error) {
      console.error('Error fetching scheduled content:', error)
    }
  }

  // Fetch content only for the selected channel
  // Only fetch content for 8 oldest dates (from bottom) to optimize performance
  const fetchAllContent = async () => {
    try {
      // Don't fetch if no channel is selected
      if (!selectedChannel) {
        console.log('No channel selected, skipping content fetch')
        setFetchingContent(false)
        return
      }
      
      // If "all" is selected, don't fetch (or fetch for all channels - but user wants only selected channel)
      if (selectedChannel === 'all') {
        console.log('"All" channel selected - not fetching content (only fetch for specific channel)')
        setAllContent([])
        setFetchingContent(false)
        return
      }
      
      // Set loading state
      setFetchingContent(true)
      console.log(`Fetching content for channel "${selectedChannel}" - 8 oldest dates (from bottom)...`)
      
      const allDates = new Set()
      const allDateToContentMap = new Map() // Map date -> array of content (all dates)
      const contentWithoutDates = []
      let offset = 0
      const batchSize = 50
      const maxDates = 8
      let hasMoreData = true
      
      // Normalize selected channel for comparison
      const normalizedSelectedChannel = selectedChannel.toLowerCase()
      
      // Fetch in batches to collect dates
      // Since backend returns newest first (desc), we fetch enough to likely get 8 oldest dates
      // We'll fetch a reasonable number of batches (enough to cover date range)
      const maxBatches = 10 // Fetch up to 10 batches (500 items) to ensure we get enough date coverage
      let batchCount = 0
      
      while (hasMoreData && batchCount < maxBatches) {
        // Use setTimeout to yield to the event loop between batches (non-blocking)
        if (batchCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        
        const result = await contentAPI.getAllContent(batchSize, offset)
        
        if (!result.data || result.data.length === 0) {
          hasMoreData = false
          break
        }
        
        console.log(`Fetched batch ${batchCount + 1}: ${result.data.length} items, offset: ${offset}`)
        console.log(`Looking for channel: "${normalizedSelectedChannel}"`)
        console.log(`Platforms in this batch:`, [...new Set(result.data.map(c => c.platform?.toLowerCase().trim()).filter(Boolean))])
        
        // Process this batch and track all dates - ONLY for selected channel
        let matchedInBatch = 0
        for (const content of result.data) {
          // Filter by selected channel - normalize platform name for comparison
          const contentPlatform = content.platform?.toLowerCase().trim() || ''
          
          // Skip content that doesn't match the selected channel
          // Handle variations: "x (twitter)" -> "twitter", "whatsapp business" -> "whatsapp", etc.
          let matchesChannel = false
          if (contentPlatform === normalizedSelectedChannel) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'google business profile' && contentPlatform.includes('google')) {
            matchesChannel = true
          }
          
          if (!matchesChannel) {
            continue
          }
          
          matchedInBatch++
          
          if (content.scheduled_at) {
            // Extract date from scheduled_at (format: "YYYY-MM-DDTHH:mm:ss" or "YYYY-MM-DD")
            const dateStr = content.scheduled_at.split('T')[0]
            allDates.add(dateStr)
            
            // Group content by date (store all dates)
            if (!allDateToContentMap.has(dateStr)) {
              allDateToContentMap.set(dateStr, [])
            }
            allDateToContentMap.get(dateStr).push(content)
          } else {
            // Store content without dates separately (only if it matches the channel)
            contentWithoutDates.push(content)
          }
        }
        
        console.log(`Matched ${matchedInBatch} items in batch ${batchCount + 1} for channel "${normalizedSelectedChannel}"`)
        
        // If we got fewer items than batch size, we're done
        if (result.data.length < batchSize) {
          hasMoreData = false
        } else {
          offset += batchSize
          batchCount++
        }
      }
      
      // Sort all dates in ascending order (oldest first) and take the 8 oldest
      const sortedDates = Array.from(allDates).sort()
      const selectedDates = sortedDates.slice(0, maxDates)
      
      // Track if there's more content to load
      setAllDatesCount(sortedDates.length)
      setHasMoreContent(sortedDates.length > maxDates)
      
      console.log(`Found ${allDates.size} unique dates for channel "${selectedChannel}", selecting 8 oldest:`, selectedDates)
      
      // Collect content from the 8 oldest dates
      const filteredContent = []
      for (const date of selectedDates) {
        const contentForDate = allDateToContentMap.get(date) || []
        filteredContent.push(...contentForDate)
      }
      
      // Add content without dates at the end
      filteredContent.push(...contentWithoutDates)
      
      console.log(`Filtered to ${filteredContent.length} items from ${selectedDates.length} dates for channel "${selectedChannel}"`)
      console.log('Selected dates (oldest first):', selectedDates)
      console.log('Sample content platforms:', filteredContent.slice(0, 3).map(c => ({ id: c.id, platform: c.platform })))
      
      // Update state asynchronously to avoid blocking
      setTimeout(() => {
      if (filteredContent.length > 0) {
        setAllContent(filteredContent)
        console.log(`✅ Set allContent with ${filteredContent.length} items for channel "${selectedChannel}"`)
        
        // Images are now loaded directly from content_posts.primary_image_url
      } else {
        setAllContent([])
        console.log(`No content found for channel "${selectedChannel}"`)
      }
      
      // Set loading state to false after fetch completes
      setFetchingContent(false)
      }, 0)
    } catch (error) {
      console.error('Error fetching all content:', error)
      setAllContent([])
      setFetchingContent(false)
    }
  }

  // Load all content for the selected channel (all dates, not just 8)
  const loadAllContent = async () => {
    try {
      // Don't fetch if no channel is selected
      if (!selectedChannel) {
        console.log('No channel selected, skipping content fetch')
        return
      }
      
      // If "all" is selected, don't fetch
      if (selectedChannel === 'all') {
        console.log('"All" channel selected - not fetching content')
        return
      }
      
      // Set loading state
      setLoadingAllContent(true)
      console.log(`Loading all content for channel "${selectedChannel}"...`)
      
      const allDates = new Set()
      const allDateToContentMap = new Map() // Map date -> array of content
      const contentWithoutDates = []
      let offset = 0
      const batchSize = 50
      let hasMoreData = true
      
      // Normalize selected channel for comparison
      const normalizedSelectedChannel = selectedChannel.toLowerCase()
      
      // Fetch in batches to collect all dates
      const maxBatches = 20 // Fetch up to 20 batches (1000 items) to get all content
      let batchCount = 0
      
      while (hasMoreData && batchCount < maxBatches) {
        // Use setTimeout to yield to the event loop between batches (non-blocking)
        if (batchCount > 0) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
        
        const result = await contentAPI.getAllContent(batchSize, offset)
        
        if (!result.data || result.data.length === 0) {
          hasMoreData = false
          break
        }
        
        console.log(`Fetched batch ${batchCount + 1}: ${result.data.length} items, offset: ${offset}`)
        
        // Process this batch and track all dates - ONLY for selected channel
        let matchedInBatch = 0
        for (const content of result.data) {
          // Filter by selected channel - normalize platform name for comparison
          const contentPlatform = content.platform?.toLowerCase().trim() || ''
          
          // Skip content that doesn't match the selected channel
          let matchesChannel = false
          if (contentPlatform === normalizedSelectedChannel) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) {
            matchesChannel = true
          } else if (normalizedSelectedChannel === 'google business profile' && contentPlatform.includes('google')) {
            matchesChannel = true
          }
          
          if (!matchesChannel) {
            continue
          }
          
          matchedInBatch++
          
          if (content.scheduled_at) {
            // Extract date from scheduled_at
            const dateStr = content.scheduled_at.split('T')[0]
            allDates.add(dateStr)
            
            // Group content by date
            if (!allDateToContentMap.has(dateStr)) {
              allDateToContentMap.set(dateStr, [])
            }
            allDateToContentMap.get(dateStr).push(content)
          } else {
            // Store content without dates separately
            contentWithoutDates.push(content)
          }
        }
        
        console.log(`Matched ${matchedInBatch} items in batch ${batchCount + 1} for channel "${normalizedSelectedChannel}"`)
        
        // If we got fewer items than batch size, we're done
        if (result.data.length < batchSize) {
          hasMoreData = false
        } else {
          offset += batchSize
          batchCount++
        }
      }
      
      // Sort all dates in ascending order (oldest first) - load ALL dates
      const sortedDates = Array.from(allDates).sort()
      
      console.log(`Found ${allDates.size} unique dates for channel "${selectedChannel}", loading all dates`)
      
      // Collect content from ALL dates
      const allFilteredContent = []
      for (const date of sortedDates) {
        const contentForDate = allDateToContentMap.get(date) || []
        allFilteredContent.push(...contentForDate)
      }
      
      // Add content without dates at the end
      allFilteredContent.push(...contentWithoutDates)
      
      console.log(`Loaded ${allFilteredContent.length} items from ${sortedDates.length} dates for channel "${selectedChannel}"`)
      
      // Update state asynchronously to avoid blocking
      setTimeout(() => {
      if (allFilteredContent.length > 0) {
        setAllContent(allFilteredContent)
        setHasMoreContent(false) // No more content to load
        setAllDatesCount(sortedDates.length)
        console.log(`✅ Set allContent with ${allFilteredContent.length} items for channel "${selectedChannel}"`)
        
        // Images are now loaded directly from content_posts.primary_image_url
      } else {
        setAllContent([])
        console.log(`No content found for channel "${selectedChannel}"`)
      }
      
      // Set loading state to false after fetch completes
      setLoadingAllContent(false)
      }, 0)
    } catch (error) {
      console.error('Error loading all content:', error)
      setAllContent([])
      setLoadingAllContent(false)
    }
  }

  const handleProgressComplete = async () => {
    console.log('Content generation completed, fetching fresh data...')
    setShowProgress(false)
    setGenerating(false)
    setShowGenerationModal(false)
    setFetchingFreshData(true) // Start loading state
    
    // Clear cache completely to ensure fresh data
    clearCache()
    
    // Wait a moment for the backend to finish storing the content
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Fetch fresh data directly from API (bypassing cache)
    try {
      const result = await contentAPI.getScheduledContent()
      if (result.data) {
        // Update the cache with fresh data
        setScheduledContent(result.data)
        setContentDate(result.date)
        setLastFetchTime(Date.now())
        setCacheValid(true)
        
        setFetchingFreshData(false) // End loading state
        await fetchAllContent() // Refresh all content and channels after content generation
        showSuccess('Content Generated!', 'Your new content is ready to view.')
      }
    } catch (error) {
      console.error('Error fetching fresh content:', error)
      setFetchingFreshData(false) // End loading state
      // Fallback to page refresh if API fails
      window.location.reload()
    }
  }

  const handleGenerateContent = () => {
    setShowConfirmationModal(true)
  }

  const handleConfirmGeneration = async () => {
    setShowConfirmationModal(false)
    const shouldGenerateImages = generateImagesWithContent
    setGenerateImagesWithContent(false) // Reset checkbox
    
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      setShowGenerationModal(true)
      setFetchingFreshData(false) // Reset data fetching state
      
      const result = await contentAPI.generateContent(shouldGenerateImages)
      
      if (result.data) {
        // Don't set generating to false here - let the modal handle it
        // The modal will call onComplete when generation is done
        
      } else if (result.error) {
        setGenerationStatus('error')
        setShowGenerationModal(false)
        setGenerating(false)
        
        let errorMessage = 'Failed to start content generation. Please try again.'
        
        if (result.error.message?.includes('onboarding')) {
          errorMessage = 'Please complete your onboarding first before generating content.'
        } else if (result.error.message?.includes('platforms')) {
          errorMessage = 'Please configure your social media platforms in your profile first.'
        } else {
          errorMessage = result.error.message || errorMessage
        }
        
        setGenerationMessage(errorMessage)
        showError('Content Generation Failed', errorMessage)
      }
    } catch (error) {
      console.error('Error generating content:', error)
      setGenerationStatus('error')
      setShowGenerationModal(false)
      setGenerating(false)
      setGenerationMessage('An unexpected error occurred. Please try again.')
      showError('Content Generation Error', 'An unexpected error occurred. Please try again.')
    }
  }

  const handleTriggerWeekly = async () => {
    try {
      setGenerating(true)
      setGenerationStatus(null)
      setGenerationMessage('')
      setShowGenerationModal(true)
      
      const API_BASE_URL = (() => {
  // Check for environment variable first
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/+$/, '') // Remove all trailing slashes
  }
  
  // Fallback to production URL
  if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return 'https://agent-emily.onrender.com'
  }
  
  // Local development fallback
  return (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
})()
      const response = await fetch(`${API_BASE_URL}/content/trigger-weekly`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Don't set generating to false here - let the modal handle it
      } else {
        setGenerationStatus('error')
        setShowGenerationModal(false)
        setGenerating(false)
        setGenerationMessage(data.message || 'Weekly generation failed')
        showError('Weekly Generation Failed', data.message || 'Weekly generation failed')
      }
    } catch (error) {
      console.error('Error triggering weekly generation:', error)
      setGenerationStatus('error')
      setShowGenerationModal(false)
      setGenerating(false)
      setGenerationMessage('Weekly generation failed. Please try again.')
      showError('Weekly Generation Error', 'Weekly generation failed. Please try again.')
    }
  }

  const toggleCampaignExpansion = (campaignId) => {
    const newExpanded = new Set(expandedCampaigns)
    if (newExpanded.has(campaignId)) {
      newExpanded.delete(campaignId)
    } else {
      newExpanded.add(campaignId)
    }
    setExpandedCampaigns(newExpanded)
  }

  // Filter content by selected channel
  // Hide content during generation and data fetching to prevent showing old/incomplete content
  const contentToDisplay = (generating || fetchingFreshData)
    ? [] 
    : allContent

  // Debug logging for content display
  console.log('Content Dashboard Debug:', {
    selectedChannel,
    availableChannels,
    allContentLength: allContent.length,
    contentToDisplayLength: contentToDisplay.length,
    generating,
    fetchingFreshData
  })
  
  // Filter content by selected channel
  // Note: fetchAllContent already filters by channel, but we do a final check here for safety
  const filteredContent = contentToDisplay
    .filter(content => {
      if (!selectedChannel) {
        return false // Don't show content until a channel is selected
      }
      if (selectedChannel === 'all') {
        return true // Show all content when 'all' is selected
      }
      // Case-insensitive comparison with platform name variations
      const contentPlatform = content.platform?.toLowerCase().trim() || ''
      const normalizedChannel = selectedChannel.toLowerCase().trim()
      
      // Direct match
      if (contentPlatform === normalizedChannel) {
        return true
      }
      
      // Handle variations
      if (normalizedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) {
        return true
      }
      if (normalizedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) {
        return true
      }
      if (normalizedChannel === 'google business profile' && contentPlatform.includes('google')) {
        return true
      }
      
      return false
    })
    .sort((a, b) => {
      // Prioritize scheduled posts first
      const aIsScheduled = a.status?.toLowerCase() === 'scheduled'
      const bIsScheduled = b.status?.toLowerCase() === 'scheduled'
      
      // Scheduled posts first
      if (aIsScheduled && !bIsScheduled) return -1
      if (!aIsScheduled && bIsScheduled) return 1
      
      // Within scheduled posts, sort by scheduled_at in ascending order (earliest dates first)
      if (aIsScheduled && bIsScheduled) {
        if (!a.scheduled_at && !b.scheduled_at) return 0
        if (!a.scheduled_at) return 1
        if (!b.scheduled_at) return -1
        const dateA = new Date(a.scheduled_at).getTime()
        const dateB = new Date(b.scheduled_at).getTime()
        return dateA - dateB
      }
      
      // Then prioritize scripts (content with video_scripting) and drafts
      const aIsScript = a.video_scripting && typeof a.video_scripting === 'object'
      const bIsScript = b.video_scripting && typeof b.video_scripting === 'object'
      const aIsDraft = a.status?.toLowerCase() === 'draft'
      const bIsDraft = b.status?.toLowerCase() === 'draft'
      
      // Scripts next, then drafts, then others
      if (aIsScript && !bIsScript) return -1
      if (!aIsScript && bIsScript) return 1
      if (aIsDraft && !bIsDraft && !aIsScript && !bIsScript) return -1
      if (!aIsDraft && bIsDraft && !aIsScript && !bIsScript) return 1
      
      // Within same priority, sort by scheduled_at in ascending order (earliest dates first)
      // Content without dates goes to the end of their priority group
      if (!a.scheduled_at && !b.scheduled_at) return 0
      if (!a.scheduled_at) return 1
      if (!b.scheduled_at) return -1
      const dateA = new Date(a.scheduled_at).getTime()
      const dateB = new Date(b.scheduled_at).getTime()
      return dateA - dateB
    })

  // Custom Pinterest Icon Component
  const PinterestIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.49-.09-.79-.17-2.01.03-2.87.18-.78 1.16-4.97 1.16-4.97s-.3-.6-.3-1.48c0-1.38.8-2.41 1.8-2.41.85 0 1.26.64 1.26 1.4 0 .85-.54 2.12-.82 3.3-.23.94.48 1.7 1.42 1.7 1.71 0 3.02-1.8 3.02-4.4 0-2.3-1.67-3.91-4.05-3.91-2.76 0-4.38 2.07-4.38 4.2 0 .82.32 1.7.72 2.19.08.1.09.19.07.29l-.28 1.12c-.04.16-.13.2-.3.12-1.12-.52-1.82-2.15-1.82-3.46 0-2.83 2.06-5.43 5.94-5.43 3.12 0 5.54 2.22 5.54 5.19 0 3.1-1.95 5.59-4.73 5.59-.93 0-1.8-.48-2.1-1.18l-.57 2.18c-.21.81-.78 1.83-1.16 2.45 1.19.37 2.45.57 3.78.57 5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
    </svg>
  )

  const getPlatformIcon = (platform) => {
    // Normalize platform name to lowercase for consistent matching
    const normalizedPlatform = platform?.toLowerCase()?.trim()
    
    const icons = {
      facebook: Facebook,
      instagram: Instagram,
      linkedin: Linkedin,
      twitter: X,
      'twitter/x': X,
      'x': X,
      tiktok: 'custom', // Special case for TikTok
      youtube: Youtube,
      pinterest: PinterestIcon,
      'google-business': Building2,
      'google-my-business': Building2,
      'google business profile': Building2,
      'google business': Building2,
      unknown: 'custom' // Special case for unknown
    }
    
    // Debug log to see what platform values we're getting
    console.log('Platform icon requested for:', platform, 'normalized to:', normalizedPlatform)
    console.log('Available icon keys:', Object.keys(icons))
    
    let Icon = icons[normalizedPlatform]
    console.log('Icon found for', normalizedPlatform, ':', Icon)
    
    // Try alternative variations for Twitter/X
    if (!Icon && (normalizedPlatform.includes('twitter') || normalizedPlatform.includes('x'))) {
      console.log('Trying alternative Twitter/X variations...')
      if (normalizedPlatform.includes('twitter')) {
        Icon = icons['twitter'] || icons['twitter/x'] || icons['x']
      } else if (normalizedPlatform.includes('x')) {
        Icon = icons['x'] || icons['twitter'] || icons['twitter/x']
      }
      console.log('Alternative icon found:', Icon)
    }
    
    // Try alternative variations for Google Business
    if (!Icon && (normalizedPlatform.includes('google') && normalizedPlatform.includes('business'))) {
      console.log('Trying alternative Google Business variations...')
      Icon = icons['google business profile'] || icons['google business'] || icons['google-business'] || icons['google-my-business']
      console.log('Alternative Google Business icon found:', Icon)
    }
    
    if (Icon) {
      // Handle custom cases
      if (Icon === 'custom') {
        if (normalizedPlatform === 'tiktok') {
          return <div className="w-5 h-5 bg-black rounded text-white flex items-center justify-center text-xs font-bold">TT</div>
        }
        if (normalizedPlatform === 'unknown') {
          return <div className="w-5 h-5 bg-gray-500 rounded text-white flex items-center justify-center text-xs">?</div>
        }
      }
      // Handle Lucide React components and custom components
      console.log('Rendering icon:', Icon, 'for platform:', normalizedPlatform)
      // Check if it's a React component (function) or Lucide icon
      if (typeof Icon === 'function') {
        return <Icon className="w-5 h-5" />
      }
      return <Icon className="w-5 h-5" />
    }
    
    // Fallback with debug info
    console.warn('Unknown platform:', platform, 'normalized:', normalizedPlatform)
    return <div className="w-5 h-5 bg-gray-400 rounded text-white flex items-center justify-center text-xs" title={`Unknown platform: ${platform}`}>?</div>
  }

  const getPlatformColor = (platform) => {
    const colors = {
      facebook: 'from-blue-500 to-blue-600',
      instagram: 'from-pink-500 to-purple-600',
      linkedin: 'from-blue-600 to-blue-700',
      twitter: 'from-gray-800 to-black',
      tiktok: 'from-black to-gray-800',
      youtube: 'from-red-500 to-red-600'
    }
    return colors[platform] || 'from-gray-500 to-gray-600'
  }

  const getPlatformCardTheme = (platform) => {
    // Normalize platform name to lowercase for consistent matching
    const normalizedPlatform = platform?.toLowerCase()?.trim()

    const themes = isDarkMode ? {
      // Dark mode themes
      facebook: {
        bg: 'bg-gray-800/80',
        border: 'border-blue-700/50',
        iconBg: 'bg-blue-600',
        text: 'text-blue-400',
        accent: 'bg-blue-900/50'
      },
      instagram: {
        bg: 'bg-gray-800/80',
        border: 'border-pink-700/50',
        iconBg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500',
        text: 'text-pink-400',
        accent: 'bg-pink-900/50'
      },
      linkedin: {
        bg: 'bg-gray-800/80',
        border: 'border-blue-700/50',
        iconBg: 'bg-blue-700',
        text: 'text-blue-400',
        accent: 'bg-blue-900/50'
      },
      twitter: {
        bg: 'bg-gray-800/80',
        border: 'border-sky-700/50',
        iconBg: 'bg-sky-500',
        text: 'text-sky-400',
        accent: 'bg-sky-900/50'
      },
      'twitter/x': {
        bg: 'bg-gray-800/80',
        border: 'border-sky-700/50',
        iconBg: 'bg-sky-500',
        text: 'text-sky-400',
        accent: 'bg-sky-900/50'
      },
      'x': {
        bg: 'bg-gray-800/80',
        border: 'border-sky-700/50',
        iconBg: 'bg-sky-500',
        text: 'text-sky-400',
        accent: 'bg-sky-900/50'
      },
      tiktok: {
        bg: 'bg-gray-800/80',
        border: 'border-gray-700/50',
        iconBg: 'bg-black',
        text: 'text-gray-400',
        accent: 'bg-gray-900/50'
      },
      youtube: {
        bg: 'bg-gray-800/80',
        border: 'border-red-700/50',
        iconBg: 'bg-red-600',
        text: 'text-red-400',
        accent: 'bg-red-900/50'
      },
      'google business profile': {
        bg: 'bg-gray-800/80',
        border: 'border-green-700/50',
        iconBg: 'bg-green-600',
        text: 'text-green-400',
        accent: 'bg-green-900/50'
      },
      'google business': {
        bg: 'bg-gray-800/80',
        border: 'border-green-700/50',
        iconBg: 'bg-green-600',
        text: 'text-green-400',
        accent: 'bg-green-900/50'
      },
      'google-business': {
        bg: 'bg-gray-800/80',
        border: 'border-green-700/50',
        iconBg: 'bg-green-600',
        text: 'text-green-400',
        accent: 'bg-green-900/50'
      },
      'google-my-business': {
        bg: 'bg-gray-800/80',
        border: 'border-green-700/50',
        iconBg: 'bg-green-600',
        text: 'text-green-400',
        accent: 'bg-green-900/50'
      }
    } : {
      // Light mode themes
      facebook: {
        bg: 'bg-white/50',
        border: 'border-blue-300',
        iconBg: 'bg-blue-600',
        text: 'text-blue-800',
        accent: 'bg-blue-200'
      },
      instagram: {
        bg: 'bg-white/50',
        border: 'border-pink-300',
        iconBg: 'bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500',
        text: 'text-pink-800',
        accent: 'bg-pink-200'
      },
      linkedin: {
        bg: 'bg-white/50',
        border: 'border-blue-300',
        iconBg: 'bg-blue-700',
        text: 'text-blue-800',
        accent: 'bg-blue-200'
      },
      twitter: {
        bg: 'bg-white/50',
        border: 'border-sky-300',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-200'
      },
      'twitter/x': {
        bg: 'bg-white/50',
        border: 'border-sky-300',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-200'
      },
      'x': {
        bg: 'bg-white/50',
        border: 'border-sky-300',
        iconBg: 'bg-sky-500',
        text: 'text-sky-800',
        accent: 'bg-sky-200'
      },
      tiktok: {
        bg: 'bg-white/50',
        border: 'border-gray-300',
        iconBg: 'bg-black',
        text: 'text-gray-800',
        accent: 'bg-gray-200'
      },
      youtube: {
        bg: 'bg-white/50',
        border: 'border-red-300',
        iconBg: 'bg-red-600',
        text: 'text-red-800',
        accent: 'bg-red-200'
      },
      'google business profile': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      },
      'google business': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      },
      'google-business': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      },
      'google-my-business': {
        bg: 'bg-white/50',
        border: 'border-green-300',
        iconBg: 'bg-green-600',
        text: 'text-green-800',
        accent: 'bg-green-200'
      }
    }

    let theme = themes[normalizedPlatform]

    // Try alternative variations for Google Business
    if (!theme && (normalizedPlatform.includes('google') && normalizedPlatform.includes('business'))) {
      console.log('Trying alternative Google Business theme variations...')
      theme = themes['google business profile'] || themes['google business'] || themes['google-business'] || themes['google-my-business']
      console.log('Alternative Google Business theme found:', theme)
    }

    if (theme) {
      return theme
    }

    // Fallback theme
    console.warn('Unknown platform for theme:', platform, 'normalized:', normalizedPlatform)
    return isDarkMode ? {
      bg: 'bg-gray-800/80',
      border: 'border-gray-700/50',
      iconBg: 'bg-gray-500',
      text: 'text-gray-400',
      accent: 'bg-gray-900/50'
    } : {
      bg: 'bg-white/50',
      border: 'border-gray-300',
      iconBg: 'bg-gray-500',
      text: 'text-gray-800',
      accent: 'bg-gray-200'
    }
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      scheduled: 'bg-blue-100 text-blue-800',
      published: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getStatusTextColor = (status) => {
    const colors = {
      draft: 'text-gray-800',
      scheduled: 'text-blue-800',
      published: 'text-green-800',
      failed: 'text-red-800'
    }
    return colors[status] || 'text-gray-800'
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Fetch fresh post status from database
  const fetchPostStatusFromDB = async (postId) => {
    try {
      const authToken = await getAuthToken()
      const response = await fetch(`${API_BASE_URL}/content/all`, {
        headers: { 
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      })
      if (response.ok) {
        const data = await response.json()
        const post = data.content?.find(p => p.id === postId)
        if (post) {
          return post.status?.toLowerCase()
        }
      }
    } catch (error) {
      console.error('Error fetching post status from database:', error)
    }
    return null
  }

  // Remove the early return for loading - we'll handle it in the main content area

  const handlePostContent = async (content) => {
    try {
      // Prevent duplicate publishing
      // Check if already being posted
      if (postingContent.has(content.id)) {
        console.log('⚠️ Post is already being published, skipping duplicate request')
        return
      }
      
      // Check if backend is already publishing this post (prevent duplicate publishing)
      const isPublishing = content.metadata?._publishing === true
      if (isPublishing) {
        console.log('⚠️ Backend is already publishing this post, skipping duplicate request')
        showError('Post Being Published', 'This post is currently being published by the system. Please wait a moment and refresh the page.')
        return
      }
      
      // Query database for fresh status before publishing
      const freshStatus = await fetchPostStatusFromDB(content.id)
      if (freshStatus === 'published') {
        console.log('⚠️ Post is already published in database, skipping duplicate request')
        showError('Post Already Published', 'This post has already been published. Please refresh the page to see the latest status.')
        return
      }
      
      // Check if already published (from cache)
      const status = content.status?.toLowerCase()
      if (status === 'published') {
        console.log('⚠️ Post is already published (from cache), skipping duplicate request')
        showError('Post Already Published', 'This post has already been published. Please refresh the page to see the latest status.')
        return
      }
      
      // Add content to posting set
      setPostingContent(prev => new Set([...prev, content.id]))
      
      console.log('Posting content to', content.platform, ':', content)
      
      // Handle different platforms
      if (content.platform.toLowerCase() === 'facebook') {
        await postToFacebook(content)
      } else if (content.platform.toLowerCase() === 'instagram') {
        await postToInstagram(content)
      } else if (content.platform.toLowerCase() === 'linkedin') {
        await postToLinkedIn(content)
      } else if (content.platform.toLowerCase() === 'youtube') {
        await postToYouTube(content)
      } else {
        // For other platforms, show a message
        showError(`${content.platform} posting not yet implemented`)
        return
      }
      
    } catch (error) {
      console.error('Error posting content:', error)
      showError(`Failed to post to ${content.platform}: ${error.message}`)
    } finally {
      // Remove content from posting set
      setPostingContent(prev => {
        const newSet = new Set(prev)
        newSet.delete(content.id)
        return newSet
      })
    }
  }

  const postToFacebook = async (content) => {
    try {
      const authToken = await getAuthToken()
      
      // Check if this is a carousel post
      const isCarousel = content.post_type === 'carousel' || 
                         (content.metadata && content.metadata.carousel_images && content.metadata.carousel_images.length > 0)
      const carouselImages = isCarousel ? (content.metadata?.carousel_images || []) : []
      
      // Get the image URL if available (from content.media_url which comes from primary_image_url)
      let imageUrl = content.media_url || ''
      if (imageUrl && !isCarousel) {
        console.log('📸 Including image in Facebook post:', imageUrl)
      }
      
      if (isCarousel) {
        console.log(`🎠 Posting carousel with ${carouselImages.length} images to Facebook`)
      }
      
      const postBody = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.id
      }
      
      if (isCarousel && carouselImages.length > 0) {
        postBody.post_type = 'carousel'
        postBody.carousel_images = carouselImages
      } else {
        postBody.image_url = imageUrl
      }
      
      const response = await fetch(`${API_BASE_URL}/connections/facebook/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Facebook post result:', result)
      
      // Show beautiful notification with post URL if available
      showPostNotification('Facebook', result.post_url || result.url)
      
      // Update the content status to published in cache (with published_at timestamp)
      const publishedAt = new Date().toISOString()
      updateContentInCache(content.id, { 
        status: 'published',
        published_at: publishedAt,
        facebook_post_id: result.post_id
      })
      
      // Also update in allContent if it exists there
      setAllContent(prev => prev.map(item => 
        item.id === content.id 
          ? { ...item, status: 'published', published_at: publishedAt, facebook_post_id: result.post_id }
          : item
      ))
      
      // Wait longer for backend to update database, then verify status before final cache update
      setTimeout(async () => {
        // Verify status from database before final update
        const freshStatus = await fetchPostStatusFromDB(content.id)
        if (freshStatus === 'published') {
          // Database confirms published status, ensure cache is updated
          updateContentInCache(content.id, { 
            status: 'published',
            published_at: publishedAt,
            facebook_post_id: result.post_id
          })
        }
        fetchAllContent()
      }, 3000) // Increased from 1500ms to 3000ms for better sync
      
    } catch (error) {
      console.error('Error posting to Facebook:', error)
      throw error
    }
  }

  const postToInstagram = async (content) => {
    let oauthError = null
    
    try {
      const authToken = await getAuthToken()
      
      // Check if this is a carousel post
      const isCarousel = content.post_type === 'carousel' || 
                         (content.metadata && content.metadata.carousel_images && content.metadata.carousel_images.length > 0)
      const carouselImages = isCarousel ? (content.metadata?.carousel_images || []) : []
      
      // Get the media URL if available (from content.media_url which comes from primary_image_url)
      let mediaUrl = content.media_url || ''
      
      // Check if media is a video
      const isVideo = content.post_type === 'video' || 
                      content.content_type?.toLowerCase() === 'video' ||
                      content.metadata?.media_type === 'video' ||
                      (mediaUrl && isVideoFile(mediaUrl))
      
      if (mediaUrl && !isCarousel) {
        if (isVideo) {
          console.log('🎥 Including video in Instagram post:', mediaUrl)
        } else {
          console.log('📸 Including image in Instagram post:', mediaUrl)
        }
      }
      
      if (isCarousel) {
        console.log(`🎠 Posting carousel with ${carouselImages.length} images to Instagram`)
      }
      
      // Instagram requires an image, video, or carousel - check if we have one
      if (!isCarousel && !mediaUrl) {
        throw new Error('Instagram requires an image or video to post content. Please click the "Generate Media" button to create media for this post first.')
      }
      
      if (isCarousel && carouselImages.length === 0) {
        throw new Error('Carousel post requires at least one image.')
      }
      
      const postData = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.id
      }
      
      if (isCarousel && carouselImages.length > 0) {
        postData.post_type = 'carousel'
        postData.carousel_images = carouselImages
      } else {
        // Pass the media URL - backend will detect if it's a video or image
        postData.image_url = mediaUrl
      }
      
      // Try OAuth method first (original endpoint)
      try {
        console.log('🔄 Trying Instagram OAuth posting...')
        
        // Create an AbortController for timeout handling
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 180000) // 3 minutes timeout (longer than backend wait)
        
        try {
          const response = await fetch(`${API_BASE_URL}/connections/instagram/post`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(postData),
            signal: controller.signal
          })

          clearTimeout(timeoutId)

          if (response.ok) {
            const result = await response.json()
            console.log('✅ Instagram OAuth post successful:', result)
            console.log('📋 Response data:', { post_url: result.post_url, url: result.url, post_id: result.post_id })
            
            // Show beautiful notification with post URL if available
            const postUrl = result.post_url || result.url
            if (postUrl) {
              showPostNotification('Instagram', postUrl)
            } else {
              // If no URL, still show success message
              showSuccess('Successfully posted to Instagram!')
            }
            
            // Update the content status to published in cache (with published_at timestamp)
            const publishedAt = new Date().toISOString()
            updateContentInCache(content.id, { 
              status: 'published',
              published_at: publishedAt,
              instagram_post_id: result.post_id
            })
            
            // Also update in allContent if it exists there
            setAllContent(prev => prev.map(item => 
              item.id === content.id 
                ? { ...item, status: 'published', published_at: publishedAt, instagram_post_id: result.post_id }
                : item
            ))
            // Wait longer for backend to update database, then verify status before final cache update
            setTimeout(async () => {
              // Verify status from database before final update
              const freshStatus = await fetchPostStatusFromDB(content.id)
              if (freshStatus === 'published') {
                // Database confirms published status, ensure cache is updated
                updateContentInCache(content.id, { 
                  status: 'published',
                  published_at: publishedAt,
                  instagram_post_id: result.post_id
                })
              }
              fetchAllContent()
            }, 3000) // Increased from 1500ms to 3000ms for better sync
            return
          } else {
            const errorText = await response.text()
            console.log('❌ Instagram OAuth failed:', response.status, errorText)
            oauthError = new Error(`OAuth method failed: ${response.status}: ${errorText}`)
            // Continue to try token method
          }
        } catch (fetchError) {
          clearTimeout(timeoutId)
          if (fetchError.name === 'AbortError') {
            console.log('⏱️ Instagram OAuth request timeout')
            oauthError = new Error('Request timeout: Instagram reel processing is taking longer than expected. The post may still be processing in the background.')
          } else {
            throw fetchError
          }
        }
      } catch (error) {
        console.log('❌ Instagram OAuth error:', error)
        oauthError = error
        // Continue to try token method
      }
      
      // Try token method (new endpoint) - but this will fail for Instagram Basic Display API
      try {
        console.log('🔄 Trying Instagram token posting...')
        const response = await fetch(`${API_BASE_URL}/api/social-media/instagram/post`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
          },
          body: JSON.stringify(postData)
        })

        if (response.ok) {
          const result = await response.json()
          console.log('✅ Instagram token post successful:', result)
          
          // Show beautiful notification with post URL if available
          const postUrl = result.post_url || result.url
          if (postUrl) {
            showPostNotification('Instagram', postUrl)
          } else {
          showSuccess(`Successfully posted to Instagram!`)
          }
          
          // Update the content status to published in cache (with published_at timestamp)
          const publishedAt = new Date().toISOString()
          updateContentInCache(content.id, { 
            status: 'published',
            published_at: publishedAt,
            instagram_post_id: result.post_id
          })
          
          // Also update in allContent if it exists there
          setAllContent(prev => prev.map(item => 
            item.id === content.id 
              ? { ...item, status: 'published', published_at: publishedAt, instagram_post_id: result.post_id }
              : item
          ))
          // Refresh content after successful publishing
          setTimeout(() => {
            fetchAllContent()
          }, 1500)
          return
        } else {
          const errorText = await response.text()
          const errorData = JSON.parse(errorText)
          
          // Check if it's the Basic Display API limitation
          if (errorData.detail && errorData.detail.includes('Basic Display API does not support posting')) {
            throw new Error('Instagram Basic Display API (token method) is read-only and cannot post content. Please use OAuth connection method for posting to Instagram.')
          }
          
          throw new Error(`Token method failed: ${response.status}: ${errorText}`)
        }
      } catch (tokenError) {
        console.log('❌ Instagram token error:', tokenError)
        
        // If OAuth failed and token method also failed, show appropriate message
        if (oauthError) {
          // Check if it's a connection issue
          if (oauthError.message.includes('No active Instagram connection found') || 
              tokenError.message.includes('No active Instagram connection found')) {
            throw new Error('Instagram account not connected. Please go to Settings > Connections and connect your Instagram account first.')
          } else if (oauthError.message.includes('image_url is required')) {
            throw new Error('Instagram requires an image to post content. Please click the "Generate Media" button to create an image for this post first.')
          } else {
            throw new Error(`Instagram posting failed: ${oauthError.message}`)
          }
        } else {
          throw tokenError
        }
      }
      
    } catch (error) {
      console.error('Error posting to Instagram:', error)
      throw error
    }
  }

  const postToLinkedIn = async (content) => {
    try {
      const authToken = await getAuthToken()
      
      // Get the image URL if available (from content.media_url which comes from primary_image_url)
      let imageUrl = content.media_url || ''
      if (imageUrl) {
        console.log('📸 Including image in LinkedIn post:', imageUrl)
      }
      
      const postData = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.id,
        image_url: imageUrl,
        visibility: content.linkedin_visibility || 'PUBLIC' // Use content setting or default to PUBLIC
      }
      
      console.log('🔄 Posting to LinkedIn...')
      const response = await fetch(`${API_BASE_URL}/connections/linkedin/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ LinkedIn post successful:', result)
        
        // Update the content status to published
        const publishedAt = new Date().toISOString()
        updateContentInCache(content.id, { 
          status: 'published',
          published_at: publishedAt,
          linkedin_post_id: result.post_id || result.id
        })
        
        // Also update in allContent if it exists there
        setAllContent(prev => prev.map(item => 
          item.id === content.id 
            ? { ...item, status: 'published', published_at: publishedAt, linkedin_post_id: result.post_id || result.id }
            : item
        ))
        
        // Wait longer for backend to update database, then verify status before final cache update
        setTimeout(async () => {
          // Verify status from database before final update
          const freshStatus = await fetchPostStatusFromDB(content.id)
          if (freshStatus === 'published') {
            // Database confirms published status, ensure cache is updated
            updateContentInCache(content.id, { 
              status: 'published',
              published_at: publishedAt,
              linkedin_post_id: result.post_id || result.id
            })
          }
          fetchAllContent()
        }, 3000) // Increased from 1500ms to 3000ms for better sync
        
        // Show beautiful notification with post URL if available
        showPostNotification('LinkedIn', result.post_url || result.url)
      } else {
        const errorText = await response.text()
        console.error('❌ LinkedIn post failed:', response.status, errorText)
        throw new Error(`LinkedIn posting failed: ${response.status}: ${errorText}`)
      }
      
    } catch (error) {
      console.error('Error posting to LinkedIn:', error)
      throw error
    }
  }

  const postToYouTube = async (content) => {
    try {
      const authToken = await getAuthToken()
      
      // Get the image URL if available (from content.media_url which comes from primary_image_url)
      let imageUrl = content.media_url || ''
      if (imageUrl) {
        console.log('📸 Including image in YouTube post:', imageUrl)
      }
      
      const postData = {
        title: content.title,
        description: content.content,
        image_url: imageUrl,
        content_id: content.id
      }
      
      console.log('🔄 Posting to YouTube...')
      const response = await fetch(`${API_BASE_URL}/connections/youtube/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('✅ YouTube post successful:', result)
        
        // Update the content status to published
        const publishedAt = new Date().toISOString()
        updateContentInCache(content.id, { 
          status: 'published',
          published_at: publishedAt,
          youtube_post_id: result.post_id || result.id
        })
        
        // Also update in allContent if it exists there
        setAllContent(prev => prev.map(item => 
          item.id === content.id 
            ? { ...item, status: 'published', published_at: publishedAt, youtube_post_id: result.post_id || result.id }
            : item
        ))
        
        // Refresh content after successful publishing
        setTimeout(() => {
          fetchAllContent()
        }, 1500)
        
        // Show beautiful notification with post URL if available
        showPostNotification('YouTube', result.post_url || result.url)
      } else {
        const errorText = await response.text()
        console.error('❌ YouTube post failed:', response.status, errorText)
        throw new Error(`YouTube posting failed: ${response.status}: ${errorText}`)
      }
      
    } catch (error) {
      console.error('Error posting to YouTube:', error)
      throw error
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const handleEditContent = (content) => {
    setEditingContent(content)
    setEditForm({
      id: content.id, // Add the ID to the edit form
      title: content.title || '',
      content: content.content || '',
      hashtags: content.hashtags ? content.hashtags.join(', ') : '',
      scheduled_date: content.scheduled_at ? content.scheduled_at.split('T')[0] : '',
      scheduled_time: content.scheduled_at ? content.scheduled_at.split('T')[1] : '12:00',
      status: content.status || 'draft',
      media_url: content.media_url || content.image_url || '' // Include media_url from primary_image_url
    })
  }

  const handleSaveEdit = async () => {
    try {
      setSaving(true)
      const authToken = await getAuthToken()
      
      // Convert hashtags string back to array
      const hashtagsArray = editForm.hashtags 
        ? editForm.hashtags.split(',').map(tag => tag.trim()).filter(tag => tag)
        : []
      
      // Prepare update data
      const updateData = {
        title: editForm.title,
        content: editForm.content,
        hashtags: hashtagsArray,
        scheduled_date: editForm.scheduled_date,
        scheduled_time: editForm.scheduled_time,
        status: editForm.status
      }
      
      const response = await fetch(`${API_BASE_URL}/content/update/${editingContent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Content update result:', result)
      
      // If status is scheduled, register with backend for exact-time publishing
      if (updateData.status === 'scheduled' && updateData.scheduled_date && updateData.scheduled_time) {
        const scheduledAt = `${updateData.scheduled_date}T${updateData.scheduled_time}`
        const platform = editingContent.platform || 'facebook' // Default platform
        try {
          await contentAPI.registerScheduledPost(
            editingContent.id,
            scheduledAt,
            platform
          )
          console.log(`✅ Registered scheduled post ${editingContent.id} with backend`)
        } catch (error) {
          console.warn(`Failed to register scheduled post with backend: ${error.message}`)
          // Don't fail the update if registration fails
        }
      }
      
      showSuccess('Content updated successfully!')
      
      // Update the content in the local state
      const updatedContent = {
        ...editingContent,
        ...updateData,
        scheduled_at: `${editForm.scheduled_date}T${editForm.scheduled_time}`
      }
      
      // Update in allContent
      if (allContent.some(item => item.id === editingContent.id)) {
        setAllContent(prev => prev.map(item => 
          item.id === editingContent.id ? updatedContent : item
        ))
      }
      
      // Update in scheduledContent if it exists there
      if (scheduledContent.some(item => item.id === editingContent.id)) {
        updateContentInCache(editingContent.id, updateData)
      }
      
      setEditingContent(null)
      setEditForm({})
      
    } catch (error) {
      console.error('Error updating content:', error)
      showError('Failed to update content', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingContent(null)
    setEditForm({})
    setSelectedFile(null)
  }

  const handleViewContent = (content) => {
    // Open modal with full content
    setSelectedContentForModal(content)
  }

  const handleCloseModal = () => {
    setSelectedContentForModal(null)
    // Reset edit states
    setEditingTitleInModal(false)
    setEditingContentInModal(false)
    setEditTitleValue('')
    setEditContentValue('')
  }

  // AI Edit functions
  const handleAIEdit = (type) => {
    setAiEditType(type)
    setShowAIEditModal(true)
    setAiEditInstruction('')
  }

  const handleAISaveEdit = async () => {
    if (!selectedContentForModal || !aiEditInstruction.trim()) return

    // Validate instruction length
    if (aiEditInstruction.length > 500) {
      showError('Instruction too long', 'Please keep your instruction under 500 characters')
      return
    }

    try {
      setAiEditing(true)

      // Get the current text based on type
      const currentText = aiEditType === 'title' 
        ? selectedContentForModal.title || ''
        : selectedContentForModal.content || ''

      // Get auth token
      const authToken = await getAuthToken()
      
      // Call AI service to edit content
      const response = await fetch(`${API_BASE_URL}/content/ai/edit-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          content: currentText,
          instruction: aiEditInstruction
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.success) {
        // Show confirmation modal with AI-edited content
        setAiEditedContent(result.edited_content)
        setShowAIEditModal(false)
        setShowAIConfirmModal(true)
      } else {
        throw new Error(result.error || result.detail || 'Failed to edit content with AI')
      }

    } catch (error) {
      console.error('Error editing content with AI:', error)
      showError('Failed to edit content with AI', error.message)
    } finally {
      setAiEditing(false)
    }
  }

  const handleCancelAIEdit = () => {
    setShowAIEditModal(false)
    setAiEditInstruction('')
    setAiEditType(null)
  }

  const handleAIConfirmSave = async () => {
    if (!selectedContentForModal || !aiEditedContent) return

    try {
      setSaving(true)

      const updateData = {}
      if (aiEditType === 'title') {
        updateData.title = aiEditedContent
      } else {
        updateData.content = aiEditedContent
      }

      const result = await contentAPI.updateContent(selectedContentForModal.id, updateData)

      if (result.success) {
        // Update the content in state
        const updatedContent = { ...selectedContentForModal, ...updateData }
        setAllContent(prev => prev.map(item => 
          item.id === selectedContentForModal.id ? updatedContent : item
        ))

        // Update the modal content - keep modal open
        setSelectedContentForModal(updatedContent)

        // Close only the confirmation modal, keep the main modal open
        setShowAIConfirmModal(false)
        setAiEditedContent('')
        setAiEditInstruction('')
        setAiEditType(null)

        showSuccess('Success', 'Content updated with AI assistance')
      } else {
        throw new Error(result.error || 'Failed to update content')
      }

    } catch (error) {
      console.error('Error updating content:', error)
      showError('Failed to update content', error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleAIConfirmCancel = () => {
    setShowAIConfirmModal(false)
    setAiEditedContent('')
    setAiEditInstruction('')
    setAiEditType(null)
  }

  // Manual Edit functions for modal
  const handleManualEdit = (type) => {
    if (type === 'title') {
      setEditingTitleInModal(true)
      setEditTitleValue(selectedContentForModal?.title || '')
    } else {
      setEditingContentInModal(true)
      setEditContentValue(selectedContentForModal?.content || '')
    }
  }

  const handleCancelManualEdit = (type) => {
    if (type === 'title') {
      setEditingTitleInModal(false)
      setEditTitleValue('')
    } else {
      setEditingContentInModal(false)
      setEditContentValue('')
    }
  }

  const handleSaveManualEdit = async (type) => {
    if (!selectedContentForModal) return

    try {
      setSavingModalEdit(true)

      const updateData = {}
      if (type === 'title') {
        updateData.title = editTitleValue
      } else {
        updateData.content = editContentValue
      }

      const result = await contentAPI.updateContent(selectedContentForModal.id, updateData)

      if (result.success) {
        // Update the content in state
        setAllContent(prev => prev.map(item => 
          item.id === selectedContentForModal.id ? { ...item, ...updateData } : item
        ))

        // Update the modal content
        setSelectedContentForModal(prev => ({ ...prev, ...updateData }))

        // Reset edit state
        if (type === 'title') {
          setEditingTitleInModal(false)
          setEditTitleValue('')
        } else {
          setEditingContentInModal(false)
          setEditContentValue('')
        }

        showSuccess('Success', `${type === 'title' ? 'Title' : 'Content'} updated successfully`)
      } else {
        throw new Error(result.error || 'Failed to update content')
      }

    } catch (error) {
      console.error('Error updating content:', error)
      showError('Failed to update content', error.message)
    } finally {
      setSavingModalEdit(false)
    }
  }

  // fetchPostImages removed - images are now loaded directly from content_posts.primary_image_url via content.media_url

  const handleGenerateMedia = async (content) => {
    try {
      // Add to generating set
      setGeneratingMedia(prev => new Set(prev).add(content.id))
      
      // Check if this is a carousel post
      const isCarousel = content.post_type === 'carousel' || 
                         content.post_type?.toLowerCase() === 'carousel'
      
      let result
      if (isCarousel) {
        // Generate all carousel images
        result = await mediaService.generateCarouselImages(content.id)
      } else {
        // Generate single image
        result = await mediaService.generateMedia(content.id)
      }
      
      if (result.success) {
        console.log('🎨 Generation successful, fetching images for content:', content.id)
        console.log('🎨 Generation result:', result)
        
        // Update the content in state with the new image URL(s)
        if (isCarousel && result.carousel_images) {
          // Update metadata with carousel images
          const updatedMetadata = {
            ...(content.metadata || {}),
            carousel_images: result.carousel_images
          }
          
          const firstImageUrl = result.carousel_images[0]
          
          setAllContent(prevContent => 
            prevContent.map(item => 
              item.id === content.id 
                ? { 
                    ...item, 
                    metadata: updatedMetadata,
                    media_url: firstImageUrl,
                    primary_image_url: firstImageUrl
                  }
                : item
            )
          )
          
          setScheduledContent(prevContent => 
            prevContent.map(item => 
              item.id === content.id 
                ? { 
                    ...item, 
                    metadata: updatedMetadata,
                    media_url: firstImageUrl,
                    primary_image_url: firstImageUrl
                  }
                : item
            )
          )
          
          setCelebrationData({
            imageUrl: firstImageUrl,
            generationTime: result.generation_time,
            generationModel: result.generation_model,
            generationService: result.generation_service
          })
          setShowCelebration(true)
        } else {
          // Single image generation
          const imageUrl = result.image_url
          console.log('🖼️ Image URL from result:', imageUrl)
          
          if (imageUrl) {
            // Update the content item in allContent state with the new media_url
            setAllContent(prevContent => 
              prevContent.map(item => 
                item.id === content.id 
                  ? { ...item, media_url: imageUrl, primary_image_url: imageUrl }
                  : item
              )
            )
            
            // Also update scheduledContent if it exists
            setScheduledContent(prevContent => 
              prevContent.map(item => 
                item.id === content.id 
                  ? { ...item, media_url: imageUrl, primary_image_url: imageUrl }
                  : item
              )
            )
            
            setCelebrationData({
              imageUrl: imageUrl,
              generationTime: result.generation_time,
              generationModel: result.generation_model,
              generationService: result.generation_service
            })
            setShowCelebration(true)
          } else {
            // Fallback to regular notification if no image URL
            showSuccess('Media generated successfully!', `Image created in ${result.generation_time || 0}s`)
          }
        }
        
        // Immediately update state and then refresh from database to ensure consistency
        // This ensures the new image shows right away and persists after refresh
        setTimeout(() => {
          fetchAllContent()
        }, 500)
        
        // Also refresh after a longer delay to catch any database replication delays
        setTimeout(() => {
          fetchAllContent()
        }, 2000)
      } else {
        throw new Error(result.error || 'Failed to generate media')
      }
      
    } catch (error) {
      console.error('Error generating media:', error)
      
      // Provide more helpful error messages
      let errorMessage = error.message
      if (error.message.includes('OpenAI API key not configured')) {
        errorMessage = 'OpenAI API key not configured. Please contact support to set up image generation.'
      } else if (error.message.includes('quota exceeded')) {
        errorMessage = 'OpenAI API quota exceeded. Please check billing settings.'
      } else if (error.message.includes('Invalid OpenAI API key')) {
        errorMessage = 'Invalid OpenAI API key. Please contact support.'
      }
      
      showError('Failed to generate media', errorMessage)
    } finally {
      // Remove from generating set
      setGeneratingMedia(prev => {
        const newSet = new Set(prev)
        newSet.delete(content.id)
        return newSet
      })
    }
  }

  const handleApproveImage = async (postId) => {
    try {
      // Find the image ID for this post
      const result = await mediaService.getPostImages(postId)
      if (result.images && result.images.length > 0) {
        const imageId = result.images[0].id
        await mediaService.approveImage(imageId)
        
        // Update local state
        setGeneratedImages(prev => ({
          ...prev,
          [postId]: {
            ...prev[postId],
            is_approved: true
          }
        }))
        
        showSuccess('Image approved successfully!')
      }
    } catch (error) {
      console.error('Error approving image:', error)
      showError('Failed to approve image', error.message)
    }
  }

  const handleApprovePost = async (contentId) => {
    try {
      const result = await contentAPI.updateContentStatus(contentId, 'scheduled')
      
      if (result.success) {
        // Update local content cache first
        updateContentInCache(contentId, { status: 'scheduled' })
        
        // Register with backend for exact-time publishing
        const content = allContent.find(c => c.id === contentId) || 
                       scheduledContent.find(c => c.id === contentId) ||
                       (selectedContentForModal && selectedContentForModal.id === contentId ? selectedContentForModal : null)
        if (content && content.scheduled_at && content.platform) {
          try {
            await contentAPI.registerScheduledPost(
              contentId,
              content.scheduled_at,
              content.platform
            )
            console.log(`✅ Registered scheduled post ${contentId} with backend`)
          } catch (error) {
            console.warn(`Failed to register scheduled post with backend: ${error.message}`)
            // Don't fail the approval if registration fails
          }
        }
        
        // Close the modal if this content is currently open
        if (selectedContentForModal && selectedContentForModal.id === contentId) {
          setSelectedContentForModal(null)
        }
        
        // Show success message immediately
        showSuccess('Post approved and scheduled successfully!')
        
        // Add a small delay to ensure the status update is processed
        setTimeout(async () => {
          // Force refresh the content data to get updated status
          await fetchData(true)
        }, 500)
        
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error approving post:', error)
      showError('Failed to approve post', error.message)
    }
  }

  const handleDisapprovePost = async (contentId) => {
    try {
      const result = await contentAPI.updateContentStatus(contentId, 'draft')
      
      if (result.success) {
        // Update local content cache first
        updateContentInCache(contentId, { status: 'draft' })
        
        // Update the modal content if it's currently open
        if (selectedContentForModal && selectedContentForModal.id === contentId) {
          setSelectedContentForModal({ ...selectedContentForModal, status: 'draft' })
        }
        
        // Show success message immediately
        showSuccess('Post disapproved and moved back to draft!')
        
        // Add a small delay to ensure the status update is processed
        setTimeout(async () => {
          // Force refresh the content data to get updated status
          await fetchData(true)
        }, 500)
        
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error disapproving post:', error)
      showError('Failed to disapprove post', error.message)
    }
  }

  // Handle status change
  const handleStatusChange = async (contentId, newStatus) => {
    try {
      setUpdatingStatus(prev => new Set(prev).add(contentId))
      
      const result = await contentAPI.updateContentStatus(contentId, newStatus)
      
      if (result.success) {
        // Update local content cache first
        updateContentInCache(contentId, { status: newStatus })
        
        // If status changed to 'scheduled', register with backend for exact-time publishing
        if (newStatus === 'scheduled') {
          const content = allContent.find(c => c.id === contentId) || 
                         scheduledContent.find(c => c.id === contentId)
          if (content && content.scheduled_at && content.platform) {
            try {
              await contentAPI.registerScheduledPost(
                contentId,
                content.scheduled_at,
                content.platform
              )
              console.log(`✅ Registered scheduled post ${contentId} with backend`)
            } catch (error) {
              console.warn(`Failed to register scheduled post with backend: ${error.message}`)
              // Don't fail the status update if registration fails
            }
          }
        }
        
        // Close the dropdown
        setStatusDropdownOpen(null)
        
        // Show success message
        showSuccess(`Status updated to ${newStatus} successfully!`)
        
        // Add a small delay to ensure the status update is processed
        setTimeout(async () => {
          // Force refresh the content data to get updated status
          await fetchData(true)
        }, 500)
        
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Error updating status:', error)
      showError('Failed to update status', error.message)
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev)
        newSet.delete(contentId)
        return newSet
      })
    }
  }

  // Available status options
  const statusOptions = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-800' },
    { value: 'published', label: 'Published', color: 'bg-green-100 text-green-800' },
    { value: 'archived', label: 'Archived', color: 'bg-yellow-100 text-yellow-800' }
  ]

  const handleFileSelect = (event) => {
    const file = event.target.files[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        showError('Invalid file type', 'Please select an image or video file')
        return
      }
      
      // Validate file size (max 100MB for videos, 10MB for images)
      const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > maxSize) {
        const maxSizeMB = file.type.startsWith('video/') ? '100MB' : '10MB'
        showError('File too large', `Please select a file smaller than ${maxSizeMB}`)
        return
      }
      
      setSelectedFile(file)
    }
  }

  const handleDeleteUploadedMedia = async (postId) => {
    try {
      const result = await mediaService.deleteUploadedMedia(postId)
      if (result.success) {
        showSuccess('Media deleted successfully', 'The uploaded media has been removed')
        // Clear selected file if it was for this post
        if (editForm.id === postId) {
          setSelectedFile(null)
        }
        // Refresh the content list
        loadContent()
      }
    } catch (error) {
      console.error('Error deleting uploaded media:', error)
      showError('Failed to delete media', error.message || 'An error occurred while deleting the media')
    }
  }

  const handleOpenUploadModal = (contentId) => {
    setShowUploadModal(contentId)
    setSelectedFile(null)
  }

  const handleUploadImage = async (postId) => {
    console.log('🔍 Upload function called with postId:', postId)
    console.log('🔍 editForm:', editForm)
    console.log('🔍 API_BASE_URL:', API_BASE_URL)
    console.log('🔍 Selected file:', selectedFile)
    
    if (!selectedFile) {
      showError('No file selected', 'Please select an image or video to upload')
      return
    }

    if (!postId) {
      showError('No post ID', 'Cannot upload image without post ID')
      return
    }

    try {
      setUploadingImage(prev => new Set(prev).add(postId))
      
      // Use backend API for upload (bypasses RLS issues)
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('post_id', postId)
      
      console.log('🔍 Uploading via backend API to:', `${API_BASE_URL}/media/upload-image`)
      
      // Test API connectivity first
      try {
        const healthCheck = await fetch(`${API_BASE_URL}/health`, { method: 'GET' })
        console.log('🔍 API health check status:', healthCheck.status)
      } catch (healthError) {
        console.warn('🔍 API health check failed:', healthError.message)
      }
      
      const authToken = await getAuthToken()
      console.log('🔍 Auth token available:', !!authToken)
      
      const response = await fetch(`${API_BASE_URL}/media/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        },
        body: formData
      })
      
      console.log('🔍 Response status:', response.status)
      console.log('🔍 Response headers:', Object.fromEntries(response.headers.entries()))
      
      let result
      try {
        result = await response.json()
        console.log('🔍 Backend upload result:', result)
      } catch (jsonError) {
        console.error('🔍 Failed to parse JSON response:', jsonError)
        const textResponse = await response.text()
        console.error('🔍 Raw response:', textResponse)
        throw new Error(`Server returned invalid JSON: ${textResponse}`)
      }
      
      if (!response.ok) {
        throw new Error(result.detail || result.message || `HTTP ${response.status}: Upload failed`)
      }
      
      if (!result.success) {
        throw new Error(result.message || 'Upload failed')
      }
      
      // Update modal content if it's open
      if (selectedContentForModal && selectedContentForModal.id === postId) {
        setSelectedContentForModal(prev => ({
          ...prev,
          media_url: result.image_url,
          image_url: result.image_url
        }))
      }
      
      // Update allContent state with media_url (which comes from primary_image_url)
      setAllContent(prev => prev.map(item => 
        item.id === postId ? { ...item, media_url: result.image_url, image_url: result.image_url } : item
      ))
      
      // Update scheduled content if it exists
      setScheduledContent(prev => prev.map(item => 
        item.id === postId ? { ...item, media_url: result.image_url, image_url: result.image_url } : item
      ))
      
      // Close modal and reset
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
      setPreviewUrl(null)
      setShowUploadModal(null)
      setSelectedFile(null)
      
      // Use the message from backend (which correctly identifies video vs image)
      const successMessage = result.message || 'Media uploaded successfully!'
      const successDescription = selectedFile?.type.startsWith('video/') 
        ? 'Your custom video has been added to the post'
        : 'Your custom image has been added to the post'
      
      showSuccess(successMessage, successDescription)
      
    } catch (error) {
      console.error('Error uploading image:', error)
      
      // Provide more specific error messages
      let errorMessage = error.message
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again.'
      } else if (error.message.includes('404')) {
        errorMessage = 'API endpoint not found. Please contact support.'
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later or contact support.'
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.'
      }
      
      showError('Failed to upload image', errorMessage)
    } finally {
      setUploadingImage(prev => {
        const newSet = new Set(prev)
        newSet.delete(postId)
        return newSet
      })
    }
  }

  const handleReplaceCarouselImage = async (postId, imageIndex) => {
    try {
      const authToken = await getAuthToken()
      
      // Show loading state
      showLoading('Generating new carousel image...', 'Please wait while we create a new image for your carousel')
      
      // Call backend endpoint to regenerate carousel image
      const response = await fetch(`${API_BASE_URL}/content/${postId}/regenerate-carousel-image/${imageIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to regenerate carousel image' }))
        throw new Error(errorData.detail || errorData.message || 'Failed to regenerate carousel image')
      }
      
      const result = await response.json()
      
      // Update modal content if it's open
      if (selectedContentForModal && selectedContentForModal.id === postId) {
        setSelectedContentForModal(prev => {
          const updatedCarouselImages = [...(prev.metadata?.carousel_images || prev.carousel_images || [])]
          updatedCarouselImages[imageIndex] = result.image_url
          
          return {
            ...prev,
            carousel_images: updatedCarouselImages,
            metadata: {
              ...prev.metadata,
              carousel_images: updatedCarouselImages
            },
            // Update primary_image_url to first image
            media_url: updatedCarouselImages[0],
            image_url: updatedCarouselImages[0]
          }
        })
      }
      
      // Update allContent state
      setAllContent(prev => prev.map(item => {
        if (item.id === postId) {
          const updatedCarouselImages = [...(item.metadata?.carousel_images || item.carousel_images || [])]
          updatedCarouselImages[imageIndex] = result.image_url
          
          return {
            ...item,
            carousel_images: updatedCarouselImages,
            metadata: {
              ...item.metadata,
              carousel_images: updatedCarouselImages
            },
            media_url: updatedCarouselImages[0],
            image_url: updatedCarouselImages[0]
          }
        }
        return item
      }))
      
      // Update scheduled content if it exists
      setScheduledContent(prev => prev.map(item => {
        if (item.id === postId) {
          const updatedCarouselImages = [...(item.metadata?.carousel_images || item.carousel_images || [])]
          updatedCarouselImages[imageIndex] = result.image_url
          
          return {
            ...item,
            carousel_images: updatedCarouselImages,
            metadata: {
              ...item.metadata,
              carousel_images: updatedCarouselImages
            },
            media_url: updatedCarouselImages[0],
            image_url: updatedCarouselImages[0]
          }
        }
        return item
      }))
      
      // Refresh content to ensure UI is updated
      setTimeout(() => {
        fetchAllContent()
      }, 1000)
      
      showSuccess('Carousel image regenerated', `Image ${imageIndex + 1} has been successfully replaced`)
      
    } catch (error) {
      console.error('Error replacing carousel image:', error)
      showError('Failed to replace carousel image', error.message || 'An error occurred while generating the new image')
    }
  }

  // Show post success notification
  const showPostNotification = (platform, postUrl = null) => {
    // Ensure postUrl is a valid string, not empty or undefined
    const validPostUrl = postUrl && typeof postUrl === 'string' && postUrl.trim() ? postUrl.trim() : null;
    
    console.log('📢 showPostNotification called:', { platform, postUrl, validPostUrl });
    
    setPostNotification({
      platform,
      show: true,
      timestamp: Date.now(),
      postUrl: validPostUrl
    })
    
    // No auto-close - user must manually close with X button
  }

  // Handle go to post action
  const handleGoToPost = () => {
    if (postNotification?.postUrl) {
      try {
        // Validate URL before opening
        const url = new URL(postNotification.postUrl)
        window.open(postNotification.postUrl, '_blank', 'noopener,noreferrer')
      } catch (error) {
        console.error('Invalid post URL:', postNotification.postUrl)
        // Show error message to user
        alert('Sorry, the post URL is not available or invalid.')
      }
    }
  }

  // Handle close notification
  const handleCloseNotification = () => {
    console.log('X button clicked, closing notification')
    setPostNotification(prev => prev ? { ...prev, show: false } : null)
    setTimeout(() => {
      setPostNotification(null)
    }, 500)
  }

  // Handle content deletion
  const handleDeleteContent = async (content) => {
    try {
      setDeletingContent(prev => new Set(prev).add(content.id))
      
      const token = await supabase.auth.getSession()
      if (!token.data.session) {
        throw new Error('No authentication token available')
      }
      
      const response = await fetch(`${API_BASE_URL}/content/${content.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token.data.session.access_token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to delete content')
      }
      
      const result = await response.json()
      
      // Remove from local state
      setAllContent(prev => prev.filter(c => c.id !== content.id))
      
      // Close confirmation dialog
      setDeleteConfirm(null)
      
      showSuccess('Content deleted successfully', `"${content.title || 'Untitled post'}" has been permanently deleted`)
      
    } catch (error) {
      console.error('Error deleting content:', error)
      
      let errorMessage = error.message
      if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Network error: Unable to connect to server. Please check your internet connection and try again.'
      } else if (error.message.includes('404')) {
        errorMessage = 'Content not found or already deleted.'
      } else if (error.message.includes('500')) {
        errorMessage = 'Server error. Please try again later or contact support.'
      } else if (error.message.includes('401') || error.message.includes('403')) {
        errorMessage = 'Authentication error. Please refresh the page and try again.'
      }
      
      showError('Failed to delete content', errorMessage)
    } finally {
      setDeletingContent(prev => {
        const newSet = new Set(prev)
        newSet.delete(content.id)
        return newSet
      })
    }
  }

  // Images are now stored in Supabase storage for faster loading
  const getImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    return imageUrl
  }

  // Get thumbnail URL for faster loading
  const getThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Add resize transformation to create a smaller, faster-loading thumbnail
      // Using 40x40 with 50% quality for maximum speed
      return `${imageUrl}${separator}width=40&height=40&resize=cover&quality=50&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get extra small thumbnail for collapsed cards (ultra fast loading)
  const getSmallThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for very small thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 24x24 with 30% quality for ultra fast loading in collapsed cards
      return `${imageUrl}${separator}width=24&height=24&resize=cover&quality=30&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get medium thumbnail for expanded cards (balanced size and quality)
  const getMediumThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for medium thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 150x150 with 60% quality for good balance of size and quality
      return `${imageUrl}${separator}width=150&height=150&resize=cover&quality=60&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get ultra small thumbnail for very fast loading (e.g., in lists)
  const getUltraSmallThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL from the generated or user-uploads folder, add resize transformation for ultra small thumbnail
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Check if URL already has query parameters
      const separator = imageUrl.includes('?') ? '&' : '?'
      // Using 16x16 with 20% quality for ultra fast loading
      return `${imageUrl}${separator}width=16&height=16&resize=cover&quality=20&format=webp`
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Get optimized card thumbnail for fast loading in content cards
  // Note: Supabase Storage doesn't support query parameter transformations by default
  // We'll use the original image but optimize loading with proper attributes
  const getCardThumbnailUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // For now, return the original URL - browser and CSS will handle sizing
    // The image will be displayed at 96-112px (w-24 to w-28) so even large images
    // will be rendered at that size, and modern browsers optimize this
    return imageUrl
    
    // TODO: If you have Supabase Image Transformation enabled, you can use:
    // return `${imageUrl}?width=150&height=150&resize=cover&quality=40&format=webp`
    // Or use Supabase's image transformation service if configured
  }

  // Check if the media file is a video
  const isVideoFile = (url) => {
    if (!url) return false
    const videoExtensions = ['.mp4', '.avi', '.mov', '.wmv', '.webm', '.mkv']
    return videoExtensions.some(ext => url.toLowerCase().includes(ext))
  }
  
  // Check if content is a video (checks multiple sources)
  const isVideoContent = (content, mediaUrl) => {
    if (!content) return false
    // Check post_type
    if (content.post_type === 'video' || content.post_type?.toLowerCase() === 'video') {
      return true
    }
    // Check content_type
    if (content.content_type?.toLowerCase() === 'video') {
      return true
    }
    // Check metadata.media_type
    if (content.metadata?.media_type === 'video') {
      return true
    }
    // Check file extension in URL
    if (mediaUrl && isVideoFile(mediaUrl)) {
      return true
    }
    return false
  }

  // Get full-size image URL for detailed viewing
  const getFullSizeImageUrl = (imageUrl) => {
    if (!imageUrl) return null
    
    // If it's a Supabase storage URL, return the original URL for full quality
    if (imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/generated/') || 
        imageUrl.includes('supabase.co/storage/v1/object/public/ai-generated-images/user-uploads/') ||
        imageUrl.includes('supabase.co/storage/v1/object/public/user-uploads/')) {
      // Return original URL without transformations for full quality
      return imageUrl
    }
    
    // For non-generated folder URLs, return null to trigger image generation
    return null
  }

  // Helper function to clean content by removing hashtags
  const cleanContentText = (content) => {
    if (!content) return content
    
    // Remove hashtags from the content text (hashtags that start with #)
    return content.replace(/#\w+/g, '').trim()
  }

  // Handle image load events
  const handleImageLoad = (contentId) => {
    setImageLoading(prev => {
      const newSet = new Set(prev)
      newSet.delete(contentId)
      return newSet
    })
  }

  const handleImageError = (contentId) => {
    setImageLoading(prev => {
      const newSet = new Set(prev)
      newSet.delete(contentId)
      return newSet
    })
  }

  // Start loading when image is first displayed
  const startImageLoading = (contentId) => {
    setImageLoading(prev => new Set(prev).add(contentId))
  }

  // Handle image click to open lightbox
  const handleImageClick = (imageUrl, contentTitle) => {
    console.log('🖼️ Opening lightbox for:', imageUrl)
    console.log('🖼️ Is video file:', isVideoFile(imageUrl))
    setLightboxLoading(true)
    setLightboxImage({
      url: imageUrl,
      title: contentTitle
    })
  }

  // Close lightbox
  const closeLightbox = () => {
    setLightboxImage(null)
    setLightboxLoading(false)
  }

  // Handle scroll to show/hide arrow
  const handleScroll = (e) => {
    const { scrollLeft, scrollWidth, clientWidth } = e.target
    const isAtEnd = scrollLeft + clientWidth >= scrollWidth - 10 // 10px tolerance
    setShowScrollArrow(!isAtEnd)
  }

  // Reset scroll arrow when content changes
  useEffect(() => {
    setShowScrollArrow(true)
  }, [contentToDisplay])

  // Handle keyboard events for lightbox
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (lightboxImage) {
        if (event.key === 'Escape') {
        closeLightbox()
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === ' ') {
          // Prevent default behavior for arrow keys and space
          event.preventDefault()
        }
      }
    }

    if (lightboxImage) {
      document.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when lightbox is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [lightboxImage])

  return (
    <div className={`h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-white'} overflow-hidden`}>
      {/* Content Generation Modal */}
      <ContentGenerationModal 
        isVisible={showGenerationModal} 
        onClose={() => {
          setShowGenerationModal(false)
          setGenerating(false)
          setFetchingFreshData(false)
          setGenerationMessage('')
          setGenerationStatus(null)
        }}
        onComplete={handleProgressComplete}
      />

      {/* Confirmation Modal */}
      {showConfirmationModal && (
        <div className="fixed z-50 flex items-center justify-center md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }}>
          <div className="fixed bg-black bg-opacity-50 backdrop-blur-sm md:left-48 xl:left-64" style={{ right: '0', top: '0', bottom: '0' }} />
          <div className={`relative rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 z-10 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="text-center">
              <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${
                isDarkMode ? 'bg-orange-900/50' : 'bg-orange-100'
              }`}>
                <svg className={`h-6 w-6 fill="none" viewBox="0 0 24 24" stroke="currentColor" ${
                  isDarkMode ? 'text-orange-400' : 'text-orange-600'
                }`}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className={`text-lg font-semibold mb-2 ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Generate Fresh Content
              </h3>
              <p className={`text-sm mb-4 ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>
                This will delete your old content and create fresh content for all platforms.
                Are you sure you want to proceed?
              </p>
              <div className="mb-6">
                <label className="flex items-center space-x-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={generateImagesWithContent}
                    onChange={(e) => setGenerateImagesWithContent(e.target.checked)}
                    className={`w-4 h-4 text-pink-600 rounded focus:ring-pink-500 focus:ring-2 ${
                      isDarkMode ? 'border-gray-600' : 'border-gray-300'
                    }`}
                  />
                  <div className="flex items-center space-x-2">
                    <Image className={`w-4 h-4 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`} />
                    <span className={`text-sm group-hover:text-gray-900 ${
                      isDarkMode ? 'text-gray-300 group-hover:text-gray-100' : 'text-gray-700'
                    }`}>
                      Also generate images for all content posts
                    </span>
                  </div>
                </label>
                <p className={`text-xs mt-1 ml-6 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Images will be generated automatically using your brand colors after content is created
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmationModal(false)
                    setGenerateImagesWithContent(false)
                  }}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 ${
                    isDarkMode
                      ? 'text-gray-300 bg-gray-700 border border-gray-600 hover:bg-gray-600 focus:ring-gray-400'
                      : 'text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 focus:ring-gray-500'
                  }`}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmGeneration}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 rounded-lg hover:from-pink-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  Proceed
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Navigation */}
      <MobileNavigation 
        setShowCustomContentChatbot={setShowCustomContentChatbot}
        handleGenerateContent={handleGenerateContent}
        generating={generating}
        fetchingFreshData={fetchingFreshData}
      />
      
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className="md:ml-48 xl:ml-64 flex flex-col h-screen overflow-hidden">
        {/* Scrollable Content */}
        <div className={`flex-1 p-4 lg:p-6 flex flex-col overflow-y-auto custom-scrollbar ${
          isDarkMode ? 'dark-mode' : 'light-mode'
        }`}>
          {/* Status Message - Only show error messages */}
          {generationStatus === 'error' && (
            <div className={`mb-6 p-4 rounded-lg ${
              isDarkMode
                ? 'bg-red-900/20 border border-red-700 text-red-300'
                : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
              <div className="flex items-center">
                <RefreshCw className={`w-5 h-5 mr-2 ${
                  isDarkMode ? 'text-red-400' : 'text-red-600'
                }`} />
                <span className="font-medium">{generationMessage}</span>
              </div>
            </div>
          )}

          {/* Content Cards - 2 Row Grid Layout */}
          <div className="space-y-6">
            {/* Emily Message Bubble - Always show all channels from profile */}
            {availableChannels.length > 0 && (
              <div className="flex justify-start w-full mb-4">
                <div className="flex items-start gap-2 max-w-[50%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">E</span>
                  </div>
                  <div className={`rounded-lg px-4 py-3 shadow-md ${
                    isDarkMode ? 'bg-gray-800' : 'bg-white'
                  }`} style={{ boxShadow: '0 0 8px rgba(0, 0, 0, 0.15)' }}>
                    {fetchingContent ? (
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-200' : 'text-black'
                      }`}>
                        Loading suggestions...
                      </p>
                    ) : (
                      <>
                        {availableChannels.length > 0 && (
                              <>
                                <p className={`text-sm mb-2 ${
                                  isDarkMode ? 'text-gray-200' : 'text-black'
                                }`}>
                              Here are a few fresh post ideas for you!
                                </p>
                            <p className={`text-sm mb-3 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              Take a look at the suggestions and see what fits your vibe. I've tried to keep them simple, engaging, and easy to post.
                                </p>
                            {/* Channel Icons as Tabs */}
                            <div className="flex flex-wrap gap-2">
                              {availableChannels.map((channel) => {
                                        const channelCount = channelContentCounts[channel] || 0
                                        const isSelected = selectedChannel === channel
                                        return (
                                  <button
                                            key={channel}
                                            onClick={() => setSelectedChannel(channel)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${
                                              isSelected
                                        ? 'bg-purple-50 border-purple-300 shadow-sm'
                                        : isDarkMode
                                        ? 'bg-gray-700 border-gray-600 hover:bg-gray-600 hover:border-gray-500'
                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                            }`}
                                          >
                                    <span className={`flex-shrink-0 w-5 h-5 flex items-center justify-center ${
                                      isSelected ? 'text-purple-600' : (isDarkMode ? 'text-gray-400' : 'text-gray-600')
                                    }`}>
                                              {getPlatformIcon(channel)}
                                            </span>
                                    <span className={`text-xs font-medium ${
                                      isSelected ? 'text-purple-700' : (isDarkMode ? 'text-gray-300' : 'text-gray-700')
                                    }`}>
                                      {channel.charAt(0).toUpperCase() + channel.slice(1)}
                                            </span>
                                    {channelCount > 0 && (
                                      <span className={`text-xs ${
                                        isSelected ? 'text-purple-600' : (isDarkMode ? 'text-gray-400' : 'text-gray-500')
                                      }`}>
                                        ({channelCount})
                                      </span>
                                    )}
                                  </button>
                                        )
                                      })}
                                    </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {selectedChannel && !fetchingContent && filteredContent.length > 0 && (
              <>

                <div className="relative">
                  <div 
                    className="grid grid-cols-4 gap-6 pl-10"
                  >
                {filteredContent.slice(0, itemsToShow === Infinity ? filteredContent.length : itemsToShow).map((content) => {
                  const theme = getPlatformCardTheme(content.platform)
                  console.log('Content platform:', content.platform, 'Theme:', theme)
                  
                  // Only load images for the selected channel
                  // Use case-insensitive comparison
                  const contentPlatform = content.platform?.toLowerCase().trim() || ''
                  const normalizedSelectedChannel = selectedChannel?.toLowerCase().trim() || ''
                  const isSelectedChannel = !selectedChannel || selectedChannel === 'all' || 
                    contentPlatform === normalizedSelectedChannel ||
                    (normalizedSelectedChannel === 'twitter' && (contentPlatform === 'x' || contentPlatform === 'x (twitter)')) ||
                    (normalizedSelectedChannel === 'whatsapp' && contentPlatform.includes('whatsapp')) ||
                    (normalizedSelectedChannel === 'google business profile' && contentPlatform.includes('google'))
                  
                  // Detect carousel posts
                  const isCarousel = content.post_type === 'carousel' || 
                                     (content.metadata && content.metadata.carousel_images && content.metadata.carousel_images.length > 0) ||
                                     (content.carousel_images && Array.isArray(content.carousel_images) && content.carousel_images.length > 0)
                  
                  // Get carousel images from various possible locations
                  let carouselImages = []
                  if (isCarousel) {
                    if (content.carousel_images && Array.isArray(content.carousel_images) && content.carousel_images.length > 0) {
                      carouselImages = content.carousel_images.map(img => typeof img === 'string' ? img : (img.url || img))
                    } else if (content.metadata?.carousel_images && Array.isArray(content.metadata.carousel_images) && content.metadata.carousel_images.length > 0) {
                      carouselImages = content.metadata.carousel_images.map(img => typeof img === 'string' ? img : (img.url || img))
                    } else if (content.metadata?.images && Array.isArray(content.metadata.images) && content.metadata.images.length > 0) {
                      carouselImages = content.metadata.images.map(img => typeof img === 'string' ? img : (img.url || img))
                    }
                  }
                  
                  // Get image URL for left side - only if this is the selected channel
                  // For carousel, use first image; otherwise use primary_image_url
                  const imageUrl = isSelectedChannel 
                    ? (isCarousel && carouselImages.length > 0 
                        ? carouselImages[0] 
                        : (content.media_url || content.image_url))
                    : null
                  const thumbnailUrl = imageUrl ? getCardThumbnailUrl(imageUrl) : null
                  const hasImage = isSelectedChannel && (!!imageUrl || (isCarousel && carouselImages.length > 0))
                  
                  // Check if this is a video
                  const isVideo = isVideoContent(content, imageUrl)
                  
                  // Debug logging for video detection
                  if (imageUrl && isSelectedChannel) {
                    console.log('🔍 Video detection for content:', content.id, {
                      imageUrl,
                      post_type: content.post_type,
                      content_type: content.content_type,
                      metadata_media_type: content.metadata?.media_type,
                      isVideo,
                      isVideoFile: isVideoFile(imageUrl)
                    })
                  }
                  
                  // Debug logging for image URLs
                  if (content.id && !imageUrl && isSelectedChannel) {
                    console.log('⚠️ Content has no image:', content.id, {
                      hasMediaUrl: !!content.media_url,
                      hasContentImage: !!content.image_url,
                      content: content
                    })
                  }
                  
                  // Check if post is approved or scheduled (show green border)
                  const status = content.status?.toLowerCase()
                  const isApproved = status === 'approved' || status === 'scheduled'
                  const isScript = content.video_scripting && typeof content.video_scripting === 'object'
                  const isDraft = status === 'draft'
                  
                  return (
                    <div 
                      key={content.id} 
                      onClick={() => handleViewContent(content)}
                      className={`${theme.bg} rounded-xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-105 w-full flex flex-col shadow-md border cursor-pointer ${
                        isApproved
                          ? 'border-green-500'
                          : isScript && isDraft
                          ? 'border-purple-400 border-2' // Highlight script drafts with purple border
                          : isDarkMode ? 'border-gray-600' : 'border-gray-200'
                      }`}
                    >
                      {/* Top: Logo + Business Name + Date/Time */}
                      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {/* Business Logo */}
                          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center">
                            {profile?.logo_url ? (
                              <img 
                                src={profile.logo_url} 
                                alt="Business logo" 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.target.style.display = 'none'
                                  e.target.nextSibling.style.display = 'flex'
                                }}
                              />
                            ) : null}
                            <div className="w-full h-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center" style={{ display: profile?.logo_url ? 'none' : 'flex' }}>
                              <Building2 className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          {/* Business Name */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 text-sm truncate">
                              {profile?.business_name || 'Business'}
                            </h4>
                            {/* Date and Time - No emojis */}
                            {content.scheduled_at && (
                              <div className="text-xs text-gray-500 mt-0.5">
                                {formatDate(content.scheduled_at)}
                                {content.scheduled_at.includes('T') && (
                                  <span className="ml-1">{formatTime(content.scheduled_at.split('T')[1])}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Full-width Post Image */}
                      {hasImage && (
                        <div className="relative w-full bg-gray-200" style={{ aspectRatio: '1/1' }}>
                              {/* Show placeholder while loading */}
                              {imageLoading.has(content.id) && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                                  <div className="w-8 h-8 bg-gray-300 rounded animate-pulse"></div>
                                </div>
                              )}
                              {(() => {
                                // Only get media URL if this is the selected channel
                                const mediaUrl = isSelectedChannel ? (imageUrl || content.media_url) : null
                                // Always prefer thumbnail for faster loading, fallback to original if thumbnail not available
                                const mediaThumbnail = isSelectedChannel ? (thumbnailUrl || mediaUrl) : null
                                
                                // Check if it's a video - only load for selected channel
                                if (mediaUrl && isVideo && isSelectedChannel) {
                                  return (
                                    <div className="absolute inset-0 w-full h-full group">
                                    <video 
                                      src={mediaUrl}
                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      controls={false}
                                      preload="metadata"
                                      muted
                                      playsInline
                                      onLoadStart={() => {
                                        startImageLoading(content.id)
                                      }}
                                      onLoadedData={() => {
                                        handleImageLoad(content.id)
                                      }}
                                      onError={(e) => {
                                        handleImageError(content.id)
                                      }}
                                      style={{
                                        opacity: imageLoading.has(content.id) ? 0 : 1,
                                        filter: imageLoading.has(content.id) ? 'blur(6px)' : 'blur(0px)',
                                        transition: 'all 0.5s ease-in-out'
                                      }}
                                    />
                                      {/* Play button overlay */}
                                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors pointer-events-none">
                                        <div className="bg-white/90 rounded-full p-2 shadow-lg group-hover:scale-110 transition-transform">
                                          <Play className="w-4 h-4 text-purple-600 fill-purple-600" />
                                        </div>
                                      </div>
                                    </div>
                                  )
                                }
                                
                            // Show carousel images if this is a carousel post - with slider and dots
                                if (isCarousel && carouselImages.length > 0 && isSelectedChannel) {
                              const currentIndex = carouselIndices[content.id] || 0
                              
                              const goToPrevious = (e) => {
                                e.stopPropagation()
                                if (currentIndex > 0) {
                                  setCarouselIndices(prev => ({
                                    ...prev,
                                    [content.id]: currentIndex - 1
                                  }))
                                }
                              }
                              
                              const goToNext = (e) => {
                                e.stopPropagation()
                                if (currentIndex < carouselImages.length - 1) {
                                  setCarouselIndices(prev => ({
                                    ...prev,
                                    [content.id]: currentIndex + 1
                                  }))
                                }
                              }
                                  
                                  return (
                                <div className="absolute inset-0 w-full h-full overflow-hidden group">
                                  {/* Carousel Slider */}
                                  <div 
                                    className="flex transition-transform duration-300 ease-in-out h-full"
                                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                                  >
                                    {carouselImages.map((imgUrl, index) => {
                                      const imageUrl = typeof imgUrl === 'string' ? imgUrl : (imgUrl.url || imgUrl)
                                            return (
                                        <div key={index} className="w-full h-full flex-shrink-0 relative">
                                                <img
                                            src={getCardThumbnailUrl(imageUrl) || imageUrl}
                                            alt={`Carousel image ${index + 1}`}
                                                  className="w-full h-full object-cover"
                                                  onError={(e) => {
                                                    e.target.style.display = 'none'
                                                  }}
                                                />
                                              </div>
                                            )
                                          })}
                                        </div>
                                  
                                  {/* Left Arrow - Show on hover */}
                                  {carouselImages.length > 1 && currentIndex > 0 && (
                                    <button
                                      onClick={goToPrevious}
                                      className="absolute left-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20"
                                      aria-label="Previous image"
                                    >
                                      <ChevronLeft className="w-5 h-5 text-white" />
                                    </button>
                                  )}
                                  
                                  {/* Right Arrow - Show on hover */}
                                  {carouselImages.length > 1 && currentIndex < carouselImages.length - 1 && (
                                    <button
                                      onClick={goToNext}
                                      className="absolute right-2 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20"
                                      aria-label="Next image"
                                    >
                                      <ChevronRight className="w-5 h-5 text-white" />
                                    </button>
                                  )}
                                  
                                  {/* Navigation Dots */}
                                  {carouselImages.length > 1 && (
                                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 z-10">
                                      {carouselImages.map((_, index) => (
                                        <button
                                          key={index}
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setCarouselIndices(prev => ({
                                              ...prev,
                                              [content.id]: index
                                            }))
                                          }}
                                          className={`transition-all duration-200 rounded-full ${
                                            index === currentIndex
                                              ? 'w-2 h-2 bg-white'
                                              : 'w-1.5 h-1.5 bg-white/50 hover:bg-white/75'
                                          }`}
                                          aria-label={`Go to slide ${index + 1}`}
                                        />
                                      ))}
                                      </div>
                                  )}
                                    </div>
                                  )
                                }
                                
                                // Show image - using optimized thumbnail for fast loading
                                if (mediaThumbnail && isSelectedChannel) {
                                  const imageIndex = filteredContent.findIndex(c => c.id === content.id)
                                  const shouldLoadEager = imageIndex < 4
                                  
                                  return (
                                    <img 
                                      src={mediaThumbnail} 
                                      alt="Content image" 
                                  className="absolute inset-0 w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      loading={shouldLoadEager ? "eager" : "lazy"}
                                      decoding="async"
                                      onLoad={() => {
                                        handleImageLoad(content.id)
                                      }}
                                      onError={(e) => {
                                        if (mediaThumbnail !== mediaUrl) {
                                          const img = e.target
                                          img.src = mediaUrl
                                        } else {
                                          handleImageError(content.id)
                                        }
                                      }}
                                      onLoadStart={() => {
                                        startImageLoading(content.id)
                                      }}
                                      style={{
                                        opacity: imageLoading.has(content.id) ? 0 : 1,
                                        filter: imageLoading.has(content.id) ? 'blur(6px)' : 'blur(0px)',
                                        transition: 'all 0.5s ease-in-out'
                                      }}
                                    />
                                  )
                                }
                                
                                return null
                              })()}
                            </div>
                      )}
                      
                      {/* Action Icons Below Image (Left side) */}
                      <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-200">
                        {/* Only show edit, generate, and delete buttons */}
                          {content.status?.toLowerCase() !== 'published' && (
                            <>
                              <div className="relative">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditContent(content)
                                  }}
                                  onMouseEnter={() => setHoveredButton(`${content.id}-edit`)}
                                  onMouseLeave={() => setHoveredButton(null)}
                                className="w-8 h-8 transition-all duration-200 flex items-center justify-center hover:opacity-70"
                                >
                                <Edit className="w-4 h-4 text-gray-600" />
                                </button>
                                {hoveredButton === `${content.id}-edit` && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                                    Edit Post
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="relative">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleGenerateMedia(content)
                                  }}
                                  onMouseEnter={() => setHoveredButton(`${content.id}-generate`)}
                                  onMouseLeave={() => setHoveredButton(null)}
                                  disabled={generatingMedia.has(content.id)}
                                className={`w-8 h-8 transition-all duration-200 flex items-center justify-center ${
                                    generatingMedia.has(content.id)
                                    ? 'cursor-not-allowed opacity-50'
                                    : 'hover:opacity-70'
                                  }`}
                                >
                                  {generatingMedia.has(content.id) ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                                  ) : (
                                  <Wand2 className="w-4 h-4 text-gray-600" />
                                  )}
                                </button>
                                {hoveredButton === `${content.id}-generate` && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                                    {generatingMedia.has(content.id) ? 'Generating Image with AI...' : 'Generate Image with AI'}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                )}
                              </div>
                              
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    e.preventDefault()
                                    
                                    // Check if platform is connected
                                    if (!isPlatformConnected(content.platform)) {
                                      showError('Account Not Connected', `Please connect your ${content.platform} account in Settings > Connections before publishing.`)
                                      return
                                    }
                                    
                                    // Prevent duplicate clicks
                                    if (postingContent.has(content.id)) {
                                      console.log('⚠️ Already posting, ignoring click')
                                      return
                                    }
                                    
                                    // Check if already published
                                    const status = content.status?.toLowerCase()
                                    if (status === 'published') {
                                      showError('Post Already Published', 'This post has already been published.')
                                      return
                                    }
                                    
                                    // Publish post to platform
                                    handlePostContent(content)
                                  }}
                                onMouseEnter={() => setHoveredButton(`${content.id}-post`)}
                                  onMouseLeave={() => setHoveredButton(null)}
                                  disabled={postingContent.has(content.id) || content.status?.toLowerCase() === 'published' || !isPlatformConnected(content.platform)}
                                className={`w-8 h-8 transition-all duration-200 flex items-center justify-center ${
                                  postingContent.has(content.id) || !isPlatformConnected(content.platform)
                                    ? 'cursor-not-allowed opacity-50'
                                    : 'hover:opacity-70'
                                }`}
                                >
                                  {postingContent.has(content.id) ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                                  ) : (
                                  <Send className={`w-4 h-4 ${!isPlatformConnected(content.platform) ? 'text-gray-400' : 'text-gray-600'}`} />
                                  )}
                                </button>
                              {hoveredButton === `${content.id}-post` && (
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                                  {postingContent.has(content.id) 
                                    ? 'Publishing...' 
                                    : !isPlatformConnected(content.platform)
                                    ? `${content.platform} account not connected`
                                    : `Post to ${content.platform}`}
                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                          
                          <div className="relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeleteConfirm(content)
                              }}
                              onMouseEnter={() => setHoveredButton(`${content.id}-delete`)}
                              onMouseLeave={() => setHoveredButton(null)}
                              disabled={deletingContent.has(content.id)}
                            className={`w-8 h-8 transition-all duration-200 flex items-center justify-center ${
                                deletingContent.has(content.id)
                                ? 'cursor-not-allowed opacity-50'
                                : 'hover:opacity-70'
                              }`}
                            >
                              {deletingContent.has(content.id) ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                              ) : (
                              <Trash2 className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                            {hoveredButton === `${content.id}-delete` && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap z-50">
                                {deletingContent.has(content.id) ? 'Deleting...' : 'Delete Post'}
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                              </div>
                            )}
                          </div>
                        
                        {/* Status Dropdown - Inline with icons */}
                        <div className="relative status-dropdown flex-shrink-0 ml-auto">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setStatusDropdownOpen(statusDropdownOpen === content.id ? null : content.id)
                            }}
                            disabled={updatingStatus.has(content.id)}
                            className={`px-2 py-1 text-xs font-medium flex items-center space-x-1 ${getStatusTextColor(content.status)} hover:opacity-80 transition-opacity disabled:opacity-50`}
                          >
                            <span className="capitalize text-xs">{content.status}</span>
                            {updatingStatus.has(content.id) ? (
                              <RefreshCw className="w-3 h-3 animate-spin" />
                            ) : (
                              <ChevronDown className="w-3 h-3" />
                            )}
                          </button>
                          
                          {/* Dropdown Menu */}
                          {statusDropdownOpen === content.id && (
                            <div className="absolute right-0 top-full mt-1 w-36 bg-white rounded-lg shadow-xl border border-gray-200 z-50 animate-in slide-in-from-top-2 duration-200">
                              <div className="py-1">
                                {statusOptions.map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleStatusChange(content.id, option.value)
                                    }}
                                    disabled={updatingStatus.has(content.id) || content.status === option.value}
                                    className={`w-full text-left px-3 py-2 text-xs font-medium hover:bg-gray-50 transition-colors flex items-center space-x-2 ${
                                      content.status === option.value ? 'bg-gray-100 text-gray-600' : 'text-gray-700'
                                    } ${updatingStatus.has(content.id) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  >
                                    <div className={`w-2 h-2 rounded-full ${option.color.split(' ')[0]}`}></div>
                                    <span className="capitalize">{option.label}</span>
                                    {updatingStatus.has(content.id) && content.status === option.value && (
                                      <RefreshCw className="w-3 h-3 animate-spin ml-auto" />
                                    )}
                                  </button>
                                ))}
                        </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Post Content Below Icons */}
                      <div className="px-4 py-3">
                        {/* Check if this is a script (has video_scripting) */}
                        {content.video_scripting && typeof content.video_scripting === 'object' ? (
                          /* Display Script in same format as chatbot */
                          <div className="space-y-3">
                            {/* Script Title */}
                            {content.video_scripting.title && (
                              <h5 className="font-bold text-purple-800 text-base mb-2">📝 {content.video_scripting.title}</h5>
                            )}
                            
                            {/* Hook */}
                            {content.video_scripting.hook && (
                              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                <div className="text-xs font-semibold text-purple-700 mb-1">🎣 Hook:</div>
                                <div className="text-sm text-gray-700 line-clamp-2">{content.video_scripting.hook}</div>
                              </div>
                            )}
                            
                            {/* Scenes Preview - Show first scene only in card */}
                            {content.video_scripting.scenes && Array.isArray(content.video_scripting.scenes) && content.video_scripting.scenes.length > 0 && (
                              <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                                <div className="text-xs font-semibold text-purple-700 mb-1">🎬 Scene 1:</div>
                                {content.video_scripting.scenes[0].visual && (
                                  <div className="text-xs text-gray-600 mb-1">
                                    <span className="font-semibold">Visual: </span>
                                    <span className="line-clamp-1">{content.video_scripting.scenes[0].visual}</span>
                                  </div>
                                )}
                                {content.video_scripting.scenes[0].audio && (
                                  <div className="text-xs text-gray-600">
                                    <span className="font-semibold">Audio: </span>
                                    <span className="line-clamp-1">{content.video_scripting.scenes[0].audio}</span>
                                  </div>
                                )}
                                {content.video_scripting.scenes.length > 1 && (
                                  <div className="text-xs text-purple-600 mt-1">
                                    +{content.video_scripting.scenes.length - 1} more scene{content.video_scripting.scenes.length - 1 > 1 ? 's' : ''}
                                  </div>
                                )}
                              </div>
                            )}
                            
                            {/* CTA Preview */}
                            {content.video_scripting.call_to_action && (
                              <div className="text-xs text-gray-600">
                                <span className="font-semibold">📢 CTA: </span>
                                <span className="line-clamp-1">{content.video_scripting.call_to_action}</span>
                              </div>
                            )}
                            
                            {/* View Full Script Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewContent(content)
                              }}
                              className="w-full mt-2 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-medium text-xs flex items-center justify-center gap-2"
                            >
                              View Full Script
                            </button>
                          </div>
                        ) : (
                          /* Regular Content Display */
                          <>
                        {/* Title - One line only */}
                        {content.title && (
                          <h5 className="font-semibold text-gray-900 mb-2 text-base line-clamp-1 truncate">{content.title}</h5>
                        )}
                        
                        {/* Content Text - One row only with inline ...more */}
                        {content.content && cleanContentText(content.content).trim().length > 0 && (
                          <div className="flex items-center gap-1 text-sm text-gray-700">
                            <p className="line-clamp-1 truncate flex-1">
                              {cleanContentText(content.content)}
                            </p>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleViewContent(content)
                              }}
                              className="text-purple-600 hover:text-purple-800 font-medium flex-shrink-0"
                            >
                              ...more
                            </button>
                          </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
                </div>
                
                {/* Show Less Indicator - Line and Arrow (when expanded) */}
                {itemsToShow > 4 && (
                  <div className="flex flex-col items-center justify-center mt-8 pl-10">
                    <button
                      onClick={() => {
                        // Collapse back to one row (4 items)
                        setItemsToShow(4)
                      }}
                      className="flex flex-col items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      <ChevronUp className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                      <div className="h-px bg-gray-300 w-16 group-hover:bg-purple-500 transition-colors"></div>
                    </button>
                  </div>
                )}
                
                {/* Show More Indicator - Line and Arrow (shows all posts when clicked) */}
                {(filteredContent.length > itemsToShow || hasMoreContent) && (
                  <div className="flex flex-col items-center justify-center mt-8 pl-10">
                    <button
                      onClick={async () => {
                        // If there's more content to load (from other dates), fetch it first
                        if (hasMoreContent && !loadingAllContent) {
                          setLoadingAllContent(true)
                          try {
                            // Fetch all content without date limit
                            await loadAllContent()
                            // Reset hasMoreContent since we've loaded everything
                            setHasMoreContent(false)
                            // Show all posts - will be updated when filteredContent updates
                            // Use a small delay to ensure state has updated
                            setTimeout(() => {
                              setItemsToShow(Infinity) // Show all by setting to a very large number
                            }, 50)
                          } catch (error) {
                            console.error('Error loading all content:', error)
                          } finally {
                            setLoadingAllContent(false)
                          }
                        } else {
                          // Just show all currently loaded posts
                          setItemsToShow(filteredContent.length)
                        }
                      }}
                      className="flex flex-col items-center gap-2 group cursor-pointer hover:opacity-80 transition-opacity"
                      disabled={loadingAllContent}
                    >
                      <div className="h-px bg-gray-300 w-16 group-hover:bg-purple-500 transition-colors"></div>
                      {loadingAllContent ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                      )}
                    </button>
                  </div>
                )}
                  </div>
              </>
            )}

            {/* Emily Message Bubble - After Content Cards - Always show when channel is selected */}
            {!fetchingContent && selectedChannel && (
              <>
              <div className="flex justify-start w-full mt-6">
                <div className="flex items-start gap-2 max-w-[50%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">E</span>
                  </div>
                  <div className="bg-white rounded-lg px-4 py-3 shadow-md" style={{ boxShadow: '0 0 8px rgba(0, 0, 0, 0.15)' }}>
                    <p className="text-sm text-black mb-3">
                      Want to create more inspiring content ?
                    </p>
                    <div className="flex flex-col gap-2">
                      <div className="text-sm text-black">
                        Leo can help you craft personalised post for you{' '}
                        <span
                          onClick={() => setShowCustomContentChatbot(true)}
                          className="text-blue-600 hover:text-blue-700 cursor-pointer hover:underline"
                        >
                          Talk to Leo
                        </span>
                      </div>
                      <div className="text-sm text-black">
                        I can generate fresh ideas beyond what you've already approved :{' '}
                        <span
                          onClick={handleGenerateContent}
                          className={`text-purple-600 hover:text-purple-700 cursor-pointer hover:underline ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          Let's do that
                        </span>
                      </div>
                      <div className="text-sm text-black">
                        I can also create content from drive photos :{' '}
                        <button
                          onClick={() => setShowDriveContentModal(true)}
                          className="text-green-600 hover:text-green-700 cursor-pointer hover:underline font-medium"
                        >
                          Let's do that
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
                {/* White space after second message bubble */}
                <div style={{ height: '300px' }}></div>
                </>
            )}
          </div>
        </div>


      </div>

      {/* Content View Modal */}
      {selectedContentForModal && (
        <ContentModal
          content={selectedContentForModal}
          profile={profile}
          onClose={handleCloseModal}
          onImageClick={handleImageClick}
          onReplaceCarouselImage={handleReplaceCarouselImage}
          onFileSelect={handleFileSelect}
          onUploadImage={handleUploadImage}
          onUploadCarouselImage={undefined}
          onSetImageEditorData={setImageEditorData}
          onShowImageEditor={setShowImageEditor}
          onGenerateMedia={handleGenerateMedia}
          generatingMedia={generatingMedia}
          editingTitleInModal={editingTitleInModal}
          editingContentInModal={editingContentInModal}
          editTitleValue={editTitleValue}
          editContentValue={editContentValue}
          onEditTitleValueChange={setEditTitleValue}
          onEditContentValueChange={setEditContentValue}
          onManualEdit={handleManualEdit}
          onAIEdit={handleAIEdit}
          onSaveManualEdit={handleSaveManualEdit}
          onCancelManualEdit={handleCancelManualEdit}
          savingModalEdit={savingModalEdit}
          onStatusChange={(contentId, newStatus) => {
            handleStatusChange(contentId, newStatus)
            // Update modal content immediately
            setSelectedContentForModal(prev => prev ? { ...prev, status: newStatus } : null)
          }}
          onApprovePost={handleApprovePost}
          onDisapprovePost={handleDisapprovePost}
          onDeleteConfirm={setDeleteConfirm}
          uploadingImage={uploadingImage}
          updatingStatus={updatingStatus}
          isVideoFile={isVideoFile}
          getFullSizeImageUrl={getFullSizeImageUrl}
          cleanContentText={cleanContentText}
          getStatusColor={getStatusColor}
          statusOptions={statusOptions}
        />
      )}

      {/* AI Edit Modal */}
      {showAIEditModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[60]"
          onClick={handleCancelAIEdit}
        >
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 pb-20"
            style={{ left: '12rem', right: '0' }}
          >
            <div 
              className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Edit {aiEditType === 'title' ? 'Title' : 'Content'} with AI</h3>
                      <p className="text-sm text-gray-600">Provide instructions to modify the {aiEditType === 'title' ? 'title' : 'content'}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelAIEdit}
                    className="w-8 h-8 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Current Content Preview */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Current {aiEditType === 'title' ? 'Title' : 'Content'}</label>
                    <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {aiEditType === 'title' 
                        ? (selectedContentForModal?.title || '')
                        : (selectedContentForModal?.content || '')
                      }
                    </div>
                  </div>
                  
                  {/* AI Instruction */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      AI Instruction <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <textarea
                        value={aiEditInstruction}
                        onChange={(e) => setAiEditInstruction(e.target.value)}
                        className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm"
                        rows={5}
                        placeholder="Describe how you want the content to be modified..."
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {aiEditInstruction.length}/500
                      </div>
                    </div>
                    
                    {/* Instruction Examples */}
                    <div className="mt-3">
                      <p className="text-xs text-gray-500 mb-2">💡 Example instructions:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <button
                          onClick={() => setAiEditInstruction("Make it more engaging and add relevant emojis")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          ✨ Make it more engaging
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Make it shorter and more concise")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          📝 Make it shorter
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Change the tone to be more professional")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          💼 Professional tone
                        </button>
                        <button
                          onClick={() => setAiEditInstruction("Add a call-to-action at the end")}
                          className="text-left p-2 text-xs bg-purple-50 hover:bg-purple-100 rounded border border-purple-200 transition-colors"
                        >
                          🎯 Add call-to-action
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCancelAIEdit}
                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAISaveEdit}
                    disabled={aiEditing || !aiEditInstruction.trim() || aiEditInstruction.length > 500}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {aiEditing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>AI Editing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Edit with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Edit Confirmation Modal */}
      {showAIConfirmModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-[60]"
          onClick={handleAIConfirmCancel}
        >
          <div 
            className="fixed inset-0 flex items-center justify-center p-4 pb-20"
            style={{ left: '12rem', right: '0' }}
          >
            <div 
              className="relative max-w-2xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">AI Edit Complete</h3>
                      <p className="text-sm text-gray-600">Review the AI-edited {aiEditType === 'title' ? 'title' : 'content'} before saving</p>
                    </div>
                  </div>
                  <button
                    onClick={handleAIConfirmCancel}
                    className="w-8 h-8 bg-purple-100 hover:bg-purple-200 text-purple-600 rounded-full flex items-center justify-center transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {/* Original Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Original {aiEditType === 'title' ? 'Title' : 'Content'}</label>
                    <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {aiEditType === 'title' 
                        ? (selectedContentForModal?.title || '')
                        : (selectedContentForModal?.content || '')
                      }
                    </div>
                  </div>
                  
                  {/* AI Edited Content */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Edited {aiEditType === 'title' ? 'Title' : 'Content'} <span className="text-pink-600">✨</span>
                    </label>
                    <div className="p-3 bg-pink-50 border border-pink-200 rounded-lg text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {aiEditedContent}
                    </div>
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-purple-200">
                  <button
                    onClick={handleAIConfirmCancel}
                    className="px-4 py-2 text-purple-600 bg-purple-100 hover:bg-purple-200 rounded-lg font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAIConfirmSave}
                    disabled={saving}
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Save AI Edit</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingContent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className={`rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto custom-scrollbar ${
            isDarkMode
              ? 'bg-gray-800 border-gray-700 dark-mode'
              : 'bg-white border-purple-100 light-mode'
          }`}>
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                    <Edit className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Edit Content</h3>
                </div>
                <button
                  onClick={handleCancelEdit}
                  className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-gray-600" />
                </button>
              </div>

              <div className="space-y-6">
                {/* Title */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editForm.title}
                    onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    placeholder="Enter content title"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Content
                  </label>
                  <textarea
                    value={editForm.content}
                    onChange={(e) => setEditForm(prev => ({ ...prev, content: e.target.value }))}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300 resize-none"
                    placeholder="Enter content text"
                  />
                </div>

                {/* Hashtags */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Hashtags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={editForm.hashtags}
                    onChange={(e) => setEditForm(prev => ({ ...prev, hashtags: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    placeholder="Enter hashtags separated by commas"
                  />
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={editForm.scheduled_date}
                      onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_date: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Scheduled Time
                    </label>
                    <input
                      type="time"
                      value={editForm.scheduled_time}
                      onChange={(e) => setEditForm(prev => ({ ...prev, scheduled_time: e.target.value }))}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300"
                    />
                  </div>
                </div>

                {/* Media Upload and Status - Two Column Layout */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Media Upload Section - Supports both images and videos */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-3">
                      Replace Media
                    </label>
                    
                    {/* Current Media Display */}
                    {editForm.media_url && (
                      <div className="mb-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-semibold text-purple-800">Current Media:</span>
                          <span className="text-xs px-2 py-1 rounded-full font-medium bg-green-100 text-green-800">
                            Available
                          </span>
                        </div>
                        <div className="relative w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                          {imageLoading.has(editForm.id) && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            </div>
                          )}
                          
                          {isVideoFile(editForm.media_url) ? (
                            <video 
                              src={editForm.media_url}
                              className="w-full h-32 object-cover rounded-lg"
                              controls
                              preload="metadata"
                              onLoadStart={() => {
                                console.log('🔍 Video loading started, URL:', editForm.media_url)
                                startImageLoading(editForm.id)
                              }}
                              onLoadedData={() => handleImageLoad(editForm.id)}
                              onError={() => handleImageError(editForm.id)}
                              style={{
                                opacity: imageLoading.has(editForm.id) ? 0 : 1,
                                filter: imageLoading.has(editForm.id) ? 'blur(8px)' : 'blur(0px)',
                                transform: imageLoading.has(editForm.id) ? 'scale(1.05)' : 'scale(1)',
                                transition: 'all 0.6s ease-in-out'
                              }}
                            >
                              Your browser does not support the video tag.
                            </video>
                          ) : (
                          <img 
                            src={getSmallThumbnailUrl(editForm.media_url)} 
                              alt="Current content media" 
                            className="w-full h-32 object-cover rounded-lg"
                            onLoad={() => handleImageLoad(editForm.id)}
                            onError={() => handleImageError(editForm.id)}
                            onLoadStart={() => startImageLoading(editForm.id)}
                            style={{
                              opacity: imageLoading.has(editForm.id) ? 0 : 1,
                              filter: imageLoading.has(editForm.id) ? 'blur(8px)' : 'blur(0px)',
                              transform: imageLoading.has(editForm.id) ? 'scale(1.05)' : 'scale(1)',
                              transition: 'all 0.6s ease-in-out'
                            }}
                          />
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* File Upload */}
                    <div className="space-y-4">
                      <div className="relative">
                      <input
                        type="file"
                          accept="image/*,video/mp4,video/avi,video/mov,video/wmv,video/webm"
                        onChange={handleFileSelect}
                          className="w-full h-24 border-2 border-dashed border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-400 transition-all duration-200 hover:border-purple-300 cursor-pointer opacity-0 absolute inset-0"
                        />
                        <div className="w-full h-24 border-2 border-dashed border-purple-200 rounded-xl flex items-center justify-center hover:border-purple-300 transition-all duration-200">
                          <div className="text-center">
                            <Upload className="w-6 h-6 text-purple-400 mx-auto mb-1" />
                            <p className="text-sm text-purple-600 font-medium">Click to browse files</p>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center">
                        <span className="w-1 h-1 bg-purple-400 rounded-full mr-2"></span>
                        Supported formats: JPG, PNG, GIF (max 10MB), MP4, AVI, MOV, WMV, WEBM (max 100MB)
                      </p>
                      
                      {/* Selected File Preview */}
                      {selectedFile && (
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                          <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                              {selectedFile.type.startsWith('video/') ? (
                                <Video className="w-5 h-5 text-white" />
                              ) : (
                                <Image className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{selectedFile.name}</p>
                              <p className="text-xs text-purple-600 font-medium">
                                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • {selectedFile.type.startsWith('video/') ? 'Video' : 'Image'}
                              </p>
                            </div>
                            <button
                              onClick={() => setSelectedFile(null)}
                              className="w-8 h-8 bg-red-100 hover:bg-red-200 rounded-full flex items-center justify-center transition-colors"
                            >
                              <X className="w-4 h-4 text-red-600" />
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Upload Button */}
                      {selectedFile && (
                        <div className="space-y-2">
                          <button
                            onClick={() => {
                              console.log('🔍 Upload button clicked, editForm.id:', editForm.id)
                              handleUploadImage(editForm.id)
                            }}
                            disabled={uploadingImage.has(editForm.id)}
                            className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg hover:from-cyan-500 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 flex items-center justify-center space-x-2"
                          >
                            {uploadingImage.has(editForm.id) ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4" />
                                <span>{selectedFile.type.startsWith('video/') ? 'Upload New Video' : 'Upload New Image'}</span>
                              </>
                            )}
                          </button>
                          
                          {/* Debug info */}
                          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
                            <div>API URL: {API_BASE_URL}</div>
                            <div>Post ID: {editForm.id}</div>
                            <div>File: {selectedFile?.name} ({(selectedFile?.size / 1024).toFixed(1)}KB)</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end space-x-4 mt-8 pt-6 border-t-2 border-gradient-to-r from-purple-200 to-pink-200">
                <button
                  onClick={handleCancelEdit}
                  className="px-6 py-3 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-xl hover:from-pink-600 hover:to-purple-500 transition-all duration-300 disabled:opacity-50 flex items-center space-x-2 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Edit className="w-4 h-4" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Media Lightbox Modal */}
      {lightboxImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-6"
          onClick={closeLightbox}
        >
            {/* Close button */}
            <button
              onClick={closeLightbox}
            className="absolute top-6 right-6 z-10 bg-white bg-opacity-10 backdrop-blur-md text-white p-3 rounded-full shadow-xl hover:bg-opacity-20 transition-all duration-300 border border-white border-opacity-20"
            >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
          {/* Media title - positioned above the image */}
          {lightboxImage.title && (
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">{lightboxImage.title}</h3>
              <div className="w-16 h-1 bg-gradient-to-r from-purple-500 to-pink-500 mx-auto rounded-full"></div>
            </div>
          )}
          
          {/* Media Container - 70% of screen size */}
          <div className="relative w-[70vw] h-[70vh] flex items-center justify-center">
            {/* Loading spinner */}
            {lightboxLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <RefreshCw className="w-12 h-12 text-white animate-spin" />
                    <div className="absolute inset-0 w-12 h-12 border-2 border-purple-500 border-opacity-30 rounded-full"></div>
                  </div>
                  <p className="text-white text-lg font-medium">Loading image...</p>
                </div>
              </div>
            )}
            
            {isVideoFile(lightboxImage.url) ? (
              <video
                src={lightboxImage.url}
                className="w-full h-full object-contain rounded-2xl shadow-2xl border border-white border-opacity-20"
                controls
                autoPlay
                muted
                playsInline
                onClick={(e) => e.stopPropagation()}
                onLoadedData={() => setLightboxLoading(false)}
                onError={() => setLightboxLoading(false)}
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="w-full h-full object-contain rounded-2xl shadow-2xl border border-white border-opacity-20"
                onClick={(e) => e.stopPropagation()}
                onLoad={() => setLightboxLoading(false)}
                onError={() => setLightboxLoading(false)}
              />
              )}
            </div>
          
          {/* Additional info at bottom */}
          <div className="mt-6 text-center">
            <p className="text-gray-300 text-sm">Click outside or press ESC to close</p>
          </div>
        </div>
      )}

      {/* Drive Content Processing Modal */}
      <DriveContentProcessingModal
        isOpen={showDriveContentModal}
        onClose={() => {
          setShowDriveContentModal(false)
          // Refresh content after closing
          fetchAllContent()
        }}
        onSuccess={(postsCreated) => {
          // Refresh content when processing succeeds
          if (postsCreated > 0) {
            fetchAllContent()
          }
        }}
      />

      {/* Custom Content Chatbot Modal */}
      <CustomContentChatbot
        isOpen={showCustomContentChatbot}
        onClose={() => setShowCustomContentChatbot(false)}
        onContentCreated={(content) => {
          console.log('Custom content created:', content);
          // Refresh the content list
          fetchAllContent();
          setShowCustomContentChatbot(false);
        }}
      />

      {/* Chatbot Image Editor Modal */}
      {showImageEditor && imageEditorData && (
        <ChatbotImageEditor
          isOpen={showImageEditor}
          onClose={() => {
            setShowImageEditor(false)
            setImageEditorData(null)
            
            // Refresh the content dashboard after modal closes (with a small delay)
            setTimeout(async () => {
              try {
                await fetchAllContent()
              } catch (error) {
                console.error('Error refreshing content after modal close:', error)
              }
            }, 100) // Small delay to ensure modal is fully closed
          }}
          postContent={imageEditorData.postContent}
          inputImageUrl={imageEditorData.inputImageUrl}
          onImageSaved={async (newImageUrl) => {
            // The image URL stays the same, but the content is replaced
            // We need to refresh the content data to show the updated image
            try {
              // Refresh the content data to get the updated image
              await fetchAllContent()
              
              // Show success message
              showSuccess('Image saved successfully! The edited image has replaced the original.')
            } catch (error) {
              console.error('Error refreshing content after image save:', error)
              showError('Image saved, but failed to refresh content', 'Please refresh the page to see the updated image')
            }
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 border border-gray-200">
            <div className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
    </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">Delete Post</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700 mb-2">
                  Are you sure you want to delete this post?
                </p>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                  <p className="font-medium text-gray-800">
                    {deleteConfirm.title || 'Untitled Post'}
                  </p>
                  <p className="text-sm text-gray-600 capitalize">
                    {deleteConfirm.platform} • {deleteConfirm.status}
                  </p>
                </div>
                <p className="text-sm text-red-600 mt-2">
                  This will permanently delete the post and any associated images.
                </p>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deletingContent.has(deleteConfirm.id)}
                  className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteContent(deleteConfirm)}
                  disabled={deletingContent.has(deleteConfirm.id)}
                  className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center space-x-2"
                >
                  {deletingContent.has(deleteConfirm.id) ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Delete Post</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post Success Notification */}
      {postNotification && (
        <div 
          className={`fixed inset-0 flex items-center justify-center z-50 transition-all duration-500 ${
            postNotification.show 
              ? 'opacity-100 scale-100' 
              : 'opacity-0 scale-95 pointer-events-none'
          }`}
          onClick={(e) => {
            // Close notification when clicking backdrop
            if (e.target === e.currentTarget) {
              console.log('Backdrop clicked, closing notification')
              handleCloseNotification()
            }
          }}
        >
          <div 
            className={`bg-white rounded-3xl shadow-2xl border-2 p-8 max-w-sm mx-4 transform transition-all duration-500 relative ${
              postNotification.show 
                ? 'translate-y-0 scale-100' 
                : 'translate-y-4 scale-95'
            }`} 
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: '2px solid rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                console.log('X button clicked')
                handleCloseNotification()
              }}
              className="absolute top-4 right-4 w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-all duration-200 backdrop-blur-sm z-50 cursor-pointer"
              style={{ zIndex: 9999 }}
            >
              <X className="w-4 h-4 text-white" />
            </button>
            
            <div className="text-center">
              
              {/* Platform Icon */}
              <div className="mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto backdrop-blur-sm">
                  {postNotification.platform === 'Facebook' && (
                    <Facebook className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'Instagram' && (
                    <Instagram className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'LinkedIn' && (
                    <Linkedin className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'YouTube' && (
                    <Youtube className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'Twitter' && (
                    <X className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'X' && (
                    <X className="w-8 h-8 text-white" />
                  )}
                  {postNotification.platform === 'Google Business' && (
                    <Building2 className="w-8 h-8 text-white" />
                  )}
                </div>
              </div>
              
              {/* Success Message */}
              <h3 className="text-2xl font-bold text-white mb-2 animate-pulse">
                🎉 Woohoo!
              </h3>
              
              {/* Party Popper Animation */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {/* Confetti pieces */}
                <div className="absolute top-0 left-1/4 w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{animationDelay: '0s', animationDuration: '1s'}}></div>
                <div className="absolute top-0 right-1/4 w-2 h-2 bg-pink-400 rounded-full animate-bounce" style={{animationDelay: '0.2s', animationDuration: '1.2s'}}></div>
                <div className="absolute top-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.4s', animationDuration: '1.1s'}}></div>
                <div className="absolute top-0 right-1/3 w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{animationDelay: '0.6s', animationDuration: '1.3s'}}></div>
                <div className="absolute top-0 left-1/3 w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{animationDelay: '0.8s', animationDuration: '1.4s'}}></div>
                
                {/* More confetti */}
                <div className="absolute top-2 left-1/5 w-1.5 h-1.5 bg-red-400 rounded-full animate-bounce" style={{animationDelay: '1s', animationDuration: '1.5s'}}></div>
                <div className="absolute top-2 right-1/5 w-1.5 h-1.5 bg-orange-400 rounded-full animate-bounce" style={{animationDelay: '1.2s', animationDuration: '1.6s'}}></div>
                <div className="absolute top-2 left-2/3 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" style={{animationDelay: '1.4s', animationDuration: '1.7s'}}></div>
                <div className="absolute top-2 right-2/3 w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '1.6s', animationDuration: '1.8s'}}></div>
                
                {/* Side confetti */}
                <div className="absolute top-1/4 left-0 w-1 h-1 bg-yellow-300 rounded-full animate-bounce" style={{animationDelay: '0.5s', animationDuration: '1.2s'}}></div>
                <div className="absolute top-1/3 right-0 w-1 h-1 bg-pink-300 rounded-full animate-bounce" style={{animationDelay: '0.7s', animationDuration: '1.4s'}}></div>
                <div className="absolute top-1/2 left-0 w-1 h-1 bg-blue-300 rounded-full animate-bounce" style={{animationDelay: '0.9s', animationDuration: '1.6s'}}></div>
                <div className="absolute top-2/3 right-0 w-1 h-1 bg-green-300 rounded-full animate-bounce" style={{animationDelay: '1.1s', animationDuration: '1.8s'}}></div>
              </div>
              <p className="text-white/90 text-lg font-medium mb-1">
                Emily just posted your content to
              </p>
              <p className="text-white font-bold text-xl capitalize mb-6">
                {postNotification.platform}
              </p>
              
              {/* Success Checkmark */}
              <div className="mb-6 flex justify-center">
                <div className="w-8 h-8 bg-green-400 rounded-full flex items-center justify-center animate-pulse">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleCloseNotification()
                  }}
                  className="px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-lg transition-all duration-200 backdrop-blur-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ContentDashboard
