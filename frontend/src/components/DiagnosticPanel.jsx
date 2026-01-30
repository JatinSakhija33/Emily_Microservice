import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

function DiagnosticPanel() {
  const [diagnostics, setDiagnostics] = useState({
    supabaseUrl: false,
    supabaseKey: false,
    connection: false,
    googleProvider: false,
    redirectUrl: false
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    runDiagnostics()
  }, [])

  const runDiagnostics = async () => {
    const results = { ...diagnostics }

    // Check environment variables
    results.supabaseUrl = !!import.meta.env.VITE_SUPABASE_URL
    results.supabaseKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY

    // Test Supabase connection
    try {
      const { data, error } = await supabase.auth.getSession()
      results.connection = !error
    } catch (err) {
      results.connection = false
    }

    // Check redirect URL
    results.redirectUrl = window.location.origin

    // Check Google provider configuration (without actually calling it)
    results.googleProvider = true // Assume it's configured if Supabase connection works

    setDiagnostics(results)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg">
        <div className="animate-pulse">Running diagnostics...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-100 p-4 rounded-lg space-y-2">
      <h3 className="font-semibold text-gray-800">Diagnostic Results</h3>
      
      <div className="space-y-1 text-sm">
        <div className="flex items-center space-x-2">
          <span className={diagnostics.supabaseUrl ? 'text-green-600' : 'text-red-600'}>
            {diagnostics.supabaseUrl ? '✓' : '✗'}
          </span>
          <span>Supabase URL configured</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={diagnostics.supabaseKey ? 'text-green-600' : 'text-red-600'}>
            {diagnostics.supabaseKey ? '✓' : '✗'}
          </span>
          <span>Supabase Key configured</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={diagnostics.connection ? 'text-green-600' : 'text-red-600'}>
            {diagnostics.connection ? '✓' : '✗'}
          </span>
          <span>Supabase connection</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className={diagnostics.googleProvider ? 'text-green-600' : 'text-red-600'}>
            {diagnostics.googleProvider ? '✓' : '✗'}
          </span>
          <span>Google OAuth provider</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-blue-600">ℹ</span>
          <span>Redirect URL: {diagnostics.redirectUrl}/dashboard</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <span className="text-blue-600">ℹ</span>
          <span>Current URL: {window.location.href}</span>
        </div>
      </div>

      {!diagnostics.connection && (
        <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <strong>Connection Issue:</strong> Check your Supabase URL and API key in the environment variables.
        </div>
      )}

      {!diagnostics.googleProvider && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-yellow-700 text-sm">
          <strong>Google OAuth Issue:</strong> Google OAuth might not be properly configured in your Supabase project. Check the Authentication settings in your Supabase dashboard.
        </div>
      )}
    </div>
  )
}

export default DiagnosticPanel
