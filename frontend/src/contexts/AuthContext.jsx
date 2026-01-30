import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { connectionsCache } from '../services/connectionsCache'

const AuthContext = createContext()

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error getting session:', error)
        // Don't automatically sign out on session errors - let user stay logged in
        // Only clear invalid tokens from localStorage
        localStorage.removeItem('authToken')
      } else if (session) { 
        setUser(session.user)
        setIsAuthenticated(true)
        // Store token in localStorage for API calls
        localStorage.setItem('authToken', session.access_token)
      }
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change:', event, session?.user?.id)
      
      if (session) {
        setUser(session.user)
        setIsAuthenticated(true)
        // Always update token in localStorage when session exists
        localStorage.setItem('authToken', session.access_token)
        
        // Ensure profile exists for new users (especially Google OAuth)
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          console.log('🔄 Auth event triggered, ensuring profile exists...', event)
          // Run profile creation in background without blocking
          ensureProfileExists(session.user).catch(error => {
            console.log('⚠️ Profile creation failed, will be created during onboarding:', error.message)
          })
          
          // Load connections in background and cache them
          import('../services/fetchConnections').then(({ fetchAllConnections }) => {
            fetchAllConnections(true).catch(error => {
              console.log('⚠️ Failed to load connections in background:', error.message)
            })
          })
          
          // Check and generate morning message on login if needed
          checkMorningMessageOnLogin(session.access_token).catch(error => {
            console.log('⚠️ Failed to check morning message on login:', error.message)
          })
        }
      } else {
        // Handle different auth events
        if (event === 'SIGNED_OUT') {
          // Only log out on explicit sign out event
          console.log('🚪 SIGNED_OUT event detected')
          setUser(null)
          setIsAuthenticated(false)
          localStorage.removeItem('authToken')
        } else if (event === 'TOKEN_REFRESHED') {
          // Token was refreshed but session might be null temporarily
          // Try to get the session again
          console.log('🔄 TOKEN_REFRESHED event but session is null, checking session...')
          const { data: { session: refreshedSession } } = await supabase.auth.getSession()
          if (refreshedSession) {
            console.log('✅ Found refreshed session')
            setUser(refreshedSession.user)
            setIsAuthenticated(true)
            localStorage.setItem('authToken', refreshedSession.access_token)
          } else {
            console.log('⚠️ No session found after TOKEN_REFRESHED event')
            // Don't logout - this might be a temporary state
            // Let the user stay logged in if they were previously authenticated
          }
        } else if (event === 'USER_UPDATED') {
          // User was updated but session might be null
          // Try to get session
          const { data: { session: updatedSession } } = await supabase.auth.getSession()
          if (updatedSession) {
            setUser(updatedSession.user)
            setIsAuthenticated(true)
            localStorage.setItem('authToken', updatedSession.access_token)
          }
          // Don't logout on USER_UPDATED
        }
        // For other events (like INITIAL_SESSION), don't logout
        // Only logout on explicit SIGNED_OUT
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const checkMorningMessageOnLogin = async (accessToken) => {
    try {
      const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/+$/, '')
      
      const response = await fetch(`${API_BASE_URL}/chatbot/scheduled-messages/check-morning-on-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (data.success && data.generated) {
        console.log('✅ Morning message generated on login')
      } else if (data.success) {
        console.log('ℹ️ Morning message check completed:', data.message)
      }
    } catch (error) {
      console.error('Error checking morning message on login:', error)
      // Don't throw - this is a background operation
    }
  }

  const login = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { 
          success: false, 
          error: error.message 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Login failed' 
      }
    }
  }

  const register = async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name
          }
        }
      })

      if (error) {
        return { 
          success: false, 
          error: error.message 
        }
      }

      // Create basic profile record for new users
      if (data.user) {
        try {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              name: name,
              onboarding_completed: false,
              subscription_status: 'inactive',
              migration_status: 'pending'
            })

          if (profileError) {
            console.log('Profile creation error (non-critical):', profileError)
            // Don't fail registration if profile creation fails
          }
        } catch (profileError) {
          console.log('Profile creation error (non-critical):', profileError)
        }
      }

      // Check if email confirmation is required
      if (data.user && !data.session) {
        return { 
          success: true, 
          message: "Registration successful! Please check your email to confirm your account." 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Registration failed' 
      }
    }
  }


  const loginWithGoogle = async () => {
    try {
      console.log('🔐 Initiating Google OAuth login via Supabase Auth...')
      console.log('   Redirect URL:', `${window.location.origin}/auth/callback`)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          // Explicitly request email scope (required for Google Workspace accounts)
          scopes: 'email profile'
        }
      })

      if (error) {
        console.error('❌ Supabase Auth Google OAuth error:', error)
        console.error('   Error message:', error.message)
        console.error('   Error status:', error.status)
        console.error('   Error details:', JSON.stringify(error, null, 2))
        
        // Provide more helpful error messages
        let errorMessage = error.message || 'Google sign-in failed'
        
        // Check for specific error types
        if (error.message?.includes('Internal server error') || 
            error.message?.includes('500') || 
            error.status === 500 ||
            error.message?.includes('556')) {
          errorMessage = `Supabase Auth Error (HTTP ${error.status || '556'}): This usually means:
1. Google OAuth provider not configured in Supabase Dashboard
2. Database trigger/function issue (check handle_new_user function)
3. Supabase project database connection issue
4. RLS policies blocking profile creation

Please check:
- Supabase Dashboard → Authentication → Providers → Google (should be enabled)
- Supabase Dashboard → Logs → API Logs (for detailed error)
- Run diagnostic SQL: database/check_supabase_auth_setup.sql`
        } else if (error.message?.includes('redirect') || error.message?.includes('unauthorized')) {
          errorMessage = 'Redirect URL not authorized. Please add the redirect URL to Supabase Dashboard (Authentication → URL Configuration).'
        } else if (error.message?.includes('invalid_client') || error.message?.includes('unauthorized_client')) {
          errorMessage = 'Invalid Google OAuth credentials. Please verify Client ID and Secret in Supabase Dashboard.'
        }
        
        return { 
          success: false, 
          error: errorMessage,
          errorDetails: {
            status: error.status,
            message: error.message,
            originalError: error
          }
        }
      }

      console.log('✅ Google OAuth initiated successfully')
      return { success: true }
    } catch (error) {
      console.error('❌ Google sign-in exception:', error)
      return { 
        success: false, 
        error: error.message || 'Google sign-in failed. Please check Supabase Auth configuration.' 
      }
    }
  }

  // Function to ensure profile exists for Google OAuth users
  const ensureProfileExists = async (user) => {
    if (!user) {
      console.log('❌ No user provided to ensureProfileExists')
      return
    }

    console.log('🔍 ensureProfileExists called for user:', user.id, user.email)

    try {
      // Check if profile exists with timeout
      console.log('🔍 Checking if profile exists for user:', user.id)
      
      const profileCheckPromise = supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile check timeout')), 5000)
      )
      
      const { data: existingProfile, error: fetchError } = await Promise.race([
        profileCheckPromise,
        timeoutPromise
      ])

      if (fetchError) {
        console.error('❌ Error checking profile:', fetchError)
        
        // Check if it's a CORS error
        if (fetchError.message?.includes('CORS') || 
            fetchError.message?.includes('Access-Control-Allow-Origin') ||
            fetchError.code === 'PGRST301') {
          console.error('🚫 CORS Error: Supabase is blocking requests from localhost:3000')
          console.error('   Fix: Go to Supabase Dashboard → Settings → API → Add "http://localhost:3000" to allowed origins')
          console.error('   See SUPABASE_CORS_FIX.md for detailed instructions')
        }
        
        return
      }

      console.log('📊 Profile check result:', existingProfile)

      // If no profile exists, create one
      if (!existingProfile) {
        console.log('➕ No profile found, creating new profile for user:', user.id)
        const profileData = {
          id: user.id,
          name: user.user_metadata?.name || user.email,
          onboarding_completed: false,
          subscription_status: 'inactive',
          migration_status: 'pending'
        }
        
        console.log('📝 Creating profile with data:', profileData)
        
        const profileInsertPromise = supabase
          .from('profiles')
          .insert(profileData)
        
        const insertTimeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile creation timeout')), 5000)
        )
        
        const { error: insertError } = await Promise.race([
          profileInsertPromise,
          insertTimeoutPromise
        ])

        if (insertError) {
          console.error('❌ Error creating profile for Google user:', insertError)
          
          // Check if it's a CORS error
          if (insertError.message?.includes('CORS') || 
              insertError.message?.includes('Access-Control-Allow-Origin') ||
              insertError.code === 'PGRST301') {
            console.error('🚫 CORS Error: Supabase is blocking requests from localhost:3000')
            console.error('   Fix: Go to Supabase Dashboard → Settings → API → Add "http://localhost:3000" to allowed origins')
            console.error('   See SUPABASE_CORS_FIX.md for detailed instructions')
          }
        } else {
          console.log('✅ Profile created successfully for Google user:', user.id)
        }
      } else {
        console.log('✅ Profile already exists for user:', user.id)
      }
    } catch (error) {
      console.error('💥 Error ensuring profile exists:', error)
      console.log('🔄 Profile creation failed, user will need to create profile manually')
    }
  }

  const logout = async () => {
    try {
      console.log('🚪 Logging out user...')
      
      // Sign out from Supabase
      await supabase.auth.signOut()
      
      // Clear local state
      setUser(null)
      setIsAuthenticated(false)
      
      // Clear localStorage
      localStorage.removeItem('authToken')
      
      // Clear any other cached data
      localStorage.removeItem('socialMediaCache')
      localStorage.removeItem('contentCache')
      
      // Clear leads cache
      const leadsCacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('leads_') || 
        key.startsWith('lead_') || 
        key.includes('leadCache') ||
        key.includes('leadsCache')
      )
      leadsCacheKeys.forEach(key => localStorage.removeItem(key))
      
      // Clear connections cache
      connectionsCache.clearCache()
      
      console.log('✅ User logged out successfully')
      
      // Redirect to login page
      window.location.href = '/login'
      
    } catch (error) {
      console.error('❌ Logout error:', error)
      
      // Even if logout fails, clear local state and redirect
      setUser(null)
      setIsAuthenticated(false)
      localStorage.clear()
      window.location.href = '/login'
    }
  }

  const sendPasswordResetCode = async (email) => {
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        return { 
          success: false, 
          error: error.message 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to send verification code' 
      }
    }
  }

  const resetPassword = async (email, otp, newPassword) => {
    try {
      // First verify the OTP with type 'recovery'
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'recovery'
      })

      if (verifyError) {
        return { 
          success: false, 
          error: verifyError.message 
        }
      }

      // Update the password
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        return { 
          success: false, 
          error: updateError.message 
        }
      }

      return { success: true }
    } catch (error) {
      return { 
        success: false, 
        error: 'Failed to reset password' 
      }
    }
  }

  const value = {
    isAuthenticated,
    user,
    loading,
    login,
    register,
    loginWithGoogle,
    logout,
    sendPasswordResetCode,
    resetPassword,
    ensureProfileExists
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
