import React, { useState } from 'react'
import { CheckCircle, AlertTriangle, ExternalLink, Copy, Globe, Key, User, Shield, Ban, Settings, Sparkles } from 'lucide-react'

const WordPressInstructionsModal = ({ isOpen, onClose, onProceed }) => {
  const [copiedText, setCopiedText] = useState('')

  const handleProceed = () => {
    onProceed()
  }

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedText(text)
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setCopiedText('')
      }, 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center p-6 border-b border-gray-200 bg-gradient-to-r from-pink-50 via-purple-50 to-indigo-50">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-r from-pink-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
                WordPress Connection Setup
              </h2>
              <p className="text-sm text-gray-600">Follow these steps to enable REST API access</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Important Notice */}
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-amber-800 mb-2">Important: WordPress Requirements</h3>
                <p className="text-sm text-amber-700 mb-2">
                  Your WordPress site must meet these requirements for successful connection:
                </p>
                <ul className="text-sm text-amber-700 space-y-1 ml-4">
                  <li>• WordPress version 5.6 or higher</li>
                  <li>• Application Passwords feature enabled</li>
                  <li>• REST API must be accessible</li>
                  <li>• No security plugins blocking API calls</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-6">
            {/* Step 1 - Check Plugins and REST API */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Check Plugins & REST API Access</h3>
                  <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <Ban className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-red-800 mb-2">Plugins That Block REST API:</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-red-700">
                            <div>• Wordfence Security</div>
                            <div>• iThemes Security</div>
                            <div>• Sucuri Security</div>
                            <div>• All In One WP Security</div>
                            <div>• WP Security Audit Log</div>
                            <div>• Disable REST API</div>
                            <div>• REST API Authentication</div>
                            <div>• WP REST API Controller</div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          <strong>Test REST API Access:</strong> Visit <code className="bg-gray-100 px-1 rounded text-xs">yoursite.com/wp-json/wp/v2/posts</code>
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          If you see JSON data, REST API is working. If you see an error or blank page, it's blocked.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <Settings className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          <strong>Configure Security Plugins:</strong> Add REST API endpoints to whitelist/allowlist
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Look for "REST API", "API Access", or "WordPress API" settings in your security plugins
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Enable Application Passwords</h3>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          Go to your WordPress admin dashboard
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Navigate to Users → Profile or Users → All Users → Edit User
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          Scroll down to the "Application Passwords" section
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          If you don't see this section, your WordPress version may not support it
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          Click "Add New Application Password"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Create Application Password</h3>
                  <div className="space-y-3">
                     <div className="bg-gray-50 p-4 rounded-lg">
                       <div className="flex items-center justify-between mb-2">
                         <label className="text-sm font-medium text-gray-700">Application Name:</label>
                         <button
                           onClick={() => copyToClipboard('Emily Agent')}
                           className={`text-xs flex items-center space-x-1 transition-colors ${
                             copiedText === 'Emily Agent' 
                               ? 'text-green-600 hover:text-green-700' 
                               : 'text-blue-600 hover:text-blue-800'
                           }`}
                         >
                           <Copy className="w-3 h-3" />
                           <span>{copiedText === 'Emily Agent' ? 'Copied!' : 'Copy'}</span>
                         </button>
                       </div>
                       <div className="bg-white border border-gray-300 rounded px-3 py-2 text-sm font-mono transition-colors">
                         Emily Agent
                       </div>
                       {copiedText === 'Emily Agent' && (
                         <div className="mt-2 text-xs text-green-600 flex items-center space-x-1 animate-pulse">
                           <CheckCircle className="w-3 h-3" />
                           <span>Text copied to clipboard!</span>
                         </div>
                       )}
                     </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          Enter "Emily Agent" as the application name
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          Click "Add New Application Password"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  4
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Copy the Generated Password</h3>
                  <div className="space-y-3">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <h4 className="font-semibold text-red-800 mb-1">Important Security Notice</h4>
                          <p className="text-sm text-red-700">
                            WordPress will show the password only once. Copy it immediately and store it securely. 
                            You won't be able to see it again.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <Key className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-700">
                          The password will look like: <code className="bg-gray-100 px-1 rounded text-xs">abcd efgh ijkl mnop</code>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 5 */}
            <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
              <div className="flex items-start space-x-4">
                <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
                  5
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Required Information</h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Globe className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Site URL</span>
                        </div>
                        <p className="text-xs text-gray-600">Your WordPress site URL (e.g., https://yoursite.com)</p>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <User className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Username</span>
                        </div>
                        <p className="text-xs text-gray-600">Your WordPress username</p>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Key className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">App Password</span>
                        </div>
                        <p className="text-xs text-gray-600">The generated application password</p>
                      </div>
                      
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          <Shield className="w-4 h-4 text-gray-600" />
                          <span className="text-sm font-medium text-gray-700">Site Name</span>
                        </div>
                        <p className="text-xs text-gray-600">A friendly name for this connection</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Troubleshooting */}
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Troubleshooting</h3>
              <div className="space-y-2 text-sm text-gray-700">
                <p>• <strong>Can't find Application Passwords?</strong> Make sure you're using WordPress 5.6+</p>
                <p>• <strong>Connection fails?</strong> Check that your site URL is correct and accessible</p>
                <p>• <strong>Permission denied?</strong> Ensure your user has administrator privileges</p>
                <p>• <strong>Still having issues?</strong> Check your WordPress REST API is enabled</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gradient-to-r from-gray-50 to-pink-50">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Sparkles className="w-4 h-4 text-pink-500" />
            <span>Take your time to read through all the steps</span>
          </div>
          
          <div className="flex items-center justify-end">
            <button
              onClick={handleProceed}
              className="px-8 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WordPressInstructionsModal
