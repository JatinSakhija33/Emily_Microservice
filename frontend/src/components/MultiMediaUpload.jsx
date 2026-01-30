import React, { useState, useRef, useEffect } from 'react'
import { Upload, X, Image as ImageIcon, Video } from 'lucide-react'
import { mediaAPI } from '../services/api'

const MultiMediaUpload = ({ 
  value = [],
  onUploadSuccess, 
  onError,
  className = '',
  disabled = false,
  maxFiles = 4
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState(value || [])
  const [uploadProgress, setUploadProgress] = useState({})
  const fileInputRef = useRef(null)

  // Sync with value prop
  useEffect(() => {
    if (value && Array.isArray(value)) {
      // Convert URLs to file objects if needed
      const files = value.map(item => {
        if (typeof item === 'string') {
          return { url: item, type: 'image', name: 'Uploaded file' }
        }
        return item
      })
      setUploadedFiles(files)
    }
  }, [value])

  const handleFileSelect = async (file) => {
    if (!file) return

    // Check if we've reached max files
    if (uploadedFiles.length >= maxFiles) {
      onError?.(`Maximum ${maxFiles} files allowed`)
      return
    }

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
    
    try {
      // Upload file using API service
      const response = await mediaAPI.uploadMedia(file)
      const newFile = {
        url: response.data.url,
        type: isVideo ? 'video' : 'image',
        name: file.name
      }
      
      const updatedFiles = [...uploadedFiles, newFile]
      setUploadedFiles(updatedFiles)
      onUploadSuccess?.(updatedFiles)
      onError?.(null)
    } catch (error) {
      console.error('Upload error:', error)
      onError?.(error.message || 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemove = (index) => {
    const updatedFiles = uploadedFiles.filter((_, i) => i !== index)
    setUploadedFiles(updatedFiles)
    onUploadSuccess?.(updatedFiles)
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
      handleMultipleFiles(files)
    }
  }

  const handleClick = () => {
    if (!disabled && uploadedFiles.length < maxFiles) {
      fileInputRef.current?.click()
    }
  }

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleMultipleFiles(files)
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleMultipleFiles = async (files) => {
    // Filter out files that would exceed maxFiles limit
    const remainingSlots = maxFiles - uploadedFiles.length
    if (remainingSlots <= 0) {
      onError?.(`Maximum ${maxFiles} files allowed`)
      return
    }

    const filesToUpload = files.slice(0, remainingSlots)
    if (files.length > remainingSlots) {
      onError?.(`Only ${remainingSlots} file(s) can be uploaded. Maximum ${maxFiles} files allowed.`)
    }

    // Validate all files first
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm']
    const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes]

    const validFiles = []
    for (const file of filesToUpload) {
      if (!allowedTypes.includes(file.type)) {
        onError?.(`${file.name} is not a valid file type. Please select images (JPEG, PNG, GIF, WebP) or videos (MP4, MOV, AVI, WebM)`)
        continue
      }

      const isVideo = allowedVideoTypes.includes(file.type)
      const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
      if (file.size > maxSize) {
        onError?.(`${file.name} is too large. Maximum size is ${isVideo ? '50MB' : '10MB'}`)
        continue
      }

      validFiles.push(file)
    }

    if (validFiles.length === 0) {
      return
    }

    setIsUploading(true)
    const newFiles = []

    // Upload files sequentially to avoid overwhelming the server
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i]
      try {
        setUploadProgress({ [i]: `Uploading ${file.name}...` })
        const response = await mediaAPI.uploadMedia(file)
        const uploadedFile = {
          url: response.data.url,
          type: allowedVideoTypes.includes(file.type) ? 'video' : 'image',
          name: file.name
        }
        newFiles.push(uploadedFile)
        setUploadProgress({ [i]: 'Complete' })
      } catch (error) {
        console.error(`Upload error for ${file.name}:`, error)
        onError?.(`Failed to upload ${file.name}: ${error.message || 'Upload failed'}`)
        setUploadProgress({ [i]: 'Failed' })
      }
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...uploadedFiles, ...newFiles]
      setUploadedFiles(updatedFiles)
      onUploadSuccess?.(updatedFiles)
    }

    setUploadProgress({})
    setIsUploading(false)
    onError?.(null)
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="relative group">
              {file.type === 'video' ? (
                <video
                  src={file.url}
                  className="w-full h-32 object-cover rounded-lg border border-gray-300"
                  controls
                />
              ) : (
                <img
                  src={file.url}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border border-gray-300"
                />
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Area */}
      {uploadedFiles.length < maxFiles && (
        <div
          className={`
            relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${isDragOver ? 'border-pink-500 bg-pink-50' : 'border-gray-300 hover:border-gray-400'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
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
            multiple
            onChange={handleFileInputChange}
            className="hidden"
            disabled={disabled}
          />

          {isUploading ? (
            <div className="flex flex-col items-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
              <p className="text-sm text-gray-600">
                {Object.values(uploadProgress)[0] || 'Uploading...'}
              </p>
              {Object.keys(uploadProgress).length > 1 && (
                <p className="text-xs text-gray-500">
                  {Object.keys(uploadProgress).length} files uploading...
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <Upload className="h-12 w-12 text-gray-400" />
              </div>
              <div className="space-y-1 mt-2">
                <p className="text-sm font-medium text-gray-700">
                  Upload Post Media ({uploadedFiles.length}/{maxFiles})
                </p>
                <p className="text-xs text-gray-500">
                  Drag and drop multiple files or click to browse (up to {maxFiles - uploadedFiles.length} more)
                </p>
                <p className="text-xs text-gray-400">
                  Images: PNG, JPG, GIF, WebP up to 10MB | Videos: MP4, MOV, AVI, WebM up to 50MB
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {uploadedFiles.length >= maxFiles && (
        <p className="text-sm text-gray-500 text-center">
          Maximum {maxFiles} files uploaded
        </p>
      )}
    </div>
  )
}

export default MultiMediaUpload

