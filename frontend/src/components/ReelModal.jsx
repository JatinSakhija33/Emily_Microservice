import React, { useState, useEffect } from 'react'
import { X, Hash, Edit, Check, X as XIcon, Sparkles, Upload } from 'lucide-react'
import { Instagram, Facebook, MessageCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import ReactMarkdown from 'react-markdown'

// Get dark mode state from localStorage or default to dark mode
const getDarkModePreference = () => {
  const saved = localStorage.getItem('darkMode')
  return saved !== null ? saved === 'true' : true // Default to true (dark mode)
}

// Listen for storage changes to sync dark mode across components
const useStorageListener = (key, callback) => {
  React.useEffect(() => {
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

const ReelModal = ({ content, onClose }) => {
  const [isDarkMode] = React.useState(getDarkModePreference)
  const [dbContent, setDbContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  useStorageListener('darkMode', () => {})

  // Fetch content directly from Supabase
  useEffect(() => {
    const fetchContentFromDB = async () => {
      if (!content?.id) {
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('created_content')
          .select('*')
          .eq('id', content.id)
          .single()

        if (error) {
          console.error('Error fetching content from Supabase:', error)
          console.log('Content ID:', content.id)
        } else {
          console.log('Fetched content data:', data)
          setDbContent(data)
        }
      } catch (error) {
        console.error('Error fetching content:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchContentFromDB()
  }, [content?.id])

  // Debug logging for dbContent changes
  useEffect(() => {
    if (dbContent) {
      console.log('dbContent updated:', dbContent)
      console.log('media_url:', dbContent.media_url)
    }
  }, [dbContent])

  // Use database content if available, otherwise fallback to props
  const displayContent = dbContent || content

  // Handle reel upload
  const handleReelUpload = async (event) => {
    const file = event.target.files[0]
    if (!file) return

    // Validate file type (video files)
    if (!file.type.startsWith('video/')) {
      alert('Please select a video file')
      return
    }

    // Validate file size (max 100MB)
    if (file.size > 100 * 1024 * 1024) {
      alert('File size must be less than 100MB')
      return
    }

    setUploading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in to upload files')
        return
      }

      // Generate unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/reels/${Date.now()}.${fileExt}`

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('user-uploads')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        console.error('Upload error:', error)
        alert('Failed to upload video: ' + error.message)
        return
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-uploads')
        .getPublicUrl(fileName)

      if (!urlData?.publicUrl) {
        alert('Failed to get video URL')
        return
      }

      // Update the content record with the video URL
      console.log('Updating content with media_url:', urlData.publicUrl)
      const { error: updateError } = await supabase
        .from('created_content')
        .update({
          media_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', content.id)

      if (updateError) {
        console.error('Update error:', updateError)
        console.log('Update error details:', JSON.stringify(updateError, null, 2))
        alert('Video uploaded but failed to update content: ' + updateError.message)
        return
      }

      console.log('Content updated successfully')

      // Refresh the content data
      const { data: refreshedData, error: refreshError } = await supabase
        .from('created_content')
        .select('*')
        .eq('id', content.id)
        .single()

      if (refreshError) {
        console.error('Error refreshing content:', refreshError)
      } else if (refreshedData) {
        console.log('Refreshed content data:', refreshedData)
        setDbContent(refreshedData)
      }

      alert(`Reel uploaded successfully! URL: ${urlData.publicUrl}`)

    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed: ' + error.message)
    } finally {
      setUploading(false)
    }
  }

  if (!content) return null
  if (loading) return null // Could show a loading spinner here

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-30 backdrop-blur-sm">
      <div className={`relative w-full max-w-6xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden ${
        isDarkMode ? 'bg-gray-900' : 'bg-white'
      }`}>

        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              displayContent.platform?.toLowerCase() === 'instagram' ? (isDarkMode ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gradient-to-r from-purple-500 to-pink-500') :
              displayContent.platform?.toLowerCase() === 'facebook' ? (isDarkMode ? 'bg-blue-700' : 'bg-blue-600') :
              displayContent.platform?.toLowerCase() === 'linkedin' ? (isDarkMode ? 'bg-blue-800' : 'bg-blue-700') :
              (isDarkMode ? 'bg-purple-600' : 'bg-purple-500')
            }`}>
              {displayContent.platform?.toLowerCase() === 'instagram' ? (
                <Instagram className="w-6 h-6 text-white" />
              ) : displayContent.platform?.toLowerCase() === 'facebook' ? (
                <Facebook className="w-6 h-6 text-white" />
              ) : displayContent.platform?.toLowerCase() === 'linkedin' ? (
                <div className="w-6 h-6 bg-white rounded-sm flex items-center justify-center">
                  <span className="text-blue-700 text-xs font-bold">in</span>
                </div>
              ) : (
                <MessageCircle className="w-6 h-6 text-white" />
              )}
            </div>
            <div>
              <p className={`text-base ${
                isDarkMode ? 'text-gray-300' : 'text-gray-600'
              }`}>
                {displayContent.platform} • {displayContent.content_type}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${
              isDarkMode
                ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 min-h-[400px]">

          {/* Left Column - Reel Script */}
          <div className="space-y-4">
            <div className={`w-full max-h-[32rem] rounded-lg shadow-lg overflow-hidden ${
              isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
            }`}>
              <div className={`p-4 border-b ${
                isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-100'
              }`}>
                <div className="flex items-center justify-between">
                  <div>
                          <h3 className={`text-xl font-normal ${
                            isDarkMode ? 'text-white' : 'text-gray-900'
                          }`}>
                            Video Script
                          </h3>
                          <p className={`text-base mt-1 ${
                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                      15-30 second video script optimized for virality
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(displayContent.short_video_script || '');
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
                  </div>
                </div>
              </div>
              <div className={`p-4 max-h-[28rem] overflow-y-auto ${
                isDarkMode ? 'text-white' : 'text-gray-700'
              }`}>
                <div className="prose prose-base max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className={`mb-3 leading-relaxed text-base ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>{children}</p>,
                      strong: ({ children }) => <strong className={`font-normal text-base ${isDarkMode ? 'text-blue-300' : 'text-blue-600'}`}>{children}</strong>,
                      em: ({ children }) => <em className={`italic text-base ${isDarkMode ? 'text-purple-300' : 'text-purple-600'}`}>{children}</em>,
                      ul: ({ children }) => <ul className="list-disc list-inside mb-3 space-y-2">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal list-inside mb-3 space-y-2">{children}</ol>,
                      li: ({ children }) => <li className={`ml-4 text-base ${isDarkMode ? 'text-white' : 'text-gray-700'}`}>{children}</li>,
                      h1: ({ children }) => <h1 className={`text-xl font-normal mb-3 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>{children}</h1>,
                      h2: ({ children }) => <h2 className={`text-lg font-normal mb-3 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>{children}</h2>,
                      h3: ({ children }) => <h3 className={`text-base font-normal mb-2 ${isDarkMode ? 'text-yellow-300' : 'text-yellow-600'}`}>{children}</h3>,
                      blockquote: ({ children }) => (
                        <blockquote className={`border-l-4 pl-4 italic my-3 text-base ${isDarkMode ? 'border-blue-400 text-blue-200' : 'border-blue-500 text-blue-700'}`}>
                          {children}
                        </blockquote>
                      ),
                      code: ({ children }) => (
                        <code className={`px-2 py-1 rounded text-sm font-mono ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-200 text-gray-800'}`}>
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {displayContent.short_video_script || 'No script available.'}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Title and Content */}
          <div className="space-y-6 pr-4 max-h-[32rem] overflow-y-auto">
            {/* Title */}
            {displayContent.title && (
              <div>
                <h2 className={`text-3xl font-normal leading-tight ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  {displayContent.title}
                </h2>
              </div>
            )}

            {/* Instagram Caption from created_content.content */}
            {displayContent.content && (
              <div className={`leading-relaxed whitespace-pre-wrap p-4 rounded-lg text-base ${
                isDarkMode ? 'text-white bg-gray-800' : 'text-gray-700 bg-gray-50'
              }`}>
                {displayContent.content}
              </div>
            )}

            {/* Cover Image or Video Player */}
            {displayContent.media_url ? (
              <div className="flex justify-center">
                <video
                  src={displayContent.media_url}
                  controls
                  className="w-full max-h-[20rem] object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
              </div>
            ) : displayContent.images && displayContent.images.length > 0 ? (
              <div className="flex justify-center relative">
                <img
                  src={displayContent.images[0]}
                  alt="Reel cover"
                  className="w-full max-h-[20rem] object-contain rounded-lg shadow-lg"
                  onError={(e) => {
                    e.target.style.display = 'none'
                  }}
                />
                {/* Black Overlay */}
                <div className="absolute inset-0 bg-black bg-opacity-70 rounded-lg"></div>
                {/* Upload Reel Button Overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <label className={`px-6 py-3 rounded-lg font-normal text-white shadow-lg transform transition-all duration-200 hover:scale-105 cursor-pointer flex items-center gap-2 ${
                    isDarkMode
                      ? 'bg-blue-600 hover:bg-blue-500 border border-blue-500'
                      : 'bg-blue-500 hover:bg-blue-600'
                  } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    <Upload className="w-5 h-5" />
                    {uploading ? 'Uploading...' : 'Upload Your Reel Here'}
                    <input
                      type="file"
                      accept="video/*"
                      onChange={handleReelUpload}
                      disabled={uploading}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div className="flex justify-center items-center h-48 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500">No media available</p>
              </div>
            )}

            {/* Hashtags */}
            {displayContent.hashtags && Array.isArray(displayContent.hashtags) && displayContent.hashtags.length > 0 && (
              <div>
                <h3 className={`text-xl font-normal mb-3 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  🏷️ Hashtags
                </h3>
                <div className="flex flex-wrap gap-2">
                  {displayContent.hashtags.map((hashtag, index) => (
                    <span
                      key={index}
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        isDarkMode
                          ? 'bg-blue-900 text-blue-200'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      #{hashtag}
                    </span>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

export default ReelModal
