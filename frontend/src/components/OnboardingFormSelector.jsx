import React, { useState, useEffect } from 'react'
import { Briefcase, User, Sparkles, TrendingUp, CheckCircle2 } from 'lucide-react'
import { onboardingAPI } from '../services/onboarding'

const OnboardingFormSelector = ({ onSelect }) => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hoveredCard, setHoveredCard] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference, default to dark mode
    const saved = localStorage.getItem('darkMode')
    return saved !== null ? saved === 'true' : true // Default to true (dark mode)
  })

  // Listen for dark mode changes
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'darkMode') {
        setIsDarkMode(e.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Also check for changes within the same tab
    const checkDarkMode = () => {
      const saved = localStorage.getItem('darkMode')
      setIsDarkMode(saved !== null ? saved === 'true' : true)
    }

    // Check periodically for changes
    const interval = setInterval(checkDarkMode, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  const handleSelect = async (formType) => {
    if (loading) return // Prevent multiple clicks
    
    setLoading(true)
    setError('')
    
    try {
      // Validate form type
      if (formType !== 'business' && formType !== 'creator') {
        setError('Invalid form type selected. Please try again.')
        setLoading(false)
        return
      }
      
      // Save to localStorage first
      localStorage.setItem('selected_onboarding_type', formType)
      localStorage.setItem('onboarding_form_selected', 'true')
      sessionStorage.setItem('selected_onboarding_type', formType)
      sessionStorage.setItem('onboarding_form_selected', 'true')
      
      // Save to database if user is authenticated
      try {
        await onboardingAPI.updateProfile({ onboarding_type: formType })
      } catch (dbError) {
        console.warn('Could not save onboarding type to database:', dbError)
        // Continue anyway - localStorage is saved
      }
      
      // Call the onSelect callback - this will hide the selector
      if (onSelect) {
        onSelect(formType)
      }
    } catch (err) {
      console.error('Error selecting form type:', err)
      setError('Failed to save selection. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div 
      className={`fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in ${
        isDarkMode ? 'bg-black/70' : 'bg-black/60'
      }`}
      style={{ pointerEvents: 'auto' }}
    >
      <div 
        className={`rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden transform animate-slide-up ${
          isDarkMode ? 'bg-gray-800' : 'bg-white'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-pink-500 via-pink-600 to-purple-600 px-6 sm:px-8 py-6 sm:py-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 sm:w-28 sm:h-28 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              <img
                src="/logo_.png"
                alt="ATSN Logo"
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
              />
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-normal text-white mb-2">
              What best describes you ?
            </h2>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {error && (
            <div className={`mb-6 p-4 border-l-4 border-red-500 rounded-lg transition-all duration-300 ${
              isDarkMode ? 'bg-red-900/20 text-red-300' : 'bg-red-50 text-red-700'
            }`}>
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Business Form Option */}
            <button
              onClick={() => handleSelect('business')}
              onMouseEnter={() => setHoveredCard('business')}
              onMouseLeave={() => setHoveredCard(null)}
              disabled={loading}
              className={`group relative p-6 sm:p-8 border-2 rounded-2xl hover:shadow-2xl transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                isDarkMode
                  ? 'border-gray-600 bg-gradient-to-br from-gray-700 to-gray-600/30 hover:border-pink-500 hover:shadow-pink-500/20 hover:from-gray-600 hover:to-gray-500/50 text-gray-100'
                  : 'border-gray-200 bg-gradient-to-br from-white to-pink-50/30 hover:border-pink-500 hover:shadow-pink-500/20 hover:from-pink-50 hover:to-pink-100/50'
              }`}
            >
              {/* Decorative gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${hoveredCard === 'business' ? 'opacity-100' : ''}`}></div>
              
              <div className="relative z-10">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-pink-500/30">
                    <Briefcase className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className={`text-xl sm:text-2xl font-bold mb-2 transition-colors ${
                      isDarkMode ? 'text-gray-100 group-hover:text-pink-400' : 'text-gray-900 group-hover:text-pink-600'
                    }`}>
                      Business
                    </h3>
                    <p className={`text-sm sm:text-base leading-relaxed ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      For businesses, brands, and companies looking to grow their online presence
                    </p>
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 mt-5 pt-5 border-t transition-colors ${
                  isDarkMode
                    ? 'border-gray-600 group-hover:border-pink-400 text-gray-400 group-hover:text-gray-300'
                    : 'border-gray-200 group-hover:border-pink-200 text-gray-500 group-hover:text-gray-700'
                }`}>
                  <TrendingUp className="w-4 h-4 text-pink-500" />
                  <p className="text-xs sm:text-sm">
                    Perfect for: E-commerce, SaaS, Services, Retail, and more
                  </p>
                </div>
              </div>
              
              {/* Hover indicator */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-pink-500 to-purple-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ${hoveredCard === 'business' ? 'scale-x-100' : ''}`}></div>
            </button>

            {/* Creator Form Option */}
            <button
              onClick={() => handleSelect('creator')}
              onMouseEnter={() => setHoveredCard('creator')}
              onMouseLeave={() => setHoveredCard(null)}
              disabled={loading}
              className={`group relative p-6 sm:p-8 border-2 rounded-2xl hover:shadow-2xl transition-all duration-300 text-left disabled:opacity-50 disabled:cursor-not-allowed overflow-hidden ${
                isDarkMode
                  ? 'border-gray-600 bg-gradient-to-br from-gray-700 to-gray-600/30 hover:border-purple-500 hover:shadow-purple-500/20 hover:from-gray-600 hover:to-gray-500/50 text-gray-100'
                  : 'border-gray-200 bg-gradient-to-br from-white to-purple-50/30 hover:border-purple-500 hover:shadow-purple-500/20 hover:from-purple-50 hover:to-purple-100/50'
              }`}
            >
              {/* Decorative gradient overlay on hover */}
              <div className={`absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${hoveredCard === 'creator' ? 'opacity-100' : ''}`}></div>
              
              <div className="relative z-10">
                <div className="flex items-start space-x-4 mb-4">
                  <div className="flex-shrink-0 w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-purple-500/30">
                    <User className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="flex-1 pt-1">
                    <h3 className={`text-xl sm:text-2xl font-bold mb-2 transition-colors ${
                      isDarkMode ? 'text-gray-100 group-hover:text-purple-400' : 'text-gray-900 group-hover:text-purple-600'
                    }`}>
                      Creator
                    </h3>
                    <p className={`text-sm sm:text-base leading-relaxed ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-600'
                    }`}>
                      For content creators, influencers, and personal brands building their audience
                    </p>
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 mt-5 pt-5 border-t transition-colors ${
                  isDarkMode
                    ? 'border-gray-600 group-hover:border-purple-400 text-gray-400 group-hover:text-gray-300'
                    : 'border-gray-200 group-hover:border-purple-200 text-gray-500 group-hover:text-gray-700'
                }`}>
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <p className="text-xs sm:text-sm">
                    Perfect for: Influencers, YouTubers, Bloggers, Artists, and more
                  </p>
                </div>
              </div>
              
              {/* Hover indicator */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 to-pink-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ${hoveredCard === 'creator' ? 'scale-x-100' : ''}`}></div>
            </button>
          </div>

          {loading && (
            <div className="text-center py-4 transition-opacity duration-300">
              <div className="inline-flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-2 border-pink-500 border-t-transparent"></div>
                <p className={`text-sm sm:text-base font-medium ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>Saving your selection...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingFormSelector
