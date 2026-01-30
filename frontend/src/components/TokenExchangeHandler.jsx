import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import OAuthLoadingScreen from './OAuthLoadingScreen'
import { onboardingAPI } from '../services/onboarding'
import { subscriptionAPI } from '../services/subscription'

const TokenExchangeHandler = () => {
  const [status, setStatus] = useState('processing')
  const [message, setMessage] = useState('Processing OAuth callback...')
  const [debugInfo, setDebugInfo] = useState([])
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  useEffect(() => {
    handleTokenExchange()
  }, [])

  const addDebugInfo = (info) => {
    setDebugInfo(prev => [...prev, { timestamp: new Date().toISOString(), message: info }])
  }

  const checkSubscriptionAndRedirect = async () => {
    try {
      addDebugInfo('Checking subscription status...')
      
      const subResponse = await subscriptionAPI.getSubscriptionStatus()
      const hasActiveSubscription = subResponse.data.has_active_subscription
      
      addDebugInfo(`Subscription status: ${hasActiveSubscription ? 'active' : 'inactive'}`)
      
      if (!hasActiveSubscription) {
        addDebugInfo('No active subscription, redirecting to subscription page...')
        navigate('/subscription')
        return
      }
      
      // User has active subscription, now check onboarding
      addDebugInfo('Checking onboarding status...')
      
      const onboardingResponse = await onboardingAPI.getOnboardingStatus()
      const isOnboardingCompleted = onboardingResponse.data.onboarding_completed
      
      addDebugInfo(`Onboarding status: ${isOnboardingCompleted ? 'completed' : 'incomplete'}`)
      
      if (isOnboardingCompleted) {
        addDebugInfo('Redirecting to dashboard...')
        navigate('/dashboard')
      } else {
        addDebugInfo('Redirecting to onboarding...')
        navigate('/onboarding')
      }
    } catch (error) {
      console.error('Error checking subscription/onboarding status:', error)
      addDebugInfo(`Status check error: ${error.message}`)
      // Default to subscription page if check fails
      addDebugInfo('Defaulting to subscription page due to status check error')
      navigate('/subscription')
    }
  }

  const handleTokenExchange = async () => {
    try {
      setStatus('processing')
      setMessage('Processing OAuth callback...')
      addDebugInfo('Starting OAuth callback processing')

      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      
      const code = urlParams.get('code') || hashParams.get('code')
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      const state = urlParams.get('state') || hashParams.get('state')
      const error = urlParams.get('error') || hashParams.get('error')
      const errorDescription = urlParams.get('error_description') || hashParams.get('error_description')

      addDebugInfo(`Code: ${code ? 'Present' : 'Missing'}`)
      addDebugInfo(`Access Token: ${accessToken ? 'Present' : 'Missing'}`)
      addDebugInfo(`Refresh Token: ${refreshToken ? 'Present' : 'Missing'}`)
      addDebugInfo(`State: ${state ? 'Present' : 'Missing'}`)
      addDebugInfo(`Error: ${error || 'None'}`)

      if (error) {
        setStatus('error')
        setMessage(`OAuth Error: ${errorDescription || error}`)
        addDebugInfo(`OAuth error: ${error}`)
        return
      }

      // Check if we have tokens directly (implicit flow)
      if (accessToken && refreshToken) {
        addDebugInfo('Implicit flow detected - tokens received directly')
        
        // Set the session using the tokens
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        })
        
        if (sessionError) {
          setStatus('error')
          setMessage(`Session creation failed: ${sessionError.message}`)
          addDebugInfo(`Session error: ${sessionError.message}`)
          return
        }

        if (data.session) {
          addDebugInfo('Session created successfully with implicit flow tokens')
          addDebugInfo(`User ID: ${data.session.user.id}`)
          addDebugInfo(`Provider: ${data.session.user.app_metadata?.provider}`)
          
          // Check subscription and onboarding status and redirect accordingly
          checkSubscriptionAndRedirect()
        } else {
          setStatus('error')
          setMessage('No session created with implicit flow tokens')
          addDebugInfo('Session creation completed but no session returned')
        }
        return
      }

      // Check if we have authorization code (authorization code flow)
      if (code) {
        addDebugInfo('Authorization code flow detected - exchanging code for tokens')
        
        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        
        if (exchangeError) {
          setStatus('error')
          setMessage(`Token exchange failed: ${exchangeError.message}`)
          addDebugInfo(`Exchange error: ${exchangeError.message}`)
          console.error('Token exchange error:', exchangeError)
          return
        }

        if (data.session) {
          addDebugInfo('Token exchange successful, session created')
          addDebugInfo(`User ID: ${data.session.user.id}`)
          addDebugInfo(`Provider: ${data.session.user.app_metadata?.provider}`)
          
          // Check subscription and onboarding status and redirect accordingly
          checkSubscriptionAndRedirect()
        } else {
          setStatus('error')
          setMessage('No session created after token exchange')
          addDebugInfo('Token exchange completed but no session created')
        }
        return
      }

      // If we reach here, neither flow was detected
      setStatus('error')
      setMessage('No OAuth data found in URL')
      addDebugInfo('No authorization code or tokens found in URL')
      addDebugInfo('This might be a direct access to the callback page')

    } catch (error) {
      console.error('OAuth callback error:', error)
      setStatus('error')
      setMessage(`OAuth callback failed: ${error.message}`)
      addDebugInfo(`Exception: ${error.message}`)
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

  // Show beautiful loading screen for processing state
  if (status === 'processing') {
    return <OAuthLoadingScreen status={status} message={message} />
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
        <div className="text-center mb-8">
          {getStatusIcon()}
          <div className="mt-6">
            <h2 className={`text-3xl font-bold ${getStatusColor()}`}>
              Authentication Error
            </h2>
            <p className="text-lg text-gray-600 mt-4">{message}</p>
          </div>
        </div>

        {/* Debug Information - Only show in development */}
        {debugInfo.length > 0 && process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-6 bg-gray-50 rounded-xl border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-blue-500" />
              Debug Information
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {debugInfo.map((info, index) => (
                <div key={index} className="text-sm text-gray-600 bg-white p-2 rounded border-l-4 border-blue-400">
                  <span className="text-gray-400 font-mono">[{info.timestamp.split('T')[1].split('.')[0]}]</span> {info.message}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 space-y-4">
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/login')}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-xl hover:from-pink-600 hover:to-pink-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Go to Login
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl hover:from-gray-600 hover:to-gray-700 transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Try Again
            </button>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-500">
              Having trouble? Contact support or try again later.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default TokenExchangeHandler
