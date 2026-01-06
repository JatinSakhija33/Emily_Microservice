import React, { useState, useEffect } from 'react'
import { X, Send, MessageSquare, Phone, Loader2, CheckCircle, XCircle, Settings, ExternalLink, FileText, ChevronDown } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

const WhatsAppMessageModal = ({ isOpen, onClose }) => {
  const { user } = useAuth()
  const [phoneNumber, setPhoneNumber] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null) // { success: true/false, message: string }
  const [hasConnection, setHasConnection] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(true)
  const [showConnectionSetup, setShowConnectionSetup] = useState(false)
  const [messageType, setMessageType] = useState('text') // 'text' or 'template'
  const [templates, setTemplates] = useState([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [templateParams, setTemplateParams] = useState({}) // Store template parameters

  const handleSend = async () => {
    // Validate inputs
    if (!phoneNumber.trim()) {
      setResult({ success: false, message: 'Please enter a phone number' })
      return
    }

    if (!message.trim()) {
      setResult({ success: false, message: 'Please enter a message' })
      return
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/
    const cleanPhone = phoneNumber.replace(/\s|-|\(|\)/g, '')
    if (!phoneRegex.test(cleanPhone)) {
      setResult({ success: false, message: 'Please enter a valid phone number (e.g., +1234567890)' })
      return
    }

    setSending(true)
    setResult(null)

    try {
      // Get auth token
      const authToken = localStorage.getItem('authToken') || 
                       localStorage.getItem('token') || 
                       localStorage.getItem('access_token')

      if (!authToken) {
        throw new Error('Authentication required. Please log in again.')
      }

      // Prepare request body based on message type
      const requestBody = {
        phone_number: cleanPhone,
        message_type: messageType
      }

      if (messageType === 'template') {
        if (!selectedTemplate) {
          throw new Error('Please select a template')
        }
        requestBody.template_name = selectedTemplate.name
        requestBody.language_code = selectedTemplate.language || 'en'
        
        // Build template parameters if needed
        if (selectedTemplate.components && selectedTemplate.components.length > 0) {
          const bodyComponents = selectedTemplate.components.find(c => c.type === 'BODY')
          if (bodyComponents && bodyComponents.example) {
            // Extract parameters from template params
            const params = []
            // Sort by index to maintain order
            const sortedKeys = Object.keys(templateParams).sort((a, b) => parseInt(a) - parseInt(b))
            sortedKeys.forEach(key => {
              if (templateParams[key] && templateParams[key].trim()) {
                params.push({
                  type: 'text',
                  text: templateParams[key].trim()
                })
              }
            })
            
            if (params.length > 0) {
              requestBody.template_parameters = params
            }
          }
        }
      } else {
        requestBody.message = message.trim()
        if (!requestBody.message) {
          throw new Error('Please enter a message')
        }
      }

      const response = await fetch(`${API_BASE_URL}/whatsapp/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        // Check if it's a "no connection" error
        const errorMessage = data.detail || data.message || 'Failed to send message'
        if (errorMessage.toLowerCase().includes('no active whatsapp connection') || 
            errorMessage.toLowerCase().includes('no whatsapp connection')) {
          setHasConnection(false)
          setShowConnectionSetup(true)
          throw new Error('WhatsApp connection required. Please set up your connection first.')
        }
        throw new Error(errorMessage)
      }

      if (data.success) {
        setResult({ success: true, message: 'Message sent successfully!' })
        // Clear form after successful send
        setTimeout(() => {
          setPhoneNumber('')
          setMessage('')
          setResult(null)
          setSelectedTemplate(null)
          setTemplateParams({})
          onClose()
        }, 2000)
      } else {
        throw new Error(data.message || 'Failed to send message')
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error)
      setResult({ 
        success: false, 
        message: error.message || 'Failed to send message. Please try again.' 
      })
    } finally {
      setSending(false)
    }
  }

  // Check for WhatsApp connection when modal opens
  useEffect(() => {
    if (isOpen) {
      checkConnection()
      if (hasConnection && messageType === 'template') {
        fetchTemplates()
      }
    }
  }, [isOpen, hasConnection, messageType])

  const fetchTemplates = async () => {
    setLoadingTemplates(true)
    try {
      const authToken = localStorage.getItem('authToken') || 
                       localStorage.getItem('token') || 
                       localStorage.getItem('access_token')

      if (!authToken) {
        return
      }

      const response = await fetch(`${API_BASE_URL}/whatsapp/templates`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Error fetching templates:', error)
    } finally {
      setLoadingTemplates(false)
    }
  }

  const checkConnection = async () => {
    setCheckingConnection(true)
    try {
      const authToken = localStorage.getItem('authToken') || 
                       localStorage.getItem('token') || 
                       localStorage.getItem('access_token')

      if (!authToken) {
        setHasConnection(false)
        setCheckingConnection(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/leads/whatsapp/connection`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        setHasConnection(true)
      } else {
        setHasConnection(false)
      }
    } catch (error) {
      console.error('Error checking WhatsApp connection:', error)
      setHasConnection(false)
    } finally {
      setCheckingConnection(false)
    }
  }

  const handleClose = () => {
    if (!sending) {
      setPhoneNumber('')
      setMessage('')
      setResult(null)
      setShowConnectionSetup(false)
      setSelectedTemplate(null)
      setTemplateParams({})
      setMessageType('text')
      onClose()
    }
  }

  // Parse template components to get parameter placeholders
  const getTemplateParameters = (template) => {
    if (!template || !template.components) return []
    
    const bodyComponent = template.components.find(c => c.type === 'BODY')
    if (!bodyComponent) return []
    
    // Extract variables from example
    const variables = []
    
    // Check for example body_text array (most common format)
    if (bodyComponent.example && bodyComponent.example.body_text && Array.isArray(bodyComponent.example.body_text)) {
      bodyComponent.example.body_text.forEach((exampleText, index) => {
        // Extract text from example (could be string or array)
        const example = Array.isArray(exampleText) ? exampleText[0] : exampleText
        variables.push({
          index: index + 1,
          placeholder: `Parameter ${index + 1}`,
          example: typeof example === 'string' ? example : ''
        })
      })
    }
    // Alternative: check for body_text as direct array
    else if (bodyComponent.body_text && Array.isArray(bodyComponent.body_text)) {
      bodyComponent.body_text.forEach((text, index) => {
        variables.push({
          index: index + 1,
          placeholder: `Parameter ${index + 1}`,
          example: typeof text === 'string' ? text : ''
        })
      })
    }
    // Check format array (alternative format)
    else if (bodyComponent.format && bodyComponent.format === 'TEXT') {
      // Count {{1}}, {{2}}, etc. in the template text if available
      const templateText = bodyComponent.text || ''
      const matches = templateText.match(/\{\{(\d+)\}\}/g)
      if (matches) {
        matches.forEach((match, index) => {
          variables.push({
            index: index + 1,
            placeholder: `Parameter ${index + 1}`,
            example: ''
          })
        })
      }
    }
    
    return variables
  }

  if (!isOpen) return null

  // Show loading state while checking connection
  if (checkingConnection) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <Loader2 className="w-8 h-8 animate-spin text-green-600 mb-4" />
          <p className="text-gray-600">Checking WhatsApp connection...</p>
        </div>
      </div>
    )
  }

  // Show connection setup if no connection
  if (!hasConnection && !showConnectionSetup) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <div 
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-white font-semibold text-lg">WhatsApp Not Connected</h2>
                <p className="text-white/80 text-sm">Connect your WhatsApp Business account to send messages</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="p-6">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                You need to connect your WhatsApp Business API account to send messages.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">How to Get Your WhatsApp Credentials:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
                <li>Go to <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline inline-flex items-center gap-1">Meta for Developers <ExternalLink className="w-3 h-3" /></a></li>
                <li>Create or select your WhatsApp Business App</li>
                <li>Go to WhatsApp → API Setup</li>
                <li>Copy your <strong>Phone Number ID</strong> and <strong>Access Token</strong></li>
                <li>Click "Set Up Connection" below to connect</li>
              </ol>

              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={() => setShowConnectionSetup(true)}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2 rounded-lg hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Set Up Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose()
        }
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg">Send WhatsApp Message</h2>
              <p className="text-white/80 text-sm">Send a message to any WhatsApp number</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={sending}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          {/* Connection Setup Form */}
          {showConnectionSetup ? (
            <WhatsAppConnectionSetup 
              onSuccess={() => {
                setShowConnectionSetup(false)
                checkConnection()
              }}
              onCancel={() => setShowConnectionSetup(false)}
            />
          ) : (
            <>
          {/* Result Message */}
          {result && (
            <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 ${
              result.success 
                ? 'bg-green-50 text-green-800 border border-green-200' 
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}>
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{result.message}</p>
            </div>
          )}

          {/* Phone Number Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+1234567890"
                disabled={sending}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Include country code (e.g., +1 for US, +91 for India)
            </p>
          </div>

          {/* Message Type Toggle */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMessageType('text')
                  setSelectedTemplate(null)
                  setTemplateParams({})
                }}
                disabled={sending}
                className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                  messageType === 'text'
                    ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  <span>Text Message</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMessageType('template')
                  fetchTemplates()
                }}
                disabled={sending}
                className={`flex-1 px-4 py-2 rounded-lg border transition-all ${
                  messageType === 'template'
                    ? 'bg-green-50 border-green-500 text-green-700 font-medium'
                    : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <div className="flex items-center justify-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>Template</span>
                </div>
              </button>
            </div>
          </div>

          {/* Template Selection */}
          {messageType === 'template' && (
            <div className="mb-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Template
                </label>
                <div className="relative">
                  <select
                    value={selectedTemplate?.name || ''}
                    onChange={(e) => {
                      const template = templates.find(t => t.name === e.target.value)
                      setSelectedTemplate(template || null)
                      setTemplateParams({}) // Reset parameters when template changes
                    }}
                    disabled={sending || loadingTemplates}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed appearance-none pr-10"
                  >
                    <option value="">{loadingTemplates ? 'Loading templates...' : 'Select a template'}</option>
                    {templates.map((template) => (
                      <option key={template.name} value={template.name}>
                        {template.name} ({template.language}) - {template.status}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                </div>
                {templates.length === 0 && !loadingTemplates && (
                  <p className="mt-1 text-xs text-amber-600">
                    No templates found. Create templates in Meta for Developers → WhatsApp → Message Templates
                  </p>
                )}
              </div>

              {/* Template Parameters */}
              {selectedTemplate && getTemplateParameters(selectedTemplate).length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Template Parameters
                  </label>
                  <div className="space-y-2">
                    {getTemplateParameters(selectedTemplate).map((param) => (
                      <div key={param.index}>
                        <input
                          type="text"
                          value={templateParams[param.index] || ''}
                          onChange={(e) => setTemplateParams({
                            ...templateParams,
                            [param.index]: e.target.value
                          })}
                          placeholder={param.example || param.placeholder}
                          disabled={sending}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {param.example && (
                          <p className="mt-1 text-xs text-gray-500">
                            Example: {param.example}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Fill in the parameters to personalize your template message
                  </p>
                </div>
              )}

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <p className="text-xs font-medium text-gray-700 mb-1">Template Preview:</p>
                  <p className="text-sm text-gray-600">
                    <strong>Name:</strong> {selectedTemplate.name}<br/>
                    <strong>Language:</strong> {selectedTemplate.language}<br/>
                    <strong>Status:</strong> <span className={`font-medium ${
                      selectedTemplate.status === 'APPROVED' ? 'text-green-600' : 
                      selectedTemplate.status === 'PENDING' ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>{selectedTemplate.status}</span>
                  </p>
                  {selectedTemplate.status !== 'APPROVED' && (
                    <p className="mt-2 text-xs text-amber-600">
                      ⚠️ Only APPROVED templates can be sent. This template is {selectedTemplate.status}.
                    </p>
                  )}
                </div>
              )}

              <div className="p-2 bg-green-50 border border-green-200 rounded text-xs text-green-800">
                <p className="font-medium mb-1">✓ Template Messages:</p>
                <p>Can be sent to any number, even for first-time contacts. Templates must be approved by Meta.</p>
              </div>
            </div>
          )}

          {/* Text Message Input */}
          {messageType === 'text' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your message here..."
                rows={6}
                disabled={sending}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-500">
                {message.length} characters
              </p>
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                <p className="font-medium mb-1">⚠️ Important:</p>
                <p>Free-form messages only work if the recipient has replied to you within the last 24 hours. For first-time messages, use a template message instead.</p>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Footer - Only show if not in connection setup */}
        {!showConnectionSetup && (
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
            <button
              onClick={handleClose}
              disabled={sending}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={
                sending || 
                !phoneNumber.trim() || 
                (messageType === 'text' && !message.trim()) ||
                (messageType === 'template' && !selectedTemplate)
              }
              className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>{messageType === 'template' ? 'Send Template' : 'Send Message'}</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// WhatsApp Connection Setup Component
const WhatsAppConnectionSetup = ({ onSuccess, onCancel }) => {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [businessAccountId, setBusinessAccountId] = useState('')
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [result, setResult] = useState(null)

  const handleConnect = async () => {
    if (!phoneNumberId.trim() || !accessToken.trim()) {
      setResult({ success: false, message: 'Phone Number ID and Access Token are required' })
      return
    }

    setConnecting(true)
    setResult(null)

    try {
      const authToken = localStorage.getItem('authToken') || 
                       localStorage.getItem('token') || 
                       localStorage.getItem('access_token')

      if (!authToken) {
        throw new Error('Authentication required. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/leads/whatsapp/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          phone_number_id: phoneNumberId.trim(),
          access_token: accessToken.trim(),
          business_account_id: businessAccountId.trim() || undefined,
          whatsapp_business_account_id: whatsappBusinessAccountId.trim() || undefined
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Failed to connect WhatsApp')
      }

      if (data.success) {
        setResult({ success: true, message: 'WhatsApp connected successfully!' })
        setTimeout(() => {
          onSuccess()
        }, 1500)
      } else {
        throw new Error(data.message || 'Failed to connect WhatsApp')
      }
    } catch (error) {
      console.error('Error connecting WhatsApp:', error)
      setResult({ 
        success: false, 
        message: error.message || 'Failed to connect WhatsApp. Please try again.' 
      })
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-4">
      {result && (
        <div className={`p-3 rounded-lg flex items-center gap-2 ${
          result.success 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {result.success ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <p className="text-sm font-medium">{result.message}</p>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Phone Number ID <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder="e.g., 123456789012345"
          disabled={connecting}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">Found in Meta for Developers → WhatsApp → API Setup</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Access Token <span className="text-red-500">*</span>
        </label>
        <input
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder="Enter your WhatsApp access token"
          disabled={connecting}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <p className="mt-1 text-xs text-gray-500">Temporary token from Meta for Developers (expires in 24 hours)</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Business Account ID <span className="text-gray-400">(Optional)</span>
        </label>
        <input
          type="text"
          value={businessAccountId}
          onChange={(e) => setBusinessAccountId(e.target.value)}
          placeholder="Business Account ID"
          disabled={connecting}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          WhatsApp Business Account ID <span className="text-gray-400">(Optional)</span>
        </label>
        <input
          type="text"
          value={whatsappBusinessAccountId}
          onChange={(e) => setWhatsappBusinessAccountId(e.target.value)}
          placeholder="WhatsApp Business Account ID"
          disabled={connecting}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={connecting}
          className="flex-1 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
        <button
          onClick={handleConnect}
          disabled={connecting || !phoneNumberId.trim() || !accessToken.trim()}
          className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {connecting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <CheckCircle className="w-4 h-4" />
              <span>Connect</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

export default WhatsAppMessageModal

