import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Play } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import ATSNContentCard from './ATSNContentCard'
import ATSNContentModal from './ATSNContentModal'
import ReelModal from './ReelModal'

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

    window.addEventListener('storage', handleStorageChange)

    // Also listen for custom events for same-tab updates
    const handleCustomChange = (e) => {
      if (e.detail.key === key) {
        callback(e.detail.newValue === 'true')
      }
    }

    window.addEventListener('localStorageChange', handleCustomChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageChange', handleCustomChange)
    }
  }, [key, callback])
}

import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Eye,
  Edit,
  Copy,
  Calendar,
  Instagram,
  Facebook,
  MessageCircle,
  Trash2,
  Clock,
  Send
} from 'lucide-react'

import { supabase } from '../lib/supabase'

// Platform icons
const getPlatformIcon = (platformName) => {
  switch (platformName?.toLowerCase()) {
    case 'instagram':
      return <Instagram className="w-4 h-4 text-white" />
    case 'facebook':
      return <Facebook className="w-4 h-4 text-white" />
    case 'linkedin':
      return <div className="w-4 h-4 bg-blue-700 rounded-sm flex items-center justify-center text-white text-xs font-bold">in</div>
    case 'twitter':
    case 'x':
      return <div className="w-4 h-4 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs">𝕏</div>
    case 'tiktok':
      return <div className="w-4 h-4 bg-black rounded-sm flex items-center justify-center text-white text-xs">TT</div>
    default:
      return <MessageCircle className="w-4 h-4 text-white" />
  }
}

function CreatedContentDashboard() {
  const { user } = useAuth()
  const { showError, showInfo, showSuccess } = useNotifications()
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)

  // Listen for dark mode changes from other components (like SideNavbar)
  useStorageListener('darkMode', setIsDarkMode)

  // Apply dark mode class to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState([])
  const [filteredContent, setFilteredContent] = useState([])

  // Filters
  const [filterChannel, setFilterChannel] = useState('all')
  const [filterPlatform, setFilterPlatform] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Schedule modal state
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', contentId: null })
  const [isScheduling, setIsScheduling] = useState(false)

  // Delete confirmation modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  // Publish confirmation modal state
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [itemToPublish, setItemToPublish] = useState(null)

  // Schedule confirmation modal state
  const [showScheduleConfirmModal, setShowScheduleConfirmModal] = useState(false)
  const [itemToSchedule, setItemToSchedule] = useState(null)

  // Action loading states
  const [isDeleting, setIsDeleting] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)

  // Modal states
  const [selectedContent, setSelectedContent] = useState(null)
  const [isContentModalOpen, setIsContentModalOpen] = useState(false)
  const [isReelModalOpen, setIsReelModalOpen] = useState(false)

  const contentRef = useRef([])

  const fetchContent = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true)

      const token = await getAuthToken()
      if (!token) {
        showError('Authentication required', 'Please log in again.')
        return
      }

      const response = await fetch(`${API_BASE_URL}/content/created?limit=100&offset=0`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch content: ${response.status}`)
      }

      const data = await response.json()
      const fetchedContent = Array.isArray(data) ? data : []

      setContent(fetchedContent)
      contentRef.current = fetchedContent

    } catch (error) {
      console.error('Error fetching content:', error)
      showError('Error', 'Failed to fetch content. Please try again.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [showError])

  // Filter content based on search and filters
  useEffect(() => {
    let filtered = Array.isArray(content) ? [...content] : []

    // Apply channel filter
    if (filterChannel !== 'all') {
      const channelQuery = filterChannel.toLowerCase()
      filtered = filtered.filter(item => {
        const channel = (item.content_campaigns?.channel || item.channel || '').toLowerCase()
        return channel === channelQuery
      })
    }

    // Apply platform filter
    if (filterPlatform !== 'all') {
      const platformQuery = filterPlatform.toLowerCase()
      filtered = filtered.filter(item => {
        const platform = (item.content_campaigns?.platform || item.platform || '').toLowerCase()
        return platform === platformQuery
      })
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(item => {
        const title = item.title || ''
        const content = item.content || ''
        const hashtags = (item.hashtags || []).join(' ')

        return title.toLowerCase().includes(query) ||
               content.toLowerCase().includes(query) ||
               hashtags.toLowerCase().includes(query)
      })
    }

    setFilteredContent(filtered)
  }, [content, filterChannel, filterPlatform, searchQuery])

  useEffect(() => {
    if (user) {
      fetchContent()
    }
  }, [user, fetchContent])

  const handleEdit = (contentItem) => {
    // Handle edit functionality - TBD
    console.log('Edit content:', contentItem)
    showInfo('Edit functionality coming soon')
  }

  const handleCopy = (contentItem) => {
    // Handle copy functionality - TBD
    console.log('Copy content:', contentItem)
    showInfo('Copy functionality coming soon')
  }

  const handlePreview = (contentItem) => {
    // Open content modal for preview
    setSelectedContent(contentItem)

    // Check if it's a reel and open appropriate modal
    if (contentItem.content_type === 'short_video or reel' ||
        contentItem.content_type === 'reel' ||
        contentItem.content_type?.toLowerCase().includes('reel') ||
        contentItem.content_type?.toLowerCase().includes('video')) {
      setIsReelModalOpen(true)
    } else {
      setIsContentModalOpen(true)
    }
  }

  const handleCloseModal = () => {
    setIsContentModalOpen(false)
    setSelectedContent(null)
  }

  const handleCloseReelModal = () => {
    setIsReelModalOpen(false)
    setSelectedContent(null)
  }

  const handleDelete = async (contentItem) => {
    setItemToDelete(contentItem)
    setShowDeleteModal(true)
    }

  const confirmDelete = async () => {
    if (!itemToDelete) return

    setIsDeleting(true)
    try {
      const token = await getAuthToken()

      // Delete content from Supabase
      const { error } = await supabase
        .from('created_content')
        .delete()
        .eq('id', itemToDelete.id)
        .eq('user_id', user.id) // Security: ensure user can only delete their own content

      if (error) {
        console.error('Error deleting content:', error)
        showError(`Failed to delete content: ${error.message}`)
        return
      }

      // Remove from local state
      setContent(prev => prev.filter(item => item.id !== itemToDelete.id))

      showSuccess('Content deleted successfully')
      setShowDeleteModal(false)
      setItemToDelete(null)

    } catch (error) {
      console.error('Error deleting content:', error)
      showError(error.message || 'Failed to delete content')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleSchedule = (contentItem) => {
    // Open schedule confirmation modal
    setItemToSchedule(contentItem)
    setShowScheduleConfirmModal(true)
  }

  const confirmSchedule = () => {
    if (!itemToSchedule) return

    // Set up schedule data and open the schedule modal
    setScheduleData({ date: '', time: '', contentId: itemToSchedule.id })
    setShowScheduleModal(true)
    setShowScheduleConfirmModal(false)
    setItemToSchedule(null)
  }

  const handleScheduleConfirm = async () => {
    if (!scheduleData.date || !scheduleData.time) {
      showError('Please select both date and time')
      return
    }

    setIsScheduling(true)

    try {
      const token = await getAuthToken()

      // Combine date and time
      const scheduleDateTime = new Date(`${scheduleData.date}T${scheduleData.time}`)

      // Update the content with schedule information
      const { error } = await supabase
        .from('created_content')
        .update({
          status: 'scheduled',
          scheduled_at: scheduleDateTime.toISOString()
        })
        .eq('id', scheduleData.contentId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error scheduling content:', error)
        showError(`Failed to schedule content: ${error.message}`)
        return
      }

      // Update local state
      setContent(prev => prev.map(item =>
        item.id === scheduleData.contentId
          ? { ...item, status: 'scheduled', scheduled_at: scheduleDateTime.toISOString() }
          : item
      ))

      setShowScheduleModal(false)
      setScheduleData({ date: '', time: '', contentId: null })
      showSuccess(`Content scheduled for ${scheduleData.date} at ${scheduleData.time}`)

    } catch (error) {
      console.error('Error scheduling content:', error)
      showError('Failed to schedule content')
    } finally {
      setIsScheduling(false)
    }
  }

  const handlePublish = async (contentItem) => {
    setItemToPublish(contentItem)
    setShowPublishModal(true)
  }

  const confirmPublish = async () => {
    if (!itemToPublish) return

    try {
      setIsPublishing(true)

      const token = await getAuthToken()

      // Check if platform is connected
      const connectionResponse = await fetch(`${API_BASE_URL}/connections/`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!connectionResponse.ok) {
        const errorData = await connectionResponse.json().catch(() => ({}))
        showError(`Failed to check connection status: ${errorData.detail || connectionResponse.statusText}`)
        return
      }

      const connections = await connectionResponse.json()
      const platform = itemToPublish.platform?.toLowerCase()
      const isConnected = connections.some(conn => conn.platform?.toLowerCase() === platform && conn.is_active)

      if (!isConnected) {
        showError(`Please connect your ${itemToPublish.platform} account first`)
        return
      }

      // Check if platform is supported for publishing
      const supportedPlatforms = ['facebook', 'instagram', 'linkedin', 'youtube']
      if (!supportedPlatforms.includes(platform)) {
        showError(`Publishing to ${itemToPublish.platform} is not yet supported`)
        return
      }

      // Get the best image URL for posting
      const imageUrl = getBestImageUrl(itemToPublish)
      console.log('📸 Publishing to', platform, 'with image URL:', imageUrl)

      // Validate that we have an image URL for Instagram
      if (platform === 'instagram' && !imageUrl) {
        showError('Instagram posts require an image. Please ensure the content has an associated image.')
        return
      }

      // For Instagram, ensure the image URL is publicly accessible
      if (platform === 'instagram' && imageUrl) {
        const isSupabaseUrl = imageUrl.includes('supabase.co') && imageUrl.includes('/storage/v1/object/public/')
        if (!isSupabaseUrl) {
          showError('Instagram requires images to be publicly accessible. Please re-upload the image or use a different platform.')
          return
        }
      }

      const postBody = {
        message: itemToPublish.content,
        title: itemToPublish.title,
        hashtags: itemToPublish.hashtags || [],
        content_id: itemToPublish.id
      }

      if (imageUrl) {
        postBody.image_url = imageUrl
      }

      // Handle different platforms
      let postEndpoint = ''
      if (platform === 'facebook') {
        postEndpoint = '/connections/facebook/post'
      } else if (platform === 'instagram') {
        postEndpoint = '/connections/instagram/post'
      } else if (platform === 'linkedin') {
        postEndpoint = '/connections/linkedin/post'
      } else if (platform === 'youtube') {
        postEndpoint = '/connections/youtube/post'
      } else {
        showError(`${contentItem.platform} posting not yet implemented`)
        return
      }

      const response = await fetch(`${API_BASE_URL}${postEndpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(postBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Post result:', result)

      // Update content status to published
      const { error: updateError } = await supabase
        .from('created_content')
        .update({
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', contentItem.id)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating content status:', updateError)
      }

      // Update local state
      setContent(prev => prev.map(item =>
        item.id === itemToPublish.id
          ? { ...item, status: 'published', published_at: new Date().toISOString() }
          : item
      ))

      showSuccess(`Successfully published to ${itemToPublish.platform}!`)
      setShowPublishModal(false)
      setItemToPublish(null)

    } catch (error) {
      console.error('Error publishing content:', error)
      showError(`Failed to publish to ${itemToPublish.platform}: ${error.message}`)
    } finally {
      setIsPublishing(false)
    }
  }

  const getAuthToken = async () => {
    const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession())
    return session?.access_token || localStorage.getItem('authToken')
  }

  const getBestImageUrl = (content) => {
    console.log('🔍 getBestImageUrl - Content object:', {
      hasImages: !!content.images,
      imagesType: typeof content.images,
      imagesIsArray: Array.isArray(content.images),
      imagesLength: content.images?.length || 0,
      imagesValue: content.images,
      firstImage: content.images?.[0],
      media_url: content.media_url,
      primary_image_url: content.primary_image_url,
      rawDataImages: content.raw_data?.images,
      content_id: content.id,
      platform: content.platform
    })

    if (content.images && Array.isArray(content.images) && content.images.length > 0) {
      console.log('✅ Using content.images[0]:', content.images[0])
      return content.images[0]
    }
    if (content.media_url) {
      console.log('✅ Using content.media_url:', content.media_url)
      return content.media_url
    }
    if (content.primary_image_url) {
      console.log('✅ Using content.primary_image_url:', content.primary_image_url)
      return content.primary_image_url
    }
    if (content.raw_data?.images && Array.isArray(content.raw_data.images) && content.raw_data.images.length > 0) {
      console.log('✅ Using content.raw_data.images[0]:', content.raw_data.images[0])
      return content.raw_data.images[0]
    }
    console.log('❌ No image URL found in any location')
    return ''
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authenticated</h1>
          <p className="text-gray-600">Please log in to access content dashboard.</p>
        </div>
      </div>
    )
  }

  // Publish Confirmation Modal
  const renderPublishModal = () => {
    if (!showPublishModal || !itemToPublish) return null

    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowPublishModal(false)}
        />
        <div className={`relative max-w-md w-full rounded-2xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            isDarkMode
              ? 'border-gray-700 bg-gradient-to-r from-pink-900/20 to-rose-900/20'
              : 'border-gray-200 bg-gradient-to-r from-pink-50 to-rose-50'
          }`}>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <div>
                <h3 className={`text-lg font-normal ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Publish Content
                </h3>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              {/* Emily Avatar */}
              <div className="flex-shrink-0">
                <img
                  src="/emily_icon.png"
                  alt="Emily"
                  className="w-16 h-16 rounded-full object-cover border-2 border-pink-200"
                  onError={(e) => {
                    e.target.src = '/default-logo.png'
                  }}
                />
              </div>

              {/* Message */}
              <div className="flex-1">
                <div className={`relative p-4 rounded-2xl ${
                  isDarkMode
                    ? 'bg-gray-700 border border-gray-600'
                    : 'bg-pink-50 border border-pink-200'
                }`}>
                  {/* Speech bubble pointer */}
                  <div className={`absolute left-0 top-4 transform -translate-x-2 w-0 h-0 ${
                    isDarkMode
                      ? 'border-t-8 border-t-gray-700 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                      : 'border-t-8 border-t-pink-50 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                  }`} />

                  <p className={`text-sm leading-relaxed ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    <span className="font-normal text-pink-500">Emily here!</span> 🚀<br />
                    Ready to publish <strong>"{itemToPublish.title || 'this content'}"</strong> to <strong>{itemToPublish.platform}</strong>?
                    This will share your content with your audience!
                  </p>
                </div>

                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowPublishModal(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 bg-gray-700 hover:bg-gray-600'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                    disabled={isPublishing}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmPublish}
                    disabled={isPublishing}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg font-medium hover:from-pink-600 hover:to-rose-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isPublishing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Publishing...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        <span>Publish</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Schedule Confirmation Modal
  const renderScheduleConfirmModal = () => {
    if (!showScheduleConfirmModal || !itemToSchedule) return null

    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowScheduleConfirmModal(false)}
        />
        <div className={`relative max-w-md w-full rounded-2xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            isDarkMode
              ? 'border-gray-700 bg-gradient-to-r from-green-900/20 to-emerald-900/20'
              : 'border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50'
          }`}>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className={`text-lg font-normal ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Schedule Content
                </h3>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              {/* Emily Avatar */}
              <div className="flex-shrink-0">
                <img
                  src="/emily_icon.png"
                  alt="Emily"
                  className="w-16 h-16 rounded-full object-cover border-2 border-pink-200"
                  onError={(e) => {
                    e.target.src = '/default-logo.png'
                  }}
                />
              </div>

              {/* Message */}
              <div className="flex-1">
                <div className={`relative p-4 rounded-2xl ${
                  isDarkMode
                    ? 'bg-gray-700 border border-gray-600'
                    : 'bg-pink-50 border border-pink-200'
                }`}>
                  {/* Speech bubble pointer */}
                  <div className={`absolute left-0 top-4 transform -translate-x-2 w-0 h-0 ${
                    isDarkMode
                      ? 'border-t-8 border-t-gray-700 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                      : 'border-t-8 border-t-pink-50 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                  }`} />

                  <p className={`text-sm leading-relaxed ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    <span className="font-normal text-pink-500">Emily here!</span> ⏰<br />
                    Ready to schedule <strong>"{itemToSchedule.title || 'this content'}"</strong> for later?
                    I'll help you pick the perfect time to share it!
                  </p>
                </div>

                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowScheduleConfirmModal(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 bg-gray-700 hover:bg-gray-600'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmSchedule}
                    className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white rounded-lg font-medium hover:from-pink-600 hover:to-rose-600 transition-all duration-200 flex items-center space-x-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Schedule</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Delete Confirmation Modal
  const renderDeleteModal = () => {
    if (!showDeleteModal || !itemToDelete) return null

    return (
      <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowDeleteModal(false)}
        />
        <div className={`relative max-w-md w-full rounded-2xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Header */}
          <div className={`p-6 border-b ${
            isDarkMode
              ? 'border-gray-700 bg-gradient-to-r from-red-900/20 to-red-800/20'
              : 'border-gray-200 bg-gradient-to-r from-red-50 to-red-100'
          }`}>
            <div className="flex items-center justify-center space-x-3">
              <div className="w-12 h-12 rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className={`text-lg font-normal ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  Delete Content
                </h3>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="flex items-start space-x-4">
              {/* Leo Avatar */}
              <div className="flex-shrink-0">
                <img
                  src="/leo_logo.png"
                  alt="Leo"
                  className="w-16 h-16 rounded-full object-cover border-2 border-red-200"
                  onError={(e) => {
                    e.target.src = '/default-logo.png'
                  }}
                />
              </div>

              {/* Message */}
              <div className="flex-1">
                <div className={`relative p-4 rounded-2xl ${
                  isDarkMode
                    ? 'bg-gray-700 border border-gray-600'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {/* Speech bubble pointer */}
                  <div className={`absolute left-0 top-4 transform -translate-x-2 w-0 h-0 ${
                    isDarkMode
                      ? 'border-t-8 border-t-gray-700 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                      : 'border-t-8 border-t-red-50 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                  }`} />

                  <p className={`text-sm leading-relaxed ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-800'
                  }`}>
                    <span className="font-semibold text-red-500">Leo here!</span> ⚠️<br />
                    Are you sure you want to delete <strong>"{itemToDelete.title || 'this content'}"</strong>?
                    This action cannot be undone and will permanently remove the content.
                  </p>
                </div>

                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 bg-gray-700 hover:bg-gray-600'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg font-medium hover:from-red-600 hover:to-red-700 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Schedule Modal
  const renderScheduleModal = () => {
    if (!showScheduleModal) return null

    return (
      <div className={`fixed inset-0 flex items-center justify-center z-50 ${
        isDarkMode ? 'bg-black bg-opacity-60' : 'bg-black bg-opacity-50'
      }`}>
        <div className={`rounded-lg p-6 max-w-md w-full mx-4 shadow-xl ${
          isDarkMode
            ? 'bg-gray-800 border border-gray-700'
            : 'bg-white border border-gray-200'
        }`}>
          <h3 className={`text-xl font-semibold mb-4 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>Schedule Content</h3>
          <div className="space-y-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Date</label>
              <input
                type="date"
                value={scheduleData.date}
                onChange={(e) => setScheduleData(prev => ({ ...prev, date: e.target.value }))}
                min={new Date().toISOString().split('T')[0]}
                className={`w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-green-500 focus:border-green-500'
                }`}
                style={isDarkMode ? {
                  colorScheme: 'dark'
                } : {}}
              />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-700'
              }`}>Time</label>
              <input
                type="time"
                value={scheduleData.time}
                onChange={(e) => setScheduleData(prev => ({ ...prev, time: e.target.value }))}
                className={`w-full px-3 py-2.5 border rounded-md focus:outline-none focus:ring-2 transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500 placeholder-gray-400'
                    : 'bg-white border-gray-300 text-gray-900 focus:ring-green-500 focus:border-green-500'
                }`}
                style={isDarkMode ? {
                  colorScheme: 'dark'
                } : {}}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowScheduleModal(false)}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              Cancel
            </button>
            <button
              onClick={handleScheduleConfirm}
              disabled={isScheduling || !scheduleData.date || !scheduleData.time}
              className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${
                isScheduling || !scheduleData.date || !scheduleData.time
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-50'
                  : 'bg-green-600 text-white hover:bg-green-700'
              } ${isDarkMode && !(isScheduling || !scheduleData.date || !scheduleData.time) ? 'hover:bg-green-600' : ''}`}
            >
              {isScheduling ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Scheduling...
                </>
              ) : (
                'Schedule'
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {renderScheduleModal()}
      {renderDeleteModal()}
      {renderPublishModal()}
      {renderScheduleConfirmModal()}
      <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <SideNavbar />
      <MobileNavigation
        handleGenerateContent={() => {}}
        generating={false}
        fetchingFreshData={false}
      />

      <div className="md:ml-48 xl:ml-64 flex flex-col min-h-screen">
        {/* Header */}
        <div className={`shadow-sm border-b sticky top-0 z-20 ${
          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'
        }`}>
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              {/* Title and Stats */}
              <div className="flex items-center gap-4">
                <div>
                  <h1 className={`text-xl ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    <span className="font-bold">Created Content</span> | <span className="font-normal text-sm">{filteredContent.length} of {content.length} items</span>
                  </h1>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-2">
                {/* All Button */}
                <button
                  onClick={() => {
                    setFilterChannel('all')
                    setFilterPlatform('all')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterChannel === 'all' && filterPlatform === 'all'
                      ? 'bg-white text-gray-900'
                      : isDarkMode
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  All
                </button>

                {/* Instagram Button */}
                <button
                  onClick={() => {
                    setFilterChannel('social media')
                    setFilterPlatform('instagram')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterPlatform === 'instagram'
                      ? 'bg-white text-gray-900'
                      : isDarkMode
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Instagram
                </button>

                {/* Facebook Button */}
                <button
                  onClick={() => {
                    setFilterChannel('social media')
                    setFilterPlatform('facebook')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterPlatform === 'facebook'
                      ? 'bg-white text-gray-900'
                      : isDarkMode
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Facebook
                </button>

                {/* LinkedIn Button */}
                <button
                  onClick={() => {
                    setFilterChannel('social media')
                    setFilterPlatform('linkedin')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterPlatform === 'linkedin'
                      ? 'bg-white text-gray-900'
                      : isDarkMode
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  LinkedIn
                </button>

                {/* YouTube Button */}
                <button
                  onClick={() => {
                    setFilterChannel('social media')
                    setFilterPlatform('youtube')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterPlatform === 'youtube'
                      ? 'bg-white text-gray-900'
                      : isDarkMode
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  YouTube
                </button>

                {/* Blogs Button */}
                <button
                  onClick={() => {
                    setFilterChannel('blog')
                    setFilterPlatform('all')
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    filterChannel === 'blog'
                      ? 'bg-white text-gray-900'
                      : isDarkMode
                      ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Blogs
                </button>

                {/* Search */}
                <div className="relative">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`} />
                  <input
                    type="text"
                    placeholder="Search content..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`pl-10 pr-4 py-2 rounded-lg border text-sm w-64 ${
                      isDarkMode
                        ? 'bg-gray-700 border-gray-600 text-gray-200 placeholder-gray-400'
                        : 'bg-white border-gray-300 text-gray-700 placeholder-gray-500'
                    }`}
                  />
                </div>


                {/* Refresh Button */}
                <button
                  onClick={() => fetchContent(true)}
                  className={`p-2 rounded-lg transition-colors ${
                    isDarkMode ? 'hover:bg-gray-700 text-gray-300' : 'hover:bg-gray-100 text-gray-600'
                  }`}
                  title="Refresh content"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-6 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <span className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Loading content...
              </span>
            </div>
          ) : filteredContent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText className={`w-16 h-16 mb-4 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
              <h3 className={`text-lg font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {content.length === 0 ? 'No content created yet' : 'No content matches your filters'}
              </h3>
              <p className={`text-center max-w-md ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                {content.length === 0
                  ? 'Start creating content with our AI-powered tools to see your content here.'
                  : 'Try adjusting your filters or search terms to find what you\'re looking for.'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.isArray(filteredContent) && filteredContent.map((contentItem) => {
                // Extract media URL from various possible fields
                let mediaUrl = null;
                let thumbnailUrl = null;
                let isVideo = false;

                // Helper function to generate thumbnail URL
                const getThumbnailUrl = (url) => {
                  if (!url) return null;

                  // For Supabase storage URLs, add transform parameters for thumbnail
                  if (url.includes('supabase.co') && url.includes('/storage/v1/object/public/')) {
                    // Add width and height parameters for thumbnail (200x200)
                    return `${url}?width=200&height=200&resize=contain&quality=80`;
                  }

                  // For other image URLs, return original (could add more logic here)
                  return url;
                };

                if (contentItem.media_url) {
                  mediaUrl = contentItem.media_url;
                  thumbnailUrl = getThumbnailUrl(mediaUrl);
                  // Check if it's a video file
                  isVideo = mediaUrl.match(/\.(mp4|mov|avi|webm|m4v)$/i) ||
                           mediaUrl.includes('video') ||
                           contentItem.content_type?.toLowerCase().includes('video') ||
                           contentItem.content_type === 'short_video or reel';
                } else if (contentItem.images && Array.isArray(contentItem.images) && contentItem.images.length > 0) {
                  mediaUrl = contentItem.images[0];
                  thumbnailUrl = getThumbnailUrl(mediaUrl);
                } else if (contentItem.image_url) {
                  mediaUrl = contentItem.image_url;
                  thumbnailUrl = getThumbnailUrl(mediaUrl);
                } else if (contentItem.metadata && contentItem.metadata.image_url) {
                  mediaUrl = contentItem.metadata.image_url;
                  thumbnailUrl = getThumbnailUrl(mediaUrl);
                }

                const hasMedia = mediaUrl && mediaUrl.trim();

                if (!hasMedia) return null; // Skip items without media

                return (
                  <div
                    key={contentItem.id}
                    className="relative aspect-square group cursor-pointer overflow-hidden bg-gray-200"
                    onClick={() => handlePreview(contentItem)}
                  >
                    {isVideo ? (
                      <video
                        src={mediaUrl}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        muted
                        poster={mediaUrl} // Use video as poster to show first frame
                        preload="none" // Don't preload to save bandwidth
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <img
                        src={thumbnailUrl || mediaUrl}
                        alt={contentItem.title || 'Content'}
                        className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                        onError={(e) => {
                          // Fallback to original URL if thumbnail fails
                          if (e.target.src !== mediaUrl) {
                            e.target.src = mediaUrl;
                          } else {
                            e.target.style.display = 'none';
                          }
                        }}
                      />
                    )}

                    {/* Video Play Button Overlay */}
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
                        <div className="bg-white/90 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-6 h-6 text-purple-600 fill-purple-600" />
                        </div>
                      </div>
                    )}

                    {/* Action Buttons Overlay */}
                    <div className={`absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex flex-col items-center justify-center ${
                      isDarkMode ? 'group-hover:bg-opacity-60' : ''
                    }`}>
                      {/* Title Display */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white text-center p-2 mb-2">
                        <div className="text-sm font-medium truncate max-w-full">
                          {contentItem.title || `Content for ${contentItem.platform}`}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(contentItem); }}
                          className="p-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                          title="Edit content"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSchedule(contentItem); }}
                          className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-colors"
                          title="Schedule content"
                        >
                          <Clock className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePublish(contentItem); }}
                          className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-full transition-colors"
                          title="Publish content"
                          disabled={isPublishing}
                        >
                          {isPublishing ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(contentItem); }}
                          className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                          title="Delete content"
                          disabled={isDeleting}
                        >
                          {isDeleting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Platform indicator */}
                    <div className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full p-1">
                      {getPlatformIcon(contentItem.platform)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ATSN Content Modal */}
      {isContentModalOpen && selectedContent && (
        <ATSNContentModal
          content={selectedContent}
          onClose={handleCloseModal}
        />
      )}

      {/* Reel Modal */}
      {isReelModalOpen && selectedContent && (
        <ReelModal
          content={selectedContent}
          onClose={handleCloseReelModal}
        />
      )}
    </div>
    </>
  )
}

export default CreatedContentDashboard
