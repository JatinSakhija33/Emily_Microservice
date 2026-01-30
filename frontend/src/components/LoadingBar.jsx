import React from 'react'
import PageLoadingBar from './PageLoadingBar'

const LoadingBar = ({ message = "Loading your content..." }) => {
  return (
    <PageLoadingBar 
      message={message} 
      size="large" 
      className="min-h-screen"
    />
  )
}

export default LoadingBar
