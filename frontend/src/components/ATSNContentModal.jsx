import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Hash, Edit, Check, X as XIcon, Sparkles, RefreshCw, Copy, ChevronLeft, ChevronRight, Layers } from 'lucide-react'
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

const ATSNContentModal = ({
  content,
  onClose,
  autoOpenImageEditor = false,
  initialImageEditorUrl = '',
  onImageEditorOpened
}) => {
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
  const [userImageFile, setUserImageFile] = useState(null)
  const [uploadingUserImage, setUploadingUserImage] = useState(false)
  const [imageUploadError, setImageUploadError] = useState('')
  const [imageSaved, setImageSaved] = useState(false)
  const [uploadedImagePreview, setUploadedImagePreview] = useState('')
  const [showAIResult, setShowAIResult] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)
  const [carouselIndex, setCarouselIndex] = useState(0)
  const fileInputRef = useRef(null)

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

  useEffect(() => {
    setCarouselIndex(0)
  }, [content?.id, content?.carousel_images?.length])

  const normalizeImages = (rawImages) => {
    if (!rawImages) return []
    if (!Array.isArray(rawImages)) return []
    return rawImages
      .map((img) => {
        if (!img) return null
        if (typeof img === 'string') return img
        if (typeof img === 'object') return img.url || img.image_url || img.path || null
        return null
      })
      .filter(Boolean)
  }

  const carouselImages = normalizeImages(
    content?.carousel_images ||
    content?.metadata?.carousel_images ||
    content?.images
  )
  const hasCarouselImages = carouselImages.length > 0

  const prevCarouselImage = () => {
    if (!hasCarouselImages) return
    setCarouselIndex((prev) => (prev - 1 + carouselImages.length) % carouselImages.length)
  }

  const nextCarouselImage = () => {
    if (!hasCarouselImages) return
    setCarouselIndex((prev) => (prev + 1) % carouselImages.length)
  }

  // Edit handlers
  const handleEdit = () => {
    setEditTitleValue(content.title || '')
    setEditContentValue(content.content || '')
    setEditHashtagsValue(content.hashtags ? content.hashtags.join(' ') : '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    try {
      // Get authentication token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        console.error('No auth token available')
        return
      }

      // Prepare update data
      const updateData = {
        title: editTitleValue,
        content: editContentValue,
        hashtags: editHashtagsValue ? editHashtagsValue.split(' ').filter(tag => tag.trim()) : []
      }

    // Handle different content types
    if (content.content_type === 'short_video or reel' && editContentValue) {
        // For short video scripts, you might need to handle this differently
        // depending on your backend schema
        updateData.short_video_script = editContentValue
      }

      // Make API call to update created content
      const response = await fetch(`${API_BASE_URL}/content/created-content/update/${content.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData)
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Content updated successfully:', result)

        // Update local content object with saved data
    content.title = editTitleValue
        content.content = editContentValue
        content.hashtags = updateData.hashtags

        // Close edit mode
        setIsEditing(false)
      } else {
        console.error('Failed to update content:', response.statusText)
        // You might want to show an error message to the user
      }
    } catch (error) {
      console.error('Error saving content:', error)
      // You might want to show an error message to the user
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
  }

  const openImageEditSession = useCallback((imageUrl) => {
    setOriginalImageUrl(imageUrl)  // Store the original image URL from content
    setEditingImage(imageUrl)      // Set the current image being edited
    setShowImageEditModal(true)
    setImageEditInstruction('')
    setEditedImageUrl('')
    setShowImagePreview(false)
    setSelectedImageForEdit('')
  }, [])

  const handleImageEdit = (imageUrl) => {
    openImageEditSession(imageUrl)
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

  const handleUserImageSelection = (event) => {
    const file = event.target.files?.[0]

    // Clean up previous preview URL
    if (uploadedImagePreview) {
      URL.revokeObjectURL(uploadedImagePreview)
    }

    if (file) {
      setUserImageFile(file)
      setImageUploadError('')
      setImageSaved(false)

      // Create preview URL for the selected file
      const previewUrl = URL.createObjectURL(file)
      setUploadedImagePreview(previewUrl)
    } else {
      setUserImageFile(null)
      setUploadedImagePreview('')
    }
  }

  const replaceContentImage = async (imageUrl) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    if (!token) {
      throw new Error('Authentication required to update content')
    }

    const response = await fetch(`${API_BASE_URL}/content/created-content/update/${content.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ images: [imageUrl] })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to save uploaded image: ${errorText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.error || 'Failed to update content with uploaded image')
    }

    content.images = Array.isArray(data.content.images) ? data.content.images : [imageUrl]
    return data.content
  }

  const handleUploadUserImage = async (file) => {
    const uploadFile = file || userImageFile
    if (!uploadFile) return

    setUploadingUserImage(true)
    setImageUploadError('')
    setImageSaved(false)

    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('You must be signed in to upload an image')
      }

      const safeFileName = uploadFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${user.id}/uploads/${content.id || 'content'}-${Date.now()}-${safeFileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('ai-generated-images')
        .upload(path, uploadFile, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        throw uploadError
      }

      const { data: publicUrlData } = supabase.storage.from('ai-generated-images').getPublicUrl(uploadData.path)
      const imageUrl = publicUrlData?.publicUrl

      if (!imageUrl) {
        throw new Error('Unable to generate public URL for the uploaded image')
      }

      await replaceContentImage(imageUrl)

      setOriginalImageUrl(imageUrl)
      setEditingImage(imageUrl)
      setSelectedImageForEdit(imageUrl)
      setShowImagePreview(false)
      setUserImageFile(null)
      setUploadedImagePreview('')
      setImageSaved(true)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error) {
      console.error('Failed to upload image:', error)
      setImageUploadError(error?.message || 'Failed to upload image')
    } finally {
      setUploadingUserImage(false)
    }
  }


  const handleImageClick = (imageUrl, imageType) => {
    if (showImagePreview) {
      setSelectedImageForEdit(imageUrl)
    }
  }

  useEffect(() => {
    if (autoOpenImageEditor && initialImageEditorUrl) {
      openImageEditSession(initialImageEditorUrl)
      onImageEditorOpened?.()
    }
  }, [autoOpenImageEditor, initialImageEditorUrl, openImageEditSession, onImageEditorOpened])

  // Cleanup uploaded image preview URL
  useEffect(() => {
    return () => {
      if (uploadedImagePreview) {
        URL.revokeObjectURL(uploadedImagePreview)
      }
    }
  }, [uploadedImagePreview])

  // Cleanup when modal closes
  useEffect(() => {
    if (!showImageEditModal && uploadedImagePreview) {
      URL.revokeObjectURL(uploadedImagePreview)
      setUploadedImagePreview('')
      setUserImageFile(null)
      setImageSaved(false)
    }
  }, [showImageEditModal, uploadedImagePreview])

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
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0077B5"/>
          </svg>
        );
      case 'twitter':
      case 'x':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
          </svg>
        );
      case 'youtube':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
          </svg>
        );
      case 'tiktok':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="#000000"/>
          </svg>
        );
      case 'pinterest':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.75.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378 0 0-.599 2.282-.744 2.84-.282 1.084-1.064 2.456-1.549 3.235C9.584 23.815 10.77 24.001 12.017 24.001c6.624 0 11.99-5.367 11.99-11.987C24.007 5.367 18.641.001.012.017z" fill="#E60023"/>
          </svg>
        );
      case 'whatsapp business':
      case 'whatsapp':
        return (
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.742.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.488" fill="#25D366"/>
          </svg>
        );
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
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className="fixed inset-0 flex items-center justify-center p-4"
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
              {hasCarouselImages ? (
                <div className="relative group">
                  <div className="overflow-hidden rounded-3xl bg-gray-900 aspect-square">
                    <div
                      className="flex h-full transition-transform duration-300 ease-in-out"
                      style={{ transform: `translateX(-${carouselIndex * 100}%)` }}
                    >
                      {carouselImages.map((img, index) => (
                        <div key={index} className="min-w-full h-full flex-shrink-0">
                          <img
                            src={img}
                            alt={`Carousel image ${index + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none'
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Navigation Arrows */}
                  {carouselImages.length > 1 && (
                    <>
                      <button
                        onClick={prevCarouselImage}
                        className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
                        title="Previous carousel image"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={nextCarouselImage}
                        className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white p-2 rounded-full transition-opacity opacity-0 group-hover:opacity-100"
                        title="Next carousel image"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {/* Indicator Dots */}
                  {carouselImages.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-2">
                      {carouselImages.map((_, index) => (
                        <button
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation()
                            setCarouselIndex(index)
                          }}
                          className={`rounded-full transition-all duration-300 ${
                            index === carouselIndex
                              ? 'bg-white w-8 h-2'
                              : 'bg-white/60 w-2 h-2'
                          }`}
                          title={`Image ${index + 1}`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Edit Image Button */}
                  <button
                    onClick={() => handleImageEdit(carouselImages[carouselIndex])}
                    className={`absolute top-3 right-6 p-2 rounded-lg shadow-lg transition-all duration-200 ${
                      isDarkMode
                        ? 'bg-gray-900/90 hover:bg-gray-800 text-white hover:text-gray-200'
                        : 'bg-black/60 hover:bg-black/80 text-white hover:text-gray-200'
                    }`}
                    title="Edit carousel image with AI"
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

                {/* Action Buttons + Upload */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4">
                  <div className="flex items-center gap-3">
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
            <div className={`relative max-w-2xl w-full h-[80vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
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
              <div className="p-6 overflow-y-auto flex-1">
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
                            className={`max-w-full max-h-80 object-contain rounded-lg border-2 ${
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
                            className={`max-w-full max-h-80 object-contain rounded-lg border-2 ${
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
                          {uploadedImagePreview && (
                            <span className="ml-2 text-xs text-green-500">(Uploaded)</span>
                          )}
                        </h4>
                        <div className="flex justify-center">
                          <img
                            src={uploadedImagePreview || editingImage}
                            alt="Image to edit"
                            className="max-w-full max-h-80 object-contain rounded-lg border-2 border-blue-500"
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
                        <div className="flex justify-center items-center h-80 bg-gradient-to-br from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 rounded-lg border border-blue-200 dark:border-blue-700 border-dashed">
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

                {/* Upload + Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-4">
                  <div className="flex items-center gap-2">
                    {/* Upload Image Button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingUserImage}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isDarkMode
                          ? 'text-gray-200 bg-gray-700 hover:bg-gray-600 disabled:opacity-50'
                          : 'text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50'
                      }`}
                    >
                      {uploadingUserImage ? 'Uploading…' : 'Upload Image'}
                    </button>

                    {/* Save Image Button */}
                    {userImageFile && (
                      <button
                        onClick={() => handleUploadUserImage(userImageFile)}
                        disabled={uploadingUserImage || imageSaved}
                        className="px-3 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-pink-500 to-purple-600 disabled:opacity-50"
                      >
                        {uploadingUserImage ? 'Saving…' : imageSaved ? 'Image Saved' : 'Save Image'}
                      </button>
                    )}

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleUserImageSelection}
                      className="hidden"
                    />
                  </div>
                  <div className="flex items-center gap-3">
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
