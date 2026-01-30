import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ArrowLeft, Mail, Lock, CheckCircle } from 'lucide-react'

function ForgotPassword() {
  const [step, setStep] = useState(1) // 1: Email, 2: OTP + Password
  const [formData, setFormData] = useState({
    email: '',
    otp: ['', '', '', '', '', ''],
    password: '',
    confirmPassword: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  
  const { sendPasswordResetCode, resetPassword } = useAuth()
  const navigate = useNavigate()
  const otpRefs = useRef([])

  // OTP input handling
  const handleOTPChange = (index, value) => {
    if (!/^\d*$/.test(value)) return // Only allow digits
    
    const newOTP = [...formData.otp]
    newOTP[index] = value
    setFormData({ ...formData, otp: newOTP })
    setError('')

    // Auto-focus to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus()
    }
  }

  const handleOTPKeyDown = (index, e) => {
    // Handle backspace
    if (e.key === 'Backspace' && !formData.otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOTPPaste = (e) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    const newOTP = pastedData.split('').concat(Array(6 - pastedData.length).fill(''))
    setFormData({ ...formData, otp: newOTP })
    setError('')
    
    // Focus on the last filled input
    const lastFilledIndex = Math.min(pastedData.length - 1, 5)
    otpRefs.current[lastFilledIndex]?.focus()
  }

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
    setError('')
  }

  const handleSendCode = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await sendPasswordResetCode(formData.email)
      
      if (result.success) {
        setStep(2)
        setResendCooldown(60) // 60 second cooldown
        setSuccessMessage('Verification code sent to your email!')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to send verification code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Validation
    if (formData.otp.some(digit => !digit)) {
      setError('Please enter the complete verification code')
      setLoading(false)
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long')
      setLoading(false)
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const otpCode = formData.otp.join('')
      const result = await resetPassword(formData.email, otpCode, formData.password)
      
      if (result.success) {
        setSuccessMessage('Password updated successfully! Redirecting to login...')
        setTimeout(() => {
          navigate('/login', { state: { message: 'Password updated successfully! Please sign in with your new password.' } })
        }, 2000)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleResendCode = async () => {
    if (resendCooldown > 0) return
    
    setLoading(true)
    setError('')

    try {
      const result = await sendPasswordResetCode(formData.email)
      
      if (result.success) {
        setResendCooldown(60)
        setSuccessMessage('New verification code sent!')
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError('Failed to resend code. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-md w-full">
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="mx-auto h-16 w-16 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Reset Password
          </h1>
          <p className="text-gray-600">
            {step === 1 ? 'Enter your email to receive a verification code' : 'Enter the code and your new password'}
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 1 ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              <Mail className="h-4 w-4" />
            </div>
            <div className={`w-12 h-1 ${step >= 2 ? 'bg-pink-500' : 'bg-gray-200'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
              step >= 2 ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              <CheckCircle className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {step === 1 ? (
            // Step 1: Email Input
            <form onSubmit={handleSendCode} className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors bg-blue-50"
                  placeholder="Enter your email"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm">
                  {successMessage}
                </div>
              )}

              {/* Send Code Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
            </form>
          ) : (
            // Step 2: OTP + Password
            <form onSubmit={handleResetPassword} className="space-y-6">
              {/* OTP Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Verification Code
                </label>
                <div className="flex space-x-2 justify-center">
                  {formData.otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => otpRefs.current[index] = el}
                      type="text"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleOTPChange(index, e.target.value)}
                      onKeyDown={(e) => handleOTPKeyDown(index, e)}
                      onPaste={handleOTPPaste}
                      className="w-12 h-12 text-center text-lg font-semibold border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors"
                    />
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Enter the 6-digit code sent to {formData.email}
                </p>
              </div>

              {/* New Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors"
                  placeholder="Enter new password"
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors"
                  placeholder="Confirm new password"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {successMessage && (
                <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg text-sm">
                  {successMessage}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-pink-500 to-pink-600 text-white py-3 px-4 rounded-lg font-semibold hover:from-pink-600 hover:to-pink-700 focus:ring-2 focus:ring-pink-500 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>

                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </button>
                  
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={resendCooldown > 0 || loading}
                    className="flex-1 px-4 py-2 border border-pink-300 text-pink-600 rounded-lg hover:bg-pink-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Back to Login */}
          <div className="text-center mt-6">
            <span className="text-gray-500">Remember your password? </span>
            <Link
              to="/login"
              className="text-pink-600 hover:text-pink-700 font-medium transition-colors"
            >
              Sign in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-xs text-gray-400">
            Secure connection • Powered by AI
          </p>
        </div>
      </div>
    </div>
  )
}

export default ForgotPassword