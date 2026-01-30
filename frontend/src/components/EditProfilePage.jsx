import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import EditProfileModal from './EditProfileModal'

const EditProfilePage = () => {
  const [isModalOpen, setIsModalOpen] = useState(true)
  const navigate = useNavigate()

  const handleModalClose = () => {
    setIsModalOpen(false)
    // Navigate to dashboard or profile page after closing
    navigate('/dashboard')
  }

  const handleModalSuccess = () => {
    setIsModalOpen(false)
    // Navigate to dashboard after successful save
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <EditProfileModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSuccess={handleModalSuccess}
      />
    </div>
  )
}

export default EditProfilePage
