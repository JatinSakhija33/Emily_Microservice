import React, { useState } from 'react'
import LogoUpload from './LogoUpload'
import { CheckCircle, ExternalLink } from 'lucide-react'

const LogoUploadPage = () => {
  const [uploadedUrl, setUploadedUrl] = useState('')
  const [error, setError] = useState('')

  const handleUploadSuccess = (url) => {
    setUploadedUrl(url)
    setError('')
  }

  const handleError = (errorMessage) => {
    setError(errorMessage)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">
              Upload Your Business Logo
            </h1>
            <p className="text-gray-600">
              Upload your business logo to store it in your Supabase bucket.
              The logo will be stored in the "Logo" bucket and you'll get a public URL.
            </p>
          </div>

          <div className="space-y-6">
            <LogoUpload
              onUploadSuccess={handleUploadSuccess}
              onError={handleError}
              className="w-full"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {uploadedUrl && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-500 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-lg font-medium text-green-800 mb-2">
                      Logo Uploaded Successfully!
                    </h3>
                    <p className="text-green-700 text-sm mb-3">
                      Your logo has been uploaded to the Supabase Logo bucket.
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm text-green-600 font-medium">Public URL:</p>
                      <div className="bg-white rounded border p-3">
                        <code className="text-xs text-gray-800 break-all">
                          {uploadedUrl}
                        </code>
                      </div>
                      <a
                        href={uploadedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-2 text-sm text-green-600 hover:text-green-700"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>View Logo</span>
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              <p className="mb-2">
                <strong>Supported formats:</strong> JPEG, PNG, GIF, WebP
              </p>
              <p>
                <strong>Maximum file size:</strong> 5MB
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LogoUploadPage
