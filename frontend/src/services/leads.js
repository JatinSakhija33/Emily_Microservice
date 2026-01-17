import api from './api'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'

export const leadsAPI = {
  /**
   * Create a new lead manually
   * @param {Object} leadData - Lead data
   * @param {string} leadData.name - Lead name (required)
   * @param {string} leadData.email - Lead email (optional)
   * @param {string} leadData.phone_number - Lead phone number (optional)
   * @param {string} leadData.source_platform - Source platform (default: 'manual')
   * @param {string} leadData.status - Lead status (default: 'new')
   * @param {Object} leadData.form_data - Form data (optional)
   * @param {Object} leadData.metadata - Additional metadata (optional)
   * @returns {Promise} API response with created lead
   */
  createLead: (leadData) => {
    return api.post('/leads', leadData)
  },

  /**
   * Get all leads for current user
   * @param {Object} params - Query parameters
   * @param {string} params.status - Filter by status (new, contacted, responded, qualified, converted, lost)
   * @param {string} params.source_platform - Filter by platform (facebook, instagram)
   * @param {number} params.limit - Number of leads to return (default: 50, max: 200)
   * @param {number} params.offset - Offset for pagination (default: 0)
   * @returns {Promise} API response with leads array
   */
  getLeads: (params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.status) queryParams.append('status', params.status)
    if (params.source_platform) queryParams.append('source_platform', params.source_platform)
    if (params.limit) queryParams.append('limit', params.limit)
    if (params.offset) queryParams.append('offset', params.offset)
    
    const queryString = queryParams.toString()
    return api.get(`/leads${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Get single lead by ID
   * @param {string} leadId - Lead ID
   * @returns {Promise} API response with lead object
   */
  getLead: (leadId) => {
    return api.get(`/leads/${leadId}`)
  },

  /**
   * Get conversation history for a lead
   * @param {string} leadId - Lead ID
   * @param {Object} params - Query parameters
   * @param {string} params.message_type - Filter by message type (email, whatsapp)
   * @param {number} params.limit - Number of messages to return (default: 100, max: 200)
   * @returns {Promise} API response with conversations array
   */
  getLeadConversations: (leadId, params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.message_type) queryParams.append('message_type', params.message_type)
    if (params.limit) queryParams.append('limit', params.limit)
    
    const queryString = queryParams.toString()
    return api.get(`/leads/${leadId}/conversations${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Get conversations (alias for getLeadConversations for consistency)
   * @param {string} leadId - Lead ID
   * @param {Object} params - Query parameters
   * @returns {Promise} API response with conversations array
   */
  getConversations: (leadId, params = {}) => {
    const queryParams = new URLSearchParams()
    if (params.message_type) queryParams.append('message_type', params.message_type)
    if (params.limit) queryParams.append('limit', params.limit)
    
    const queryString = queryParams.toString()
    return api.get(`/leads/${leadId}/conversations${queryString ? `?${queryString}` : ''}`)
  },

  /**
   * Get status history for a lead
   * @param {string} leadId - Lead ID
   * @returns {Promise} API response with status history array
   */
  getStatusHistory: (leadId) => {
    return api.get(`/leads/${leadId}/status-history`)
  },

  /**
   * Update lead status
   * @param {string} leadId - Lead ID
   * @param {string} status - New status (new, contacted, responded, qualified, converted, lost)
   * @param {string} remarks - Optional remarks for status change
   * @returns {Promise} API response
   */
  updateLeadStatus: (leadId, status, remarks = null) => {
    return api.put(`/leads/${leadId}/status`, {
      status,
      remarks
    })
  },

  /**
   * Delete a lead
   * @param {string} leadId - Lead ID
   * @returns {Promise} API response
   */
  deleteLead: (leadId) => {
    return api.delete(`/leads/${leadId}`)
  },

  /**
   * Update follow-up date and time for a lead
   * @param {string} leadId - Lead ID
   * @param {string|null} followUpAt - ISO format datetime string or null to clear
   * @returns {Promise} API response
   */
  updateFollowUp: (leadId, followUpAt) => {
    return api.put(`/leads/${leadId}/follow-up`, {
      follow_up_at: followUpAt
    })
  },

  /**
   * Update lead details (name, email, phone, source, etc.)
   * @param {string} leadId - Lead ID
   * @param {Object} leadData - Lead data to update
   * @param {string} leadData.name - Lead name
   * @param {string} leadData.email - Lead email
   * @param {string} leadData.phone_number - Lead phone number
   * @param {string} leadData.source_platform - Source platform
   * @returns {Promise} API response
   */
  updateLead: (leadId, leadData) => {
    return api.put(`/leads/${leadId}`, leadData)
  },

  /**
   * Add a remark to a lead without changing status
   * @param {string} leadId - Lead ID
   * @param {string} remarks - Remarks to add
   * @returns {Promise} API response
   */
  addRemark: (leadId, remarks) => {
    return api.post(`/leads/${leadId}/remarks`, {
      remarks
    })
  },

  /**
   * Import leads from CSV file
   * @param {File} file - CSV file to import
   * @returns {Promise} API response with import results
   */
  importLeadsCSV: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    
    return api.post('/leads/import-csv', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
  },

  /**
   * Send message to lead
   * @param {string} leadId - Lead ID
   * @param {string} message - Message content
   * @param {string} messageType - Message type (whatsapp or email)
   * @returns {Promise} API response
   */
  sendMessageToLead: (leadId, message, messageType = 'whatsapp') => {
    return api.post(`/leads/${leadId}/message`, {
      message,
      message_type: messageType
    })
  },

  /**
   * Send WhatsApp message to lead via AuthKey service
   * @param {string} leadId - Lead ID
   * @param {Object} payload - Message payload
   * @param {string} payload.template_id - AuthKey template ID (wid) - REQUIRED
   * @param {Object} payload.body_values - Template variables { "1": "value" }
   * @param {string} payload.header_filename - Optional header filename for media template
   * @param {string} payload.header_data_url - Optional media URL for header
   * @param {string} payload.template_type - text | media
   * @param {string} payload.country_code - Optional override country code
   * @param {string} payload.phone_number - Optional override phone
   * @returns {Promise} API response
   */
  sendWhatsAppAuthKeyToLead: (leadId, payload) => {
    if (!payload.template_id) {
      throw new Error('AuthKey requires template_id. Create a template in AuthKey console first.')
    }
    return api.post(`/leads/${leadId}/whatsapp/authkey`, payload)
  },

  /**
   * Save or update per-user AuthKey WhatsApp credentials
   * @param {Object} payload
   * @param {string} payload.authkey - AuthKey API key (required)
   * @param {string} payload.default_country_code - Optional default country code (e.g., "91")
   * @returns {Promise} API response
   */
  saveAuthKeyConfig: (payload) => {
    return api.post('/leads/whatsapp/authkey/config', payload)
  },

  /**
   * Get current user's AuthKey WhatsApp configuration (without exposing secret if hidden by backend)
   * @returns {Promise} API response
   */
  getAuthKeyConfig: () => {
    return api.get('/leads/whatsapp/authkey/config')
  },

  /**
   * Get WhatsApp connection for current user
   * @returns {Promise} API response with WhatsApp connection object
   */
  getWhatsAppConnection: () => {
    return api.get('/leads/whatsapp/connection')
  },

  /**
   * Connect WhatsApp Business API account
   * @param {Object} connectionData - Connection data
   * @param {string} connectionData.phone_number_id - WhatsApp Phone Number ID
   * @param {string} connectionData.access_token - WhatsApp Access Token
   * @param {string} connectionData.business_account_id - Optional Business Account ID
   * @param {string} connectionData.whatsapp_business_account_id - Optional WhatsApp Business Account ID
   * @returns {Promise} API response
   */
  connectWhatsApp: (connectionData) => {
    return api.post('/leads/whatsapp/connect', connectionData)
  },

  /**
   * Get available email templates
   * @returns {Promise} API response with templates array
   */
  getEmailTemplates: () => {
    return api.get('/leads/email-templates')
  },

  /**
   * Generate personalized email for a lead
   * @param {string} leadId - Lead ID
   * @param {Object} options - Generation options
   * @param {string} options.template - Template type (welcome, follow-up, inquiry, custom)
   * @param {string} options.customTemplate - Custom template text when template is "custom"
   * @returns {Promise} API response with generated email (subject, body)
   */
  generateEmail: (leadId, options = {}) => {
    return api.post(`/leads/${leadId}/generate-email`, {
      template: options.template || 'welcome',
      category: options.category || 'general',
      custom_template: options.customTemplate || null,
      custom_prompt: options.customPrompt || null
    })
  },

  /**
   * Bulk delete multiple leads
   * @param {string[]} leadIds - Array of lead IDs to delete
   * @returns {Promise} API response with deletion results
   */
  bulkDeleteLeads: (leadIds) => {
    return api.post('/leads/bulk-delete', {
      lead_ids: leadIds
    })
  }
}

export default leadsAPI

