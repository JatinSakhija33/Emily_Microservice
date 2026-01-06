import React, { useState, useRef } from 'react'
import { X, Upload, FileText, AlertCircle, CheckCircle, Loader2, Download } from 'lucide-react'
import { useNotifications } from '../contexts/NotificationContext'

const ImportLeadsModal = ({ isOpen, onClose, onImport, isImporting = false }) => {
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
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-xl">
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
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center space-x-2">
                <FileText className="w-4 h-4" />
                <span>CSV Format Requirements</span>
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
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
                  <span className="text-red-600 font-semibold">⚠️ Invalid dates (e.g., Nov 31) will cause the lead to be rejected</span>
                </li>
                <li>At least one of email or phone_number must be provided for each lead</li>
              </ul>
            </div>

            {/* Download Template */}
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-700">Need a template?</p>
                <p className="text-xs text-gray-500 mt-1">Download a sample CSV file with the correct format</p>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
                  ? 'border-blue-500 bg-blue-50'
                  : selectedFile
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
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
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
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
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className={`w-12 h-12 mx-auto ${dragActive ? 'text-blue-500' : 'text-gray-400'}`} />
                  <div>
                    <label
                      htmlFor="csv-file-input"
                      className="cursor-pointer text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Click to browse
                    </label>
                    <span className="text-gray-500"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-gray-500">CSV files only (max 10MB)</p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {selectedFile && !selectedFile.name.endsWith('.csv') && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  Please select a valid CSV file (.csv extension required)
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isImporting}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={!selectedFile || !selectedFile.name.endsWith('.csv') || isImporting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
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


