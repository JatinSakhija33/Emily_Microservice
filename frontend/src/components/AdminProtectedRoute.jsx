import React, { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import LoadingBar from './LoadingBar'

const AdminProtectedRoute = ({ children }) => {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setChecking(false)
        return
      }

      try {
        // Get user profile to check subscription plan
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', user.id)
          .single()
        
        if (error || !profile) {
          setIsAdmin(false)
        } else {
          // Check if subscription plan is 'admin'
          setIsAdmin(profile.subscription_plan === 'admin')
        }
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      } finally {
        setChecking(false)
      }
    }

    if (!authLoading) {
      checkAdminStatus()
    }
  }, [user, authLoading])

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingBar />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default AdminProtectedRoute

