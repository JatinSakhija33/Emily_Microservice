import React from 'react'
import PageLoadingBar from './PageLoadingBar'

const MainContentLoader = ({ message = "Loading..." }) => {
  return (
    <PageLoadingBar 
      message={message} 
      size="medium" 
      className="min-h-[60vh]"
    />
  )
}

export default MainContentLoader
