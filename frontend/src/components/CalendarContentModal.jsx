import React from 'react'
import { X, Calendar, Clock, Tag, Palette, Image, Type, Sparkles, Eye } from 'lucide-react'

const CalendarContentModal = ({ isOpen, onClose, date, entries, isDarkMode }) => {
  if (!isOpen) return null

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'N/A'
    }
  }

  const capitalizeWords = (str) => {
    if (!str) return 'N/A'
    return str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
        return isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
      case 'scheduled':
        return isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
      default:
        return isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800'
    }
  }

  const getContentTypeColor = (contentType) => {
    switch (contentType?.toLowerCase()) {
      case 'reel':
      case 'video':
        return isDarkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'
      case 'carousel':
        return isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
      case 'static_post':
      case 'image':
        return isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
      case 'story':
        return isDarkMode ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-800'
      default:
        return isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'
    }
  }

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.162c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        )
      case 'facebook':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )
      case 'youtube':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        )
      case 'linkedin':
        return (
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        )
      default:
        return <Calendar className="w-5 h-5" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
      <div
        className={`w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-4">
            {/* Platform Icon */}
            <div className={`p-3 rounded-xl ${
              entries?.length === 1
                ? getContentTypeColor(entries[0].content_type)
                : 'bg-blue-500/10 text-blue-500'
            }`}>
              {entries?.length === 1
                ? getPlatformIcon(entries[0].platform)
                : <Calendar className="w-6 h-6" />
              }
            </div>

            <div>
              <h2 className={`text-2xl font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formatDate(date)}
              </h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {entries?.length || 0} {entries?.length === 1 ? 'post' : 'posts'} scheduled
                {entries?.length === 1 && (
                  <span className="ml-2 text-blue-500 font-medium">
                    • {capitalizeWords(entries[0].platform)}
                  </span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-all duration-200 ${
              isDarkMode
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
            }`}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
          {!entries || entries.length === 0 ? (
            <div className={`text-center py-12 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>No content scheduled for this date</p>
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl border p-6 transition-all duration-200 hover:shadow-lg ${
                    isDarkMode
                      ? 'bg-gray-750 border-gray-700 hover:border-gray-600'
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                        <h3 className={`text-lg font-normal ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                          {entry.topic}
                        </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-sm px-2 py-1 rounded ${getContentTypeColor(entry.content_type)}`}>
                          {capitalizeWords(entry.content_type)}
                        </span>
                        <span className={`text-sm px-2 py-1 rounded ${getStatusColor(entry.status)}`}>
                          {capitalizeWords(entry.status)}
                        </span>
                      </div>
                    </div>

                    {entry.scheduled_time && (
                      <div className={`flex items-center gap-1 text-sm ${
                        isDarkMode ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        <Clock className="w-4 h-4" />
                        <span>{entry.scheduled_time}</span>
                      </div>
                    )}
                  </div>

                  {/* Card Content Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {/* Theme */}
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Tag className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Theme</span>
                      </div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {capitalizeWords(entry.content_theme)}
                      </p>
                    </div>

                    {/* Platform */}
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Eye className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Platform</span>
                      </div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {capitalizeWords(entry.platform)}
                      </p>
                    </div>

                    {/* Hook Type & Length */}
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Hook</span>
                      </div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {capitalizeWords(entry.hook_type)} • {capitalizeWords(entry.hook_length)}
                      </p>
                    </div>

                    {/* Tone & Creativity */}
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Palette className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Tone</span>
                      </div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {capitalizeWords(entry.tone)} • {capitalizeWords(entry.creativity)} Creativity
                      </p>
                    </div>

                    {/* Visual Style */}
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Image className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Visual Style</span>
                      </div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {capitalizeWords(entry.visual_style)}
                      </p>
                    </div>

                    {/* Text in Image */}
                    <div className={`p-3 rounded-lg ${
                      isDarkMode ? 'bg-gray-800' : 'bg-white'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <Type className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
                        <span className={`text-xs font-medium ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>Text in Image</span>
                      </div>
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                        {capitalizeWords(entry.text_in_image)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CalendarContentModal
