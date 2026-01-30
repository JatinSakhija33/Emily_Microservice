import React from 'react'
import { Loader2 } from 'lucide-react'

const PageLoadingBar = ({ 
  message = "Loading...", 
  showSpinner = true, 
  size = "medium",
  className = "" 
}) => {
  const sizeClasses = {
    small: {
      container: "min-h-[200px]",
      spinner: "w-8 h-8",
      icon: "w-4 h-4",
      bar: "w-32 h-1.5",
      text: "text-sm"
    },
    medium: {
      container: "min-h-[300px]",
      spinner: "w-12 h-12",
      icon: "w-6 h-6",
      bar: "w-48 h-2",
      text: "text-base"
    },
    large: {
      container: "min-h-[400px]",
      spinner: "w-16 h-16",
      icon: "w-8 h-8",
      bar: "w-64 h-2.5",
      text: "text-lg"
    }
  }

  const currentSize = sizeClasses[size] || sizeClasses.medium

  return (
    <div className={`flex-1 bg-transparent flex items-center justify-center ${currentSize.container} ${className}`}>
      <div className="text-center">
        {/* Spinner Icon */}
        {showSpinner && (
          <div className={`${currentSize.spinner} bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4`}>
            <Loader2 className={`${currentSize.icon} text-white animate-spin`} />
          </div>
        )}
        
        {/* Loading Message */}
        <p className={`text-gray-600 font-medium ${currentSize.text} mb-4`}>{message}</p>
        
        {/* Animated Loading Bar */}
        <div className={`${currentSize.bar} bg-gray-200 rounded-full overflow-hidden mx-auto`}>
          <div 
            className="h-full bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #ec4899, #8b5cf6, #6366f1)',
              backgroundSize: '200% 100%',
              animation: 'loading-gradient 1.5s ease-in-out infinite'
            }}
          />
        </div>
      </div>
      
      <style>{`
        @keyframes loading-gradient {
          0% { 
            background-position: 0% 50%; 
            transform: translateX(-100%);
          }
          50% { 
            background-position: 100% 50%; 
            transform: translateX(0%);
          }
          100% { 
            background-position: 0% 50%; 
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}

export default PageLoadingBar
