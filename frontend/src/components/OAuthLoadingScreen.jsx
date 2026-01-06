import React from 'react'

const OAuthLoadingScreen = ({ status, message }) => {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-2xl font-medium text-white">
          Authenticating with Google...
        </h1>
      </div>
    </div>
  )
}

export default OAuthLoadingScreen
