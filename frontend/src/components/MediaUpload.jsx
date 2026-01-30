import React, { useState, useRef, useEffect } from 'react'
import { Upload, X } from 'lucide-react'
import { mediaAPI } from '../services/api'

const MediaUpload = ({ 
  value = '',
  onUploadSuccess, 
  onError,
  className = '',
  disabled = false 
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const [uploadedUrl, setUploadedUrl] = useState(value)
  const [fileType, setFileType] = useState(null) // 'image' or 'video'
  const fileInputRef = useRef(null)

  // Detect file type from URL when value changes
  useEffect(() => {
    if (value) {
      setPreview(value)
      setUploadedUrl(value)
      
      // Detect file type from URL extension
      const url = value.toLowerCase()
      const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mpeg', '.wmv']
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp']
      
      const isVideo = videoExtensions.some(ext => url.includes(ext))
      const isImage = imageExtensions.some(ext => url.includes(ext))
      
      if (isVideo) {
        setFileType('video')
      } else if (isImage) {
        setFileType('image')
      } else {
        // Try to detect from URL path or default to image
        // Could be a video if it's from a video hosting service
        if (url.includes('video') || url.includes('.mp4') || url.includes('.mov')) {
          setFileType('video')
        } else {
          setFileType('image') // Default to image for unknown types
        }
      }
    } else {
      setPreview('')
      setUploadedUrl('')
      setFileType(null)
    }
  }, [value])

  const handleFileSelect = async (file) => {
    if (!file) return

    // Validate file type - support images and videos
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm']
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes]
    
    if (!allowedTypes.includes(file.type)) {
      onError?.('Please select a valid image or video file (JPEG, PNG, GIF, WebP, MP4, MOV, AVI, or WebM)')
      return
    }

    // Validate file size (max 50MB for videos, 10MB for images)
    const isVideo = allowedVideoTypes.includes(file.type)
    const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024 // 50MB for videos, 10MB for images
    if (file.size > maxSize) {
      onError?.(`File size must be less than ${isVideo ? '50MB' : '10MB'}`)
      return
    }

    setIsUploading(true)
    setFileType(isVideo ? 'video' : 'image')
    
    try {
      // Create preview
      if (isVideo) {
        const videoUrl = URL.createObjectURL(file)
        setPreview(videoUrl)
      } else {
        const reader = new FileReader()
        reader.onload = (e) => {
          setPreview(e.target.result)
        }
        reader.readAsDataURL(file)
      }

      // Upload file using API service
      const response = await mediaAPI.uploadMedia(file)
      setUploadedUrl(response.data.url)
      onUploadSuccess?.(response.data.url)
      onError?.(null)
    } catch (error) {
      console.error('Upload error:', error)
      onError?.(error.message || 'Upload failed. Please try again.')
      setPreview('')
      setFileType(null)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragOver(false)
    
    if (disabled) return
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleClick = () => {
    if (!disabled) {
      fileInputRef.current?.click()
    }
  }

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleRemove = (e) => {
    e.stopPropagation()
    if (preview && fileType === 'video') {
      URL.revokeObjectURL(preview)
    }
    setPreview('')
    setUploadedUrl('')
    setFileType(null)
    onUploadSuccess?.('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer transition-colors
          ${isDragOver ? 'border-pink-500 bg-pink-50' : 'border-gray-300 hover:border-gray-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${preview ? 'border-green-300 bg-green-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {preview ? (
          <div className="relative">
            {fileType === 'video' ? (
              <div className="relative">
                <video
                  src={preview}
                  className="mx-auto max-h-48 max-w-full object-contain rounded"
                  controls
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors z-10"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <img
                  src={preview}
                  alt="Media preview"
                  className="mx-auto max-h-48 max-w-full object-contain rounded"
                />
                {!disabled && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {isUploading ? (
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center">
                  <Upload className="h-12 w-12 text-gray-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">
                    Upload video, photo, or reel
                  </p>
                  <p className="text-xs text-gray-500">
                    Drag and drop or click to browse
                  </p>
                  <p className="text-xs text-gray-400">
                    Images: PNG, JPG, GIF, WebP up to 10MB<br />
                    Videos: MP4, MOV, AVI, WebM up to 50MB
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MediaUpload
