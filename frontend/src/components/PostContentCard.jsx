import React, { useState } from 'react'
import { Facebook, Instagram, Linkedin, Youtube, Twitter, Building2, Copy, Eye, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

const PostContentCard = ({ post, isDarkMode, onCopy }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  
  // Parse generated_image_url (single URL from post_contents table)
  const getImages = () => {
    if (!post.generated_image_url) return []
    
    try {
      // If it's a string URL, return it as an array
      if (typeof post.generated_image_url === 'string') {
        return [post.generated_image_url]
      }
      return []
    } catch (e) {
      console.error('Error parsing generated_image_url:', e)
      return []
    }
  }

  const images = getImages()
  const hasMultipleImages = images.length > 1
  
  // Debug logging
  if (!images.length && process.env.NODE_ENV === 'development') {
    console.log('PostContentCard: No images found for post:', post.id, 'generated_image_url:', post.generated_image_url)
  }

  // Navigate between images
  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  // Get platform icon
  const getPlatformIcon = () => {
    const iconSize = 'w-5 h-5'
    const platform = post.platform?.toLowerCase()

    switch (platform) {
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
        )
      case 'facebook':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
          </svg>
        )
      case 'linkedin':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0077B5"/>
          </svg>
        )
      case 'twitter':
      case 'x':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000"/>
          </svg>
        )
      case 'youtube':
        return (
          <svg className={iconSize} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000"/>
          </svg>
        )
      default:
        return <Building2 className={`${iconSize} ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
    }
  }

  // Get status badge color
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return isDarkMode ? 'bg-green-900/50 text-green-300 border-green-700' : 'bg-green-100 text-green-800 border-green-200'
      case 'scheduled':
        return isDarkMode ? 'bg-blue-900/50 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-800 border-blue-200'
      case 'draft':
      case 'generated':
        return isDarkMode ? 'bg-purple-900/50 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-800 border-purple-200'
      default:
        return isDarkMode ? 'bg-gray-700 text-gray-300 border-gray-600' : 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div
      className={`flex-shrink-0 w-80 rounded-xl shadow-lg border overflow-hidden hover:shadow-2xl transition-all duration-300 transform hover:scale-[1.02] ${
        isDarkMode
          ? 'bg-gray-800 border-gray-700 shadow-gray-900/50'
          : 'bg-white border-gray-200'
      }`}
    >
      {/* Image Section with Carousel */}
      {images.length > 0 && (
        <div className="relative group">
          <img
            src={images[currentImageIndex]}
            alt={`Post image ${currentImageIndex + 1}`}
            className="w-full aspect-square object-cover"
            onError={(e) => {
              console.error('Image failed to load:', e.target.src, 'for post:', post.id)
              // Show a placeholder instead of hiding
              e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"%3E%3Crect fill="%23ddd" width="400" height="400"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="30" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
              e.target.onerror = null // Prevent infinite loop
            }}
          />
          
          {/* Image Counter Badge */}
          {hasMultipleImages && (
            <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-full text-xs font-medium">
              {currentImageIndex + 1} / {images.length}
            </div>
          )}

          {/* Navigation Arrows */}
          {hasMultipleImages && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 hover:bg-black/70 backdrop-blur-sm rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </>
          )}

          {/* Image Dots Indicator */}
          {hasMultipleImages && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {images.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentImageIndex
                      ? 'bg-white w-6'
                      : 'bg-white/50 hover:bg-white/75'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Content Section */}
      <div className="p-4">
        {/* Platform Badge & Status */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {getPlatformIcon()}
            <span className={`text-sm font-medium capitalize ${
              isDarkMode ? 'text-gray-200' : 'text-gray-700'
            }`}>
              {post.platform}
            </span>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full border ${getStatusColor(post.status)}`}>
            {post.status || 'Generated'}
          </span>
        </div>

        {/* Generated Caption */}
        {post.generated_caption && (
          <p className={`text-sm line-clamp-4 mb-3 leading-relaxed ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>
            {post.generated_caption}
          </p>
        )}

        {/* Metadata */}
        <div className="flex items-center justify-between pt-3 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}">
          {/* Date */}
          <div className={`flex items-center gap-1 text-xs ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Copy Caption Button */}
            {post.generated_caption && (
              <button
                onClick={() => onCopy && onCopy(post.generated_caption)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDarkMode
                    ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200'
                    : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                }`}
                title="Copy caption"
              >
                <Copy className="w-4 h-4" />
              </button>
            )}

            {/* View Details Button */}
            <button
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isDarkMode
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PostContentCard

