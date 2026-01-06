import React, { useState, useEffect } from 'react'
import { X, Hash, Edit, Check, X as XIcon, Sparkles, RefreshCw, Copy } from 'lucide-react'
import { Instagram, Facebook, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'

// Get API URL
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '')

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

const ATSNContentModal = ({ content, onClose }) => {
  const [profileData, setProfileData] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitleValue, setEditTitleValue] = useState('')
  const [editContentValue, setEditContentValue] = useState('')
  const [editHashtagsValue, setEditHashtagsValue] = useState('')
  const [showAIEditModal, setShowAIEditModal] = useState(false)
  const [aiEditType, setAiEditType] = useState('')
  const [aiEditInstruction, setAiEditInstruction] = useState('')
  const [aiEditing, setAiEditing] = useState(false)
  const [aiEditedContent, setAiEditedContent] = useState('')
  const [showImageEditModal, setShowImageEditModal] = useState(false)
  const [imageEditInstruction, setImageEditInstruction] = useState('')
  const [editingImage, setEditingImage] = useState('')
  const [originalImageUrl, setOriginalImageUrl] = useState('')
  const [imageEditing, setImageEditing] = useState(false)
  const [editedImageUrl, setEditedImageUrl] = useState('')
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [selectedImageForEdit, setSelectedImageForEdit] = useState('')
  const [showAIResult, setShowAIResult] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)

  // Listen for dark mode changes from other components
  useStorageListener('darkMode', setIsDarkMode)

  // Apply dark mode class to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  // Fetch profile data when content changes
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data, error } = await supabase
          .from('profiles')
          .select('logo_url, business_name, business_type, name')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile:', error)
          return
        }

        setProfileData(data)
      } catch (error) {
        console.error('Error loading profile:', error)
      }
    }

    if (content) {
      fetchProfileData()
    }
  }, [content])

  // Edit handlers
  const handleEdit = () => {
    setEditTitleValue(content.title || '')
    setEditContentValue(content.content || '')
    setEditHashtagsValue(content.hashtags ? content.hashtags.join(' ') : '')
    setIsEditing(true)
  }

  const handleSave = () => {
    // Here you could add API call to save the edited content
    console.log('Saving title:', editTitleValue)
    console.log('Saving content:', editContentValue)
    console.log('Saving hashtags:', editHashtagsValue)

    // Handle different content types
    if (content.content_type === 'short_video or reel' && editContentValue) {
      // For short video scripts, save to short_video_script field
      content.short_video_script = editContentValue
    } else {
      // For regular content, save to content field
      content.content = editContentValue
    }

    setIsEditing(false)
    // Update the content object (this is just local for now)
    content.title = editTitleValue
    content.hashtags = editHashtagsValue ? editHashtagsValue.split(' ').filter(tag => tag.trim()) : []
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const handleImageEdit = (imageUrl) => {
    setOriginalImageUrl(imageUrl)  // Store the original image URL from content
    setEditingImage(imageUrl)      // Set the current image being edited
    setShowImageEditModal(true)
    setImageEditInstruction('')
    setEditedImageUrl('')
    setShowImagePreview(false)
    setSelectedImageForEdit('')
  }

  const handleImageEditSubmit = async () => {
    if (!imageEditInstruction.trim()) return

    setImageEditing(true)
    try {
      const response = await fetch(`${API_BASE_URL}/api/edit-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          imageUrl: selectedImageForEdit || editingImage,
          instruction: imageEditInstruction,
          prompt: `Edit this image according to these instructions: ${imageEditInstruction}.`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to edit image')
      }

      const data = await response.json()

      // Show preview instead of closing modal
      setEditedImageUrl(data.edited_image_url || '')
      setShowImagePreview(true)
      setImageEditInstruction('')

    } catch (error) {
      console.error('Error editing image:', error)
      alert('Failed to edit image. Please try again.')
    } finally {
      setImageEditing(false)
    }
  }

  const handleSaveEditedImage = async () => {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const response = await fetch(`${API_BASE_URL}/simple-image-editor/save-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          user_id: user.id,
          post_id: content.id,
          original_image_url: originalImageUrl,
          edited_image_url: editedImageUrl
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save image')
      }

      const data = await response.json()

      if (data.success) {
        // Close edit modal first, then show success modal
        setShowImageEditModal(false)

        // Reset state and show success modal after a brief delay
        setTimeout(() => {
          setShowSuccessModal(true)
          setOriginalImageUrl('')
          setEditingImage('')
          setEditedImageUrl('')
          setShowImagePreview(false)
          setSelectedImageForEdit('')
        }, 300)
      } else {
        throw new Error(data.error || 'Failed to save image')
      }

    } catch (error) {
      console.error('Error saving image:', error)
      alert('Failed to save image. Please try again.')
    }
  }

  const handleContinueEditing = () => {
    // If user selected a specific image, use it as the base for further editing
    if (selectedImageForEdit) {
      setEditingImage(selectedImageForEdit)
    }
    setShowImagePreview(false)
    setImageEditInstruction('')
  }

  const handleImageClick = (imageUrl, imageType) => {
    if (showImagePreview) {
      setSelectedImageForEdit(imageUrl)
    }
  }

  const handleAIEdit = (field) => {
    setAiEditType(field)
    setShowAIEditModal(true)
    setAiEditInstruction('')
  }

  const handleAISaveEdit = async () => {
    if (!aiEditInstruction.trim()) return

    // Validate instruction length
    if (aiEditInstruction.length > 500) {
      console.error('Instruction too long - please keep under 500 characters')
      return
    }

    try {
      setAiEditing(true)

      // Get the current text based on type
      const currentText = aiEditType === 'title'
        ? editTitleValue
        : aiEditType === 'content'
        ? editContentValue
        : editHashtagsValue

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        console.error('No auth token available')
        return
      }

      // Call AI service to edit content
      const response = await fetch(`${API_BASE_URL}/content/ai/edit-content`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
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
        // Show the AI result in the modal instead of directly updating
        setAiEditedContent(result.edited_content)
        setShowAIResult(true)
        console.log(`AI edited ${aiEditType}:`, result.edited_content)
      } else {
        throw new Error(result.error || result.detail || 'Failed to edit content with AI')
      }

    } catch (error) {
      console.error('AI edit failed:', error)
      // Show error but don't fall back to simple enhancement
      alert(`Failed to edit content with AI: ${error.message}`)
    } finally {
      setAiEditing(false)
    }
  }


  const handleSaveAIResult = () => {
    // Apply the AI-edited content to the form
    if (aiEditType === 'title') {
      setEditTitleValue(aiEditedContent)
    } else if (aiEditType === 'content') {
      setEditContentValue(aiEditedContent)
    } else if (aiEditType === 'hashtags') {
      setEditHashtagsValue(aiEditedContent)
    }

    // Close the modal and reset state
    setShowAIEditModal(false)
    setShowAIResult(false)
    setAiEditedContent('')
    setAiEditInstruction('')
  }

  const handleCancelAIEdit = () => {
    setShowAIEditModal(false)
    setShowAIResult(false)
    setAiEditedContent('')
    setAiEditInstruction('')
  }

  if (!content) return null

  // Platform icons
  const getPlatformIcon = (platformName) => {
    switch (platformName?.toLowerCase()) {
      case 'instagram':
        return <Instagram className="w-6 h-6 text-pink-500" />
      case 'facebook':
        return <Facebook className="w-6 h-6 text-blue-600" />
      case 'linkedin':
        return <div className="w-6 h-6 bg-blue-700 rounded-sm flex items-center justify-center text-white text-xs font-bold">in</div>
      case 'twitter':
        return <div className="w-6 h-6 bg-blue-400 rounded-full flex items-center justify-center text-white text-xs">𝕏</div>
      case 'tiktok':
        return <div className="w-6 h-6 bg-black rounded-sm flex items-center justify-center text-white text-xs">TT</div>
      default:
        return <MessageCircle className={`w-6 h-6 ${
          isDarkMode ? 'text-gray-400' : 'text-gray-500'
        }`} />
    }
  }

  // Platform display name
  const getPlatformDisplayName = (platformName) => {
    switch (platformName?.toLowerCase()) {
      case 'whatsapp business':
        return 'WhatsApp'
      case 'gmail':
        return 'Email'
      default:
        return platformName?.charAt(0).toUpperCase() + platformName?.slice(1)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-30"
      onClick={onClose}
    >
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative max-w-6xl w-full rounded-2xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}>
          {/* Header */}
          <div className={`flex items-center justify-between p-6 border-b ${
            isDarkMode
              ? 'border-gray-700 bg-gradient-to-r from-gray-700 to-gray-600'
              : 'border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50'
          }`}>
            <div className="flex items-center gap-3">
              {getPlatformIcon(content.platform)}
              <span className={`font-normal ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                {getPlatformDisplayName(content.platform)}
              </span>
            </div>
            <button
              onClick={onClose}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                isDarkMode
                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
              }`}
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content - Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-[400px]">
            {/* Left Column - Image (like posts) */}
            <div className="space-y-4 -mx-2">
              {content.images && content.images.length > 0 ? (
                <div className="flex justify-center relative group">
                  <img
                    src={content.images[0]}
                    alt={content.title || "Video thumbnail"}
                    className="w-full max-h-[32rem] object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                  {/* Edit Image Button */}
                  <button
                    onClick={() => handleImageEdit(content.images[0])}
                    className={`absolute top-3 right-6 p-2 rounded-lg shadow-lg transition-all duration-200 ${
                      isDarkMode
                        ? 'bg-gray-900/90 hover:bg-gray-800 text-white hover:text-gray-200'
                        : 'bg-black/60 hover:bg-black/80 text-white hover:text-gray-200'
                    }`}
                    title="Edit image with AI"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              ) : content.media_url ? (
                <div className="flex justify-center relative group">
                  <img
                    src={content.media_url}
                    alt={content.title || "Content image"}
                    className="w-full max-h-[32rem] object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                  {/* Edit Image Button */}
                  <button
                    onClick={() => handleImageEdit(content.media_url)}
                    className={`absolute top-3 right-6 p-2 rounded-lg shadow-lg transition-all duration-200 ${
                      isDarkMode
                        ? 'bg-gray-900/90 hover:bg-gray-800 text-white hover:text-gray-200'
                        : 'bg-black/60 hover:bg-black/80 text-white hover:text-gray-200'
                    }`}
                    title="Edit image with AI"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              ) : content.images && content.images.length > 0 ? (
                <div className="flex justify-center relative group">
                  <img
                    src={content.images[0]}
                    alt={content.title || "Video thumbnail"}
                    className="w-full max-h-[32rem] object-contain rounded-lg shadow-lg"
                    onError={(e) => {
                      e.target.style.display = 'none'
                    }}
                  />
                  {/* Edit Image Button */}
                  <button
                    onClick={() => handleImageEdit(content.images[0])}
                    className={`absolute top-3 right-6 p-2 rounded-lg shadow-lg transition-all duration-200 ${
                      isDarkMode
                        ? 'bg-gray-900/90 hover:bg-gray-800 text-white hover:text-gray-200'
                        : 'bg-black/60 hover:bg-black/80 text-white hover:text-gray-200'
                    }`}
                    title="Edit image with AI"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              ) : null}
            </div>

            {/* Right Column - Content Details or Script */}
            <div className="space-y-6 pr-4">
              {/* For reels, show script on the right */}
              {(content.content_type === 'short_video or reel' || content.content_type === 'reel') && content.short_video_script ? (
                <div className="flex justify-center">
                  <div className={`w-full max-h-[32rem] rounded-lg shadow-lg overflow-hidden ${
                    isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                  }`}>
                    <div className={`p-4 border-b ${
                      isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className={`text-lg font-normal ${
                            isDarkMode ? 'text-gray-100' : 'text-gray-900'
                          }`}>
                            🎬 Video Script
                          </h3>
                          <p className={`text-sm mt-1 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`}>
                            15-30 second video script optimized for virality
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(content.short_video_script);
                              // Could add a toast notification here
                            }}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                            }`}
                            title="Copy script to clipboard"
                          >
                            📋 Copy
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(true);
                              setAiEditType('script');
                              setEditContentValue(content.short_video_script);
                              setEditTitleValue(content.title || 'Video Script');
                            }}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              isDarkMode
                                ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                : 'bg-purple-500 hover:bg-purple-600 text-white'
                            }`}
                            title="Edit script"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => {
                              setShowAIEditModal(true);
                              setAiEditType('script');
                              setEditContentValue(content.short_video_script);
                            }}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                              isDarkMode
                                ? 'bg-green-600 hover:bg-green-500 text-white'
                                : 'bg-green-500 hover:bg-green-600 text-white'
                            }`}
                            title="Edit with AI"
                          >
                            🤖 AI Edit
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className={`p-4 max-h-[28rem] overflow-y-auto ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      <div className="whitespace-pre-wrap font-mono text-sm leading-relaxed">
                        {content.short_video_script}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6">
                  {/* Business Logo and Name */}
                  {profileData && (
                <div className="flex items-center justify-between pb-4">
                  <div className="flex items-center gap-3">
                    <img
                      src={profileData.logo_url || '/default-logo.png'}
                      alt={profileData.business_name || 'Business logo'}
                      className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        e.target.src = '/default-logo.png'
                      }}
                    />
                    <div>
                      <span className={`font-normal text-lg ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        {profileData.business_name || 'Business'}
                      </span>
                    </div>
                  </div>

                  {/* Edit Button - Top Right */}
                  {!isEditing && (content.title || content.content) && (
                    <button
                      onClick={handleEdit}
                      className={`p-2 rounded-lg transition-colors ${
                        isDarkMode
                          ? 'text-gray-400 hover:text-blue-400 hover:bg-blue-900/20'
                          : 'text-gray-500 hover:text-blue-600 hover:bg-blue-50'
                      }`}
                      title="Edit content"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}

              {/* Title */}
              {content.title && (
                <div>
                  {isEditing ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className={`block text-sm font-medium ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>Title</label>
                        <button
                          onClick={() => handleAIEdit('title')}
                          disabled={aiEditing}
                          className={`p-1 rounded transition-colors disabled:opacity-50 ${
                            isDarkMode
                              ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/20'
                              : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                          }`}
                          title="Enhance with AI"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={editTitleValue}
                        onChange={(e) => setEditTitleValue(e.target.value)}
                        className={`w-full p-3 border rounded-lg text-xl font-normal focus:outline-none focus:ring-2 ${
                          isDarkMode
                            ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                            : 'border-gray-300 text-gray-900 focus:ring-blue-500'
                        }`}
                        rows={2}
                        placeholder="Enter title..."
                      />
                    </div>
                  ) : (
                    <h2 className={`text-2xl font-normal leading-tight mb-4 ${
                      isDarkMode ? 'text-gray-100' : 'text-gray-900'
                    }`}>
                      {content.title}
                    </h2>
                  )}
                </div>
              )}

              {/* Full Content */}
              {content.content && (
                <div>
                  {isEditing ? (
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <label className={`block text-sm font-medium ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>Content</label>
                        <button
                          onClick={() => handleAIEdit('content')}
                          disabled={aiEditing}
                          className={`p-1 rounded transition-colors disabled:opacity-50 ${
                            isDarkMode
                              ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/20'
                              : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                          }`}
                          title="Enhance with AI"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      </div>
                      <textarea
                        value={editContentValue}
                        onChange={(e) => setEditContentValue(e.target.value)}
                        className={`w-full p-4 border rounded-lg leading-relaxed focus:outline-none focus:ring-2 min-h-[200px] ${
                          isDarkMode
                            ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                            : 'border-gray-300 text-gray-700 focus:ring-blue-500'
                        }`}
                        placeholder="Enter content..."
                      />
                      <div className="flex items-center justify-between mb-2 mt-4">
                        <label className={`block text-sm font-medium ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>Hashtags</label>
                        <button
                          onClick={() => handleAIEdit('hashtags')}
                          disabled={aiEditing}
                          className={`p-1 rounded transition-colors disabled:opacity-50 ${
                            isDarkMode
                              ? 'text-gray-400 hover:text-purple-400 hover:bg-purple-900/20'
                              : 'text-gray-500 hover:text-purple-600 hover:bg-purple-50'
                          }`}
                          title="Generate hashtags with AI"
                        >
                          <Sparkles className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={editHashtagsValue}
                        onChange={(e) => setEditHashtagsValue(e.target.value)}
                        className={`w-full p-3 border rounded-lg focus:outline-none focus:ring-2 ${
                          isDarkMode
                            ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                            : 'border-gray-300 text-gray-700 focus:ring-blue-500'
                        }`}
                        placeholder="Enter hashtags separated by spaces (e.g., #marketing #socialmedia)"
                      />
                    </div>
                  ) : (
                    <div className={`leading-relaxed whitespace-pre-wrap ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {content.content}
                    </div>
                  )}
                </div>
              )}


              {isEditing && (
                <div className={`flex justify-end gap-2 pt-4 border-t ${
                  isDarkMode ? 'border-gray-700' : 'border-gray-200'
                }`}>
                  <button
                    onClick={handleCancelEdit}
                    className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                      isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-gray-100 border-gray-600 hover:border-gray-500'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <XIcon className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={handleSave}
                    className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                      isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-gray-100 border-gray-600 hover:border-gray-500'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Save Changes</span>
                  </button>
                </div>
              )}

              {/* Hashtags - Only show when not editing */}
              {!isEditing && content.hashtags && Array.isArray(content.hashtags) && content.hashtags.length > 0 && (
                <div className="pt-4">
                  <p className="text-sm text-blue-500">
                    {content.hashtags.map((hashtag, index) => (
                      <span key={index}>
                        {hashtag.startsWith('#') ? hashtag : `#${hashtag}`}
                        {index < content.hashtags.length - 1 ? ' ' : ''}
                      </span>
                    ))}
                  </p>
                </div>
              )}

              {/* Additional content fields */}
              {content.email_subject && (
                <div className="pt-4">
                  <h3 className="font-normal text-gray-900 mb-2">Email Subject:</h3>
                  <p className={`${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>{content.email_subject}</p>
                </div>
              )}

              {content.email_body && (
                <div className="pt-4">
                  <h3 className="font-normal text-gray-900 mb-2">Email Body:</h3>
                  <div className={`whitespace-pre-wrap ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`}>{content.email_body}</div>
                </div>
              )}

              {content.short_video_script && (
                <div className="pt-4">
                  <h3 className="font-normal text-gray-900 mb-2">Short Video Script:</h3>
                  <div className={`whitespace-pre-wrap p-4 rounded-lg ${
                    isDarkMode
                      ? 'text-gray-300 bg-gray-700'
                      : 'text-gray-700 bg-gray-50'
                  }`}>{content.short_video_script}</div>
                </div>
              )}

              {content.long_video_script && (
                <div className="pt-4">
                  <h3 className="font-normal text-gray-900 mb-2">Long Video Script:</h3>
                  <div className={`whitespace-pre-wrap p-4 rounded-lg ${
                    isDarkMode
                      ? 'text-gray-300 bg-gray-700'
                      : 'text-gray-700 bg-gray-50'
                  }`}>{content.long_video_script}</div>
                </div>
              )}

              {content.message && (
                <div className="pt-4">
                  <h3 className="font-normal text-gray-900 mb-2">Message:</h3>
                  <div className={`whitespace-pre-wrap p-4 rounded-lg ${
                    isDarkMode
                      ? 'text-gray-300 bg-gray-700'
                      : 'text-gray-700 bg-gray-50'
                  }`}>{content.message}</div>
                </div>
              )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* AI Edit Modal */}
      {showAIEditModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-[60]"
          onClick={handleCancelAIEdit}
        >
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              {/* Header */}
              <div className={`p-6 border-b ${
                isDarkMode
                  ? 'border-gray-700 bg-gradient-to-r from-gray-700 to-gray-600'
                  : 'border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src="/leo_logo.png"
                      alt="Leo"
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        e.target.src = '/default-logo.png'
                      }}
                    />
                    <div>
                      <h3 className={`text-xl font-normal ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        Edit {aiEditType === 'title' ? 'Title' : aiEditType === 'content' ? 'Content' : 'Hashtags'} with Leo
                      </h3>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Provide instructions for Leo to modify the {aiEditType}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCancelAIEdit}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isDarkMode
                        ? 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="space-y-4">
                  {!showAIResult ? (
                    <>
                      {/* Current Content Preview */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Current {aiEditType === 'title' ? 'Title' : aiEditType === 'content' ? 'Content' : 'Hashtags'}
                        </label>
                        <div className={`p-3 rounded-lg text-sm max-h-32 overflow-y-auto ${
                          isDarkMode
                            ? 'bg-gray-700 text-gray-300'
                            : 'bg-gray-50 text-gray-700'
                        }`}>
                          {aiEditType === 'title'
                            ? editTitleValue
                            : aiEditType === 'content'
                            ? editContentValue
                            : editHashtagsValue
                          }
                        </div>
                      </div>

                      {/* AI Instruction */}
                      <div>
                        <label className={`block text-sm font-medium mb-2 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          AI Instruction <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <textarea
                            value={aiEditInstruction}
                            onChange={(e) => setAiEditInstruction(e.target.value)}
                            className={`w-full p-4 border rounded-lg focus:ring-2 focus:border-transparent resize-none text-sm ${
                              isDarkMode
                                ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-blue-400'
                                : 'border-gray-300 text-gray-900 focus:ring-blue-500'
                            }`}
                            rows={5}
                            placeholder="Describe how you want the content to be modified..."
                          />
                          <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                            {aiEditInstruction.length}/500
                          </div>
                        </div>

                        {/* Instruction Examples */}
                        <div className="mt-3">
                          <p className={`text-xs mb-2 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>Example instructions:</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <button
                              onClick={() => setAiEditInstruction("Make it more engaging and add relevant emojis")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Make it more engaging
                            </button>
                            <button
                              onClick={() => setAiEditInstruction("Make it shorter and more concise")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Make it shorter
                            </button>
                            <button
                              onClick={() => setAiEditInstruction("Change the tone to be more professional")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Professional tone
                            </button>
                            <button
                              onClick={() => setAiEditInstruction("Add a call-to-action at the end")}
                              className={`text-left p-2 text-xs rounded border transition-colors ${
                                isDarkMode
                                  ? 'bg-blue-900/20 hover:bg-blue-900/30 border-blue-700 text-blue-300'
                                  : 'bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-800'
                              }`}
                            >
                              Add call-to-action
                            </button>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* AI Result Preview */
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Generated {aiEditType === 'title' ? 'Title' : aiEditType === 'content' ? 'Content' : 'Hashtags'}
                      </label>
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-gray-700 max-h-64 overflow-y-auto">
                        {aiEditedContent}
                      </div>
                      <p className="text-xs text-blue-600 mt-2">
                        ✨ AI has processed your content based on: "{aiEditInstruction}"
                      </p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3 mt-6 pt-4">
                  <button
                    onClick={handleCancelAIEdit}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 bg-gray-700 hover:bg-gray-600'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {showAIResult ? 'Try Again' : 'Cancel'}
                  </button>
                  {!showAIResult ? (
                    <button
                      onClick={handleAISaveEdit}
                      disabled={aiEditing || !aiEditInstruction.trim() || aiEditInstruction.length > 500}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                    >
                      {aiEditing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>AI Editing...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Edit with AI</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveAIResult}
                      className="px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-indigo-600 transition-all duration-200 flex items-center space-x-2"
                    >
                      <Check className="w-4 h-4" />
                      <span>Save Changes</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Image Edit Modal */}
      {showImageEditModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-[60]"
          onClick={() => setShowImageEditModal(false)}
        >
          <div
            className="fixed inset-0 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`relative max-w-2xl w-full rounded-2xl shadow-2xl overflow-hidden ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              {/* Header */}
              <div className={`p-6 border-b ${
                isDarkMode
                  ? 'border-gray-700 bg-gradient-to-r from-gray-700 to-gray-600'
                  : 'border-gray-200 bg-gradient-to-r from-purple-50 to-pink-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src="/leo_logo.png"
                      alt="Leo"
                      className="w-12 h-12 rounded-full object-cover border-2 border-gray-200"
                      onError={(e) => {
                        e.target.src = '/default-logo.png'
                      }}
                    />
                    <div>
                      <h3 className={`text-xl font-normal ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        Edit Image with Leo
                      </h3>
                      <p className={`text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Provide instructions for Leo to modify the image
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowImageEditModal(false)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 hover:text-white hover:bg-gray-700'
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="p-6">
                {/* Image Preview */}
                <div className="mb-6">
                  {showImagePreview ? (
                    // Preview mode - show both images for comparison
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Current Image */}
                      <div>
                        <h4 className={`text-sm font-medium mb-3 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Current Image:
                          {selectedImageForEdit === editingImage && showImagePreview && (
                            <span className="ml-2 text-xs text-blue-500">(Selected for editing)</span>
                          )}
                        </h4>
                        <div className="flex justify-center">
                          <img
                            src={editingImage}
                            alt="Image to edit"
                            className={`max-w-full max-h-48 object-contain rounded-lg border-2 ${
                              selectedImageForEdit === editingImage && showImagePreview
                                ? 'border-blue-500 cursor-pointer'
                                : showImagePreview
                                ? 'border-gray-300 cursor-pointer hover:border-blue-400'
                                : 'border-gray-200'
                            }`}
                            onClick={() => showImagePreview && handleImageClick(editingImage, 'current')}
                          />
                      </div>
                    </div>

                    {/* Edited Image */}
                    <div>
                      <h4 className={`text-sm font-medium mb-3 ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-700'
                      }`}>
                        Edited Image:
                        {selectedImageForEdit === editedImageUrl && showImagePreview && (
                          <span className="ml-2 text-xs text-blue-500">(Selected for editing)</span>
                        )}
                      </h4>
                      <div className="flex justify-center">
                        {showImagePreview && editedImageUrl ? (
                          <img
                            src={editedImageUrl}
                            alt="Edited image"
                            className={`max-w-full max-h-48 object-contain rounded-lg border-2 ${
                              selectedImageForEdit === editedImageUrl
                                ? 'border-blue-500 cursor-pointer'
                                : 'border-green-500 cursor-pointer hover:border-blue-400'
                            }`}
                            onClick={() => handleImageClick(editedImageUrl, 'edited')}
                          />
                        ) : (
                          <div className="flex justify-center items-center h-48 bg-gray-100 dark:bg-gray-800 rounded-lg border border-gray-200 border-dashed">
                            <div className="text-center">
                              <svg className={`w-12 h-12 mx-auto mb-2 ${
                                isDarkMode ? 'text-gray-500' : 'text-gray-400'
                              }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <p className={`text-sm ${
                                isDarkMode ? 'text-gray-500' : 'text-gray-400'
                              }`}>
                                Preview will appear here
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  ) : (
                    // Editing mode - show image being edited and placeholder for result
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Image Being Edited */}
                      <div>
                        <h4 className={`text-sm font-medium mb-3 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Image to Edit:
                        </h4>
                        <div className="flex justify-center">
                          <img
                            src={editingImage}
                            alt="Image to edit"
                            className="max-w-full max-h-48 object-contain rounded-lg border-2 border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Result Preview Placeholder */}
                      <div>
                        <h4 className={`text-sm font-medium mb-3 ${
                          isDarkMode ? 'text-gray-300' : 'text-gray-700'
                        }`}>
                          Result Preview:
                        </h4>
                        <div className="flex justify-center items-center h-48 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 border-dashed">
                          <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                              </svg>
                            </div>
                            <p className={`text-sm font-medium ${
                              isDarkMode ? 'text-blue-300' : 'text-blue-700'
                            }`}>
                              Leo will edit this image
                            </p>
                            <p className={`text-xs mt-1 ${
                              isDarkMode ? 'text-blue-400' : 'text-blue-600'
                            }`}>
                              Result will appear here
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Instructions Input - Only show when not in preview mode */}
                {!showImagePreview && (
                  <div className="mb-6">
                    <label htmlFor="imageEditInstruction" className={`block text-sm font-medium mb-3 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      Edit Instructions:
                    </label>
                    <div className="relative">
                      <textarea
                        id="imageEditInstruction"
                        value={imageEditInstruction}
                        onChange={(e) => setImageEditInstruction(e.target.value)}
                        className={`w-full p-4 border rounded-lg focus:ring-2 focus:border-transparent resize-none text-sm ${
                          isDarkMode
                            ? 'border-gray-600 text-gray-200 bg-gray-700 focus:ring-purple-400'
                            : 'border-gray-300 text-gray-900 focus:ring-purple-500'
                        }`}
                        rows={4}
                        placeholder="Describe how you want the image to be edited (e.g., change background color, add effects, adjust lighting, etc.)"
                        maxLength={500}
                      />
                      <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                        {imageEditInstruction.length}/500
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Actions - Only show when in preview mode */}
                {showImagePreview && (
                  <div className="mb-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                      <p className={`text-sm ${
                        isDarkMode ? 'text-blue-300' : 'text-blue-800'
                      }`}>
                        <strong>Preview Ready!</strong> Click on either image to select which version you want to edit next, or save the current result.
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center justify-end space-x-3">
                  <button
                    onClick={() => setShowImageEditModal(false)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 bg-gray-700 hover:bg-gray-600'
                        : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    Cancel
                  </button>

                  {showImagePreview ? (
                    <>
                      <button
                        onClick={handleContinueEditing}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                          isDarkMode
                            ? 'text-purple-400 bg-gray-700 hover:bg-gray-600'
                            : 'text-purple-600 bg-gray-100 hover:bg-gray-200'
                        }`}
                      >
                        Continue Editing
                      </button>
                      <button
                        onClick={handleSaveEditedImage}
                        className="px-4 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg font-medium hover:from-green-600 hover:to-blue-600 transition-all duration-200 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save Changes</span>
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleImageEditSubmit}
                      disabled={imageEditing || !imageEditInstruction.trim() || imageEditInstruction.length > 500}
                      className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center space-x-2"
                    >
                      {imageEditing ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Leo Editing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Edit with Leo</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowSuccessModal(false)}
          />
          <div className={`relative max-w-md w-full rounded-2xl shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            {/* Header */}
            <div className={`p-6 border-b ${
              isDarkMode
                ? 'border-gray-700 bg-gradient-to-r from-gray-700 to-gray-600'
                : 'border-gray-200 bg-gradient-to-r from-green-50 to-blue-50'
            }`}>
              <div className="flex items-center justify-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h3 className={`text-lg font-normal ${
                    isDarkMode ? 'text-gray-100' : 'text-gray-900'
                  }`}>
                    Success!
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
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-200"
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
                      : 'bg-blue-50 border border-blue-200'
                  }`}>
                    {/* Speech bubble pointer */}
                    <div className={`absolute left-0 top-4 transform -translate-x-2 w-0 h-0 ${
                      isDarkMode
                        ? 'border-t-8 border-t-gray-700 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                        : 'border-t-8 border-t-blue-50 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                    }`} />

                    <p className={`text-sm leading-relaxed ${
                      isDarkMode ? 'text-gray-200' : 'text-gray-800'
                    }`}>
                      <span className="font-normal text-blue-500">Leo here!</span> 🎉<br />
                      Your image has been beautifully edited and updated! The changes are now live in your content and conversations. Keep creating amazing things!
                    </p>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => {
                        setShowSuccessModal(false)
                        // Soft refresh to show updated content with new image
                        window.location.reload()
                      }}
                      className="px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg font-medium hover:from-blue-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
                    >
                      Awesome! ✨
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default ATSNContentModal
