import React, { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle, XCircle, Search, Image, FileText, Calendar, Sparkles } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const DriveContentProcessingModal = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth()
  const [processing, setProcessing] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(false)
  const [googleConnected, setGoogleConnected] = useState(false)
  const [connectionError, setConnectionError] = useState(null)
  const [currentStep, setCurrentStep] = useState('')
  const [progress, setProgress] = useState({
    searched: false,
    foundPhotos: 0,
    analyzing: false,
    writingCaptions: false,
    scheduling: false,
    success: false,
    postsCreated: 0,
    error: null
  })

  useEffect(() => {
    if (isOpen && !processing) {
      // Reset progress when modal opens
      setProgress({
        searched: false,
        foundPhotos: 0,
        analyzing: false,
        writingCaptions: false,
        scheduling: false,
        success: false,
        postsCreated: 0,
        error: null
      })
      setCurrentStep('')
      setGoogleConnected(false)
      setConnectionError(null)
      // Check Google connection status
      checkGoogleConnection()
    }
  }, [isOpen])

  const checkGoogleConnection = async () => {
    if (!user) return

    setCheckingConnection(true)
    try {
      const authToken = localStorage.getItem('authToken') || 
                        localStorage.getItem('token') || 
                        localStorage.getItem('access_token')

      if (!authToken) {
        setConnectionError('Authentication required. Please log in again.')
        setCheckingConnection(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/content/drive/status`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const data = await response.json()

      if (data.google_connected) {
        setGoogleConnected(true)
        setConnectionError(null)
      } else {
        setGoogleConnected(false)
        setConnectionError(data.message || 'Google account not connected')
      }
    } catch (error) {
      console.error('Error checking Google connection:', error)
      setGoogleConnected(false)
      setConnectionError('Failed to check Google connection status')
    } finally {
      setCheckingConnection(false)
    }
  }

  const handleProcessDriveContent = async () => {
    if (!user) return

    // Check connection first
    if (!googleConnected) {
      setConnectionError('Google account not connected. Please connect your Google account first.')
      return
    }

    setProcessing(true)
    setProgress({
      searched: false,
      foundPhotos: 0,
      analyzing: false,
      writingCaptions: false,
      scheduling: false,
      success: false,
      postsCreated: 0,
      error: null
    })

    try {
      const authToken = localStorage.getItem('authToken') || 
                        localStorage.getItem('token') || 
                        localStorage.getItem('access_token')

      if (!authToken) {
        throw new Error('Authentication required. Please log in again.')
      }

      // Call the API (only if Google is connected - already checked)
      // Step 1: Searched drive for content
      setCurrentStep('Searched drive for content')
      
      // Call the API - this will process everything
      const response = await fetch(`${API_BASE_URL}/content/drive/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          user_id: user.id
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Failed to process drive content')
      }

      // Update progress based on actual agent state
      // Step 1: Searched drive - only complete if emily folder was found
      if (data.emily_folder_found) {
        setProgress(prev => ({ ...prev, searched: true }))
      } else {
        throw new Error('emily folder not found in Google Drive')
      }

      // Step 2: Found photos - only if photos were actually found
      if (data.photos_found > 0) {
        setCurrentStep('Found new photos')
        setProgress(prev => ({ ...prev, foundPhotos: data.photos_found }))
        await new Promise(resolve => setTimeout(resolve, 500))
      } else {
        throw new Error('No photos found in platform folders')
      }

      // Step 3: Analyzing photos - only if photos were analyzed
      if (data.photos_analyzed > 0) {
        setCurrentStep('Analyzing the photos')
        setProgress(prev => ({ ...prev, analyzing: true }))
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Step 4: Writing captions - only if captions were generated
      if (data.captions_generated > 0) {
        setCurrentStep('Writing captions')
        setProgress(prev => ({ ...prev, writingCaptions: true }))
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Step 5: Scheduling - only if posts were saved
      if (data.posts_saved > 0) {
        setCurrentStep('Scheduling')
        setProgress(prev => ({ ...prev, scheduling: true }))
        await new Promise(resolve => setTimeout(resolve, 500))
      }

      // Step 6: Success - only if posts were actually created
      if (data.posts_created > 0) {
        setCurrentStep('Success')
        setProgress(prev => ({ 
          ...prev, 
          success: true, 
          postsCreated: data.posts_created 
        }))
      } else {
        throw new Error('No posts were created')
      }

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess(data.posts_created || 0)
      }

    } catch (error) {
      console.error('Error processing drive content:', error)
      setProgress(prev => ({ 
        ...prev, 
        error: error.message || 'Failed to process drive content' 
      }))
      setCurrentStep('Error')
    } finally {
      setProcessing(false)
    }
  }


  if (!isOpen) return null

  const steps = [
    {
      id: 'searched',
      label: 'Searched drive for content',
      icon: Search,
      completed: progress.searched,
      active: currentStep === 'Searched drive for content'
    },
    {
      id: 'found',
      label: progress.foundPhotos > 0 ? `Found: ${progress.foundPhotos} new photos` : 'Found new photos',
      icon: Image,
      completed: progress.foundPhotos > 0,
      active: currentStep === 'Found new photos',
      count: progress.foundPhotos
    },
    {
      id: 'analyzing',
      label: 'Analyzing the photos',
      icon: Loader2,
      completed: progress.analyzing,
      active: currentStep === 'Analyzing the photos',
      spinning: progress.analyzing && !progress.writingCaptions
    },
    {
      id: 'writing',
      label: 'Writing captions',
      icon: FileText,
      completed: progress.writingCaptions,
      active: currentStep === 'Writing captions',
      spinning: progress.writingCaptions && !progress.scheduling
    },
    {
      id: 'scheduling',
      label: 'Scheduling',
      icon: Calendar,
      completed: progress.scheduling,
      active: currentStep === 'Scheduling',
      spinning: progress.scheduling && !progress.success
    },
    {
      id: 'success',
      label: progress.postsCreated > 0 
        ? `Success: created posts for ${progress.postsCreated} of photos`
        : 'Success: created posts',
      icon: CheckCircle,
      completed: progress.success,
      active: currentStep === 'Success'
    }
  ]

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Image className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Processing Drive Content</h2>
              <p className="text-white/80 text-sm">Creating posts from your Google Drive photos</p>
            </div>
          </div>
          {!processing && (
            <button
              onClick={onClose}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {checkingConnection ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
              <p className="text-sm text-gray-600">Checking Google connection...</p>
            </div>
          ) : !googleConnected ? (
            <div className="flex flex-col items-center justify-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Google Not Connected</h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                {connectionError || 'Please connect your Google account to use this feature.'}
              </p>
              <button
                onClick={checkGoogleConnection}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors mb-2"
              >
                Check Again
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Go to Settings to connect your Google account
              </p>
            </div>
          ) : !processing && !progress.success ? (
            <div className="flex flex-col items-center justify-center py-8">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Process</h3>
              <p className="text-sm text-gray-600 text-center mb-4">
                Google Drive is connected. Click the button below to start processing your photos.
              </p>
              <button
                onClick={handleProcessDriveContent}
                className="px-6 py-3 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all font-medium"
              >
                Start Processing
              </button>
            </div>
          ) : progress.error ? (
            <div className="flex flex-col items-center justify-center py-8">
              <XCircle className="w-16 h-16 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Failed</h3>
              <p className="text-sm text-gray-600 text-center mb-4">{progress.error}</p>
              <button
                onClick={handleProcessDriveContent}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {steps.map((step, index) => {
                const Icon = step.icon
                const isCompleted = step.completed
                const isActive = step.active && !isCompleted
                const isSpinning = step.spinning

                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-purple-50 border-2 border-purple-200' 
                        : isCompleted
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-gray-50 border border-gray-200'
                    }`}
                  >
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted
                        ? 'bg-green-500'
                        : isActive
                        ? 'bg-purple-500'
                        : 'bg-gray-300'
                    }`}>
                      {isSpinning ? (
                        <Loader2 className="w-5 h-5 text-white animate-spin" />
                      ) : (
                        <Icon className={`w-5 h-5 ${
                          isCompleted || isActive ? 'text-white' : 'text-gray-500'
                        }`} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        isCompleted
                          ? 'text-green-800'
                          : isActive
                          ? 'text-purple-800'
                          : 'text-gray-600'
                      }`}>
                        {step.label}
                      </p>
                      {step.count !== undefined && step.count > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {step.count} photo{step.count !== 1 ? 's' : ''} found
                        </p>
                      )}
                    </div>
                    {isCompleted && !isSpinning && (
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {progress.success && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default DriveContentProcessingModal

