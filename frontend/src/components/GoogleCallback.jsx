import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle, XCircle, Loader2, UserPlus } from 'lucide-react'
import { subscriptionAPI } from '../services/subscription'
import { onboardingAPI } from '../services/onboarding'
import { supabase } from '../lib/supabase'

const GoogleCallback = () => {
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Processing Google OAuth callback...')
  const navigate = useNavigate()

  useEffect(() => {
    handleGoogleCallback()
  }, [])

  const createProfileManually = async () => {
    try {
      console.log('🔧 Manually creating profile...')
      setMessage('Creating profile manually...')
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        console.error('❌ Error getting user:', userError)
        setMessage('Error: Could not get user information')
        return
      }
      
      console.log('👤 Creating profile for user:', user.id, user.email)
      
      // First check if profile already exists
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      
      if (checkError) {
        console.error('❌ Error checking existing profile:', checkError)
        setMessage('Error checking profile...')
        return
      }
      
      if (existingProfile) {
        console.log('✅ Profile already exists, proceeding to status check...')
        setMessage('Profile exists! Checking status...')
        setTimeout(() => {
          checkUserStatus()
        }, 1000)
        return
      }
      
      // Create profile using upsert to handle race conditions
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          name: user.user_metadata?.name || user.email,
          onboarding_completed: false,
          subscription_status: 'inactive',
          migration_status: 'pending'
        })
      
      if (upsertError) {
        console.error('❌ Error creating profile:', upsertError)
        setMessage(`Error creating profile: ${upsertError.message}`)
        // Even if profile creation fails, try to proceed
        setTimeout(() => {
          checkUserStatus()
        }, 2000)
      } else {
        console.log('✅ Profile created successfully!')
        setMessage('Profile created! Checking status...')
        // Now check user status
        setTimeout(() => {
          checkUserStatus()
        }, 1000)
      }
    } catch (error) {
      console.error('💥 Error in manual profile creation:', error)
      setMessage(`Error: ${error.message}`)
      // Even if there's an error, try to proceed
      setTimeout(() => {
        checkUserStatus()
      }, 2000)
    }
  }

  const checkUserStatus = async (retryCount = 0) => {
    try {
      console.log(`🔍 Checking user status after Google OAuth... (attempt ${retryCount + 1})`)
      setMessage(`Checking subscription status... (attempt ${retryCount + 1})`)
      
      // Check subscription status
      const subResponse = await subscriptionAPI.getSubscriptionStatus()
      console.log('📊 Subscription status response:', subResponse.data)
      
      if (subResponse.data.has_active_subscription) {
        console.log('✅ User has active subscription, checking onboarding...')
        setMessage('Checking onboarding status...')
        
        // Check onboarding status
        const onboardingResponse = await onboardingAPI.getOnboardingStatus()
        console.log('📋 Onboarding status response:', onboardingResponse.data)
        
        if (onboardingResponse.data.onboarding_completed) {
          console.log('🎯 User completed onboarding, redirecting to dashboard')
          setMessage('Redirecting to dashboard...')
          navigate('/dashboard')
        } else {
          console.log('📝 User needs onboarding, redirecting to onboarding page')
          setMessage('Redirecting to onboarding...')
          navigate('/onboarding')
        }
      } else {
        // If no active subscription and we haven't retried too many times, wait and retry
        if (retryCount < 2) { // Reduced retries
          console.log(`⏳ No active subscription yet, waiting 2 seconds before retry ${retryCount + 1}/2...`)
          setMessage(`No subscription found, retrying... (${retryCount + 1}/2)`)
          setTimeout(() => {
            checkUserStatus(retryCount + 1)
          }, 2000)
        } else {
          console.log('❌ No active subscription after retries, redirecting to subscription page')
          setMessage('Redirecting to subscription page...')
          navigate('/subscription')
        }
      }
    } catch (error) {
      console.error('💥 Error checking user status:', error)
      console.error('Error details:', error.response?.data)
      
      // If we haven't retried too many times, wait and retry
      if (retryCount < 2) { // Reduced retries
        console.log(`⏳ Error occurred, waiting 2 seconds before retry ${retryCount + 1}/2...`)
        setMessage(`Error occurred, retrying... (${retryCount + 1}/2)`)
        setTimeout(() => {
          checkUserStatus(retryCount + 1)
        }, 2000)
      } else {
        console.log('🔄 Defaulting to subscription page due to repeated errors')
        setMessage('Redirecting to subscription page...')
        navigate('/subscription')
      }
    }
  }

  const handleGoogleCallback = async () => {
    try {
      setStatus('processing')
      setMessage('Processing Google OAuth callback...')

      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search)
      const code = urlParams.get('code')
      const state = urlParams.get('state')
      const error = urlParams.get('error')

      // If there's an error parameter, show it
      if (error) {
        setStatus('error')
        // Decode the error message (it might be URL encoded)
        const decodedError = decodeURIComponent(error)
        if (decodedError.includes('access_denied') || decodedError.includes('testing')) {
          setMessage(`Google OAuth Error: The app is in testing mode. Please add your email as a test user in Google Cloud Console, or contact the administrator.`)
        } else {
          setMessage(`OAuth error: ${decodedError}`)
        }
        
        // Send error message to parent window if in popup
        if (window.opener) {
          window.opener.postMessage({
            type: 'GOOGLE_OAUTH_ERROR',
            error: decodedError
          }, window.location.origin)
        }
        return
      }

      // If we have code and state, the backend has already processed the OAuth
      // The backend redirects here after successful processing
      if (code && state) {
        console.log('✅ Google OAuth callback received with code and state')
        setStatus('success')
        setMessage('Google account connected successfully!')
        
        // Send success message to parent window if in popup
        if (window.opener) {
          console.log('Sending success message to parent window from origin:', window.location.origin)
          // Small delay to ensure popup is ready
          setTimeout(() => {
            window.opener.postMessage({
              type: 'GOOGLE_OAUTH_SUCCESS',
              message: 'Google account connected successfully!'
            }, window.location.origin)
            // Close popup after sending message
            window.close()
          }, 500)
          return
        }
        
        // If not in popup, ensure profile exists first, then check status
        console.log('🔄 Ensuring profile exists before checking status...')
        setTimeout(async () => {
          console.log('⏰ Ensuring profile exists...')
          await createProfileManually()
        }, 1000)
        return
      }

      // If we don't have code, state, or error, something went wrong
      setStatus('error')
      setMessage('Missing required OAuth parameters. Please try connecting again.')
      
      // Send error message to parent window if in popup
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_ERROR',
          error: 'Missing required OAuth parameters'
        }, window.location.origin)
      }
    } catch (error) {
      console.error('Error handling Google callback:', error)
      setStatus('error')
      setMessage(`An unexpected error occurred: ${error.message || 'Unknown error'}`)
      
      // Send error message to parent window if in popup
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_OAUTH_ERROR',
          error: error.message || 'An unexpected error occurred'
        }, window.location.origin)
      }
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'processing':
        return <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-600" />
      case 'error':
        return <XCircle className="w-8 h-8 text-red-600" />
      default:
        return <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'processing':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-blue-600'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="flex flex-col items-center space-y-4">
          {getStatusIcon()}
          <h2 className={`text-xl font-semibold ${getStatusColor()}`}>
            {status === 'processing' && 'Processing...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Error'}
          </h2>
          <p className="text-gray-600">{message}</p>
          
          {status === 'success' && (
            <p className="text-sm text-gray-500">
              Setting up your account and checking your profile...
            </p>
          )}
          
          {status === 'success' && (
            <div className="space-y-2">
              <button
                onClick={createProfileManually}
                className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-colors flex items-center justify-center space-x-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Profile Manually</span>
              </button>
              <button
                onClick={() => navigate('/subscription')}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-colors"
              >
                Go to Subscription
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
            </div>
          )}
          
          {status === 'error' && (
            <div className="space-y-2">
              <button
                onClick={() => navigate('/subscription')}
                className="px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-colors"
              >
                Go to Subscription
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Dashboard
              </button>
              <button
                onClick={() => navigate('/connections')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GoogleCallback
