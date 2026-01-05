import React, { useState, useEffect, useCallback } from 'react'
import { 
  X, 
  Mail, 
  Phone, 
  Facebook, 
  Instagram,
  User,
  Calendar,
  MessageCircle,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  TrendingUp,
  UserCheck,
  XCircle,
  ChevronRight,
  Mail as MailIcon,
  MessageSquare,
  Loader2,
  Globe,
  Users,
  LogIn,
  CalendarCheck,
  ChevronDown,
  RefreshCw,
  Sparkles,
  FileText,
  Bot
} from 'lucide-react'
import { leadsAPI } from '../services/leads'
import { useNotifications } from '../contexts/NotificationContext'

const LeadDetailModal = ({ lead, onClose, onUpdate, isDarkMode = false }) => {
  const { showSuccess, showError } = useNotifications()
  const [activeTab, setActiveTab] = useState('timeline')
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [conversationsLoaded, setConversationsLoaded] = useState(false)
  const [statusHistory, setStatusHistory] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState(lead.status)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [statusRemarks, setStatusRemarks] = useState('')
  const [showRemarksInput, setShowRemarksInput] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [followUpAt, setFollowUpAt] = useState(lead.follow_up_at || '')
  const [followUpDate, setFollowUpDate] = useState('')
  const [followUpTime, setFollowUpTime] = useState('')
  const [updatingFollowUp, setUpdatingFollowUp] = useState(false)
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [emailTemplates, setEmailTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('welcome')
  const [selectedCategory, setSelectedCategory] = useState('general')
  const [customTemplate, setCustomTemplate] = useState('')
  const [customPrompt, setCustomPrompt] = useState('')
  const [useCustomPrompt, setUseCustomPrompt] = useState(false)
  const [generatedEmail, setGeneratedEmail] = useState(null)
  const [editableSubject, setEditableSubject] = useState('')
  const [editableBody, setEditableBody] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [previousEmails, setPreviousEmails] = useState([])
  const [selectedPreviousEmail, setSelectedPreviousEmail] = useState(null)
  const [generatingEmail, setGeneratingEmail] = useState(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [newRemark, setNewRemark] = useState('')
  const [addingRemark, setAddingRemark] = useState(false)
  const [showAddRemarkSection, setShowAddRemarkSection] = useState(false)

  const fetchConversations = useCallback(async () => {
    if (conversationsLoaded) return // Don't fetch if already loaded
    
    try {
      setLoadingConversations(true)
      const response = await leadsAPI.getLeadConversations(lead.id, { limit: 200 })
      setConversations(response.data || [])
      setConversationsLoaded(true)
    } catch (error) {
      console.error('Error fetching conversations:', error)
      showError('Error', 'Failed to load conversations')
    } finally {
      setLoadingConversations(false)
    }
  }, [lead.id, conversationsLoaded, showError])

  useEffect(() => {
    fetchStatusHistory()
    const followUp = lead.follow_up_at || ''
    setFollowUpAt(followUp)
    if (followUp) {
      const date = new Date(followUp)
      setFollowUpDate(date.toISOString().split('T')[0])
      setFollowUpTime(date.toTimeString().slice(0, 5))
    } else {
      setFollowUpDate('')
      setFollowUpTime('')
    }
    fetchEmailTemplates()
    fetchPreviousEmails()
    // Reset conversations loaded state when lead changes
    setConversationsLoaded(false)
    setConversations([])
  }, [lead.id, lead.follow_up_at])
  
  // Load conversations only when conversations tab is active
  useEffect(() => {
    if (activeTab === 'conversations' && !conversationsLoaded && lead.id) {
      fetchConversations()
    }
  }, [activeTab, conversationsLoaded, lead.id, fetchConversations])

  const fetchPreviousEmails = async () => {
    try {
      const response = await leadsAPI.getConversations(lead.id, { message_type: 'email', limit: 10 })
      if (response.data) {
        const emails = response.data
          .filter(conv => conv.direction === 'outbound' && conv.content)
          .map(conv => ({
            id: conv.id,
            subject: `Re: ${lead.name || 'Lead'}`,
            body: conv.content,
            date: conv.created_at
          }))
        setPreviousEmails(emails)
      }
    } catch (error) {
      console.error('Error fetching previous emails:', error)
    }
  }

  const fetchEmailTemplates = async () => {
    try {
      const response = await leadsAPI.getEmailTemplates()
      setEmailTemplates(response.data?.templates || [])
    } catch (error) {
      console.error('Error fetching email templates:', error)
    }
  }

  const handleGenerateEmail = async () => {
    if (!lead.email) {
      showError('Error', 'Lead has no email address')
      return
    }

    try {
      setGeneratingEmail(true)
      const response = await leadsAPI.generateEmail(lead.id, {
        template: selectedTemplate,
        category: selectedCategory,
        customTemplate: selectedTemplate === 'custom' ? customTemplate : null,
        customPrompt: useCustomPrompt ? customPrompt : null
      })

      if (response.data.success) {
        const email = {
          subject: response.data.subject,
          body: response.data.body
        }
        setGeneratedEmail(email)
        setEditableSubject(email.subject)
        setEditableBody(email.body)
        setIsEditing(false)
        showSuccess('Email Generated', 'Email has been generated successfully. You can edit it before sending.')
      } else {
        showError('Error', 'Failed to generate email')
      }
    } catch (error) {
      console.error('Error generating email:', error)
      showError('Error', 'Failed to generate email')
    } finally {
      setGeneratingEmail(false)
    }
  }

  const handleSendGeneratedEmail = async () => {
    const emailToSend = isEditing ? {
      subject: editableSubject,
      body: editableBody
    } : generatedEmail

    if (!emailToSend || !emailToSend.body) {
      showError('Error', 'No email to send. Please generate an email first.')
      return
    }

    try {
      setSendingEmail(true)
      // Use the editable content if editing, otherwise use generated
      const emailBody = isEditing ? editableBody : emailToSend.body
      await leadsAPI.sendMessageToLead(lead.id, emailBody, 'email')
      showSuccess('Email Sent', 'Email has been sent successfully')
      setGeneratedEmail(null)
      setEditableSubject('')
      setEditableBody('')
      setIsEditing(false)
      fetchConversations()
      fetchPreviousEmails()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error sending email:', error)
      showError('Error', 'Failed to send email')
    } finally {
      setSendingEmail(false)
    }
  }

  const handleUsePreviousEmail = (email) => {
    setSelectedPreviousEmail(email.id)
    setGeneratedEmail({
      subject: email.subject,
      body: email.body
    })
    setEditableSubject(email.subject)
    setEditableBody(email.body)
    setIsEditing(true)
    showSuccess('Template Loaded', 'Previous email loaded. You can edit it before sending.')
  }

  const handleSaveEdits = () => {
    if (editableSubject && editableBody) {
      setGeneratedEmail({
        subject: editableSubject,
        body: editableBody
      })
      setIsEditing(false)
      showSuccess('Changes Saved', 'Email updated successfully')
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (statusDropdownOpen && !event.target.closest('.status-dropdown-container')) {
        setStatusDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [statusDropdownOpen])

  const fetchStatusHistory = async () => {
    try {
      const response = await leadsAPI.getStatusHistory(lead.id)
      const historyData = response.data || []
      // Debug: log to see what we're getting
      console.log('Status History Data:', historyData)
      historyData.forEach((h, idx) => {
        console.log(`History ${idx}:`, {
          id: h.id,
          old_status: h.old_status,
          new_status: h.new_status,
          reason: h.reason,
          created_at: h.created_at
        })
      })
      setStatusHistory(historyData)
    } catch (error) {
      console.error('Error fetching status history:', error)
      // Don't show error notification, just log it
      setStatusHistory([])
    }
  }

  const handleSendMessage = async (messageType = 'whatsapp') => {
    if (!newMessage.trim()) {
      showError('Error', 'Please enter a message')
      return
    }

    try {
      setSendingMessage(true)
      await leadsAPI.sendMessageToLead(lead.id, newMessage, messageType)
      showSuccess('Message Sent', `Message sent via ${messageType}`)
      setNewMessage('')
      fetchConversations()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error sending message:', error)
      showError('Error', 'Failed to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleStatusChange = (newStatus) => {
    if (newStatus !== selectedStatus) {
      setPendingStatus(newStatus)
      setShowRemarksInput(true)
      setStatusRemarks('')
    }
  }

  const handleStatusUpdate = async () => {
    if (!pendingStatus) return
    
    try {
      setUpdatingStatus(true)
      await leadsAPI.updateLeadStatus(lead.id, pendingStatus, statusRemarks || null)
      setSelectedStatus(pendingStatus)
      setShowRemarksInput(false)
      setPendingStatus(null)
      setStatusRemarks('')
      showSuccess('Status Updated', `Lead status updated to ${pendingStatus}`)
      // Refresh status history to show the new status change with remarks
      await fetchStatusHistory()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error updating status:', error)
      showError('Error', 'Failed to update status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleCancelStatusUpdate = () => {
    setShowRemarksInput(false)
    setPendingStatus(null)
    setStatusRemarks('')
    // Reset dropdown to current status by forcing a re-render
    // The select value will automatically reset to selectedStatus when pendingStatus is null
  }

  const handleFollowUpDateChange = (e) => {
    setFollowUpDate(e.target.value)
    updateFollowUpDateTime(e.target.value, followUpTime)
  }

  const handleFollowUpTimeChange = (e) => {
    setFollowUpTime(e.target.value)
    updateFollowUpDateTime(followUpDate, e.target.value)
  }

  const updateFollowUpDateTime = async (date, time) => {
    if (!date || !time) {
      // Don't update if either is missing
      return
    }
    
    try {
      setUpdatingFollowUp(true)
      const isoDateTime = new Date(`${date}T${time}`).toISOString()
      await leadsAPI.updateFollowUp(lead.id, isoDateTime)
      setFollowUpAt(isoDateTime)
      showSuccess('Follow-up Updated', 'Follow-up date and time have been updated')
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error updating follow-up:', error)
      showError('Error', 'Failed to update follow-up date and time')
      // Revert to previous values on error
      const previousFollowUp = lead.follow_up_at || ''
      setFollowUpAt(previousFollowUp)
      if (previousFollowUp) {
        const date = new Date(previousFollowUp)
        setFollowUpDate(date.toISOString().split('T')[0])
        setFollowUpTime(date.toTimeString().slice(0, 5))
      } else {
        setFollowUpDate('')
        setFollowUpTime('')
      }
    } finally {
      setUpdatingFollowUp(false)
    }
  }

  const clearFollowUp = async () => {
    try {
      setUpdatingFollowUp(true)
      await leadsAPI.updateFollowUp(lead.id, null)
      setFollowUpAt('')
      setFollowUpDate('')
      setFollowUpTime('')
      showSuccess('Follow-up Cleared', 'Follow-up date and time have been cleared')
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error clearing follow-up:', error)
      showError('Error', 'Failed to clear follow-up date and time')
    } finally {
      setUpdatingFollowUp(false)
    }
  }

  const handleAddRemark = async () => {
    if (!newRemark.trim()) {
      showError('Error', 'Please enter a remark')
      return
    }

    try {
      setAddingRemark(true)
      await leadsAPI.addRemark(lead.id, newRemark.trim())
      setNewRemark('')
      showSuccess('Remark Added', 'Remark has been added successfully')
      // Refresh status history to show the new remark
      await fetchStatusHistory()
      if (onUpdate) onUpdate()
    } catch (error) {
      console.error('Error adding remark:', error)
      showError('Error', 'Failed to add remark')
    } finally {
      setAddingRemark(false)
    }
  }

  const formatTime = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatTimeAgo = (dateString) => {
    if (!dateString) return 'Unknown'
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInHours < 24) return `${diffInHours}h ago`
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays}d ago`
    return formatTime(dateString)
  }

  // Parse email content - handle HTML and plain text
  const parseEmailContent = (content) => {
    if (!content) return ''
    
    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }
      return text.replace(/[&<>"']/g, (m) => map[m])
    }
    
    // Check if content contains HTML tags
    const hasHtmlTags = /<[^>]+>/g.test(content)
    
    if (hasHtmlTags) {
      // Content appears to be HTML - sanitize and return
      // Basic sanitization - remove script tags and dangerous attributes
      let sanitized = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on\w+="[^"]*"/gi, '')
        .replace(/on\w+='[^']*'/gi, '')
        .replace(/javascript:/gi, '')
      
      return sanitized
    } else {
      // Plain text - convert line breaks and preserve formatting
      const escaped = escapeHtml(content)
      return escaped
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n\n+/g, '\n\n') // Multiple line breaks to double
        .split('\n')
        .map((line) => {
          // Preserve empty lines
          if (line.trim() === '') {
            return '<br />'
          }
          // Convert URLs to links (after escaping)
          const urlRegex = /(https?:\/\/[^\s<>&]+)/g
          return line.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-purple-600 hover:text-purple-800 underline">$1</a>')
        })
        .join('<br />')
    }
  }

  const getStatusConfig = (status) => {
    const configs = {
      new: {
        color: isDarkMode ? 'bg-blue-800 text-blue-300 border-blue-700' : 'bg-blue-100 text-blue-700 border-blue-200',
        bgColor: isDarkMode ? 'bg-blue-900/50' : 'bg-blue-50',
        borderColor: isDarkMode ? 'border-blue-700' : 'border-blue-200',
        label: 'New'
      },
      contacted: {
        color: isDarkMode ? 'bg-purple-800 text-purple-300 border-purple-700' : 'bg-purple-100 text-purple-700 border-purple-200',
        bgColor: isDarkMode ? 'bg-purple-900/50' : 'bg-purple-50',
        borderColor: isDarkMode ? 'border-purple-700' : 'border-purple-200',
        label: 'Contacted'
      },
      responded: {
        color: isDarkMode ? 'bg-green-800 text-green-300 border-green-700' : 'bg-green-100 text-green-700 border-green-200',
        bgColor: isDarkMode ? 'bg-green-900/50' : 'bg-green-50',
        borderColor: isDarkMode ? 'border-green-700' : 'border-green-200',
        label: 'Responded'
      },
      qualified: {
        color: isDarkMode ? 'bg-orange-800 text-orange-300 border-orange-700' : 'bg-orange-100 text-orange-700 border-orange-200',
        bgColor: isDarkMode ? 'bg-orange-900/50' : 'bg-orange-50',
        borderColor: isDarkMode ? 'border-orange-700' : 'border-orange-200',
        label: 'Qualified'
      },
      converted: {
        color: isDarkMode ? 'bg-emerald-800 text-emerald-300 border-emerald-700' : 'bg-emerald-100 text-emerald-700 border-emerald-200',
        bgColor: isDarkMode ? 'bg-emerald-900/50' : 'bg-emerald-50',
        borderColor: isDarkMode ? 'border-emerald-700' : 'border-emerald-200',
        label: 'Converted'
      },
      lost: {
        color: isDarkMode ? 'bg-gray-800 text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-700 border-gray-200',
        bgColor: isDarkMode ? 'bg-gray-900/50' : 'bg-gray-50',
        borderColor: isDarkMode ? 'border-gray-700' : 'border-gray-200',
        label: 'Lost'
      },
      invalid: {
        color: isDarkMode ? 'bg-red-800 text-red-300 border-red-700' : 'bg-red-100 text-red-700 border-red-200',
        bgColor: isDarkMode ? 'bg-red-900/50' : 'bg-red-50',
        borderColor: isDarkMode ? 'border-red-700' : 'border-red-200',
        label: 'Invalid'
      }
    }
    return configs[status] || configs.new
  }

  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'facebook':
        return <Facebook className="w-5 h-5 text-white" />
      case 'instagram':
        return <Instagram className="w-5 h-5 text-white" />
      case 'walk_ins':
      case 'walk-ins':
        return <LogIn className="w-5 h-5 text-white" />
      case 'referral':
        return <Users className="w-5 h-5 text-white" />
      case 'email':
        return <Mail className="w-5 h-5 text-white" />
      case 'website':
        return <Globe className="w-5 h-5 text-white" />
      case 'phone_call':
      case 'phone-call':
      case 'phone call':
        return <Phone className="w-5 h-5 text-white" />
      default:
        return <User className="w-5 h-5 text-white" />
    }
  }

  // Deduplicate status history entries
  // Remove duplicates based on ID (if available) or combination of old_status, new_status, and created_at
  const deduplicatedStatusHistory = statusHistory.reduce((acc, current) => {
    // If ID exists, use it for deduplication
    if (current.id) {
      const isDuplicate = acc.some(item => item.id === current.id)
      if (!isDuplicate) {
        acc.push(current)
      }
    } else {
      // Fallback: use old_status, new_status, and created_at (within 5 seconds to catch duplicates)
      const isDuplicate = acc.some(item => 
        item.old_status === current.old_status &&
        item.new_status === current.new_status &&
        Math.abs(new Date(item.created_at) - new Date(current.created_at)) < 5000 // Within 5 seconds
      )
      if (!isDuplicate) {
        acc.push(current)
      }
    }
    return acc
  }, [])

  // Build timeline from conversations and status changes
  // Determine if lead is manual or from social media
  const isManualLead = lead.source_platform === 'manual'
  const isSocialMediaLead = ['facebook', 'instagram'].includes(lead.source_platform?.toLowerCase())
  
  // Format Chase's message based on lead source
  const getChaseMessage = () => {
    const timeStr = formatTime(lead.created_at)
    const leadName = lead.name || 'Unknown'
    
    if (isManualLead) {
      return {
        text: `Hi, I am Chase, your leads manager. You just entered a new lead manually for `,
        boldPart: leadName,
        textAfter: ` at `,
        boldTime: timeStr,
        textEnd: `.`
      }
    } else if (isSocialMediaLead) {
      const platformName = lead.source_platform.charAt(0).toUpperCase() + lead.source_platform.slice(1)
      return {
        text: `Hi, I am Chase, your leads manager. I just captured a new lead from ${platformName} for `,
        boldPart: leadName,
        textAfter: ` at `,
        boldTime: timeStr,
        textEnd: `.`
      }
    } else {
      // Fallback for other platforms
      const platformName = lead.source_platform?.charAt(0).toUpperCase() + lead.source_platform?.slice(1) || 'Unknown'
      return {
        text: `Hi, I am Chase, your leads manager. I just captured a new lead from ${platformName} for `,
        boldPart: leadName,
        textAfter: ` at `,
        boldTime: timeStr,
        textEnd: `.`
      }
    }
  }

  const chaseMessage = getChaseMessage()
  const timeline = [
    {
      type: 'lead_captured',
      title: 'Chase',
      description: chaseMessage,
      timestamp: lead.created_at,
      icon: Bot,
      color: 'text-purple-600 bg-purple-50'
    },
    ...deduplicatedStatusHistory.flatMap(history => {
      const timeStr = formatTime(history.created_at)
      const oldStatus = history.old_status?.toLowerCase() || ''
      const newStatus = history.new_status?.toLowerCase() || ''
      // Get remarks from reason column - handle both reason and remarks fields
      const remarks = (history.reason || history.remarks || '').trim()
      
      // Debug: log remarks for each history entry
      if (remarks) {
        console.log('Found remarks in history:', {
          id: history.id,
          old_status: oldStatus,
          new_status: newStatus,
          reason: history.reason,
          remarks: remarks,
          created_at: history.created_at
        })
      }
      
      // Check if this is a remark-only entry (same status, but has remarks)
      const isRemarkOnly = oldStatus === newStatus && remarks
      
      // Format all status changes as Chase messages
      // Capitalize status names for display
      const capitalizeStatus = (status) => {
        if (!status) return ''
        return status.charAt(0).toUpperCase() + status.slice(1)
      }
      
      // Build the message based on status change
      let statusText = ''
      if (newStatus === 'contacted') {
        statusText = 'Contacted'
      } else if (newStatus === 'responded') {
        statusText = 'Responded'
      } else if (newStatus === 'qualified') {
        statusText = 'Qualified'
      } else if (newStatus === 'converted') {
        statusText = 'Converted'
      } else if (newStatus === 'lost') {
        statusText = 'Lost'
      } else if (newStatus === 'invalid') {
        statusText = 'Invalid'
      } else {
        statusText = capitalizeStatus(newStatus)
      }
      
      // Format message: if remarks exist, show them first, otherwise show status
      // Ensure remarks is not empty after trimming
      const hasRemarks = remarks && remarks.trim().length > 0

      // Only show remarks as separate timeline entries
      const timelineEntries = []

      // Only create timeline entries for remarks (whether with status change or not)
      if (hasRemarks) {
        const isStatusChange = oldStatus !== newStatus
        const messageText = isStatusChange
          ? `Changed status to: ${statusText} and added note at `
          : 'Added remark at '

        timelineEntries.push({
          type: 'remark',
          title: 'Chase',
          description: {
            text: messageText,
            boldPart: '',
            textAfter: '',
            boldTime: timeStr,
            textEnd: '.'
          },
          remarks: remarks.trim(),
          remarksText: remarks.trim(),
          timestamp: history.created_at,
          icon: Bot,
          color: 'text-purple-600 bg-purple-50',
          oldStatus: history.old_status,
          newStatus: history.new_status,
          isChaseMessage: true,
          isStatusChangeWithRemark: isStatusChange
        })
      }
      // Don't show status changes without remarks

      return timelineEntries
    }),
    ...conversations.map(conv => {
      // Format email messages as Chase messages
      if (conv.message_type === 'email' && conv.sender === 'agent') {
        const recipientName = lead.name || 'the lead'
        const messageContent = conv.content || ''
        const timeStr = formatTime(conv.created_at)
        
        return {
          type: conv.message_type,
          title: 'Chase',
          description: {
            text: 'Sent an email to ',
            boldPart: recipientName,
            textAfter: ' with the message ',
            boldMessage: messageContent,
            textAfter2: ' at ',
            boldTime: timeStr,
            textEnd: '.'
          },
          timestamp: conv.created_at,
          icon: Bot,
          color: 'text-purple-600 bg-purple-50',
          status: conv.status,
          fullContent: conv.content,
          isChaseMessage: true
        }
      }
      
      // Default format for other conversations
      return {
        type: conv.message_type,
        title: conv.sender === 'agent' ? `${conv.message_type === 'email' ? 'Email' : 'WhatsApp'} Sent` : 'Lead Responded',
        description: conv.content.substring(0, 100) + (conv.content.length > 100 ? '...' : ''),
        timestamp: conv.created_at,
        icon: conv.message_type === 'email' ? MailIcon : MessageSquare,
        color: conv.sender === 'agent' ? 'text-purple-600 bg-purple-50' : 'text-pink-600 bg-pink-50',
        status: conv.status,
        fullContent: conv.content,
        isChaseMessage: false
      }
    })
  ].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))

  const emailConversations = conversations.filter(c => c.message_type === 'email')
  const whatsappConversations = conversations.filter(c => c.message_type === 'whatsapp')

  const statusConfig = getStatusConfig(selectedStatus || lead.status)

  return (
    <div className={`fixed ${isDarkMode ? 'bg-gray-900 bg-opacity-75' : 'bg-black bg-opacity-50'} flex items-center justify-center z-50 p-4 overflow-y-auto md:left-48 xl:left-64`} style={{ right: '0', top: '0', bottom: '0' }}>
      <div className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-2xl max-w-6xl w-full h-[80vh] flex flex-col overflow-hidden p-4`}>
        {/* Two Column Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Column - Lead Details */}
          <div className={`w-1/3 ${statusConfig.bgColor} ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} flex flex-col rounded-xl overflow-hidden`}>
            <style>{`
              /* Style date and time input icons */
              input[type="date"]::-webkit-calendar-picker-indicator,
              input[type="time"]::-webkit-calendar-picker-indicator {
                cursor: pointer;
                opacity: 0.7;
                filter: ${isDarkMode ? 'invert(1)' : 'none'};
              }
              input[type="date"]::-webkit-inner-spin-button,
              input[type="time"]::-webkit-inner-spin-button {
                opacity: 0.7;
                filter: ${isDarkMode ? 'invert(1)' : 'none'};
              }
              input[type="date"]::-moz-calendar-picker-indicator,
              input[type="time"]::-moz-calendar-picker-indicator {
                cursor: pointer;
                opacity: 0.7;
                filter: ${isDarkMode ? 'invert(1)' : 'none'};
              }
            `}</style>
            {/* Header Section */}
            <div className={`p-6 border-b ${isDarkMode ? 'border-gray-600' : statusConfig.borderColor}`}>
            <div className="flex items-center space-x-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center shadow-md">
                {getPlatformIcon(lead.source_platform)}
              </div>
              <div>
                  <h2 className={`text-2xl font-normal ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                  {lead.name || 'Unknown Lead'}
                </h2>
                {/* Contact Information */}
                {(lead.email || lead.phone_number) && (
                    <div className={`flex flex-col gap-1.5 mt-2 text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    {lead.email && (
                        <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3" />
                        <span>{lead.email}</span>
                      </div>
                    )}
                    {lead.phone_number && (
                        <div className="flex items-center gap-1.5">
                        <Phone className="w-3 h-3" />
                        <span>{lead.phone_number}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

            {/* Status and Follow-up Section */}
            <div className="p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Status */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Status</label>
                <div className="relative status-dropdown-container">
                  <button
                    onClick={() => !updatingStatus && !showRemarksInput && setStatusDropdownOpen(!statusDropdownOpen)}
                    disabled={updatingStatus || showRemarksInput}
                    className={`px-3 py-1.5 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100' : `bg-white border ${statusConfig.borderColor} text-gray-900`} rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:opacity-50 flex items-center space-x-2 min-w-[140px] justify-between`}
                  >
                    <span className="capitalize">{pendingStatus || selectedStatus}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Custom Dropdown with Glassmorphism */}
                  {statusDropdownOpen && (
                    <div 
                      className="absolute top-full mt-2 left-0 w-full min-w-[160px] z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="bg-white/95 backdrop-blur-lg border border-white/40 rounded-lg shadow-2xl overflow-hidden ring-1 ring-black/5">
                        <div className="py-1">
                          {[
                            { value: 'new', label: 'New' },
                            { value: 'contacted', label: 'Contacted' },
                            { value: 'responded', label: 'Responded' },
                            { value: 'qualified', label: 'Qualified' },
                            { value: 'converted', label: 'Converted' },
                            { value: 'lost', label: 'Lost' },
                            { value: 'invalid', label: 'Invalid' }
                          ].map((option) => (
                            <button
                              key={option.value}
                              onClick={(e) => {
                                e.stopPropagation()
                                handleStatusChange(option.value)
                                setStatusDropdownOpen(false)
                              }}
                              disabled={updatingStatus || showRemarksInput}
                              className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors flex items-center space-x-2 ${
                                (pendingStatus || selectedStatus) === option.value
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'text-gray-700 hover:bg-purple-50 hover:text-purple-700'
                              } ${updatingStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                            >
                              <span className="capitalize">{option.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-gray-600 mt-2" />}
              </div>

              {/* Follow-up Date & Time */}
              <div className="space-y-2">
                <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Follow-up</label>
                <div className="flex items-center gap-2 flex-nowrap">
                  <input
                    type="date"
                    value={followUpDate}
                    onChange={handleFollowUpDateChange}
                    disabled={updatingFollowUp}
                    className={`flex-1 min-w-0 px-3 py-1.5 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : `bg-white border ${statusConfig.borderColor} text-gray-900 placeholder-gray-400`} rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:opacity-50`}
                    placeholder="Date"
                  />
                  <input
                    type="time"
                    value={followUpTime}
                    onChange={handleFollowUpTimeChange}
                    disabled={updatingFollowUp}
                    className={`flex-1 min-w-0 px-3 py-1.5 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : `bg-white border ${statusConfig.borderColor} text-gray-900 placeholder-gray-400`} rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-opacity-50 disabled:opacity-50`}
                    placeholder="Time"
                  />
                </div>
                  {followUpAt && (
                    <button
                      onClick={clearFollowUp}
                      disabled={updatingFollowUp}
                    className={`w-full px-2 py-1.5 bg-white hover:opacity-80 border ${statusConfig.borderColor} rounded-lg text-gray-700 text-xs font-medium transition-colors disabled:opacity-50`}
                      title="Clear follow-up"
                    >
                    Clear Follow-up
                    </button>
                  )}
                {updatingFollowUp && <Loader2 className="w-4 h-4 animate-spin text-gray-600 mx-auto" />}
                </div>

            </div>
            
            {/* Remarks Input */}
            {showRemarksInput && pendingStatus && (
              <div className={`mt-3 ${isDarkMode ? 'bg-gray-700' : 'bg-white'} rounded-lg p-3 space-y-2 border ${isDarkMode ? 'border-gray-600' : statusConfig.borderColor}`}>
                <div className="flex items-center justify-between">
                  <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    Changing status to: <span className="capitalize font-normal">{pendingStatus}</span>
                  </label>
                </div>
                <label className={`text-sm font-medium ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Remarks (Optional)</label>
                <textarea
                  value={statusRemarks}
                  onChange={(e) => setStatusRemarks(e.target.value)}
                  placeholder="Add remarks about this status change..."
                  rows={3}
                  className={`w-full px-3 py-2 ${isDarkMode ? 'bg-gray-600 border-gray-500 text-gray-100 placeholder-gray-400' : `bg-white border ${statusConfig.borderColor} text-gray-900 placeholder-gray-400`} rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 resize-none`}
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleStatusUpdate}
                    disabled={updatingStatus}
                    className={`flex-1 px-4 py-2 ${statusConfig.color.split(' ')[0]} hover:opacity-90 border ${statusConfig.borderColor} rounded-lg text-white font-medium transition-colors disabled:opacity-50`}
                  >
                    {updatingStatus ? 'Updating...' : 'Save Status Change'}
                  </button>
                  <button
                    onClick={handleCancelStatusUpdate}
                    disabled={updatingStatus}
                    className={`px-4 py-2 bg-white hover:opacity-80 border ${statusConfig.borderColor} rounded-lg text-gray-700 font-medium transition-colors disabled:opacity-50`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Add Remarks Section - Hide when status change is selected */}
            {!(showRemarksInput && pendingStatus) && (
              <div className="mt-3 px-6 pb-6 space-y-2">
                <textarea
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Add a remark about this lead..."
                  rows={3}
                  className={`w-full px-3 py-2 ${isDarkMode ? 'bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400' : `bg-white border ${statusConfig.borderColor} text-gray-900 placeholder-gray-400`} rounded-lg focus:outline-none focus:ring-2 focus:ring-opacity-50 resize-none`}
                />
                <button
                  onClick={handleAddRemark}
                  disabled={addingRemark || !newRemark.trim()}
                  className="w-full px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 border border-pink-300 rounded-lg text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {addingRemark ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4" />
                      <span>Add Remark</span>
                    </>
                  )}
                </button>
          </div>
            )}
        </div>

          {/* Right Column - Tabs and Content */}
          <div className={`w-2/3 ${isDarkMode ? 'bg-gray-800' : 'bg-white'} flex flex-col relative`}>
            {/* Close Button */}
            <button
              onClick={onClose}
              className={`absolute top-2 right-4 p-2 ${isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'} rounded-lg transition-colors z-10`}
            >
              <X className={`w-6 h-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`} />
            </button>

        {/* Tabs */}
            <div className={`border-b ${isDarkMode ? 'border-gray-600' : 'border-gray-200'} flex space-x-1 px-6 bg-transparent`}>
          {[
            { id: 'timeline', label: 'Timeline', icon: Clock },
            { id: 'conversations', label: 'Conversations', icon: MessageCircle },
            { id: 'email', label: 'Email', icon: MailIcon }
          ].map(tab => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-purple-600 text-white'
                    : `border-transparent ${isDarkMode ? 'text-gray-400 hover:text-purple-400' : 'text-gray-600 hover:text-purple-600'}`
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              {loadingConversations ? (
                <div className="flex flex-col items-start w-full mb-4">
                  <div className="flex items-start gap-2 max-w-[90%] justify-start">
                    {/* Chase Logo */}
                    <div className="flex-shrink-0">
                      <img
                        src="/chase_logo.png"
                        alt="Chase"
                        className="w-8 h-8 object-contain rounded-full shadow-md"
                      />
                    </div>
                    {/* Message Bubble */}
                    <div className={`px-4 py-3 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'} chatbot-bubble-shadow`}>
                      <p className="text-sm leading-relaxed">
                        Loading timeline...
                      </p>
                    </div>
                  </div>
                </div>
              ) : timeline.length === 0 ? (
                <div className="text-center py-12">
                  <Clock className={`w-12 h-12 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'} mx-auto mb-3`} />
                  <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>No timeline events yet</p>
                </div>
              ) : (
                <div className="relative">
                  {timeline.map((event, index) => {
                    const Icon = event.icon
                    const isChaseMessage = event.type === 'lead_captured' || event.isChaseMessage
                    
                    if (isChaseMessage) {
                      // Render Chase message as chatbot-style bubble
                      return (
                        <div key={index} className="flex flex-col items-start w-full mb-4">
                          <div className="flex items-start gap-2 max-w-[90%] justify-start">
                            {/* Chase Logo */}
                            <div className="flex-shrink-0">
                              <img
                                src="/chase_logo.png"
                                alt="Chase"
                                className="w-8 h-8 object-contain rounded-full shadow-md"
                              />
                            </div>
                            {/* Message Bubble */}
                            <div className={`px-4 py-3 rounded-lg ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-white text-black'} chatbot-bubble-shadow`}>
                              <p className="text-sm leading-relaxed">
                                {typeof event.description === 'object' ? (
                                  <>
                                    {event.description.text}
                                    <strong>{event.description.boldPart}</strong>
                                    {event.description.textAfter}
                                    {event.description.boldMessage ? (
                                      <div className={`mt-2 p-2 ${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-gray-50 border-gray-200'} border rounded text-xs`}>
                                        <div
                                          className={isDarkMode ? 'text-gray-200' : 'text-gray-800'}
                                          dangerouslySetInnerHTML={{ __html: event.description.boldMessage }}
                                        />
                                      </div>
                                    ) : null}
                                    {event.description.textAfter2}
                                    {event.description.boldTime ? (
                                      <strong>{event.description.boldTime}</strong>
                                    ) : null}
                                    {event.description.textEnd}
                                  </>
                                ) : (
                                  event.description
                                )}
                              </p>
                              {/* Show remarks content for remark-type Chase messages */}
                              {event.type === 'remark' && event.remarks && (
                                <div className={`mt-3 p-3 ${isDarkMode ? 'bg-gray-600 border-gray-500' : 'bg-gray-50 border-gray-200'} border rounded-lg`}>
                                  <p className={`text-sm ${isDarkMode ? 'text-gray-200' : 'text-gray-800'} font-medium`}>
                                    {event.remarks}
                                  </p>
                                </div>
                              )}
                              {event.timestamp && (
                                <div className="mt-2">
                                  <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                    {formatTimeAgo(event.timestamp)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    }
                    
                    // Render other timeline events in original style
                    // Debug: log event data for status changes and remarks
                    if ((event.type === 'status_change' || event.type === 'remark')) {
                      console.log('Rendering timeline event:', {
                        type: event.type,
                        remarks: event.remarks,
                        remarksText: event.remarksText,
                        hasRemarks: !!(event.remarks || event.remarksText),
                        fullEvent: event
                      })
                    }
                    
                    return (
                      <div key={index} className="relative flex items-start space-x-4 mb-6">
                        <div className={`relative z-10 w-8 h-8 rounded-full ${event.color} flex items-center justify-center flex-shrink-0`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 bg-gradient-to-r from-pink-50 to-purple-50 rounded-lg p-4 border border-purple-200">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-normal text-gray-900">{event.title}</h4>
                            <span className="text-xs text-gray-500">{formatTimeAgo(event.timestamp)}</span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {typeof event.description === 'object' ? (
                              <>
                                {event.description.text}
                                <strong>{event.description.boldPart}</strong>
                                {event.description.textAfter}
                                {event.description.boldTime ? (
                                  <strong>{event.description.boldTime}</strong>
                                ) : null}
                                {event.description.textEnd}
                              </>
                            ) : (
                              event.description
                            )}
                          </p>
                          {/* Show remarks content for remark-type entries */}
                          {event.type === 'remark' && event.remarks && (
                            <div className="mt-3 p-3 bg-white/60 rounded-lg border border-blue-200">
                              <p className="text-sm text-gray-700 font-medium">
                                {event.remarks}
                              </p>
                            </div>
                          )}
                          {/* Show remarks for status changes if they exist */}
                          {event.type === 'status_change' && event.remarksText && (
                            <div className="mt-3 p-3 bg-white/60 rounded-lg border border-blue-200">
                              <p className="text-sm text-gray-700 font-medium">
                                {event.remarksText}
                              </p>
                            </div>
                          )}
                          {event.status && (
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${
                                event.status === 'sent' ? 'bg-purple-100 text-purple-700' :
                                event.status === 'delivered' ? 'bg-green-100 text-green-700' :
                                event.status === 'read' ? 'bg-pink-100 text-pink-700' :
                                'bg-gray-100 text-gray-700'
                              }`}>
                                {event.status}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'conversations' && (
            <div className="space-y-6">
              {/* Send Message */}
              <div className={`${isDarkMode ? 'bg-gradient-to-r from-gray-700 to-gray-600 border-gray-600' : 'bg-gradient-to-r from-pink-50 to-purple-50 border-purple-200'} rounded-lg p-4 border`}>
                <h3 className={`text-sm font-normal ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} mb-3`}>Send Message</h3>
                <div className="space-y-3">
                  <textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Type your message..."
                    rows={3}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isDarkMode ? 'border-gray-500 bg-gray-600 text-gray-100 placeholder-gray-400' : 'border-gray-300'}`}
                  />
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleSendMessage('whatsapp')}
                      disabled={sendingMessage || !newMessage.trim() || !lead.phone_number}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-purple-600 text-white rounded-lg hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <MessageSquare className="w-4 h-4" />
                          <span>Send WhatsApp</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleSendMessage('email')}
                      disabled={sendingMessage || !newMessage.trim() || !lead.email}
                      className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                    >
                      {sendingMessage ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <MailIcon className="w-4 h-4" />
                          <span>Send Email</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Email Conversations */}
              {emailConversations.length > 0 && (
                <div>
                  <h3 className="text-lg font-normal text-white mb-4 flex items-center space-x-2">
                    <MailIcon className="w-5 h-5" />
                    <span>Email ({emailConversations.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {emailConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-4 rounded-lg border w-[90%] ${
                          conv.sender === 'agent' ? 'bg-gradient-to-r from-pink-100 to-purple-100 ml-auto border-purple-200' : 'bg-gray-50 mr-auto border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {conv.sender === 'agent' ? 'You' : lead.name || 'Lead'}
                          </span>
                          <span className="text-xs text-gray-500">{formatTimeAgo(conv.created_at)}</span>
                        </div>
                        <div 
                          className="text-sm text-gray-700 email-content prose prose-sm max-w-none"
                          dangerouslySetInnerHTML={{ __html: parseEmailContent(conv.content) }}
                          style={{
                            wordWrap: 'break-word',
                            overflowWrap: 'break-word',
                            lineHeight: '1.6'
                          }}
                        />
                        {conv.status && (
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              conv.status === 'sent' ? 'bg-purple-100 text-purple-700' :
                              conv.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              conv.status === 'read' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {conv.status}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* WhatsApp Conversations */}
              {whatsappConversations.length > 0 && (
                <div>
                  <h3 className="text-lg font-normal text-white mb-4 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5" />
                    <span>WhatsApp ({whatsappConversations.length})</span>
                  </h3>
                  <div className="space-y-3">
                    {whatsappConversations.map((conv) => (
                      <div
                        key={conv.id}
                        className={`p-4 rounded-lg border w-[90%] ${
                          conv.sender === 'agent' ? 'bg-gradient-to-r from-pink-100 to-purple-100 ml-auto border-purple-200' : 'bg-gray-50 mr-auto border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {conv.sender === 'agent' ? 'You' : lead.name || 'Lead'}
                          </span>
                          <span className="text-xs text-gray-500">{formatTimeAgo(conv.created_at)}</span>
                        </div>
                        <p className="text-sm text-gray-700">{conv.content}</p>
                        {conv.status && (
                          <div className="mt-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              conv.status === 'sent' ? 'bg-purple-100 text-purple-700' :
                              conv.status === 'delivered' ? 'bg-green-100 text-green-700' :
                              conv.status === 'read' ? 'bg-pink-100 text-pink-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {conv.status}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {conversations.length === 0 && !loadingConversations && (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No conversations yet</p>
                </div>
              )}
              <style>{`
                .email-content p {
                  margin: 0.5rem 0;
                  color: #374151;
                }
                .email-content p:first-child {
                  margin-top: 0;
                }
                .email-content p:last-child {
                  margin-bottom: 0;
                }
                .email-content a {
                  color: #9333ea;
                  text-decoration: underline;
                }
                .email-content a:hover {
                  color: #7e22ce;
                }
                .email-content ul, .email-content ol {
                  margin: 0.5rem 0;
                  padding-left: 1.5rem;
                }
                .email-content li {
                  margin: 0.25rem 0;
                }
                .email-content br {
                  line-height: 1.6;
                }
                .email-content strong, .email-content b {
                  font-weight: 600;
                }
                .email-content em, .email-content i {
                  font-style: italic;
                }
                /* Style date and time input icons to be white */
                input[type="date"]::-webkit-calendar-picker-indicator,
                input[type="time"]::-webkit-calendar-picker-indicator {
                  filter: invert(1);
                  cursor: pointer;
                }
                input[type="date"]::-webkit-inner-spin-button,
                input[type="time"]::-webkit-inner-spin-button {
                  filter: invert(1);
                }
                input[type="date"]::-moz-calendar-picker-indicator,
                input[type="time"]::-moz-calendar-picker-indicator {
                  filter: invert(1);
                  cursor: pointer;
                }
              `}</style>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-6">
              {/* Email Generation Section */}
              <div className={`${isDarkMode ? 'bg-gradient-to-r from-gray-700 to-gray-600 border-gray-600' : 'bg-gradient-to-r from-pink-50 to-purple-50 border-purple-200'} rounded-lg p-6 border`}>
                <h3 className={`text-lg font-normal ${isDarkMode ? 'text-gray-100' : 'text-gray-900'} mb-4 flex items-center space-x-2`}>
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <span>Generate Personalized Email</span>
                </h3>
                
                {/* Template Selection */}
                <div className="space-y-4">
                  <div>
                    <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} mb-2`}>
                      Email Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => {
                        setSelectedCategory(e.target.value)
                        setGeneratedEmail(null)
                      }}
                      className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${isDarkMode ? 'border-gray-500 bg-gray-600 text-gray-100' : 'border-gray-300'}`}
                    >
                      <option value="general">General</option>
                      <option value="welcome">Welcome</option>
                      <option value="follow-up">Follow-up</option>
                      <option value="product-inquiry">Product/Service Inquiry</option>
                      <option value="pricing">Pricing Information</option>
                      <option value="demo">Demo Request</option>
                      <option value="support">Support</option>
                      <option value="newsletter">Newsletter</option>
                      <option value="promotional">Promotional</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Template
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => {
                        setSelectedTemplate(e.target.value)
                        setGeneratedEmail(null)
                      }}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    >
                      {emailTemplates.map(template => (
                        <option key={template.id} value={template.id}>
                          {template.name} - {template.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Custom Prompt Toggle */}
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="useCustomPrompt"
                      checked={useCustomPrompt}
                      onChange={(e) => {
                        setUseCustomPrompt(e.target.checked)
                        setGeneratedEmail(null)
                      }}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label htmlFor="useCustomPrompt" className="text-sm font-medium text-gray-700">
                      Use Custom Prompt
                    </label>
                  </div>

                  {/* Custom Prompt Input */}
                  {useCustomPrompt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custom Prompt Instructions
                      </label>
                      <textarea
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        placeholder="Describe exactly what you want in the email, e.g., 'A friendly follow-up email asking about their interest in our premium plan, mentioning the 30-day free trial, and asking for a call to discuss their needs'"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Custom Template Input */}
                  {selectedTemplate === 'custom' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Custom Template Instructions
                      </label>
                      <textarea
                        value={customTemplate}
                        onChange={(e) => setCustomTemplate(e.target.value)}
                        placeholder="Describe the type of email you want to generate, e.g., 'A follow-up email about our premium service offering'"
                        rows={4}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>
                  )}

                  {/* Generate Button */}
                  <button
                    onClick={handleGenerateEmail}
                    disabled={generatingEmail || (selectedTemplate === 'custom' && !customTemplate.trim()) || (useCustomPrompt && !customPrompt.trim()) || !lead.email}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {generatingEmail ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>Generate Email</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Previous Emails Section */}
              {previousEmails.length > 0 && !generatedEmail && (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                  <h3 className="text-lg font-normal text-gray-900 mb-4 flex items-center space-x-2">
                    <MailIcon className="w-5 h-5 text-purple-600" />
                    <span>Use Previous Email as Template</span>
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {previousEmails.map((email) => (
                      <button
                        key={email.id}
                        onClick={() => handleUsePreviousEmail(email)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedPreviousEmail === email.id
                            ? 'bg-purple-50 border-purple-300'
                            : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{email.subject}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{email.body.replace(/<[^>]*>/g, '').substring(0, 100)}...</p>
                          </div>
                          <span className="text-xs text-gray-400 ml-2">{new Date(email.date).toLocaleDateString()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated Email Preview */}
              {generatedEmail && (
                <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-normal text-gray-900 flex items-center space-x-2">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <span>{isEditing ? 'Edit Email' : 'Email Preview'}</span>
                    </h3>
                    <div className="flex items-center space-x-2">
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setIsEditing(true)
                            setEditableSubject(generatedEmail.subject)
                            setEditableBody(generatedEmail.body)
                          }}
                          className="px-3 py-1.5 text-sm text-purple-600 hover:bg-purple-50 rounded-lg border border-purple-200"
                        >
                          Edit
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setGeneratedEmail(null)
                          setEditableSubject('')
                          setEditableBody('')
                          setIsEditing(false)
                        }}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Subject
                      </label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editableSubject}
                          onChange={(e) => setEditableSubject(e.target.value)}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Email subject"
                        />
                      ) : (
                        <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-900">
                          {generatedEmail.subject}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Body
                      </label>
                      {isEditing ? (
                        <textarea
                          value={editableBody}
                          onChange={(e) => setEditableBody(e.target.value)}
                          rows={12}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                          placeholder="Email body (HTML supported)"
                        />
                      ) : (
                        <div 
                          className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 max-h-96 overflow-y-auto email-preview"
                          style={{ 
                            lineHeight: '1.6',
                            fontSize: '14px'
                          }}
                          dangerouslySetInnerHTML={{ 
                            __html: generatedEmail.body || ''
                          }}
                        />
                      )}
                      <style>{`
                        .email-preview p {
                          margin: 0.75rem 0;
                          color: #374151;
                        }
                        .email-preview p:first-child {
                          margin-top: 0;
                        }
                        .email-preview p:last-child {
                          margin-bottom: 0;
                        }
                        .email-preview a {
                          color: #9333ea;
                          text-decoration: underline;
                        }
                        .email-preview ul, .email-preview ol {
                          margin: 0.75rem 0;
                          padding-left: 1.5rem;
                        }
                        .email-preview li {
                          margin: 0.5rem 0;
                        }
                        .email-preview br {
                          line-height: 1.6;
                        }
                      `}</style>
                    </div>

                    {isEditing && (
                      <div className="flex space-x-3">
                        <button
                          onClick={handleSaveEdits}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 shadow-md"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>Save Changes</span>
                        </button>
                        <button
                          onClick={() => {
                            setIsEditing(false)
                            setEditableSubject(generatedEmail.subject)
                            setEditableBody(generatedEmail.body)
                          }}
                          className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}

                    <div className="flex space-x-3 pt-4">
                      <button
                        onClick={handleSendGeneratedEmail}
                        disabled={sendingEmail || (isEditing && (!editableSubject || !editableBody))}
                        className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                      >
                        {sendingEmail ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            <span>Send Email</span>
                          </>
                        )}
                      </button>
                      {!isEditing && (
                        <button
                          onClick={handleGenerateEmail}
                          disabled={generatingEmail}
                          className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                        >
                          {generatingEmail ? (
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Regenerating...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-5 h-5" />
                              <span>Regenerate</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* No Email Generated State */}
              {!generatedEmail && (
                <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                  <MailIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 mb-2">No email generated yet</p>
                  <p className="text-sm text-gray-400">Select a template and click "Generate Email" to create a personalized email for this lead</p>
                </div>
              )}
            </div>
          )}
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .chatbot-bubble-shadow {
          box-shadow: 0 0 8px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </div>
  )
}

export default LeadDetailModal

