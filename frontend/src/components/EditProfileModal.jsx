import React, { useState, useEffect, useRef } from 'react'
import { onboardingAPI } from '../services/onboarding'
import OnboardingForm from './OnboardingForm'
import CreatorOnboardingForm from './CreatorOnboardingForm'
import { X, ChevronDown, Navigation, Save, RotateCcw, CheckCircle } from 'lucide-react'

const EditProfileModal = ({ isOpen, onClose, onSuccess, isDarkMode = false }) => {
  const [profileData, setProfileData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showStepNavigation, setShowStepNavigation] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [showSaveIndicator, setShowSaveIndicator] = useState(false)
  const [completedSteps, setCompletedSteps] = useState(new Set())
  const onboardingFormRef = useRef(null)

  // Business form steps
  const businessSteps = [
    'Basic Business Info',
    'Business Description', 
    'Brand & Contact',
    'Current Presence & Focus Areas',
    'Digital Marketing & Goals',
    'Content Strategy',
    'Market & Competition',
    'Campaign Planning',
    'Performance & Customer',
    'Automation & Platform',
    'Review & Submit'
  ]

  // Creator form steps
  const creatorSteps = [
    'Creator Basics',
    'Brand & Contact',
    'Audience & Brand Story',
    'Platforms & Current Presence',
    'Content Strategy & Goals',
    'Performance Insights & Competition',
    'Monetization, Workflow & Automation',
    'Review & Submit'
  ]

  // Determine which steps to use based on onboarding_type
  // Default to businessSteps if profileData is not yet loaded
  const steps = profileData?.onboarding_type === 'creator' ? creatorSteps : businessSteps

  useEffect(() => {
    if (isOpen) {
      fetchProfileData()
    }
  }, [isOpen])

  // Close step navigation when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showStepNavigation && !event.target.closest('.step-navigation')) {
        setShowStepNavigation(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showStepNavigation])


  const fetchProfileData = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await onboardingAPI.getProfile()
      setProfileData(response.data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setError('Failed to load profile data')
    } finally {
      setLoading(false)
    }
  }

  const handleSuccess = () => {
    if (onSuccess) {
      onSuccess()
    }
    onClose()
  }

  const handleStepChange = (stepIndex) => {
    setCurrentStep(stepIndex)
    setShowStepNavigation(false)
    // Call the OnboardingForm's step change method if available
    if (onboardingFormRef.current && onboardingFormRef.current.goToStep) {
      onboardingFormRef.current.goToStep(stepIndex)
    }
  }

  const handleStepUpdate = (stepIndex) => {
    setCurrentStep(stepIndex)
  }

  const handleStepComplete = (stepIndex) => {
    setCompletedSteps(prev => new Set([...prev, stepIndex]))
  }

  const showSaveSuccess = () => {
    setShowSaveIndicator(true)
    setTimeout(() => setShowSaveIndicator(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-1.5 sm:p-2 md:p-4 modal" role="dialog">
      <div className={`rounded-lg sm:rounded-xl shadow-2xl max-w-6xl w-full max-h-[98vh] sm:max-h-[95vh] md:max-h-[90vh] overflow-hidden flex flex-col ${
        isDarkMode ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Modal Header */}
        <div className={`flex items-start sm:items-center justify-between p-2.5 sm:p-3 md:p-4 lg:p-6 border-b gap-2 sm:gap-3 ${
          isDarkMode
            ? 'border-gray-700 bg-gray-800'
            : 'border-gray-200 bg-gradient-to-r from-gray-50 to-white'
        }`}>
          {/* Left section - Title and Save indicator */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 flex-wrap gap-1">
              <h2 className={`text-base sm:text-lg md:text-2xl font-bold ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>Edit Profile</h2>
              {showSaveIndicator && (
                <div className={`flex items-center space-x-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                  isDarkMode
                    ? 'bg-green-900/30 text-green-400 border border-green-700'
                    : 'bg-green-100 text-green-700'
                }`}>
                  <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                  <span className="hidden sm:inline">Saved!</span>
                </div>
              )}
            </div>
            <p className={`text-xs sm:text-sm md:text-base mt-1 ${
              isDarkMode ? 'text-gray-400' : 'text-gray-600'
            }`}>
              {profileData?.onboarding_type === 'creator' 
                ? 'Update your creator information and preferences' 
                : 'Update your business information and preferences'}
            </p>
          </div>

          {/* Right section - Step Navigation and Close button */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Step Navigation */}
            <div className="relative step-navigation">
              <button
                onClick={() => setShowStepNavigation(!showStepNavigation)}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-colors text-xs sm:text-sm ${
                  isDarkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
                title="Click to navigate between steps"
              >
                <Navigation className={`w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`} />
                <span className={`font-medium hidden md:inline ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  Step {currentStep + 1}: {steps[currentStep]}
                </span>
                <span className={`font-medium md:hidden ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                  {currentStep + 1}/{steps.length}
                </span>
                <ChevronDown className={`w-3 h-3 sm:w-4 sm:h-4 transition-transform flex-shrink-0 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                } ${showStepNavigation ? 'rotate-180' : ''}`} />
              </button>
              
              {/* Step Dropdown */}
              {showStepNavigation && (
                <div className={`absolute right-0 top-full mt-2 w-[280px] sm:w-80 border rounded-lg shadow-xl z-10 max-h-[50vh] sm:max-h-96 overflow-y-auto ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-600 dark-scrollbar'
                    : 'bg-white border-gray-200 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400'
                }`}>
                  <div className="p-2 sm:p-3">
                    <div className="mb-2 sm:mb-3">
                      <div className={`text-[10px] sm:text-xs font-semibold uppercase tracking-wide ${
                        isDarkMode ? 'text-gray-300' : 'text-gray-500'
                      }`}>
                        Jump to Step
                      </div>
                    </div>
                    <div className="space-y-1">
                      {steps.map((step, index) => (
                        <button
                          key={index}
                          onClick={() => handleStepChange(index)}
                          className={`w-full text-left px-2 sm:px-3 py-1.5 sm:py-2 md:py-2.5 rounded-md text-xs sm:text-sm transition-all duration-200 ${
                            index === currentStep
                              ? isDarkMode
                                ? 'bg-pink-900/50 text-pink-300 font-medium shadow-sm border border-pink-700'
                                : 'bg-pink-100 text-pink-700 font-medium shadow-sm'
                              : completedSteps.has(index)
                              ? isDarkMode
                                ? 'bg-green-900/30 text-green-400 hover:bg-green-900/50 border border-green-700'
                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                              : isDarkMode
                              ? 'text-gray-300 hover:bg-gray-700 hover:shadow-sm'
                              : 'text-gray-700 hover:bg-gray-50 hover:shadow-sm'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] sm:text-xs font-medium transition-colors flex-shrink-0 ${
                              index === currentStep
                                ? 'bg-pink-600 text-white'
                                : completedSteps.has(index)
                                ? 'bg-green-500 text-white'
                                : isDarkMode
                                ? 'bg-gray-700 text-gray-400'
                                : 'bg-gray-200 text-gray-600'
                            }`}>
                              {completedSteps.has(index) ? (
                                <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                              ) : (
                                index + 1
                              )}
                            </div>
                            <span className="flex-1 truncate">{step}</span>
                            {index === currentStep && (
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-pink-600 rounded-full flex-shrink-0"></div>
                            )}
                            {completedSteps.has(index) && (
                              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
              
            {/* Close Button */}
            <button
              onClick={onClose}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0 ${
                isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
              }`}
            >
              <X className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 ${
                isDarkMode ? 'text-gray-300' : 'text-gray-500'
              }`} />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className={`p-2 sm:p-3 md:p-4 lg:p-6 overflow-y-auto max-h-[calc(98vh-170px)] sm:max-h-[calc(95vh-180px)] md:max-h-[calc(90vh-140px)] ${
          isDarkMode ? 'dark-scrollbar' : 'scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400'
        }`}>
          {loading ? (
            <div className="flex items-center justify-center py-6 sm:py-8 md:py-12">
              <div className="text-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
                <p className={`text-sm sm:text-base ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Loading your profile...</p>
              </div>
            </div>
          ) : error ? (
            <div className="text-center py-6 sm:py-8 md:py-12">
              <div className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                <X className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-red-600" />
              </div>
              <h3 className={`text-base sm:text-lg font-semibold mb-2 ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>Error Loading Profile</h3>
              <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${
                isDarkMode ? 'text-gray-400' : 'text-gray-600'
              }`}>{error}</p>
              <button
                onClick={fetchProfileData}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm sm:text-base"
              >
                Try Again
              </button>
            </div>
          ) : profileData ? (
            profileData.onboarding_type === 'creator' ? (
              <CreatorOnboardingForm
                ref={onboardingFormRef}
                initialData={profileData}
                isEditMode={true}
                onClose={onClose}
                onSuccess={handleSuccess}
                showHeader={false}
                showProgress={true}
                onStepChange={handleStepUpdate}
                onStepComplete={handleStepComplete}
                isDarkMode={isDarkMode}
              />
            ) : (
              <OnboardingForm
                ref={onboardingFormRef}
                initialData={profileData}
                isEditMode={true}
                onClose={onClose}
                onSuccess={handleSuccess}
                showHeader={false}
                showProgress={true}
                onStepChange={handleStepUpdate}
                onStepComplete={handleStepComplete}
                isDarkMode={isDarkMode}
              />
            )
          ) : null}
        </div>
      </div>

    </div>
  )
}

export default EditProfileModal
