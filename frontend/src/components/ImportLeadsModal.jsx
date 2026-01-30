import React, { useState, useRef } from 'react'
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'

const ImportLeadsModal = ({ isOpen, onClose, onImport, isImporting = false, isDarkMode = false }) => {
  const { showError } = useNotifications()
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = (file) => {
    if (!file) return
    
    if (!file.name.endsWith('.csv')) {
      showError('Invalid File', 'Please select a CSV file')
      return
    }
    
    setSelectedFile(file)
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0])
    }
  }

  const handleImport = () => {
    if (!selectedFile) {
      showError('No File Selected', 'Please select a CSV file to import')
      return
    }
    
    if (onImport) {
      onImport(selectedFile)
    }
  }

  const handleClose = () => {
    if (isImporting) {
      return // Prevent closing while importing
    }
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    onClose()
  }

  const downloadTemplate = () => {
    // Create CSV template content
    const template = `name,email,phone_number,source_platform,status,follow_up_at
John Doe,john@example.com,1234567890,email,new,2024-12-31T10:00:00
Jane Smith,jane@example.com,+1234567891,website,contacted,2024-12-31T10:00:00
Bob Johnson,,+1234567892,phone_call,new,2024-12-31T14:00:00`

    // Create blob and download
    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads_import_template.csv'
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto md:left-48 xl:left-64"
      style={{ right: '0', top: '0', bottom: '0' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <div
        className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col`}
      >
        {/* Header */}
        <div className={`${isDarkMode ? 'bg-gradient-to-r from-blue-700 to-indigo-700' : 'bg-gradient-to-r from-blue-600 to-indigo-600'} text-white p-6 rounded-t-xl`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Upload className="w-6 h-6" />
              <h2 className="text-2xl font-bold">Import Leads from CSV</h2>
            </div>
            <button
              onClick={handleClose}
              disabled={isImporting}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto p-6"
          style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isDarkMode ? '#4B5563 #1F2937' : '#9CA3AF #F3F4F6'
          }}
        >
          <div className="space-y-6">
            {/* Instructions */}
            <div className={`${isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'} rounded-lg p-4`}>
              <h3 className={`text-sm font-semibold mb-2 flex items-center space-x-2 ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>
                <FileText className="w-4 h-4" />
                <span>CSV Format Requirements</span>
              </h3>
              <ul className={`text-sm space-y-1 list-disc list-inside ${isDarkMode ? 'text-blue-300' : 'text-blue-800'}`}>
                <li><strong>Required columns:</strong> name, follow_up_at</li>
                <li><strong>Optional columns:</strong> email, phone_number (or phone), source_platform, status</li>
                <li><strong>Source platforms:</strong> manual, facebook, instagram, walk_ins, referral, email, website, phone_call</li>
                <li><strong>Status options:</strong> new, contacted, responded, qualified, converted, lost, invalid</li>
                <li><strong>Follow-up date (REQUIRED):</strong> Must be a valid date in one of these formats:
                  <ul className="ml-4 mt-1 space-y-0.5">
                    <li>• YYYY-MM-DD (e.g., 2024-12-31)</li>
                    <li>• YYYY-MM-DDTHH:MM:SS (e.g., 2024-12-31T10:00:00)</li>
                    <li>• YYYY-MM-DD HH:MM:SS (e.g., 2024-12-31 10:00:00)</li>
                    <li>• MM/DD/YYYY (e.g., 12/31/2024)</li>
                    <li>• DD/MM/YYYY (e.g., 31/12/2024)</li>
                  </ul>
                  <span className={`font-semibold ${isDarkMode ? 'text-red-400' : 'text-red-600'}`}>⚠️ Invalid dates (e.g., Nov 31) will cause the lead to be rejected</span>
                </li>
                <li>At least one of email or phone_number must be provided for each lead</li>
              </ul>
            </div>

            {/* Download Template */}
            <div className={`flex items-center justify-between rounded-lg p-4 border ${
              isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-50 border-gray-200'
            }`}>
              <div>
                <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Need a template?</p>
                <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Download a sample CSV file with the correct format</p>
              </div>
              <button
                onClick={downloadTemplate}
                className={`flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-colors ${
                  isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>Download Template</span>
              </button>
            </div>

            {/* File Upload Area */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? `border-blue-500 ${isDarkMode ? 'bg-blue-900/20' : 'bg-blue-50'}`
                  : selectedFile
                  ? `border-green-500 ${isDarkMode ? 'bg-green-900/20' : 'bg-green-50'}`
                  : `${isDarkMode ? 'border-gray-600 bg-gray-700 hover:border-gray-500' : 'border-gray-300 bg-gray-50 hover:border-gray-400'}`
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileInputChange}
                className="hidden"
                id="csv-file-input"
              />
              
              {selectedFile ? (
                <div className="space-y-3">
                  <CheckCircle className={`w-12 h-12 mx-auto ${isDarkMode ? 'text-green-400' : 'text-green-500'}`} />
                  <div>
                    <p className={`text-sm font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{selectedFile.name}</p>
                    <p className={`text-xs mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      {(selectedFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) {
                        fileInputRef.current.value = ''
                      }
                    }}
                    className={`text-sm ${isDarkMode ? 'text-red-400 hover:text-red-300' : 'text-red-600 hover:text-red-700'}`}
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className={`w-12 h-12 mx-auto ${
                    dragActive
                      ? 'text-blue-500'
                      : isDarkMode
                      ? 'text-gray-500'
                      : 'text-gray-400'
                  }`} />
                  <div>
                    <label
                      htmlFor="csv-file-input"
                      className={`cursor-pointer font-medium ${
                        isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'
                      }`}
                    >
                      Click to browse
                    </label>
                    <span className={` ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}> or drag and drop</span>
                  </div>
                  <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>CSV files only (max 10MB)</p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {selectedFile && !selectedFile.name.endsWith('.csv') && (
              <div className={`${isDarkMode ? 'bg-red-900/20 border-red-700' : 'bg-red-50 border-red-200'} rounded-lg p-3 flex items-start space-x-2`}>
                <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-red-400' : 'text-red-600'}`} />
                <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-800'}`}>
                  Please select a valid CSV file (.csv extension required)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className={`flex items-center justify-end space-x-3 p-6 border-t ${
          isDarkMode ? 'border-gray-600' : 'border-gray-200'
        }`}>
          <button
            onClick={handleClose}
            disabled={isImporting}
            className={`px-4 py-2 border rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              isDarkMode
                ? 'border-gray-600 text-gray-200 hover:bg-gray-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || !selectedFile.name.endsWith('.csv') || isImporting}
            className={`px-6 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 ${
              isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Importing...</span>
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                <span>Import Leads</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ImportLeadsModal


