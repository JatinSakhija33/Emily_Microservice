import React from 'react'
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

const PasswordStrengthIndicator = ({ password, confirmPassword = '' }) => {
  // Password validation rules
  const rules = [
    {
      id: 'length',
      label: 'At least 8 characters',
      test: (pwd) => pwd.length >= 8,
      icon: CheckCircle
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter (A-Z)',
      test: (pwd) => /[A-Z]/.test(pwd),
      icon: CheckCircle
    },
    {
      id: 'lowercase',
      label: 'One lowercase letter (a-z)',
      test: (pwd) => /[a-z]/.test(pwd),
      icon: CheckCircle
    },
    {
      id: 'number',
      label: 'One number (0-9)',
      test: (pwd) => /\d/.test(pwd),
      icon: CheckCircle
    },
    {
      id: 'symbol',
      label: 'One special character (!@#$%^&*)',
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
      icon: CheckCircle
    }
  ]

  // Check if passwords match
  const passwordsMatch = confirmPassword && password === confirmPassword

  // Calculate overall strength
  const validRules = rules.filter(rule => rule.test(password))
  const strength = validRules.length
  const strengthPercentage = (strength / rules.length) * 100

  // Get strength level and color
  const getStrengthLevel = () => {
    if (strength === 0) return { level: 'Very Weak', color: 'bg-red-500', textColor: 'text-red-600' }
    if (strength === 1) return { level: 'Weak', color: 'bg-red-400', textColor: 'text-red-600' }
    if (strength === 2) return { level: 'Fair', color: 'bg-yellow-400', textColor: 'text-yellow-600' }
    if (strength === 3) return { level: 'Good', color: 'bg-blue-400', textColor: 'text-blue-600' }
    if (strength === 4) return { level: 'Strong', color: 'bg-green-400', textColor: 'text-green-600' }
    if (strength === 5) return { level: 'Very Strong', color: 'bg-green-500', textColor: 'text-green-600' }
  }

  const strengthInfo = getStrengthLevel()

  // Don't show anything if password is empty or all requirements are met
  if (!password || strength === 5) return null

  return (
    <div className="relative">
      {/* Tooltip/Popover */}
      <div className="absolute top-2 left-0 z-10 bg-white border border-gray-200 rounded-lg shadow-lg p-4 min-w-80">
        {/* Arrow pointing up */}
        <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-gray-200 transform rotate-45"></div>
        
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Password requirements:</h4>
          <div className="space-y-2">
            {rules.map((rule) => {
              const isValid = rule.test(password)
              const Icon = rule.icon
              
              return (
                <div key={rule.id} className="flex items-center space-x-2">
                  <Icon
                    className={`w-4 h-4 ${
                      isValid ? 'text-green-500' : 'text-gray-400'
                    }`}
                  />
                  <span
                    className={`text-sm ${
                      isValid ? 'text-green-600' : 'text-gray-500'
                    }`}
                  >
                    {rule.label}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Password Match Indicator */}
          {confirmPassword && (
            <div className="flex items-center space-x-2 pt-2 border-t border-gray-100">
              {passwordsMatch ? (
                <CheckCircle className="w-4 h-4 text-green-500" />
              ) : (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
              <span
                className={`text-sm ${
                  passwordsMatch ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default PasswordStrengthIndicator
