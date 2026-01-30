import React, { useState, useEffect } from 'react'
import { X, Eye, PartyPopper, Sparkles } from 'lucide-react'

const MediaGenerationCelebration = ({ isOpen, onClose, imageUrl, generationTime, generationModel, generationService }) => {
  const [showConfetti, setShowConfetti] = useState(false)
  const [showImageModal, setShowImageModal] = useState(false)

  // Debug logging
  useEffect(() => {
    if (isOpen) {
      console.log('🎉 Celebration popup opened with data:', {
        imageUrl,
        generationTime,
        generationModel,
        generationService
      })
    }
  }, [isOpen, imageUrl, generationTime, generationModel, generationService])

  useEffect(() => {
    if (isOpen) {
      setShowConfetti(true)
      // Hide confetti after animation
      const timer = setTimeout(() => setShowConfetti(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Handle ESC key for image modal
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && showImageModal) {
        handleCloseImageModal()
      }
    }

    if (showImageModal) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showImageModal])

  if (!isOpen) return null

  const handleViewImage = () => {
    console.log('🖼️ View Image clicked, imageUrl:', imageUrl)
    setShowImageModal(true)
  }

  const handleCloseImageModal = () => {
    setShowImageModal(false)
    // Don't close the celebration popup, just the image modal
  }

  return (
    <>
      {/* Celebration Popup */}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full relative overflow-hidden">
          {/* Confetti Animation */}
          {showConfetti && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Party Poppers */}
              <div className="absolute top-4 left-4 animate-bounce">
                <PartyPopper className="w-8 h-8 text-yellow-500" />
              </div>
              <div className="absolute top-8 right-8 animate-bounce delay-200">
                <PartyPopper className="w-6 h-6 text-pink-500" />
              </div>
              <div className="absolute top-12 left-1/2 animate-bounce delay-500">
                <PartyPopper className="w-7 h-7 text-blue-500" />
              </div>
              <div className="absolute top-6 right-4 animate-bounce delay-700">
                <PartyPopper className="w-5 h-5 text-green-500" />
              </div>
              <div className="absolute top-10 left-8 animate-bounce delay-1000">
                <PartyPopper className="w-6 h-6 text-purple-500" />
              </div>
              
              {/* Sparkles */}
              <div className="absolute top-2 right-2 animate-pulse">
                <Sparkles className="w-4 h-4 text-yellow-400" />
              </div>
              <div className="absolute top-16 left-2 animate-pulse delay-300">
                <Sparkles className="w-3 h-3 text-pink-400" />
              </div>
              <div className="absolute top-20 right-6 animate-pulse delay-600">
                <Sparkles className="w-5 h-5 text-blue-400" />
              </div>
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors z-10"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>

          {/* Content */}
          <div className="text-center relative z-10">
            {/* Celebration Icon */}
            <div className="mb-6">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                <PartyPopper className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-3xl font-bold text-gray-900 mb-2 animate-bounce">
              Wohoo! 🎉
            </h2>

            {/* Message */}
            <p className="text-lg text-gray-700 mb-2">
              You just generated a post using AI
            </p>

            {/* Generation Info */}
            {generationTime && (
              <div className="text-sm text-gray-500 mb-6 space-y-1">
                <p>Generated in {generationTime}s</p>
                {generationService && (
                  <p className="text-xs">
                    Using {generationService === 'google_gemini' ? 'Google Gemini' : 
                           generationService === 'openai_dalle' ? 'OpenAI DALL-E' :
                           generationService === 'internal_fallback' ? 'Fallback Generator' :
                           generationService}
                    {generationModel && ` (${generationModel})`}
                  </p>
                )}
              </div>
            )}

            {/* View Button */}
            <button
              onClick={handleViewImage}
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 text-white font-semibold py-3 px-6 rounded-xl hover:from-pink-600 hover:to-purple-700 transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Eye className="w-5 h-5" />
              <span>View Image</span>
            </button>
          </div>
        </div>
      </div>

      {/* Full Image Modal */}
      {showImageModal && (
        <div 
          className="fixed inset-0 bg-transparent flex items-center justify-center z-[100] p-4"
          onClick={handleCloseImageModal}
        >
          <div 
            className="relative w-[70vw] h-[70vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button - positioned above top right corner of image */}
            <button
              onClick={handleCloseImageModal}
              className="absolute -top-2 -right-2 w-10 h-10 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full flex items-center justify-center transition-colors z-10"
            >
              <X className="w-6 h-6 text-white" />
            </button>

            {/* Image */}
            <img
              src={imageUrl}
              alt="Generated content"
              className="w-full h-full object-contain rounded-lg shadow-2xl"
              onLoad={() => console.log('✅ Image loaded successfully:', imageUrl)}
              onError={(e) => {
                console.error('❌ Image failed to load:', imageUrl, e)
                console.error('Image error details:', e.target.error)
              }}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default MediaGenerationCelebration
