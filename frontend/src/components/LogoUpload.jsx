import React, { useState, useRef } from 'react'
import { Upload, X, Image as ImageIcon } from 'lucide-react'
import { mediaAPI } from '../services/api'

const LogoUpload = ({ 
  value = '',
  onUploadSuccess, 
  onError,
  onColorsExtracted,
  className = '',
  disabled = false 
}) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState(value)
  const [uploadedUrl, setUploadedUrl] = useState(value)
  const fileInputRef = useRef(null)

  const handleFileSelect = async (file) => {
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      onError?.('Please select a valid image file (JPEG, PNG, GIF, or WebP)')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      onError?.('File size must be less than 5MB')
      return
    }

    setIsUploading(true)
    
    try {
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setPreview(e.target.result)
      }
      reader.readAsDataURL(file)

      // Upload file using API service
      const response = await mediaAPI.uploadLogo(file)
      setUploadedUrl(response.data.url)
      onUploadSuccess?.(response.data.url)
      onError?.(null)

      // Automatically extract colors from logo
      try {
        const colorResponse = await mediaAPI.extractColorsFromLogo(response.data.url)
        console.log('Color extraction response:', colorResponse.data)
        if (colorResponse.data && colorResponse.data.colors) {
          const colors = colorResponse.data.colors
          console.log('Extracted colors:', colors)
          onColorsExtracted?.(colors)
        } else if (colorResponse.data && Array.isArray(colorResponse.data)) {
          // Handle case where colors are returned directly as array
          console.log('Extracted colors (direct array):', colorResponse.data)
          onColorsExtracted?.(colorResponse.data)
        }
      } catch (colorError) {
        console.warn('Failed to extract colors from logo:', colorError)
        // Don't fail the upload if color extraction fails
      }
    } catch (error) {
      console.error('Upload error:', error)
      onError?.(error.message || 'Upload failed. Please try again.')
      setPreview('')
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
    setPreview('')
    setUploadedUrl('')
    onUploadSuccess?.('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
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
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />

        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Logo preview"
              className="mx-auto max-h-32 max-w-32 object-contain rounded"
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
                  <ImageIcon className="h-12 w-12 text-gray-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">
                    Upload your logo
                  </p>
                  <p className="text-xs text-gray-500">
                    Drag and drop or click to browse
                  </p>
                  <p className="text-xs text-gray-400">
                    PNG, JPG, GIF, WebP up to 5MB
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

export default LogoUpload
