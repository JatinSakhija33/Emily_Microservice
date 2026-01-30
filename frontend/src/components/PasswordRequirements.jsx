import React from 'react'
import { CheckCircle, XCircle } from 'lucide-react'

const PasswordRequirements = ({ password, showAll = false }) => {
  const rules = [
    {
      id: 'length',
      label: 'At least 8 characters',
      test: (pwd) => pwd.length >= 8
    },
    {
      id: 'uppercase',
      label: 'One uppercase letter (A-Z)',
      test: (pwd) => /[A-Z]/.test(pwd)
    },
    {
      id: 'lowercase',
      label: 'One lowercase letter (a-z)',
      test: (pwd) => /[a-z]/.test(pwd)
    },
    {
      id: 'number',
      label: 'One number (0-9)',
      test: (pwd) => /\d/.test(pwd)
    },
    {
      id: 'symbol',
      label: 'One special character (!@#$%^&*)',
      test: (pwd) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)
    }
  ]

  // Filter rules based on showAll prop
  const rulesToShow = showAll ? rules : rules.filter(rule => !rule.test(password))

  if (!password && !showAll) return null

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700">Password Requirements:</h4>
      <div className="space-y-1">
        {rulesToShow.map((rule) => {
          const isValid = rule.test(password)
          const Icon = isValid ? CheckCircle : XCircle
          
          return (
            <div key={rule.id} className="flex items-center space-x-2">
              <Icon
                className={`w-4 h-4 ${
                  isValid ? 'text-green-500' : 'text-red-400'
                }`}
              />
              <span
                className={`text-sm ${
                  isValid ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {rule.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PasswordRequirements
