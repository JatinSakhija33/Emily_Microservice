import React, { useState } from 'react'
import { X, UserPlus, Mail, Phone, Globe, Loader2, AlertCircle, Upload } from 'lucide-react'
import { leadsAPI } from '../services/leads'
import { useNotifications } from '../contexts/NotificationContext'
import ImportLeadsModal from './ImportLeadsModal'

const AddLeadModal = ({ isOpen, onClose, onSuccess, isImporting = false, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotifications()
  const [loading, setLoading] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    source_platform: 'manual',
    status: 'new',
    form_data: {},
    metadata: {}
  })
  const [errors, setErrors] = useState({})
  const [customSourcePlatform, setCustomSourcePlatform] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleAddFormField = () => {
    const key = prompt('Enter field name:')
    if (key && key.trim()) {
      const value = prompt(`Enter value for "${key}":`)
      setFormData(prev => ({
        ...prev,
        form_data: {
          ...prev.form_data,
          [key.trim()]: value || ''
        }
      }))
    }
  }

  const handleRemoveFormField = (key) => {
    setFormData(prev => {
      const newFormData = { ...prev.form_data }
      delete newFormData[key]
      return {
        ...prev,
        form_data: newFormData
      }
    })
  }

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }
    
    if (!formData.email && !formData.phone_number) {
      newErrors.contact = 'Either email or phone number is required'
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address'
    }
    
    if (formData.phone_number && !/^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/.test(formData.phone_number)) {
      newErrors.phone_number = 'Please enter a valid phone number'
    }
    
    if (formData.source_platform === 'other' && !customSourcePlatform.trim()) {
      newErrors.customSourcePlatform = 'Please enter a custom source platform'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    try {
      setLoading(true)
      
      // Prepare lead data
      const leadData = {
        name: formData.name.trim(),
        email: formData.email.trim() || null,
        phone_number: formData.phone_number.trim() || null,
        source_platform: formData.source_platform === 'other' ? customSourcePlatform.trim() : formData.source_platform,
        status: formData.status,
        form_data: formData.form_data,
        metadata: {
          ...formData.metadata,
          created_manually: true,
          created_by: 'user'
        }
      }
      
      const response = await leadsAPI.createLead(leadData)
      
      showSuccess('Lead Added', 'Lead has been successfully added')
      
      // Reset form
      setFormData({
        name: '',
        email: '',
        phone_number: '',
        source_platform: 'manual',
        status: 'new',
        form_data: {},
        metadata: {}
      })
      setCustomSourcePlatform('')
      setErrors({})
      
      if (onSuccess) {
        onSuccess(response.data)
      }
      
      onClose()
      
    } catch (error) {
      console.error('Error creating lead:', error)
      // Handle duplicate lead error (409 Conflict)
      if (error.response?.status === 409) {
        showError('Duplicate Lead', error.response?.data?.detail || 'This lead already exists. Duplicate leads are not allowed.')
      } else {
        showError('Error', error.response?.data?.detail || 'Failed to create lead. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setFormData({
        name: '',
        email: '',
        phone_number: '',
        source_platform: 'manual',
        status: 'new',
        form_data: {},
        metadata: {}
      })
      setCustomSourcePlatform('')
      setErrors({})
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto md:left-48 xl:left-64"
      style={{ right: '0', top: '0', bottom: '0' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className={`${
          isDarkMode ? 'bg-gray-800 border border-gray-700' : 'bg-white'
        } rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <UserPlus className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Add New Lead</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={loading}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* CSV Import Option */}
          <div className="mt-4 pt-4 border-t border-white/20">
            <button
              type="button"
              onClick={() => setShowImportModal(true)}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <Upload className="w-4 h-4" />
              <span>Import from CSV</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6" style={{ color: isDarkMode ? '#f3f4f6' : 'inherit' }}>
            {/* Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.name
                    ? 'border-red-500'
                    : isDarkMode
                      ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400'
                      : 'border-gray-300'
                }`}
                placeholder="Enter lead name"
                disabled={loading}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600 flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.name}</span>
                </p>
              )}
            </div>

            {/* Email and Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  <Mail className="w-4 h-4 inline mr-1" />
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.email
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400'
                        : 'border-gray-300'
                  }`}
                  placeholder="email@example.com"
                  disabled={loading}
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.email}</span>
                  </p>
                )}
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.phone_number
                      ? 'border-red-500'
                      : isDarkMode
                        ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400'
                        : 'border-gray-300'
                  }`}
                  placeholder="+1234567890"
                  disabled={loading}
                />
                {errors.phone_number && (
                  <p className="mt-1 text-sm text-red-600 flex items-center space-x-1">
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.phone_number}</span>
                  </p>
                )}
              </div>
            </div>

            {errors.contact && (
              <div className={`${
                isDarkMode
                  ? 'bg-red-900/20 border-red-700 text-red-400'
                  : 'bg-red-50 border-red-200 text-red-600'
              } border rounded-lg p-3`}>
                <p className="text-sm flex items-center space-x-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errors.contact}</span>
                </p>
              </div>
            )}

            {/* Source Platform */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                <Globe className="w-4 h-4 inline mr-1" />
                Source Platform
              </label>
              <select
                name="source_platform"
                value={formData.source_platform}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDarkMode
                    ? 'border-gray-600 bg-gray-700 text-gray-200'
                    : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="manual">Manual Entry</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="walk_ins">Walk Ins</option>
                <option value="referral">Referral</option>
                <option value="email">Email</option>
                <option value="website">Website</option>
                <option value="phone_call">Phone Call</option>
                <option value="other">Other</option>
              </select>
              {formData.source_platform === 'other' && (
                <div className="mt-2">
                  <input
                    type="text"
                    value={customSourcePlatform}
                    onChange={(e) => {
                      setCustomSourcePlatform(e.target.value)
                      if (errors.customSourcePlatform) {
                        setErrors(prev => ({
                          ...prev,
                          customSourcePlatform: ''
                        }))
                      }
                    }}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      errors.customSourcePlatform
                        ? 'border-red-500'
                        : isDarkMode
                          ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400'
                          : 'border-gray-300'
                    }`}
                    placeholder="Enter custom source platform"
                    disabled={loading}
                  />
                  {errors.customSourcePlatform && (
                    <p className="mt-1 text-sm text-red-600 flex items-center space-x-1">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.customSourcePlatform}</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Status */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${
                isDarkMode ? 'text-gray-200' : 'text-gray-700'
              }`}>
                Initial Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  isDarkMode
                    ? 'border-gray-600 bg-gray-700 text-gray-200'
                    : 'border-gray-300'
                }`}
                disabled={loading}
              >
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="responded">Responded</option>
                <option value="qualified">Qualified</option>
                <option value="converted">Converted</option>
                <option value="lost">Lost</option>
                <option value="invalid">Invalid</option>
              </select>
            </div>

            {/* Additional Form Fields */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className={`block text-sm font-medium ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>
                  Additional Information (Optional)
                </label>
                <button
                  type="button"
                  onClick={handleAddFormField}
                  className={`text-sm font-medium ${
                    isDarkMode
                      ? 'text-blue-400 hover:text-blue-300'
                      : 'text-blue-600 hover:text-blue-700'
                  }`}
                  disabled={loading}
                >
                  + Add Field
                </button>
              </div>
              {Object.keys(formData.form_data).length > 0 ? (
                <div className={`space-y-2 border rounded-lg p-3 ${
                  isDarkMode
                    ? 'border-gray-600 bg-gray-700'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  {Object.entries(formData.form_data).map(([key, value]) => (
                    <div key={key} className="flex items-center space-x-2">
                      <div className="flex-1">
                        <div className={`text-xs mb-1 capitalize ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                        }`}>{key.replace(/_/g, ' ')}</div>
                        <div className={`text-sm ${
                          isDarkMode ? 'text-gray-200' : 'text-gray-900'
                        }`}>{value}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFormField(key)}
                        className={`p-1 ${
                          isDarkMode
                            ? 'text-red-400 hover:text-red-300'
                            : 'text-red-600 hover:text-red-700'
                        }`}
                        disabled={loading}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-sm italic p-3 rounded-lg border ${
                  isDarkMode
                    ? 'text-gray-400 bg-gray-700 border-gray-600'
                    : 'text-gray-500 bg-gray-50 border-gray-200'
                }`}>
                  No additional fields added. Click "Add Field" to add custom information.
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className={`flex items-center justify-end space-x-3 mt-6 pt-6 border-t ${
            isDarkMode ? 'border-gray-600' : 'border-gray-200'
          }`}>
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className={`px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 ${
                isDarkMode
                  ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Add Lead</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      
      {/* Import CSV Modal */}
      <ImportLeadsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={async (file) => {
          if (onSuccess) {
            // Handle CSV import through parent component
            // We'll need to pass this handler from LeadsDashboard
            await onSuccess({ type: 'csv', file })
          }
          setShowImportModal(false)
        }}
        isImporting={isImporting}
        isDarkMode={isDarkMode}
      />
    </div>
  )
}

export default AddLeadModal

