import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { supabase } from '../lib/supabase'
import { Send, ArrowRight, User, Bot, RefreshCw, MessageCircle, Clock, AlertCircle, Trash2, Square, CheckSquare, Edit, Share, Calendar, Save, Copy, Upload, Video, Mail, Phone, Heart, X, Download } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ContentCard from './ContentCard'
import ATSNContentCard from './ATSNContentCard'
import ATSNContentModal from './ATSNContentModal'
import ReelModal from './ReelModal'
import LeadCard from './LeadCard'
import MultiMediaUpload from './MultiMediaUpload'
import CharacterCard from './CharacterCard'
import { leadsAPI } from '../services/leads'
import { connectionsAPI } from '../services/connections'
import { mediaAPI } from '../services/api'

// Get dark mode state from localStorage or default to dark mode
const getDarkModePreference = () => {
  const saved = localStorage.getItem('darkMode')
  return saved !== null ? saved === 'true' : true // Default to true (dark mode)
}

// Listen for storage changes to sync dark mode across components
const useStorageListener = (key, callback) => {
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key) {
        callback(e.newValue === 'true')
      }
    }

    window.addEventListener('storage', handleStorageChange)

    // Also listen for custom events for same-tab updates
    const handleCustomChange = (e) => {
      if (e.detail.key === key) {
        callback(e.detail.newValue === 'true')
      }
    }

    window.addEventListener('localStorageChange', handleCustomChange)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageChange', handleCustomChange)
    }
  }, [key, callback])
}

// Get API URL
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL
  if (envUrl) {
    if (envUrl.startsWith(':')) {
      return `http://localhost${envUrl}`
    }
    if (!envUrl.startsWith('http://') && !envUrl.startsWith('https://')) {
      return `http://${envUrl}`
    }
    return envUrl
  }
  return 'http://localhost:8000'
}
const API_BASE_URL = getApiBaseUrl().replace(/\/$/, '')

const ATSNChatbot = ({ externalConversations = null }) => {
  const { user } = useAuth()
  const { showError, showSuccess } = useNotifications()
  const [messages, setMessages] = useState([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [conversationHistory, setConversationHistory] = useState([])
  const [agentStatus, setAgentStatus] = useState(null)
  const [selectedContent, setSelectedContent] = useState([])
  const [selectedLeadId, setSelectedLeadId] = useState(null)
  const [selectedLeads, setSelectedLeads] = useState([])
  const [leadFilters, setLeadFilters] = useState({
    status: '',
    source: '',
    search: '',
    dateFrom: '',
    dateTo: ''
  })
  const [fetchedLeads, setFetchedLeads] = useState({})
  const [isDeleting, setIsDeleting] = useState(false)
  const [isScheduling, setIsScheduling] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showEditLeadModal, setShowEditLeadModal] = useState(false)
  const [editLeadData, setEditLeadData] = useState(null)
  const [scheduleData, setScheduleData] = useState({ date: '', time: '', contentId: null })
  const [currentRequestIntent, setCurrentRequestIntent] = useState(null)
  const [lastSentMessage, setLastSentMessage] = useState('')
  const [showContentModal, setShowContentModal] = useState(false)
  const [showReelModal, setShowReelModal] = useState(false)
  const [chatReset, setChatReset] = useState(false) // Track if chat was reset
  const [freshReset, setFreshReset] = useState(false) // Track if chat was just reset to prevent loading conversations
  const [resetTimestamp, setResetTimestamp] = useState(null) // Track when reset happened
  const [selectedContentForModal, setSelectedContentForModal] = useState(null)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedDateRange, setSelectedDateRange] = useState({ start: '', end: '' })
  const [showSingleDatePicker, setShowSingleDatePicker] = useState(false)
  const [selectedSingleDate, setSelectedSingleDate] = useState('')
  const [thinkingPhase, setThinkingPhase] = useState(0) // 0: assigning, 1: contacting, 2: invoking, 3: working
  const [isFirstMessage, setIsFirstMessage] = useState(true) // Track if this is the first message in session
  const [showMediaUploadModal, setShowMediaUploadModal] = useState(false)
  const [showPublishSuccessModal, setShowPublishSuccessModal] = useState(false)
  const [publishSuccessData, setPublishSuccessData] = useState(null)

  // Daily conversation caching system
  const [messageCache, setMessageCache] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]) // YYYY-MM-DD format

  // Get cache key for current day
  const getDailyCacheKey = (userId) => `conversation_cache_${userId}_${currentDate}`

  // Save messages to daily localStorage cache
  const saveMessagesToCache = (messages) => {
    if (user && messages.length > 0) {
      const cacheKey = getDailyCacheKey(user.id)
      localStorage.setItem(cacheKey, JSON.stringify(messages))
      console.log(`Saved ${messages.length} messages to daily cache for ${currentDate}`)
    }
  }
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [saveStatus, setSaveStatus] = useState('saved') // 'saved', 'saving', 'unsaved', 'error'
  const [uploadedMediaUrls, setUploadedMediaUrls] = useState([])
  const [selectedFilesForUpload, setSelectedFilesForUpload] = useState([])
  const [businessName, setBusinessName] = useState('') // Business name from profile
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [tooltipAgent, setTooltipAgent] = useState(null)
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 })
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)
  const [likedMessages, setLikedMessages] = useState(new Set())
  const [agentProfiles, setAgentProfiles] = useState({}) // Agent profiles with likes and tasks data
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastExternalConversationsRef = useRef(null)
  const hasScrolledToBottomRef = useRef(false)

  // Apply dark mode class to document element
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDarkMode])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView()
  }

  // 1️⃣ Intent-based global keypress handler
  const handleGlobalKeyPress = useRef((e) => {
    const input = inputRef.current;

    // Ignore shortcuts
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    // Ignore non-character keys
    if (e.key.length !== 1) return;

    // Ignore if typing in another input (MODALS, forms, etc.)
    const target = e.target;
    const isEditable =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable;

    if (isEditable) return;

    // Ignore if user is selecting text
    if (window.getSelection().toString().length > 0) return;

    // 🔑 KEY: Ignore if any modal is open
    if (showEditLeadModal || showScheduleModal || showContentModal || showMediaUploadModal || showDatePicker || showSingleDatePicker) return;

    // Only then focus chat input
    input.focus();
  });

  // 2️⃣ Handle clicking in chat area to focus input
  const handleChatAreaClick = (e) => {
    // Prevent focusing when clicking links or buttons or form elements
    if (e.target.closest("a, button, input, textarea, select")) return;

    // Prevent focusing when modals are open
    if (showEditLeadModal || showScheduleModal || showContentModal || showMediaUploadModal || showDatePicker || showSingleDatePicker) return;

    inputRef.current?.focus();
  };

  // 3️⃣ Handle escape key to unfocus (accessibility)
  const handleEscapeKey = useRef((e) => {
    if (e.key === "Escape") {
      inputRef.current?.blur();
    }
  });

  // Auto-focus input when component mounts
  useEffect(() => {
    // Add global keydown listener for typing anywhere
    window.addEventListener('keydown', handleGlobalKeyPress.current);

    // Add escape key handler for accessibility
    window.addEventListener('keydown', handleEscapeKey.current);

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyPress.current);
      window.removeEventListener('keydown', handleEscapeKey.current);
    };
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Listen for dark mode changes from other components (like SideNavbar)
  useStorageListener('darkMode', setIsDarkMode)

  // Handle thinking message phases
  useEffect(() => {
    if (isLoading) {
      if (isFirstMessage) {
        // First message phases
        const phaseTimers = [
          setTimeout(() => setThinkingPhase(1), 1000), // Contacting after 1s
          setTimeout(() => setThinkingPhase(2), 2000), // Invoking after 2s
          setTimeout(() => setThinkingPhase(3), 3000), // Working after 3s
        ]
        return () => phaseTimers.forEach(clearTimeout)
      } else {
        // Subsequent message phases
        const phaseTimers = [
          setTimeout(() => setThinkingPhase(1), 1000), // Processing after 1s
          setTimeout(() => setThinkingPhase(2), 2000), // Finalizing after 2s
          setTimeout(() => setThinkingPhase(3), 3000), // Almost done after 3s
        ]
        return () => phaseTimers.forEach(clearTimeout)
      }
    } else if (!isLoading && isFirstMessage && messages.length > 0) {
      // Find the last user message and mark as not first message
      const lastUserMessage = messages.slice().reverse().find(msg => msg.sender === 'user')
      if (lastUserMessage) {
        setIsFirstMessage(false)
        setThinkingPhase(0) // Reset phase for subsequent messages
      }
    } else if (!isLoading && !isFirstMessage) {
      // Reset phase for next subsequent message
      setThinkingPhase(0)
    }
  }, [isLoading, isFirstMessage, messages])

  // Auto-select content for created_content messages
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (latestMessage && latestMessage.intent === 'created_content' && latestMessage.content_items && latestMessage.content_items.length > 0) {
      // Automatically select the single created content item
      setSelectedContent([latestMessage.content_items[0].content_id])
    }
  }, [messages])

  // Auto-select lead for messages with lead_id and fetch lead data
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (latestMessage && latestMessage.lead_id && !latestMessage.lead_items) {
      // Automatically select the created lead
      setSelectedLeadId(latestMessage.lead_id)

      // Fetch lead data from Supabase
      const fetchLeadData = async () => {
        try {
          console.log('Fetching lead data for ID:', latestMessage.lead_id)
          const response = await leadsAPI.getLead(latestMessage.lead_id)
          console.log('Lead data fetched:', response)

          if (response && response.data) {
            // Store fetched lead data separately
            setFetchedLeads(prev => ({
              ...prev,
              [latestMessage.lead_id]: response.data
            }))
          }
        } catch (error) {
          console.error('Error fetching lead data:', error)
          showError('Failed to load lead details')
        }
      }

      fetchLeadData()
    }
  }, [messages, showError])

  // Handle OAuth connections when needed
  useEffect(() => {
    const latestMessage = messages[messages.length - 1]
    if (latestMessage && latestMessage.sender === 'bot' && latestMessage.needs_connection && latestMessage.connection_platform) {
      console.log('Connection required for platform:', latestMessage.connection_platform)
      console.log('Full message:', latestMessage)
      // Automatically trigger OAuth connection
      handleConnectionRequired(latestMessage.connection_platform)
    }
  }, [messages])

  // Get authentication token from session
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  // Load conversations from database (today's conversations only)
  const loadConversations = async () => {
    try {
      const token = await getAuthToken()
      if (!token) return

      // Get today's date in UTC to match backend timezone handling
      const today = new Date().toISOString().split('T')[0]

      const response = await fetch(`${API_BASE_URL}/atsn/conversations?date=${today}&limit=20`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        console.log('ATSN loadConversations response:', data)
        if (data.conversations && data.conversations.length > 0) {
          // Handle new conversation structure with embedded messages
          console.log(`Found ${data.conversations.length} ATSN conversations`)

          // Flatten all messages from all conversations
          const allMessages = []
          data.conversations.forEach(conv => {
            if (conv.messages && conv.messages.length > 0) {
              conv.messages.forEach(msg => {
                console.log('Processing message:', msg.text)
                // Clean message text to remove stray characters like })}
                let cleanText = msg.text || '';
                console.log('Before cleaning loaded message:', cleanText)
                // Remove trailing )} patterns (with or without whitespace)
                cleanText = cleanText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                // Remove any standalone )} patterns
                cleanText = cleanText.replace(/\s*\)\s*\}\s*/g, '');
                // Remove leading ( and whitespace
                cleanText = cleanText.replace(/^[(\s]*/g, '').trim();
                console.log('After cleaning loaded message:', cleanText)

                // Skip messages that are just stray characters
                if (cleanText.length === 0 || /^[)}\s\(\{\[\]\*]+$/.test(cleanText)) {
                  console.log('Skipping corrupted message:', cleanText)
                  return;
                }

                allMessages.push({
                  id: msg.id,
                  conversationId: conv.id,
                  sender: msg.sender,
                  text: cleanText,
                  timestamp: msg.timestamp,
                  intent: msg.intent,
                  agent_name: msg.agent_name,
                  current_step: msg.current_step,
                  clarification_question: msg.clarification_question,
                  clarification_options: msg.clarification_options,
                  content_items: msg.content_items,
                  lead_items: msg.lead_items,
                  isNew: false
                })
              })
            }
          })

          if (allMessages.length > 0) {
            // Sort messages by timestamp
            allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
            setMessages(allMessages)
            console.log(`Loaded ${allMessages.length} ATSN messages from ${data.conversations.length} conversations`)
            return // Don't show welcome message if we have conversations
          }
        }
      }
    } catch (error) {
      console.error('Error loading ATSN conversations:', error)
    }

    // Don't show automatic welcome message - only show when "New Chat" is clicked
  }

  // Initialize daily caching and handle external conversations
  useEffect(() => {
    // Load cached messages for current day
    if (user) {
      const cacheKey = getDailyCacheKey(user.id)
      const cachedMessages = localStorage.getItem(cacheKey)
      if (cachedMessages) {
        try {
          const parsedMessages = JSON.parse(cachedMessages)
          setMessages(parsedMessages)
          console.log(`Loaded ${parsedMessages.length} cached messages for ${currentDate}`)
        } catch (error) {
          console.error('Error loading cached messages:', error)
          localStorage.removeItem(cacheKey)
        }
      }
    }

    // Check for date changes and clear old cache
    const checkDateChange = () => {
      const today = new Date().toISOString().split('T')[0]
      if (today !== currentDate) {
        console.log(`Date changed from ${currentDate} to ${today}, clearing old cache`)
        // Clear old cache
        if (user) {
          const oldCacheKey = getDailyCacheKey(user.id)
          localStorage.removeItem(oldCacheKey)
        }
        setCurrentDate(today)
        setMessages([]) // Clear messages for new day
        setMessageCache([])
      }
    }

    // Check date change every minute
    const dateCheckInterval = setInterval(checkDateChange, 60000)

    // Load business name from profile
    const loadBusinessName = async () => {
      if (!user) return

      try {
        // Try to fetch from profiles table
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('business_name, name')
          .eq('id', user.id)
          .single()

        if (error) {
          console.error('Error fetching profile for business name:', error)
          setBusinessName('Your Business') // Fallback
          return
        }

        // Use business_name if available, otherwise use name or fallback
        const name = profile?.business_name || profile?.name || 'Your Business'
        setBusinessName(name)
      } catch (error) {
        console.error('Error loading business name:', error)
        setBusinessName('Your Business') // Fallback
      }
    }

    loadBusinessName()

    return () => clearInterval(dateCheckInterval)
  }, [user, currentDate])


  // Initialize session tracking and handle external conversations
  useEffect(() => {

    // Don't load external conversations if chat was reset
    if (chatReset) {
      setChatReset(false) // Reset the flag
      return
    }

    // Don't load conversations if recently reset (within last 10 seconds)
    if (resetTimestamp && (Date.now() - resetTimestamp) < 10000) {
      console.log('Recent reset detected - not loading conversations')
      return
    }

    // Load external conversations from history (no automatic loading)
    if (externalConversations) {
      console.log('Loading external conversations:', externalConversations)
      setMessages(externalConversations)
      setMessageCache([]) // Clear cache since we're loading from history
      setHasUnsavedChanges(false)
      setTimeout(() => scrollToBottom(), 100)
    }
    // Note: Automatic conversation loading is disabled for better performance
  }, [user, externalConversations, chatReset, resetTimestamp, currentDate])

  // Reset scroll flag when chat is reset
  useEffect(() => {
    if (chatReset) {
      hasScrolledToBottomRef.current = false
    }
  }, [chatReset])

  // Scroll to bottom only once when messages are first loaded (like WhatsApp)
  useEffect(() => {
    if (messages.length > 0 && !hasScrolledToBottomRef.current) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        scrollToBottom()
        hasScrolledToBottomRef.current = true
      }, 100)
    }
  }, [messages.length])

  // Fetch agent profiles data
  useEffect(() => {
    const fetchAgentProfiles = async () => {
      try {
        const token = await getAuthToken()
        if (!token) return

        const response = await fetch('/api/profile/agents/profiles', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const profiles = await response.json()
          setAgentProfiles(profiles)
        } else {
          console.error('Failed to fetch agent profiles:', response.statusText)
        }
      } catch (error) {
        console.error('Error fetching agent profiles:', error)
      }
    }

    fetchAgentProfiles()
  }, [])

  // Load today's conversations (similar to Chatbot.jsx)
  const loadTodayConversations = async () => {
    try {
      const token = await getAuthToken()
      if (!token) {
        console.error('No auth token available')
        return
      }

      const response = await fetch(`${API_BASE_URL}/atsn/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        console.error('Failed to fetch today\'s conversations:', response.status)
        return
      }

      const data = await response.json()
      console.log('Today\'s conversations response:', data)

      if (data.conversations && data.conversations.length > 0) {
        // Handle new conversation structure with embedded messages
        console.log(`Found ${data.conversations.length} ATSN conversations for today`)

        // Flatten all messages from all conversations
        const allMessages = []
        data.conversations.forEach(conv => {
          if (conv.messages && conv.messages.length > 0) {
            conv.messages.forEach(msg => {
              allMessages.push({
                id: msg.id,
                conversationId: conv.id,
                sender: msg.sender,
                text: msg.text,
                timestamp: msg.timestamp,
                intent: msg.intent,
                agent_name: msg.agent_name,
                current_step: msg.current_step,
                clarification_question: msg.clarification_question,
                clarification_options: msg.clarification_options,
                content_items: msg.content_items,
                lead_items: msg.lead_items,
                isNew: false
              })
            })
          }
        })

        if (allMessages.length > 0) {
          // Sort messages by timestamp
          allMessages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
          setMessages(allMessages)
          console.log(`Loaded ${allMessages.length} today's ATSN messages from ${data.conversations.length} conversations`)
        }
      }
    } catch (error) {
      console.error('Error loading today\'s conversations:', error)
    }
  }

  // Real-time conversation updates
  useEffect(() => {
    if (!user) return

    // Subscribe to real-time conversation updates for ATSN
    const channel = supabase
      .channel('atsn_conversations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chatbot_conversations',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const newMessage = payload.new

          // Only process ATSN conversations
          if (newMessage.metadata?.agent === 'atsn') {
            // Determine agent_name with fallback logic
            let agent_name = newMessage.metadata?.agent_name
            if (!agent_name && newMessage.message_type === 'bot' && newMessage.intent) {
              // Fallback: determine agent from intent (similar to backend logic)
              const intent = newMessage.intent.toLowerCase()
              if (intent.includes('lead')) {
                agent_name = 'chase'
              } else if (['view_content', 'publish_content', 'delete_content'].includes(intent)) {
                agent_name = 'emily'
              } else if (['create_content', 'edit_content', 'schedule_content'].includes(intent)) {
                agent_name = 'leo'
              } else if (intent.includes('orio') || intent.includes('analytics')) {
                agent_name = 'orio'
              } else {
                agent_name = 'emily' // default
              }
            }

            const messageObj = {
              id: newMessage.id,
              conversationId: newMessage.id,
              sender: newMessage.message_type === 'user' ? 'user' : 'bot',
              text: newMessage.content,
              timestamp: newMessage.created_at,
              intent: newMessage.intent,
              agent_name: agent_name,
              isNew: true
            }

            setMessages(prev => {
              // Avoid duplicates
              const exists = prev.some(msg => msg.id === newMessage.id)
              if (exists) return prev

              return [...prev, messageObj]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Handle message copying
  const handleCopyMessage = async (message) => {
    try {
      // Extract text content from message
      let textToCopy = message.text || message.content || ''

      // For bot messages, get the content
      if (message.sender === 'bot' && !textToCopy) {
        textToCopy = message.content || ''
      }

      await navigator.clipboard.writeText(textToCopy)

      // Remove focus from input to allow text selection
      if (inputRef.current) {
        inputRef.current.blur()
      }

      showSuccess('Message copied to clipboard')
    } catch (error) {
      console.error('Error copying message:', error)
      showError('Failed to copy message')
    }
  }

  const handleDeleteMessage = async (message) => {
    if (!message.conversationId) {
      // If it's a local message (not saved to Supabase), just remove from UI
      setMessages(prev => prev.filter(msg => msg.id !== message.id))
      return
    }

    try {
      const token = await getAuthToken()
      if (!token) {
        throw new Error('No authentication token available')
      }

      const response = await fetch(`${API_BASE_URL}/chatbot/conversations/${message.conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        // Remove from UI
        setMessages(prev => prev.filter(msg => msg.id !== message.id))
        showSuccess('Message deleted successfully')
      } else {
        throw new Error('Failed to delete message')
      }
    } catch (error) {
      console.error('Error deleting message:', error)
      showError('Failed to delete message')
    }
  }

  const handleLikeMessage = async (message) => {
    const isCurrentlyLiked = likedMessages.has(message.id)

    // Update local state immediately for better UX
    setLikedMessages(prev => {
      const newSet = new Set(prev)
      if (isCurrentlyLiked) {
        newSet.delete(message.id)
        showSuccess('Message unliked')
      } else {
        newSet.add(message.id)
        showSuccess('Message liked')
      }
      return newSet
    })

    // If liking (not unliking) and message has an agent_name, increment likes count
    if (!isCurrentlyLiked && message.agent_name) {
      try {
        const token = await getAuthToken()
        if (!token) {
          console.error('No auth token available')
          return
        }

        const response = await fetch(`${API_BASE_URL}/agents/${message.agent_name}/like`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          console.error('Failed to increment likes count')
          // Optionally revert the local state if API call fails
        }
      } catch (error) {
        console.error('Error incrementing likes count:', error)
      }
    }
  }


  // Save cached messages to database
  const saveCachedMessages = async (force = false) => {
    if (messageCache.length === 0 && !force) return

    setSaveStatus('saving')
    try {
      const token = await getAuthToken()
      if (!token) return

      const conversationData = {
        session_id: `session-${user.id}-${currentDate}`,
        messages: messageCache,
      }

      const response = await fetch(`${API_BASE_URL}/atsn/conversations/incremental-save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(conversationData)
      })

      if (response.ok) {
        const data = await response.json()
        console.log('Successfully saved cached messages to database')
        setMessageCache([])
        setHasUnsavedChanges(false)
        setSaveStatus('saved')
      } else {
        throw new Error('Save failed')
      }
    } catch (error) {
      console.error('Error saving cached messages:', error)
      setSaveStatus('error')
      // Don't clear cache on error - retry later
    }
  }

  // Save complete conversation when intent is fully completed
  const saveCompleteConversation = async () => {
    if (messageCache.length === 0) return

    setSaveStatus('saving')
    try {
      const token = await getAuthToken()
      if (!token) return

      const conversationData = {
        session_id: `session-${user.id}-${currentDate}`,
        messages: messageCache
      }

      const response = await fetch(`${API_BASE_URL}/atsn/conversations/save-complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(conversationData)
      })

      if (response.ok) {
        console.log('Successfully saved complete conversation to database')
        setMessageCache([])
        setHasUnsavedChanges(false)
        setSaveStatus('saved')
      } else {
        throw new Error('Save failed')
      }
    } catch (error) {
      console.error('Error saving complete conversation:', error)
      setSaveStatus('error')
    }
  }

  const sendMessage = async (message) => {
    setInputMessage(message)
    await handleSendMessage()
  }

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage = inputMessage.trim()
    const messageId = Date.now()

    // Create user message object
    const userMessageObj = {
      id: messageId,
      sender: 'user',
      text: userMessage.trim(),
      timestamp: new Date().toISOString()
    }

    // Add user message to UI
    setMessages(prev => [...prev, userMessageObj])

    // Cache the message
    setMessageCache(prev => {
      const newCache = [...prev, userMessageObj]
      saveMessagesToCache([...messages, userMessageObj])
      return newCache
    })
    setHasUnsavedChanges(true)
    setSaveStatus('unsaved')

    // Calculate updated conversation history
    const updatedHistory = [...conversationHistory, userMessage]

    // Store the message for loading detection
    setLastSentMessage(inputMessage)

    // Update conversation history state
    setConversationHistory(updatedHistory)
    setInputMessage('')
    setIsLoading(true)

    try {
      // Get token from session
      const token = await getAuthToken()

      if (!token) {
        throw new Error('No authentication session found. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/atsn/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversation_history: updatedHistory,
          session_id: `session-${user.id}-${currentDate}`,
          agent_status: agentStatus,
          thinking_phase: thinkingPhase,
          is_first_message: isFirstMessage
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Debug: log the raw response
      console.log('Raw API response:', data.response)

      // Clean response text to remove stray characters
      let cleanResponse = data.response || '';
      console.log('Before cleaning:', cleanResponse)
      // Remove trailing )} patterns (with or without whitespace)
      cleanResponse = cleanResponse.replace(/\s*\)\s*\}\s*$/g, '').trim();
      // Remove any standalone )} patterns
      cleanResponse = cleanResponse.replace(/\s*\)\s*\}\s*/g, '');
      // Remove leading ( and whitespace
      cleanResponse = cleanResponse.replace(/^[(\s]*/g, '').trim();
      console.log('After cleaning:', cleanResponse)

      // Create bot message object
      const botMessageObj = {
        id: Date.now(),
        sender: 'bot',
        text: cleanResponse,
        timestamp: new Date().toISOString(),
        intent: data.intent,
        step: data.current_step,
        payload: data.payload,
        waiting_for_user: data.waiting_for_user,
        waiting_for_upload: data.waiting_for_upload,
        upload_type: data.upload_type,
        payload_complete: data.payload_complete,
        error: data.error,
        content_items: data.content_items || null,
        lead_id: data.lead_id || null,
        lead_items: data.lead_items || null,
        calendar_entries: data.calendar_entries || null,
        agent_name: data.agent_name || 'emily',
        clarification_options: data.clarification_options || [],
        clarification_data: data.clarification_data,
        needs_connection: data.needs_connection || false,
        connection_platform: data.connection_platform || null
      }

      // Add bot response to UI
      setMessages(prev => {
        const newMessages = [...prev, botMessageObj]
        saveMessagesToCache(newMessages)
        return newMessages
      })

      // Cache the bot message
      setMessageCache(prev => {
        const newCache = [...prev, botMessageObj]
        saveMessagesToCache([...messages, botMessageObj])
        return newCache
      })

      // Trigger calendar refresh if calendar was generated
      if (data.calendar_entries && data.calendar_entries.length > 0) {
        console.log('Calendar generated, triggering refresh event')
        // Dispatch custom event to notify CalendarDashboard to refresh
        window.dispatchEvent(new CustomEvent('calendarRegenerated', {
          detail: { calendar_id: data.calendar_id }
        }))
        
        // Invalidate ALL calendar caches
        if (user?.id) {
          const todayCacheKey = `today_calendar_entries_${user.id}`
          const calendarDataCacheKey = `calendar_data_${user.id}`
          localStorage.removeItem(todayCacheKey)
          localStorage.removeItem(calendarDataCacheKey)
          console.log('✅ Invalidated all calendar caches (today entries + full calendar data)')
        }
      }

      // Auto-open upload modal if waiting for upload
      if (data.waiting_for_upload) {
        setTimeout(() => {
          setShowMediaUploadModal(true)
        }, 500)
      }

      // Update agent status
      setAgentStatus({
        intent: data.intent,
        step: data.current_step,
        waiting: data.waiting_for_user,
        complete: data.payload_complete
      })

      // Save complete conversation when intent is fully completed
      if (data.payload_complete && messageCache.length > 0) {
        console.log('Intent completed, saving conversation to database')
        saveCompleteConversation()
      }

      // Update thinking phase
      setIsFirstMessage(false)
      setThinkingPhase(0)

    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error.message || 'Failed to send message. Please try again.'
      showError(errorMessage)

      const errorMessageObj = {
        id: Date.now(),
        sender: 'bot',
        text: `❌ ${errorMessage}\n\n${error.message?.includes('authentication') ? 'Please refresh the page and log in again.' : 'Please try again or reset the conversation.'}`,
        timestamp: new Date().toISOString(),
        error: true
      }

      setMessages(prev => {
        const newMessages = [...prev, errorMessageObj]
        saveMessagesToCache(newMessages)
        return newMessages
      })
      setMessageCache(prev => [...prev, errorMessageObj])
    } finally {
      setIsLoading(false)
      setLastSentMessage('')

      // Refocus input for continued conversation
      setTimeout(() => {
        inputRef.current?.focus()
      }, 100)
    }
  }

  const handleReset = async () => {
    try {
      // Get token from session
      const token = await getAuthToken()

      if (!token) {
        throw new Error('No authentication session found. Please log in again.')
      }

      await fetch(`${API_BASE_URL}/atsn/reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      // Clear all messages and state
      setConversationHistory([])
      setAgentStatus(null)
      setIsFirstMessage(true) // Reset to show "assigning agent" for first message
      setThinkingPhase(0) // Reset phase

      // Clear any selected content/leads
      setSelectedContent([])
      setSelectedLeadId(null)
      setSelectedLeads([])
      setFetchedLeads({})
      setSelectedContentForModal(null)

      // Clear input
      setInputMessage('')
      setLastSentMessage('')

      // Reset modal data
      setEditLeadData(null)
      setScheduleData({ date: '', time: '', contentId: null })

      // Reset date picker states
      setShowDatePicker(false)
      setSelectedDateRange({ start: '', end: '' })
      setShowSingleDatePicker(false)
      setSelectedSingleDate('')

      // Reset lead filters
      setLeadFilters({
        search: '',
        status: '',
        tags: [],
        dateRange: { start: '', end: '' },
        sortBy: 'created_at',
        sortOrder: 'desc'
      })

      // Reset loading states
      setIsLoading(false)
      setIsPublishing(false)
      setIsDeleting(false)
      setIsScheduling(false)
      setShowScheduleModal(false)
      setShowContentModal(false)
      setShowEditLeadModal(false)
      setCurrentRequestIntent(null)

      // Mark chat as reset to prevent loading external conversations
      setChatReset(true)
      setFreshReset(true) // Prevent loading conversations after reset
      setResetTimestamp(Date.now()) // Record when reset happened

      // Clear all messages to show welcome screen
      setMessages([])
      setMessageCache([]) // Clear message cache for new conversation

      // Clear daily localStorage cache
      if (user) {
        const cacheKey = getDailyCacheKey(user.id)
        localStorage.removeItem(cacheKey)
        console.log(`Cleared daily cache for ${currentDate}`)
      }
    } catch (error) {
      console.error('Error resetting:', error)
      showError(error.message || 'Failed to start new chat')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Content selection functions
  const handleContentSelect = (contentId, intent) => {
    if (intent === 'publish_content') {
      // Single selection for publishing
      setSelectedContent([contentId])
    } else {
      // Multi-selection for other intents
      setSelectedContent(prev => {
        if (prev.includes(contentId)) {
          return prev.filter(id => id !== contentId)
        } else {
          return [...prev, contentId]
        }
      })
    }
  }

  // Lead selection functions
  const handleLeadSelect = (leadId, intent) => {
    if (intent === 'delete_leads') {
      // Single selection for deletion
      setSelectedLeads([leadId])
    } else {
      // Multi-selection for other operations
      setSelectedLeads(prev => {
        if (prev.includes(leadId)) {
          return prev.filter(id => id !== leadId)
        } else {
          return [...prev, leadId]
        }
      })
    }
  }

  const handleSelectAll = (contentItems) => {
    const allIds = contentItems.map(item => item.content_id)
    setSelectedContent(allIds)
  }

  const handleDeselectAll = () => {
    setSelectedContent([])
  }

  const handleContentClick = (contentItem) => {
    // Process the content item the same way as for ATSNContentCard
    const processedContent = {
      id: contentItem.content_id,
      title: contentItem.title_display || contentItem.title,
      content: contentItem.content_text || contentItem.content_preview,
      hashtags: contentItem.hashtags_display ?
        contentItem.hashtags_display.split(' ').filter(tag => tag.startsWith('#')).map(tag => tag.substring(1)) :
        (contentItem.hashtags ?
          (Array.isArray(contentItem.hashtags) ? contentItem.hashtags : []) :
          (contentItem.raw_data?.hashtags ?
            (Array.isArray(contentItem.raw_data.hashtags) ? contentItem.raw_data.hashtags : []) :
            [])),
      media_url: contentItem.media_url,
      images: contentItem.images || [],
      metadata: contentItem.metadata || {},
      post_type: contentItem.raw_data?.post_type,
      content_type: contentItem.content_type,
      selected_content_type: contentItem.raw_data?.selected_content_type,
      carousel_images: contentItem.raw_data?.carousel_images || contentItem.raw_data?.images,
      // Add additional fields for different content types
      email_subject: contentItem.email_subject,
      email_body: contentItem.email_body,
      short_video_script: contentItem.short_video_script,
      long_video_script: contentItem.long_video_script,
      message: contentItem.message,
      platform: contentItem.platform,
      status: contentItem.status || 'draft', // Add status field for proper restrictions
      scheduled_at: contentItem.scheduled_at // Add scheduled_at for status display
    }

    setSelectedContentForModal(processedContent)

    // Check if it's a reel and open appropriate modal
    if (processedContent.content_type === 'short_video or reel' ||
        processedContent.content_type === 'reel' ||
        processedContent.content_type?.toLowerCase().includes('reel') ||
        processedContent.content_type?.toLowerCase().includes('video')) {
      setShowReelModal(true)
    } else {
      setShowContentModal(true)
    }
  }

  const handleCloseContentModal = () => {
    setShowContentModal(false)
    setSelectedContentForModal(null)
  }

  const handleCloseReelModal = () => {
    setShowReelModal(false)
    setSelectedContentForModal(null)
  }

  const handleDeleteSelected = async () => {
    if (selectedContent.length === 0) {
      showError('Please select at least one item to delete')
      return
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedContent.length} content item(s)? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)

    try {
      const token = await getAuthToken()

      // Delete selected content items from Supabase
      for (const contentId of selectedContent) {
        const { error } = await supabase
          .from('created_content')
          .delete()
          .eq('id', contentId)
          .eq('user_id', user.id) // Security: ensure user can only delete their own content

        if (error) {
          console.error(`Error deleting content ${contentId}:`, error)
          showError(`Failed to delete content: ${error.message}`)
          return
        }
      }

      // Add success message
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: `Successfully deleted ${selectedContent.length} content item(s)`,
        timestamp: new Date().toISOString()
      }])

      // Clear selection
      setSelectedContent([])
      showSuccess(`Successfully deleted ${selectedContent.length} content item(s)`)

    } catch (error) {
      console.error('Error deleting content:', error)
      showError(error.message || 'Failed to delete content')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleEditSelected = async () => {
    if (selectedContent.length === 0) {
      showError('Please select a content item to edit')
      return
    }
    if (selectedContent.length > 1) {
      showError('Please select only one item to edit')
      return
    }

    const contentId = selectedContent[0]

    try {
      // Fetch fresh content data from API to get current status
      const token = await getAuthToken()
      if (!token) {
        showError('Authentication required')
        return
      }

      const response = await fetch(`${API_BASE_URL}/content/created?limit=10000&offset=0`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (!response.ok) {
        console.error('Failed to fetch content data, falling back to chat data')
        // Fallback to chat message data if API fails
        let selectedContentItem = null
        for (const message of messages) {
          if (message.content_items) {
            selectedContentItem = message.content_items.find(item => item.content_id === contentId)
            if (selectedContentItem) break
          }
        }

        if (!selectedContentItem) {
          showError('Selected content not found')
          return
        }

        const processedContent = {
          id: selectedContentItem.content_id,
          title: selectedContentItem.title_display || selectedContentItem.title,
          content: selectedContentItem.content_text || selectedContentItem.content_preview,
          hashtags: selectedContentItem.hashtags_display ?
            selectedContentItem.hashtags_display.split(' ').filter(tag => tag.startsWith('#')).map(tag => tag.substring(1)) :
            (selectedContentItem.hashtags ?
              (Array.isArray(selectedContentItem.hashtags) ? selectedContentItem.hashtags : []) :
              (selectedContentItem.raw_data?.hashtags ?
                (Array.isArray(selectedContentItem.raw_data.hashtags) ? selectedContentItem.raw_data.hashtags : []) :
                [])),
          media_url: selectedContentItem.media_url,
          images: selectedContentItem.images || [],
          metadata: selectedContentItem.metadata || {},
          post_type: selectedContentItem.raw_data?.post_type,
          content_type: selectedContentItem.content_type,
          selected_content_type: selectedContentItem.raw_data?.selected_content_type,
          carousel_images: selectedContentItem.raw_data?.carousel_images || selectedContentItem.raw_data?.images,
          email_subject: selectedContentItem.email_subject,
          email_body: selectedContentItem.email_body,
          short_video_script: selectedContentItem.short_video_script,
          long_video_script: selectedContentItem.long_video_script,
          message: selectedContentItem.message,
          platform: selectedContentItem.platform,
          status: selectedContentItem.status || 'draft'
        }
        setSelectedContentForModal(processedContent)
        return
      }

      const data = await response.json()
      const fetchedContent = Array.isArray(data) ? data : (data.content || [])

      // Find the specific content item
      const contentItem = fetchedContent.find(item => item.id === contentId)
      if (!contentItem) {
        showError('Content not found')
        return
      }

      // Ensure platform information is included
      console.log('Edit selected - contentItem.platform:', contentItem.platform, 'Full contentItem:', contentItem);
      const contentWithPlatform = {
        ...contentItem,
        platform: contentItem.platform || 'General'
      };
      console.log('Content with platform for edit:', contentWithPlatform.platform);
      setSelectedContentForModal(contentWithPlatform)

      // Check if it's a reel/video and open appropriate modal
      if (contentItem.content_type === 'short_video or reel' ||
          contentItem.content_type === 'reel' ||
          contentItem.content_type?.toLowerCase().includes('reel') ||
          contentItem.content_type?.toLowerCase().includes('video')) {
        setShowReelModal(true)
      } else {
        setShowContentModal(true)
      }

    } catch (error) {
      console.error('Error opening content modal:', error)
      showError('Failed to open content modal')
      return
    }

    // Clear selection after action
    setSelectedContent([])
  }

  const handlePublishSelected = async () => {
    if (selectedContent.length === 0) {
      showError('Please select at least one item to publish')
      return
    }

    setIsPublishing(true)

    try {
      for (const contentId of selectedContent) {
        // Find the content item from messages
        let contentToPublish = null
        for (const message of messages) {
          if (message.content_items) {
            contentToPublish = message.content_items.find(item => item.content_id === contentId)
            if (contentToPublish) break
          }
        }

        if (!contentToPublish) {
          console.error(`Content with ID ${contentId} not found`)
          continue
        }

        // Check if already published
        const status = contentToPublish.status?.toLowerCase()
        if (status === 'published') {
          showError('Post Already Published', 'This post has already been published.')
          continue
        }

        // Check if platform is connected
        if (!isPlatformConnected(contentToPublish.platform)) {
          showError('Account Not Connected', `Please connect your ${contentToPublish.platform} account in Settings > Connections before publishing.`)
          continue
        }

        console.log('Posting content to', contentToPublish.platform, ':', contentToPublish)

        try {
          // Handle different platforms
          if (contentToPublish.platform.toLowerCase() === 'facebook') {
            await postToFacebook(contentToPublish)
          } else if (contentToPublish.platform.toLowerCase() === 'instagram') {
            await postToInstagram(contentToPublish)
          } else if (contentToPublish.platform.toLowerCase() === 'linkedin') {
            await postToLinkedIn(contentToPublish)
          } else if (contentToPublish.platform.toLowerCase() === 'youtube') {
            await postToYouTube(contentToPublish)
          } else {
            showError(`${contentToPublish.platform} posting not yet implemented`)
            continue
          }

          // Show success modal instead of toast
          console.log('Showing success modal for platform:', contentToPublish.platform)
          setPublishSuccessData({
            platform: contentToPublish.platform,
            postUrl: null // Will be set by individual platform functions
          })
          setShowPublishSuccessModal(true)

        } catch (error) {
          console.error('Error posting content:', error)
          showError(`Failed to post to ${contentToPublish.platform}: ${error.message}`)
        }
      }

    } catch (error) {
      console.error('Error in publish process:', error)
      showError('Publishing failed', error.message || 'An unexpected error occurred during publishing.')
    } finally {
      setIsPublishing(false)
      setSelectedContent([])
    }
  }

  const isPlatformConnected = (platform) => {
    // This would need to check user's connected platforms
    // For now, return true as placeholder - you might want to implement this properly
    return true
  }

  // Update content status in database
  const updateContentStatus = async (contentId, status) => {
    try {
      const token = await getAuthToken()
      if (!token) return

      // Try created_content table first
      let response = await fetch(`${API_BASE_URL}/content/created-content/update/${contentId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: status })
      })

      // If created_content update fails, try content_posts table
      if (!response.ok) {
        console.log('Created content update failed, trying content_posts table')
        response = await fetch(`${API_BASE_URL}/content/update/${contentId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ status: status })
        })
      }

      if (!response.ok) {
        console.error('Failed to update content status in both tables')
      } else {
        console.log('Content status updated successfully')
      }
    } catch (error) {
      console.error('Error updating content status:', error)
    }
  }

  const handleScheduleSelected = () => {
    if (selectedContent.length === 0) {
      showError('Please select a content item to schedule')
      return
    }
    if (selectedContent.length > 1) {
      showError('Please select only one item to schedule')
      return
    }

    // Open schedule modal
    setScheduleData({ date: '', time: '', contentId: selectedContent[0] })
    setShowScheduleModal(true)
  }

  const handleScheduleConfirm = async () => {
    if (!scheduleData.date || !scheduleData.time) {
      showError('Please select both date and time')
      return
    }

    setIsScheduling(true)

    try {
      const token = await getAuthToken()

      // Combine date and time
      const scheduleDateTime = new Date(`${scheduleData.date}T${scheduleData.time}`)

      // Update the content with schedule information
      const { error } = await supabase
        .from('created_content')
        .update({
          status: 'scheduled',
          scheduled_at: scheduleDateTime.toISOString()
        })
        .eq('id', scheduleData.contentId)
        .eq('user_id', user.id)

      if (error) {
        console.error('Error scheduling content:', error)
        showError(`Failed to schedule content: ${error.message}`)
        return
      }

      // Add success message
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: `Content scheduled for ${scheduleData.date} at ${scheduleData.time}`,
        timestamp: new Date().toISOString()
      }])

      setShowScheduleModal(false)
      setSelectedContent([])
      showSuccess('Content scheduled successfully!')

    } catch (error) {
      console.error('Error scheduling content:', error)
      showError(error.message || 'Failed to schedule content')
    } finally {
      setIsScheduling(false)
    }
  }

  // Lead action handlers
  const handleEditLead = () => {
    if (!selectedLeadId) {
      showError('Please select a lead to edit')
      return
    }

    const leadToEdit = messages.find(msg => msg.intent === 'lead_created')?.lead_items?.find(lead => lead.id === selectedLeadId)
    if (leadToEdit) {
      // Trigger edit lead flow
      sendMessage(`Edit lead: ${leadToEdit.name}`)
    }
  }

  const handleDeleteLead = () => {
    if (!selectedLeadId) {
      showError('Please select a lead to delete')
      return
    }

    if (window.confirm('Are you sure you want to delete this lead?')) {
      // Trigger delete lead flow
      sendMessage(`Delete lead: ${selectedLeadId}`)
    }
  }

  const handleSaveLead = () => {
    if (!selectedLeadId) {
      showError('Please select a lead to save')
      return
    }

    // Trigger save lead flow (mark as saved/completed)
    sendMessage(`Save lead: ${selectedLeadId}`)
  }

  const handleEditSelectedLead = () => {
    if (selectedLeads.length !== 1) {
      showError('Please select exactly one lead to edit')
      return
    }

    const leadId = selectedLeads[0]
    // Find the lead data from current message
    const currentMessage = messages[messages.length - 1]
    const leadToEdit = currentMessage?.lead_items?.find(lead => lead.lead_id === leadId || lead.id === leadId)

    if (leadToEdit) {
      setEditLeadData(leadToEdit)
      setShowEditLeadModal(true)
    } else {
      showError('Lead data not found')
    }
  }

  const handleDeleteSelectedLeads = async () => {
    if (selectedLeads.length === 0) {
      showError('Please select at least one lead to delete')
      return
    }

    const confirmMessage = selectedLeads.length === 1
      ? 'Are you sure you want to delete this lead? This action cannot be undone.'
      : `Are you sure you want to delete ${selectedLeads.length} leads? This action cannot be undone.`

    if (!confirm(confirmMessage)) {
      return
    }

    setIsDeleting(true)

    try {
      // Directly call bulk delete API instead of sending chatbot messages
      await leadsAPI.bulkDeleteLeads(selectedLeads)

      showSuccess(`Successfully deleted ${selectedLeads.length} lead${selectedLeads.length > 1 ? 's' : ''}`)
      setSelectedLeads([]) // Clear selection after deletion

      // Refresh the current view to reflect the changes
      // This will trigger a new message to show updated leads
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage.intent === 'view_leads' || lastMessage.intent === 'delete_leads') {
          // Trigger a refresh by sending a new view leads command
          await sendMessage('Show my leads')
        }
      }
    } catch (error) {
      console.error('Error deleting leads:', error)
      showError('Failed to delete leads. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleConnectionRequired = async (platform) => {
    console.log('handleConnectionRequired called with platform:', platform)
    if (!platform) {
      console.error('No platform specified for connection')
      showError('Unable to determine which platform to connect. Please try again.')
      return
    }

    // Normalize platform name to lowercase for OAuth compatibility
    platform = platform.toLowerCase()
    if (platform === "gmail") {
      platform = "google"
    }
    console.log('Normalized platform:', platform)

    try {
      setIsConnecting(true)
      console.log('Starting connection process for platform:', platform)

      if (platform === 'google') {
        // Handle Google OAuth with popup (same as ConnectionCards)
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com'
        const cleanUrl = API_BASE_URL.replace(/\/+$/, '') + '/connections/google/auth/initiate'
        console.log('Google auth URL:', cleanUrl)

        const response = await fetch(cleanUrl)
        console.log('Google auth response status:', response.status)

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Google auth error:', response.status, errorText)
          throw new Error(`Failed to get Google auth URL: ${response.status}`)
        }

        const data = await response.json()
        console.log('Google auth data received:', data)

        if (data.auth_url) {
          console.log('Opening Google OAuth popup with URL:', data.auth_url)
          const popup = window.open(
            data.auth_url,
            'google-oauth',
            'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
          )

          console.log('Popup opened:', popup)

          // Check if popup was blocked
          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            console.error('Popup was blocked or failed to open')
            showError('Popup blocked! Please allow popups for this site and try again.')
            setIsConnecting(false)
            return
          }

          // Listen for popup messages (same as ConnectionCards)
          const messageHandler = async (event) => {
            const allowedOrigins = [
              window.location.origin,
              'https://emily.atsnai.com',
              'https://agent-emily.onrender.com'
            ]

            if (!allowedOrigins.includes(event.origin)) {
              console.log('Ignoring message from origin:', event.origin)
              return
            }

            console.log('Received message:', event.data, 'from origin:', event.origin)

            if (event.data.type === 'GOOGLE_OAUTH_SUCCESS' || event.data.type === 'OAUTH_SUCCESS') {
              console.log('OAuth successful:', event.data)
              popup.close()
              window.removeEventListener('message', messageHandler)

              // After successful connection, retry the publish operation
              showSuccess('Account connected successfully! Retrying publish operation...')
              setTimeout(() => {
                const lastMessage = messages[messages.length - 1]
                if (lastMessage && lastMessage.sender === 'user') {
                  sendMessage(lastMessage.text)
                }
              }, 2000)
            } else if (event.data.type === 'GOOGLE_OAUTH_ERROR' || event.data.type === 'OAUTH_ERROR') {
              console.error('OAuth error:', event.data.error)
              popup.close()
              window.removeEventListener('message', messageHandler)
              showError(`Connection failed: ${event.data.error}`)
            }
          }

          window.addEventListener('message', messageHandler)

          // Check if popup was closed manually
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              window.removeEventListener('message', messageHandler)
              console.log('Popup closed, retrying publish operation...')
              setTimeout(() => {
                const lastMessage = messages[messages.length - 1]
                if (lastMessage && lastMessage.sender === 'user') {
                  sendMessage(lastMessage.text)
                }
              }, 1000)
            }
          }, 1000)
        } else {
          throw new Error('Failed to get Google auth URL from response')
        }
      } else {
        // Handle other platforms using the proper connections API with popup
        console.log(`Initiating ${platform} connection via API`)
        const result = await connectionsAPI.initiateConnection(platform)

        if (result.error) {
          throw new Error(result.error)
        }

        if (result.data) {
          console.log(`${platform} auth URL received:`, result.data)

          // Open OAuth in popup for ALL platforms (not just Google)
          const popup = window.open(
            result.data,
            `${platform}-oauth`,
            'width=500,height=600,scrollbars=yes,resizable=yes,status=yes,location=yes,toolbar=no,menubar=no'
          )

          console.log('Popup opened:', popup)

          // Check if popup was blocked
          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            console.error('Popup was blocked or failed to open')
            showError('Popup blocked! Please allow popups for this site and try again.')
            setIsConnecting(false)
            return
          }

          // Listen for OAuth messages (both Google and generic)
          const messageHandler = async (event) => {
            const allowedOrigins = [
              window.location.origin,
              'https://emily.atsnai.com',
              'https://agent-emily.onrender.com'
            ]

            if (!allowedOrigins.includes(event.origin)) {
              console.log('Ignoring message from origin:', event.origin)
              return
            }

            console.log('Received message:', event.data, 'from origin:', event.origin)

            if (event.data.type === 'GOOGLE_OAUTH_SUCCESS' || event.data.type === 'OAUTH_SUCCESS') {
              console.log('OAuth successful:', event.data)
              popup.close()
              window.removeEventListener('message', messageHandler)

              // After successful connection, retry the publish operation
              showSuccess('Account connected successfully! Retrying publish operation...')
              setTimeout(() => {
                const lastMessage = messages[messages.length - 1]
                if (lastMessage && lastMessage.sender === 'user') {
                  sendMessage(lastMessage.text)
                }
              }, 2000)
            } else if (event.data.type === 'GOOGLE_OAUTH_ERROR' || event.data.type === 'OAUTH_ERROR') {
              console.error('OAuth error:', event.data.error)
              popup.close()
              window.removeEventListener('message', messageHandler)
              showError(`Connection failed: ${event.data.error}`)
            }
          }

          window.addEventListener('message', messageHandler)

          // Check if popup was closed manually
          const checkClosed = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkClosed)
              window.removeEventListener('message', messageHandler)
              console.log('Popup closed, retrying publish operation...')
              setTimeout(() => {
                const lastMessage = messages[messages.length - 1]
                if (lastMessage && lastMessage.sender === 'user') {
                  sendMessage(lastMessage.text)
                }
              }, 1000)
            }
          }, 1000)
        } else {
          throw new Error('Failed to get auth URL')
        }
      }
    } catch (error) {
      console.error(`Error connecting to ${platform}:`, error)
      showError(`Failed to connect to ${platform}. Please try again.`)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleSaveSelected = async () => {
    if (selectedContent.length === 0) {
      showError('Please select at least one item to save')
      return
    }

    try {
      // Content is already saved as draft when created, this just confirms
      console.log('Save draft content:', selectedContent)
      showSuccess('Content saved as draft successfully!')

      // Clear selection after action
      setSelectedContent([])

    } catch (error) {
      console.error('Error saving content:', error)
      showError(error.message || 'Failed to save content')
    }
  }

  // Handle option selection from clarification buttons
  const handleOptionSelect = async (value) => {
    if (!value || isLoading) return

    // Special handling for custom date picker
    if (value === 'show_date_picker') {
      // Detect if this is for lead follow-up (single date) or content viewing (range)
      const lastMessage = messages[messages.length - 1]
      const isLeadFollowUp = lastMessage?.clarification_options?.some(opt =>
        opt.value === 'tomorrow' || opt.value === 'next week' || opt.value === 'next month'
      )

      if (isLeadFollowUp) {
        setShowSingleDatePicker(true)
      } else {
        setShowDatePicker(true)
      }
      return
    }

    // Special handling for media upload
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.clarification_options &&
        lastMessage.clarification_options.some(opt => opt.value === 'Upload') &&
        value === 'Upload') {
      setShowMediaUploadModal(true)
      return
    }

    const optionMessage = value.trim()
    const messageId = Date.now()

    // Add user message with selected option
    setMessages(prev => [...prev, {
      id: messageId,
      sender: 'user',
      text: optionMessage,
      timestamp: new Date().toISOString()
    }])

    // Update conversation history
    const updatedHistory = [...conversationHistory, optionMessage]
    setConversationHistory(updatedHistory)
    setInputMessage('')
    setIsLoading(true)

    try {
      // Get token from session
      const token = await getAuthToken()

      if (!token) {
        throw new Error('No authentication session found. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/atsn/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: optionMessage,
          conversation_history: updatedHistory
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Add bot response
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: data.response,
        timestamp: new Date().toISOString(),
        intent: data.intent,
        step: data.current_step,
        payload: data.payload,
        waiting_for_user: data.waiting_for_user,
        waiting_for_upload: data.waiting_for_upload,
        upload_type: data.upload_type,
        payload_complete: data.payload_complete,
        error: data.error,
        content_items: data.content_items || null,
        lead_id: data.lead_id || null,
        lead_items: data.lead_items || null,
        calendar_entries: data.calendar_entries || null,
        agent_name: data.agent_name || 'emily',
        clarification_options: data.clarification_options || [],
        clarification_data: data.clarification_data,
        needs_connection: data.needs_connection || false,
        connection_platform: data.connection_platform || null
      }])

      // Trigger calendar refresh if calendar was generated
      if (data.calendar_entries && data.calendar_entries.length > 0) {
        console.log('Calendar generated, triggering refresh event')
        // Dispatch custom event to notify CalendarDashboard to refresh
        window.dispatchEvent(new CustomEvent('calendarRegenerated', {
          detail: { calendar_id: data.calendar_id }
        }))
        
        // Invalidate ALL calendar caches
        if (user?.id) {
          const todayCacheKey = `today_calendar_entries_${user.id}`
          const calendarDataCacheKey = `calendar_data_${user.id}`
          localStorage.removeItem(todayCacheKey)
          localStorage.removeItem(calendarDataCacheKey)
          console.log('✅ Invalidated all calendar caches (today entries + full calendar data)')
        }
      }

      // Auto-open upload modal if waiting for upload
      if (data.waiting_for_upload) {
        setTimeout(() => {
          setShowMediaUploadModal(true)
        }, 500) // Small delay to ensure modal renders properly
      }

      // Update agent status
      setAgentStatus({
        intent: data.intent,
        step: data.current_step,
        waiting: data.waiting_for_user,
        complete: data.payload_complete
      })

    } catch (error) {
      console.error('Error sending option:', error)
      const errorMessage = error.message || 'Failed to send option. Please try again.'
      showError(errorMessage)

      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: `❌ ${errorMessage}\n\n${error.message?.includes('authentication') ? 'Please refresh the page and log in again.' : 'Please try again or reset the conversation.'}`,
        timestamp: new Date().toISOString(),
        error: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDatePickerConfirm = async () => {
    if (!selectedDateRange.start) {
      showError('Please select a start date')
      return
    }

    let dateMessage = selectedDateRange.start
    if (selectedDateRange.end && selectedDateRange.end !== selectedDateRange.start) {
      dateMessage = `${selectedDateRange.start} to ${selectedDateRange.end}`
    }

    const messageId = Date.now()

    // Add user message with selected date(s)
    setMessages(prev => [...prev, {
      id: messageId,
      sender: 'user',
      text: dateMessage,
      timestamp: new Date().toISOString()
    }])

    // Update conversation history
    const updatedHistory = [...conversationHistory, dateMessage]
    setConversationHistory(updatedHistory)
    setShowDatePicker(false)
    setSelectedDateRange({ start: '', end: '' })
    setIsLoading(true)

    try {
      // Get token from session
      const token = await getAuthToken()

      if (!token) {
        throw new Error('No authentication session found. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/atsn/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: dateMessage,
          conversation_history: updatedHistory
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.')
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      // Add bot response
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: data.response,
        timestamp: new Date().toISOString(),
        intent: data.intent,
        step: data.current_step,
        payload: data.payload,
        waiting_for_user: data.waiting_for_user,
        waiting_for_upload: data.waiting_for_upload,
        upload_type: data.upload_type,
        payload_complete: data.payload_complete,
        error: data.error,
        content_items: data.content_items || null,
        lead_id: data.lead_id || null,
        lead_items: data.lead_items || null,
        calendar_entries: data.calendar_entries || null,
        agent_name: data.agent_name || 'emily',
        clarification_options: data.clarification_options || [],
        clarification_data: data.clarification_data,
        needs_connection: data.needs_connection || false,
        connection_platform: data.connection_platform || null
      }])

      // Auto-open upload modal if waiting for upload
      if (data.waiting_for_upload) {
        setTimeout(() => {
          setShowMediaUploadModal(true)
        }, 500) // Small delay to ensure modal renders properly
      }

      // Update agent status
      setAgentStatus({
        intent: data.intent,
        step: data.current_step,
        waiting: data.waiting_for_user,
        complete: data.payload_complete
      })

    } catch (error) {
      console.error('Error sending date selection:', error)
      const errorMessage = error.message || 'Failed to send date selection. Please try again.'
      showError(errorMessage)

      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: `❌ ${errorMessage}\n\n${error.message?.includes('authentication') ? 'Please refresh the page and log in again.' : 'Please try again or reset the conversation.'}`,
        timestamp: new Date().toISOString(),
        error: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleDatePickerCancel = () => {
    setShowDatePicker(false)
    setSelectedDateRange({ start: '', end: '' })
  }

  const handleSingleDatePickerConfirm = async () => {
    if (!selectedSingleDate) {
      showError('Please select a follow-up date')
      return
    }

    const dateMessage = selectedSingleDate
    const messageId = Date.now()

    // Add user message with selected date
    setMessages(prev => [...prev, {
      id: messageId,
      sender: 'user',
      text: dateMessage,
      timestamp: new Date().toISOString()
    }])

    // Update conversation history
    const updatedHistory = [...conversationHistory, dateMessage]
    setConversationHistory(updatedHistory)
    setShowSingleDatePicker(false)
    setSelectedSingleDate('')
    setIsLoading(true)

    try {
      // Get token from session
      const token = await getAuthToken()

      if (!token) {
        throw new Error('No authentication session found. Please log in again.')
      }

      const response = await fetch(`${API_BASE_URL}/atsn/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: dateMessage,
          conversation_history: updatedHistory
        })
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired. Please log in again.')
        }
        throw new Error('Failed to send message')
      }

      const data = await response.json()

      // Add bot response
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: data.response,
        timestamp: new Date().toISOString(),
        intent: data.intent,
        step: data.current_step,
        payload: data.payload,
        waiting_for_user: data.waiting_for_user,
        waiting_for_upload: data.waiting_for_upload,
        upload_type: data.upload_type,
        payload_complete: data.payload_complete,
        error: data.error,
        content_items: data.content_items || null,
        lead_id: data.lead_id || null,
        lead_items: data.lead_items || null,
        calendar_entries: data.calendar_entries || null,
        agent_name: data.agent_name || 'emily',
        clarification_options: data.clarification_options || [],
        clarification_data: data.clarification_data,
        needs_connection: data.needs_connection || false,
        connection_platform: data.connection_platform || null
      }])

      // Auto-open upload modal if waiting for upload
      if (data.waiting_for_upload) {
        setTimeout(() => {
          setShowMediaUploadModal(true)
        }, 500) // Small delay to ensure modal renders properly
      }

      // Update agent status
      setAgentStatus({
        intent: data.intent,
        step: data.current_step,
        waiting: data.waiting_for_user,
        complete: data.payload_complete
      })

    } catch (error) {
      console.error('Error sending follow-up date:', error)
      const errorMessage = error.message || 'Failed to send follow-up date. Please try again.'
      showError(errorMessage)

      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'bot',
        text: `❌ ${errorMessage}\n\n${error.message?.includes('authentication') ? 'Please refresh the page and log in again.' : 'Please try again or reset the conversation.'}`,
        timestamp: new Date().toISOString(),
        error: true
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSingleDatePickerCancel = () => {
    setShowSingleDatePicker(false)
    setSelectedSingleDate('')
  }

  const handleFileSelection = (files) => {
    // Store selected files for confirmation before upload
    setSelectedFilesForUpload(files)
  }

  const handleAgentHover = (agentName, event) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTooltipAgent(agentName)
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    })
  }

  const handleAgentLeave = () => {
    setTooltipAgent(null)
  }

  const handleCancelUpload = () => {
    setSelectedFilesForUpload([])
  }

  const handleConfirmUpload = async () => {
    if (selectedFilesForUpload.length === 0) return

    setIsUploadingMedia(true)

    // Capture media type before clearing
    const mediaType = selectedFilesForUpload[0].type.startsWith('image/') ? 'image' : 'video'

    try {
      const token = await getAuthToken()
      if (!token) {
        showError('Authentication required')
        return
      }

      const formData = new FormData()
      selectedFilesForUpload.forEach((file, index) => {
        formData.append('files', file)
      })

      const response = await fetch(`${API_BASE_URL}/media/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (response.ok) {
        const data = await response.json()
        setUploadedMediaUrls(data.urls || [])
        setShowMediaUploadModal(false)

        // Clear selected files after capturing media type
        setSelectedFilesForUpload([])

        // Check if this is a clarification upload or waiting for upload
        const lastMessage = messages[messages.length - 1]
        const isClarificationUpload = lastMessage && lastMessage.clarification_data && lastMessage.clarification_data.type === 'upload_request'
        const isWaitingForUpload = lastMessage && lastMessage.waiting_for_upload

        if (isClarificationUpload || isWaitingForUpload) {
          // Send upload response without adding a chat message for waiting_for_upload
          let messageToSend = ""
          let conversationHistoryToSend = conversationHistory

          if (isWaitingForUpload) {
            // For waiting_for_upload, send a special token that won't trigger intent changes
            messageToSend = "[MEDIA_UPLOAD]"
          } else {
            // For clarification uploads, send the upload message
            messageToSend = `I uploaded the ${mediaType}: ${data.urls[0]}`
            conversationHistoryToSend = [...conversationHistory, messageToSend]

            // Add to chat for clarification uploads
            setMessages(prev => [...prev, {
              id: Date.now(),
              sender: 'user',
              text: messageToSend,
              timestamp: new Date().toISOString(),
              media_urls: data.urls || []
            }])
          }

          // Send upload response
          try {
            const chatResponse = await fetch(`${API_BASE_URL}/atsn/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                message: messageToSend,
                media_urls: data.urls || [],
                conversation_history: conversationHistoryToSend
              })
            })

            if (chatResponse.ok) {
              const chatData = await chatResponse.json()
            // Handle the response similar to regular messages
            setMessages(prev => [...prev, {
              id: Date.now() + 1,
              sender: 'bot',
              text: chatData.response || 'Content creation task started!',
              timestamp: new Date().toISOString(),
              intent: chatData.intent,
              agent_name: chatData.agent_name
            }])
          }
          } catch (chatError) {
            console.error('Error sending clarification response:', chatError)
          }
        } else {
          // This is a regular media upload (not clarification) - create new task
          const taskMessage = `I uploaded a ${mediaType} for my content. Please help me create engaging content using this media.`

          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: 'user',
            text: taskMessage,
            timestamp: new Date().toISOString(),
            media_urls: data.urls || []
          }])

          // Send to chatbot
          try {
            const chatResponse = await fetch(`${API_BASE_URL}/atsn/chat`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify({
                message: taskMessage,
                media_urls: data.urls || [],
                conversation_history: [...conversationHistory, taskMessage]
              })
            })

            if (chatResponse.ok) {
              const chatData = await chatResponse.json()
              // Handle the response similar to regular messages
              setMessages(prev => [...prev, {
                id: Date.now() + 1,
                sender: 'bot',
                text: chatData.response || 'Content creation task started!',
                timestamp: new Date().toISOString(),
                intent: chatData.intent,
                agent_name: chatData.agent_name
              }])
            }
          } catch (chatError) {
            console.error('Error sending media upload task:', chatError)
          }

          showSuccess('Media uploaded and task created successfully!')
        }
      } else {
        throw new Error('Upload failed')
      }
    } catch (error) {
      console.error('Upload error:', error)
      showError('Failed to upload media')
    } finally {
      setIsUploadingMedia(false)
    }
  }

  // Publish functions copied from ContentDashboard
  const getBestImageUrl = (content) => {
    console.log('🔍 getBestImageUrl - Content object:', {
      hasImages: !!content.images,
      imagesType: typeof content.images,
      imagesIsArray: Array.isArray(content.images),
      imagesLength: content.images?.length || 0,
      imagesValue: content.images,
      firstImage: content.images?.[0],
      media_url: content.media_url,
      primary_image_url: content.primary_image_url,
      rawDataImages: content.raw_data?.images,
      content_id: content.content_id,
      platform: content.platform
    })

    if (content.images && Array.isArray(content.images) && content.images.length > 0) {
      console.log('✅ Using content.images[0]:', content.images[0])
      return content.images[0]
    }
    if (content.media_url) {
      console.log('✅ Using content.media_url:', content.media_url)
      return content.media_url
    }
    if (content.primary_image_url) {
      console.log('✅ Using content.primary_image_url:', content.primary_image_url)
      return content.primary_image_url
    }
    if (content.raw_data?.images && Array.isArray(content.raw_data.images) && content.raw_data.images.length > 0) {
      console.log('✅ Using content.raw_data.images[0]:', content.raw_data.images[0])
      return content.raw_data.images[0]
    }
    console.log('❌ No image URL found in any location')
    return ''
  }

  const postToFacebook = async (content) => {
    try {
      const authToken = await getAuthToken()

      // Check if this is a carousel post
      const isCarousel = content.post_type === 'carousel' ||
                         (content.metadata && content.metadata.carousel_images && content.metadata.carousel_images.length > 0)
      const carouselImages = isCarousel ? (content.metadata?.carousel_images || []) : []

      // Get the image URL if available (from content.images array)
      let imageUrl = getBestImageUrl(content)
      if (imageUrl && !isCarousel) {
        console.log('📸 Including image in Facebook post:', imageUrl)
      }

      if (isCarousel) {
        console.log(`🎠 Posting carousel with ${carouselImages.length} images to Facebook`)
      }

      const postBody = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.content_id
      }

      if (isCarousel && carouselImages.length > 0) {
        postBody.post_type = 'carousel'
        postBody.carousel_images = carouselImages
      } else {
        postBody.image_url = imageUrl
      }

      const response = await fetch(`${API_BASE_URL}/connections/facebook/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Facebook post result:', result)

      // Update the content status in database
      await updateContentStatus(content.id, 'published')

      // Update the content status in messages
      const publishedAt = new Date().toISOString()
      setMessages(prev => prev.map(message => {
        if (message.content_items) {
          return {
            ...message,
            content_items: message.content_items.map(item =>
              item.content_id === content.id
                ? { ...item, facebook_post_id: result.post_id }
                : item
            )
          }
        }
        return message
      }))

      // Update success data with post URL
      setPublishSuccessData(prev => ({
        ...prev,
        postUrl: result.post_url || result.url
      }))

    } catch (error) {
      console.error('Error posting to Facebook:', error)
      throw error
    }
  }

  const postToInstagram = async (content) => {
    let oauthError = null

    try {
      const authToken = await getAuthToken()

      // Check if this is a carousel post
      const isCarousel = content.post_type === 'carousel' ||
                         (content.metadata && content.metadata.carousel_images && content.metadata.carousel_images.length > 0)
      const carouselImages = isCarousel ? (content.metadata?.carousel_images || []) : []

      let imageUrl = getBestImageUrl(content)
      if (imageUrl && !isCarousel) {
        console.log('📸 Including image in Instagram post:', imageUrl)
      }

      if (isCarousel) {
        console.log(`🎠 Posting carousel with ${carouselImages.length} images to Instagram`)
      }

      const postBody = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.content_id
      }

      if (isCarousel && carouselImages.length > 0) {
        postBody.post_type = 'carousel'
        postBody.carousel_images = carouselImages
      } else {
        postBody.image_url = imageUrl
      }

      const response = await fetch(`${API_BASE_URL}/connections/instagram/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('Instagram post result:', result)

      // Update the content status in database
      await updateContentStatus(content.id, 'published')

      // Update the content status in messages
      const publishedAt = new Date().toISOString()
      setMessages(prev => prev.map(message => {
        if (message.content_items) {
          return {
            ...message,
            content_items: message.content_items.map(item =>
              item.content_id === content.id
                ? { ...item, instagram_post_id: result.post_id }
                : item
            )
          }
        }
        return message
      }))

      // Update success data with post URL
      setPublishSuccessData(prev => ({
        ...prev,
        postUrl: result.post_url || result.url
      }))

    } catch (error) {
      console.error('Error posting to Instagram:', error)
      throw error
    }
  }

  const postToLinkedIn = async (content) => {
    try {
      const authToken = await getAuthToken()

      // Get the image URL if available (from content.images array)
      let imageUrl = getBestImageUrl(content)
      if (imageUrl) {
        console.log('📸 Including image in LinkedIn post:', imageUrl)
      }

      const postBody = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.content_id
      }

      if (imageUrl) {
        postBody.image_url = imageUrl
      }

      const response = await fetch(`${API_BASE_URL}/connections/linkedin/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('LinkedIn post result:', result)

      // Update the content status in database
      await updateContentStatus(content.id, 'published')

      // Update the content status in messages
      const publishedAt = new Date().toISOString()
      setMessages(prev => prev.map(message => {
        if (message.content_items) {
          return {
            ...message,
            content_items: message.content_items.map(item =>
              item.content_id === content.id
                ? { ...item, linkedin_post_id: result.post_id || result.id }
                : item
            )
          }
        }
        return message
      }))

      // Update success data with post URL
      setPublishSuccessData(prev => ({
        ...prev,
        postUrl: result.post_url || result.url
      }))

    } catch (error) {
      console.error('Error posting to LinkedIn:', error)
      throw error
    }
  }

  const postToYouTube = async (content) => {
    try {
      const authToken = await getAuthToken()

      // Get the image URL if available (from content.images array)
      let imageUrl = getBestImageUrl(content)
      if (imageUrl) {
        console.log('📸 Including image in YouTube post:', imageUrl)
      }

      const postBody = {
        message: content.content,
        title: content.title,
        hashtags: content.hashtags || [],
        content_id: content.content_id
      }

      if (imageUrl) {
        postBody.image_url = imageUrl
      }

      const response = await fetch(`${API_BASE_URL}/connections/youtube/post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(postBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('YouTube post result:', result)

      // Update the content status in database
      await updateContentStatus(content.id, 'published')

      // Update the content status in messages
      const publishedAt = new Date().toISOString()
      setMessages(prev => prev.map(message => {
        if (message.content_items) {
          return {
            ...message,
            content_items: message.content_items.map(item =>
              item.content_id === content.id
                ? { ...item, youtube_post_id: result.post_id || result.id }
                : item
            )
          }
        }
        return message
      }))

      // Update success data with post URL
      setPublishSuccessData(prev => ({
        ...prev,
        postUrl: result.post_url || result.url
      }))

    } catch (error) {
      console.error('Error posting to YouTube:', error)
      throw error
    }
  }

  const showPostNotification = (platform, url) => {
    // Simple notification - could be enhanced
    showSuccess(`Successfully posted to ${platform}!${url ? ` View post: ${url}` : ''}`)
  }

  // Render agent icon based on agent name
  const renderAgentIcon = (agentName) => {
    switch (agentName?.toLowerCase()) {
      case 'leo':
        return <img src="/leo_logo.png" alt="Leo" className="w-16 h-16 rounded-full object-cover" />
      case 'chase':
        return <img src="/chase_logo.png" alt="Chase" className="w-16 h-16 rounded-full object-cover" />
      case 'orio':
        return <span className="text-xl font-bold text-white">O</span>
      case 'atsn ai':
        // Combined logo for atsn ai welcome message - all four agents
        return (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 via-blue-500 to-green-500 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <div className="grid grid-cols-2 gap-1">
                  <img src="/emily_icon.png" alt="E" className="w-4 h-4 rounded-full object-cover" />
                  <img src="/leo_logo.png" alt="L" className="w-4 h-4 rounded-full object-cover" />
                  <img src="/chase_logo.png" alt="C" className="w-4 h-4 rounded-full object-cover" />
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                    <span className="text-xs font-bold text-white">O</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      case 'emily':
      default:
        return <img src="/emily_icon.png" alt="Emily" className="w-16 h-16 rounded-full object-cover" />
    }
  }


  // Get thinking message based on current phase
  const getThinkingMessage = () => {
    if (isFirstMessage) {
      switch (thinkingPhase) {
        case 0:
          return "Assigning a suitable agent to work on your request...";
        case 1:
          return "Contacting the agent...";
        case 2:
          return "Invoking the agent...";
        default:
          return "Working on your request...";
      }
    } else {
      switch (thinkingPhase) {
        case 0:
          return "Working on your request...";
        case 1:
          return "Processing your request...";
        case 2:
          return "Finalizing your request...";
        default:
          return "Almost done...";
      }
    }
  }

  // Get agent based on message content
  const getAgentFromMessage = (message) => {
    const msg = message.toLowerCase();
    if (msg.includes('lead')) return 'chase';
    if (msg.includes('analytics') || msg.includes('insight')) return 'orio';

    // Check for view/search operations on content first
    if ((msg.includes('view') || msg.includes('show') || msg.includes('find') || msg.includes('search')) && msg.includes('content')) {
      return 'emily';
    }

    // Then check for other content operations
    if (msg.includes('content') || msg.includes('post') || msg.includes('schedule') || msg.includes('publish')) return 'leo';

    return 'emily';
  }

  // Format agent name for display
  const formatAgentName = (agentName) => {
    if (!agentName) return 'Emily';
    if (agentName.toLowerCase() === 'atsn') return 'ATSN Team';
    return agentName.charAt(0).toUpperCase() + agentName.slice(1);
  }


  return (
    <div className="flex flex-col h-full rounded-lg">
      {/* Custom scrollbar styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .chat-scrollbar::-webkit-scrollbar {
            height: 6px;
          }
          .chat-scrollbar::-webkit-scrollbar-track {
            background: #f3f4f6;
            border-radius: 3px;
          }
          .chat-scrollbar::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
          }
          .chat-scrollbar::-webkit-scrollbar-thumb:hover {
            background: #6B7280;
          }

          /* Hide scrollbar for chat messages */
          .scrollbar-hide {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;  /* Chrome, Safari and Opera */
          }
        `
      }} />

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowScheduleModal(false)
            }
          }}
        >
          <div
            className={`rounded-lg p-6 max-w-md w-full mx-4 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}
          >
            <h3 className={`text-xl font-semibold mb-4 ${
              isDarkMode ? 'text-gray-100' : 'text-gray-900'
            }`}>Schedule Content</h3>
            <div className="space-y-4">
              <div>
                <label className={`block text-base font-medium mb-1 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>Date</label>
                <input
                  type="date"
                  value={scheduleData.date}
                  onChange={(e) => setScheduleData(prev => ({ ...prev, date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-purple-400'
                      : 'border-gray-300 text-gray-900'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-base font-medium mb-1 ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-700'
                }`}>Time</label>
                <input
                  type="time"
                  value={scheduleData.time}
                  onChange={(e) => setScheduleData(prev => ({ ...prev, time: e.target.value }))}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    isDarkMode
                      ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-purple-400'
                      : 'border-gray-300 text-gray-900'
                  }`}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowScheduleModal(false)}
                className={`flex-1 px-4 py-2 text-base rounded-md transition-colors ${
                  isDarkMode
                    ? 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleScheduleConfirm}
                disabled={isScheduling || !scheduleData.date || !scheduleData.time}
                className={`flex-1 px-4 py-2 text-base rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors ${
                  isDarkMode
                    ? 'bg-purple-600 text-white hover:bg-purple-700 focus:ring-purple-400'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isScheduling ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  'Schedule'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Messages or Welcome Screen */}
      <div
        className="flex-1 overflow-y-auto scrollbar-hide p-6"
        onClick={handleChatAreaClick}
      >
        {/* Chat Messages */}
          <div className="flex flex-col h-full">
            <div className="flex-1 space-y-6">
            {messages.map((message, index) => (
          <div
            key={message.id}
            className={`group flex gap-3 ${message.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            {/* Avatar */}
            <div
              className={`${
                message.agent_name?.toLowerCase() === 'emily' || message.agent_name?.toLowerCase() === 'leo' || message.agent_name?.toLowerCase() === 'chase' || message.agent_name?.toLowerCase() === 'atsn ai'
                  ? 'w-16 h-16'
                  : 'w-8 h-8'
              } rounded-full flex items-center justify-center flex-shrink-0 ${
                message.sender === 'bot' ? 'hover:scale-110 transition-transform duration-200 cursor-pointer border-2 border-gray-300' : ''
              } ${
              message.sender === 'user'
                ? 'bg-gradient-to-br from-pink-500 to-rose-500'
                : message.agent_name?.toLowerCase() === 'leo'
                  ? '' // No background for Leo
                : message.agent_name?.toLowerCase() === 'chase'
                  ? '' // No background for Chase
                  : message.agent_name?.toLowerCase() === 'emily'
                  ? '' // No background for Emily
                  : message.agent_name?.toLowerCase() === 'atsn ai'
                  ? '' // No background for atsn ai combined logo
                : 'bg-gradient-to-br from-purple-500 to-pink-500'
              }`}
              onMouseEnter={message.sender === 'bot' ? (e) => handleAgentHover(message.agent_name, e) : undefined}
              onMouseLeave={message.sender === 'bot' ? handleAgentLeave : undefined}
            >
              {message.sender === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                renderAgentIcon(message.agent_name)
              )}
            </div>

            {/* Message bubble */}
            <div className={`flex-1 max-w-[60%] ${message.sender === 'user' ? 'text-right' : 'text-left'}`}>
              <div
                className={`inline-block p-4 rounded-2xl backdrop-blur-md border shadow-lg ${
                  message.sender === 'user'
                    ? 'bg-pink-500/90 border-pink-400 text-white rounded-tr-none'
                    : message.error
                    ? isDarkMode
                      ? 'bg-red-900/50 border-red-700 text-red-200 rounded-tl-none'
                      : 'bg-red-50 border-red-200 text-red-900 rounded-tl-none'
                    : isDarkMode
                    ? 'bg-gray-800/80 border-gray-600 text-white rounded-tl-none'
                    : 'bg-white/80 border-gray-200 text-gray-900 rounded-tl-none'
                }`}
              >
                {message.sender === 'bot' ? (
                  <div className="space-y-4">
                    {/* Agent name above message */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-base font-bold bg-clip-text text-transparent ${
                        message.agent_name?.toLowerCase() === 'leo'
                          ? isDarkMode
                            ? 'bg-gradient-to-r from-blue-300 to-blue-500'
                            : 'bg-gradient-to-r from-blue-500 to-blue-700'
                          : message.agent_name?.toLowerCase() === 'chase'
                          ? isDarkMode
                            ? 'bg-gradient-to-r from-green-400 to-yellow-400'
                            : 'bg-gradient-to-r from-green-800 to-amber-800'
                          : message.agent_name?.toLowerCase() === 'atsn'
                          ? isDarkMode
                            ? 'bg-gradient-to-r from-purple-300 via-blue-300 to-green-300'
                            : 'bg-gradient-to-r from-purple-500 via-blue-500 to-green-500'
                          : isDarkMode
                          ? 'bg-gradient-to-r from-purple-400 to-pink-400'
                          : 'bg-gradient-to-r from-purple-600 to-pink-500'
                      }`}>
                        {formatAgentName(message.agent_name)}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopyMessage(message)}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          }`}
                          title="Copy message"
                        >
                          <Copy className={`w-3 h-3 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`} />
                        </button>
                        <button
                          onClick={() => handleLikeMessage(message)}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          }`}
                          title={likedMessages.has(message.id) ? "Unlike message" : "Like message"}
                        >
                          <Heart className={`w-3 h-3 ${
                            likedMessages.has(message.id)
                              ? 'text-red-500 fill-current'
                              : isDarkMode
                              ? 'text-gray-400'
                              : 'text-gray-600'
                          }`} />
                        </button>
                        <button
                          onClick={() => handleDeleteMessage(message)}
                          className={`p-1 rounded transition-colors ${
                            isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'
                          }`}
                          title="Delete message"
                        >
                          <Trash2 className={`w-3 h-3 ${
                            isDarkMode ? 'text-gray-400' : 'text-gray-600'
                          }`} />
                        </button>
                      </div>
                    </div>

                    <div className="relative max-w-none leading-tight">
                      {/* Clean message text to remove stray characters */}
                      {(() => {
                        let displayText = message.text || '';
                        // Remove trailing )} patterns
                        displayText = displayText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                        // Remove any standalone )} patterns
                        displayText = displayText.replace(/\s*\)\s*\}\s*/g, '');
                        
                        // Check if message contains markdown syntax
                        const hasMarkdown = displayText.includes('#') || displayText.includes('*') || displayText.includes('`') || displayText.includes('[');
                        
                        return hasMarkdown ? (
                          <div className={`leading-tight pr-16 ${
                            isDarkMode ? 'prose-invert prose prose-gray' : 'prose'
                          }`}>
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {displayText}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className={`whitespace-pre-line leading-tight pr-16 ${
                            isDarkMode ? 'text-white' : ''
                          }`}>
                            {displayText}
                          </div>
                        );
                      })()}
                      <div className={`absolute bottom-0 right-0 text-xs ${
                        message.sender === 'user'
                          ? 'text-white'
                          : isDarkMode
                          ? 'text-gray-500'
                          : 'text-gray-400'
                      }`}>
                        {(() => {
                          const date = new Date(message.timestamp);
                          const hours = date.getHours();
                          const minutes = date.getMinutes().toString().padStart(2, '0');
                          const ampm = hours >= 12 ? 'PM' : 'AM';
                          const displayHours = hours % 12 || 12;
                          return `${displayHours}:${minutes} ${ampm}`;
                        })()}
                      </div>
                      </div>

                    {/* Handle upload requests */}
                    {message.clarification_data && message.clarification_data.type === 'upload_request' && message.waiting_for_user && (
                      <div className="mt-4">
                        <button
                          onClick={() => {
                            // Open media upload modal for image upload
                            setShowMediaUploadModal(true)
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            isDarkMode
                              ? 'bg-blue-600 hover:bg-blue-500 text-white'
                              : 'bg-blue-500 hover:bg-blue-600 text-white'
                          }`}
                        >
                          📤 Upload {message.clarification_data.upload_type === 'image' ? 'Image' : 'Media'}
                        </button>
                        <p className={`mt-2 text-sm ${
                          isDarkMode ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          {message.clarification_data.message}
                        </p>
                      </div>
                    )}

                    {/* Render clarification options only for active clarifications */}
                    {message.clarification_options && message.clarification_options.length > 0 && message.waiting_for_user && (
                      <div className="mt-4 flex flex-wrap gap-3">
                        {message.clarification_options.map((option, index) => (
                          <button
                            key={index}
                            onClick={() => handleOptionSelect(option.value)}
                            className={`px-3 py-2 transition-all duration-200 text-base font-normal hover:underline ${
                              message.agent_name?.toLowerCase() === 'leo'
                                ? isDarkMode
                                  ? 'text-blue-300 hover:text-blue-200'
                                  : 'text-blue-600 hover:text-blue-700'
                                : message.agent_name?.toLowerCase() === 'emily'
                                ? isDarkMode
                                  ? 'text-pink-300 hover:text-pink-200'
                                  : 'text-purple-600 hover:text-purple-700'
                                : message.agent_name?.toLowerCase() === 'chase'
                                ? isDarkMode
                                  ? 'text-green-300 hover:text-green-200'
                                  : 'text-green-800 hover:text-amber-800'
                                : message.agent_name?.toLowerCase() === 'atsn'
                                ? isDarkMode
                                  ? 'text-purple-300 hover:text-blue-300'
                                  : 'text-purple-500 hover:text-blue-500'
                                : isDarkMode
                                ? 'text-purple-400 hover:text-pink-400'
                                : 'text-purple-600 hover:text-pink-500'
                            }`}
                          >
                            <div className="font-normal text-center">{option.label}</div>
                            {option.description && (
                              <div className="text-xs opacity-75 mt-1 text-center leading-tight">{option.description}</div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Render content cards if available */}
                    {message.content_items && message.content_items.length > 0 && (
                      <div className="mt-4">
                        {/* Horizontal scrollable posts window */}
                        <div className="w-full max-w-4xl">
                          <div className="relative">
                            {/* Scrollable container with window effect - shows ~5 posts width */}
                            <div className="overflow-x-auto overflow-y-hidden max-w-full" style={{
                              scrollbarWidth: 'thin',
                              scrollbarColor: '#9CA3AF #E5E7EB'
                            }}>
                              <div className="chat-scrollbar flex gap-4 pb-2 px-1" style={{
                                width: 'max-content',
                                minWidth: message.content_items.length > 5 ? `${message.content_items.length * 336}px` : 'auto' // 320px + 16px gap (w-80 = 320px)
                              }}>
                                {message.content_items.map((contentItem, index) => (
                                   <div key={`${message.id}-${index}`} className="relative flex-shrink-0 w-96">
                                    {/* Selection checkbox for view, delete, and publish operations */}
                                    {(message.intent === 'view_content' || message.intent === 'delete_content' || message.intent === 'created_content' || message.intent === 'publish_content') && (
                                      <div className="absolute top-2 right-2 z-10">
                                        <button
                                          onClick={() => handleContentSelect(contentItem.content_id, message.intent)}
                                          className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                                            selectedContent.includes(contentItem.content_id)
                                              ? (message.intent === 'delete_content' ? 'bg-red-600 border-red-600' : 'bg-purple-600 border-purple-600') + ' text-white'
                                              : 'bg-white border-gray-300 hover:border-purple-400'
                                          }`}
                                        >
                                          {selectedContent.includes(contentItem.content_id) ? (
                                            <CheckSquare className="w-4 h-4" />
                                          ) : (
                                            <Square className="w-4 h-4" />
                                          )}
                                        </button>
                                      </div>
                                    )}

                                    {/* Use ATSNContentCard for posts and reels, ContentCard for others */}
                                    {contentItem.raw_data?.content_type === 'post' || contentItem.content_type?.toLowerCase().includes('post') ||
                                     contentItem.content_type?.toLowerCase().includes('reel') || contentItem.content_type?.toLowerCase().includes('video') ? (
                                      <ATSNContentCard
                                        content={{
                                          id: contentItem.content_id,
                                          title: contentItem.title_display || contentItem.title,
                                          content: contentItem.content_preview || contentItem.content_text,
                                          hashtags: contentItem.hashtags_display ?
                                            contentItem.hashtags_display.split(' ').filter(tag => tag.startsWith('#')).map(tag => tag.substring(1)) :
                                            (contentItem.hashtags ?
                                              (Array.isArray(contentItem.hashtags) ? contentItem.hashtags : []) :
                                              []),
                                          media_url: contentItem.media_url,
                                          images: contentItem.images || [],
                                          metadata: contentItem.metadata || {},
                                          post_type: contentItem.raw_data?.post_type,
                                          content_type: contentItem.content_type,
                                          selected_content_type: contentItem.raw_data?.selected_content_type,
                                          carousel_images: contentItem.raw_data?.carousel_images || contentItem.raw_data?.images,
                                          // Add additional fields for different content types
                                          email_subject: contentItem.email_subject,
                                          email_body: contentItem.email_body,
                                          short_video_script: contentItem.short_video_script,
                                          long_video_script: contentItem.long_video_script,
                                          message: contentItem.message,
                                          status: contentItem.status || 'draft', // Add status field
                                          scheduled_at: contentItem.scheduled_at // Add scheduled_at for status display
                                        }}
                                        platform={contentItem.platform}
                                        contentType={contentItem.content_type}
                                        intent={message.intent}
                                        onClick={() => handleContentClick(contentItem)}
                                        isDarkMode={isDarkMode}
                                      />
                                    ) : (
                                      <ContentCard
                                        content={{
                                          id: contentItem.content_id,
                                          title: contentItem.title_display || contentItem.title,
                                          content: contentItem.content_preview || contentItem.content_text,
                                          hashtags: contentItem.hashtags_display ?
                                            contentItem.hashtags_display.split(' ').filter(tag => tag.startsWith('#')).map(tag => tag.substring(1)) :
                                            (contentItem.hashtags ?
                                              (Array.isArray(contentItem.hashtags) ? contentItem.hashtags : []) :
                                              []),
                                          media_url: contentItem.media_url,
                                          images: contentItem.images || [],
                                          metadata: contentItem.metadata || {},
                                          post_type: contentItem.raw_data?.post_type,
                                          content_type: contentItem.content_type,
                                          selected_content_type: contentItem.raw_data?.selected_content_type,
                                          carousel_images: contentItem.raw_data?.carousel_images || contentItem.raw_data?.images,
                                          // Add additional fields for different content types
                                          email_subject: contentItem.email_subject,
                                          email_body: contentItem.email_body,
                                          short_video_script: contentItem.short_video_script,
                                          long_video_script: contentItem.long_video_script,
                                          message: contentItem.message,
                                          status: contentItem.status || 'draft', // Add status field
                                          scheduled_at: contentItem.scheduled_at // Add scheduled_at for status display
                                        }}
                                        platform={contentItem.platform}
                                        contentType={contentItem.content_type}
                                        minimal={message.intent !== 'created_content'}
                                        onCopy={() => {
                                          let textToCopy = '';

                                          // Handle different content types for copying
                                          if (contentItem.content_type?.toLowerCase() === 'email' && contentItem.email_subject && contentItem.email_body) {
                                            textToCopy = `Subject: ${contentItem.email_subject}\n\n${contentItem.email_body}`;
                                          } else if ((contentItem.content_type?.toLowerCase() === 'short video' || contentItem.content_type?.toLowerCase() === 'long video') && (contentItem.short_video_script || contentItem.long_video_script)) {
                                            textToCopy = contentItem.short_video_script || contentItem.long_video_script;
                                          } else if (contentItem.content_type?.toLowerCase() === 'message' && contentItem.message) {
                                            textToCopy = contentItem.message;
                                          } else {
                                            textToCopy = contentItem.content_preview || contentItem.content_text;
                                          }

                                          if (textToCopy) {
                                            navigator.clipboard.writeText(textToCopy);
                                            showSuccess('Content copied to clipboard!');
                                          }
                                        }}
                                        onPreview={(content) => {
                                          // Open content preview modal
                                          console.log('Eye icon clicked - contentItem.platform:', contentItem.platform, 'contentItem.content_type:', contentItem.content_type);
                                          const contentWithPlatform = {
                                            ...content,
                                            platform: contentItem.platform,
                                            content_type: contentItem.content_type
                                          };
                                          console.log('Content with platform:', contentWithPlatform.platform);
                                          setSelectedContentForModal(contentWithPlatform);
                                          setShowContentModal(true);
                                        }}
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Scroll indicators */}
                            {message.content_items.length > 5 && (
                              <div className="flex justify-center mt-2">
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <span>← Scroll to see more posts →</span>
                                </div>
                              </div>
                            )}
                          </div>


                                          {/* Action buttons for publish content */}
                          {message.intent === 'publish_content' && message.content_items && message.content_items.length > 0 && selectedContent.length > 0 && (
                            <div className={`mt-4 flex flex-wrap items-center gap-3 p-4 backdrop-blur-md border rounded-xl shadow-lg ${
                              isDarkMode
                                ? 'bg-gray-800/90 border-gray-700'
                                : 'bg-white/90 border-gray-200'
                            }`}>
                              <div className="flex gap-2">
                                <button
                                  onClick={handlePublishSelected}
                                  disabled={isPublishing}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  {isPublishing ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      Publishing...
                                    </>
                                  ) : (
                                    <>
                                      <Share className="w-4 h-4" />
                                      Publish Selected ({selectedContent.length})
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          )}

                                          {/* Action buttons for created content */}
                          {message.intent === 'created_content' && message.content_items && message.content_items.length > 0 && (
                            <div className={`mt-4 flex flex-wrap items-center gap-3 p-4 backdrop-blur-md border rounded-xl shadow-lg ${
                              isDarkMode
                                ? 'bg-gray-800/90 border-gray-700'
                                : 'bg-white/90 border-gray-200'
                            }`}>
                              <div className="flex gap-2">
                                <button
                                  onClick={handleEditSelected}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <Edit className="w-4 h-4" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  onClick={handlePublishSelected}
                                  disabled={isPublishing}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  {isPublishing ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      <span>Publishing...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Share className="w-4 h-4" />
                                      <span>Publish</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={handleScheduleSelected}
                                  disabled={isScheduling}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  {isScheduling ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      <span>Scheduling...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-4 h-4" />
                                      <span>Schedule</span>
                                    </>
                                  )}
                                </button>
                                <button
                                  onClick={handleSaveSelected}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <Save className="w-4 h-4" />
                                  <span>Save Draft</span>
                                </button>
                                <button
                                  onClick={handleDeleteSelected}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <Trash2 className="w-4 h-4" />
                                  <span>Delete</span>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Selection controls for view operations - below posts */}
                          {message.intent === 'view_content' && (
                            <div className="mt-4 flex flex-wrap items-center gap-3 p-3 rounded-lg">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSelectAll(message.content_items)}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <CheckSquare className="w-4 h-4" />
                                  <span>Select All</span>
                                </button>
                                <button
                                  onClick={handleDeselectAll}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <Square className="w-4 h-4" />
                                  <span>Deselect All</span>
                                </button>
                                <span className="text-base text-gray-600">
                                  {selectedContent.length}/{message.content_items.length} selected
                                </span>
                              </div>
                              {selectedContent.length > 0 && (
                                <div className="flex gap-2">
                                  <button
                                    onClick={handleEditSelected}
                                    disabled={selectedContent.length > 1}
                                    className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                  >
                                    <Edit className="w-4 h-4" />
                                    <span>Edit {selectedContent.length === 1 ? '' : '(Select 1)'}</span>
                                  </button>
                                  <button
                                    onClick={handlePublishSelected}
                                    disabled={isPublishing}
                                    className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                  >
                                    {isPublishing ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Publishing...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Share className="w-4 h-4" />
                                        <span>Publish ({selectedContent.length})</span>
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={handleScheduleSelected}
                                    disabled={selectedContent.length > 1}
                                    className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                  >
                                    <Calendar className="w-4 h-4" />
                                    <span>Schedule {selectedContent.length === 1 ? '' : '(Select 1)'}</span>
                                  </button>
                                  <button
                                    onClick={handleDeleteSelected}
                                    disabled={isDeleting}
                                    className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                  >
                                    {isDeleting ? (
                                      <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        <span>Deleting...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="w-4 h-4" />
                                        <span>Delete ({selectedContent.length})</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Selection controls for delete operations - below posts */}
                          {message.intent === 'delete_content' && (
                            <div className="mt-4 flex flex-wrap items-center gap-3 p-3 rounded-lg">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSelectAll(message.content_items)}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <CheckSquare className="w-4 h-4" />
                                  <span>Select All</span>
                                </button>
                                <button
                                  onClick={handleDeselectAll}
                                  className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                                >
                                  <Square className="w-4 h-4" />
                                  <span>Deselect All</span>
                                </button>
                                <span className="text-base text-gray-600">
                                  {selectedContent.length}/{message.content_items.length} selected
                                </span>
                              </div>
                              {selectedContent.length > 0 && (
                                <button
                                  onClick={handleDeleteSelected}
                                  disabled={isDeleting}
                                  className="px-4 py-2 text-base bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                                >
                                  {isDeleting ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      Deleting...
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="w-4 h-4" />
                                      Delete Selected ({selectedContent.length})
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Render lead table for view_leads and other lead operations */}
                    {message.lead_items && message.lead_items.length > 0 && (
                      <div className="mt-4">
                        {/* Filter Controls */}
                        <div className={`rounded-xl shadow-lg border p-4 mb-4 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50'
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Search Filter */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-green-300' : 'text-green-800'
                              }`}>
                                Search
                              </label>
                              <input
                                type="text"
                                placeholder="Name or email..."
                                value={leadFilters.search}
                                onChange={(e) => setLeadFilters(prev => ({ ...prev, search: e.target.value }))}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                                  isDarkMode
                                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500 placeholder-gray-400'
                                    : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                                }`}
                              />
                            </div>

                            {/* Status Filter */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-green-300' : 'text-green-800'
                              }`}>
                                Status
                              </label>
                              <select
                                value={leadFilters.status}
                                onChange={(e) => setLeadFilters(prev => ({ ...prev, status: e.target.value }))}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                                  isDarkMode
                                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500'
                                    : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                                }`}
                              >
                                <option value="">All Status</option>
                                <option value="new">New</option>
                                <option value="contacted">Contacted</option>
                                <option value="responded">Responded</option>
                                <option value="qualified">Qualified</option>
                                <option value="converted">Converted</option>
                                <option value="lost">Lost</option>
                                <option value="invalid">Invalid</option>
                              </select>
                            </div>

                            {/* Source Filter */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-green-300' : 'text-green-800'
                              }`}>
                                Source
                              </label>
                              <select
                                value={leadFilters.source}
                                onChange={(e) => setLeadFilters(prev => ({ ...prev, source: e.target.value }))}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                                  isDarkMode
                                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500'
                                    : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                                }`}
                              >
                                <option value="">All Sources</option>
                                <option value="Website">Website</option>
                                <option value="Facebook">Facebook</option>
                                <option value="Instagram">Instagram</option>
                                <option value="LinkedIn">LinkedIn</option>
                                <option value="Walk Ins">Walk Ins</option>
                                <option value="Referral">Referral</option>
                                <option value="Email">Email</option>
                                <option value="Phone Call">Phone Call</option>
                                <option value="Manual Entry">Manual Entry</option>
                              </select>
                            </div>

                            {/* Date From Filter */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-green-300' : 'text-green-800'
                              }`}>
                                Date From
                              </label>
                              <input
                                type="date"
                                value={leadFilters.dateFrom}
                                onChange={(e) => setLeadFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                                  isDarkMode
                                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500'
                                    : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                                }`}
                              />
                            </div>

                            {/* Date To Filter */}
                            <div>
                              <label className={`block text-sm font-medium mb-2 ${
                                isDarkMode ? 'text-green-300' : 'text-green-800'
                              }`}>
                                Date To
                              </label>
                              <input
                                type="date"
                                value={leadFilters.dateTo}
                                onChange={(e) => setLeadFilters(prev => ({ ...prev, dateTo: e.target.value }))}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 text-sm ${
                                  isDarkMode
                                    ? 'bg-gray-700 border-gray-600 text-gray-200 focus:ring-green-500 focus:border-green-500'
                                    : 'border-gray-300 focus:ring-green-500 focus:border-green-500'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Clear Filters Button */}
                          <div className="flex justify-end mt-4">
                            <button
                              onClick={() => setLeadFilters({
                                status: '',
                                source: '',
                                search: '',
                                dateFrom: '',
                                dateTo: ''
                              })}
                              className={`px-4 py-2 text-sm rounded-md transition-colors border ${
                                isDarkMode
                                  ? 'text-green-300 hover:text-green-200 hover:bg-gray-700 border-green-600'
                                  : 'text-green-700 hover:text-green-800 hover:bg-green-50 border-green-200'
                              }`}
                            >
                              Clear Filters
                            </button>
                          </div>
                        </div>

                        <div className={`rounded-xl shadow-lg border overflow-hidden ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50'
                            : 'bg-amber-50 border-amber-200'
                        }`}>
                          {(() => {
                            // Apply filters to lead items
                            const filteredLeads = message.lead_items.filter(lead => {
                              // Search filter (name or email)
                              if (leadFilters.search) {
                                const searchLower = leadFilters.search.toLowerCase()
                                const nameMatch = (lead.name || '').toLowerCase().includes(searchLower)
                                const emailMatch = (lead.email || '').toLowerCase().includes(searchLower)
                                if (!nameMatch && !emailMatch) return false
                              }

                              // Status filter
                              if (leadFilters.status && lead.status !== leadFilters.status) {
                                return false
                              }

                              // Source filter
                              if (leadFilters.source && lead.source_platform !== leadFilters.source) {
                                return false
                              }

                              // Date range filter
                              if (leadFilters.dateFrom || leadFilters.dateTo) {
                                const leadDate = new Date(lead.created_at)
                                if (leadFilters.dateFrom) {
                                  const fromDate = new Date(leadFilters.dateFrom)
                                  if (leadDate < fromDate) return false
                                }
                                if (leadFilters.dateTo) {
                                  const toDate = new Date(leadFilters.dateTo)
                                  toDate.setHours(23, 59, 59, 999) // End of day
                                  if (leadDate > toDate) return false
                                }
                              }

                              return true
                            })

                            return (
                              <>
                                {/* Results count */}
                                <div className={`px-4 py-3 border-b flex justify-between items-center ${
                                  isDarkMode
                                    ? 'bg-gray-700 border-gray-600'
                                    : 'bg-green-100 border-green-200'
                                }`}>
                                  <span className={`text-sm font-medium ${
                                    isDarkMode ? 'text-green-300' : 'text-green-800'
                                  }`}>
                                    Showing {filteredLeads.length} of {message.lead_items.length} leads
                                  </span>
                                </div>

                                <div className="overflow-x-auto max-w-[90%]">
                                  <table className="w-full min-w-[600px]">
                                    <thead className={`border-b ${
                                      isDarkMode
                                        ? 'bg-gray-700 border-gray-600'
                                        : 'bg-green-100 border-green-200'
                                    }`}>
                                      <tr>
                                        <th className="px-2 md:px-4 py-3 text-left">
                                          {(message.intent === 'view_leads' || message.intent === 'delete_leads') && (
                                            <button
                                              onClick={() => {
                                                const allFilteredIds = filteredLeads.map(item => item.lead_id || item.id)
                                                setSelectedLeads(allFilteredIds)
                                              }}
                                              className={`p-1 rounded transition-colors ${
                                                isDarkMode
                                                  ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-600'
                                                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                                              }`}
                                              title="Select All Filtered"
                                            >
                                              <CheckSquare className="w-3 h-3 md:w-4 md:h-4" />
                                            </button>
                                          )}
                                        </th>
                                        <th className={`px-2 md:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          Lead Name
                                        </th>
                                        <th className={`hidden sm:table-cell px-2 md:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          Email
                                        </th>
                                        <th className={`hidden md:table-cell px-2 md:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          Phone
                                        </th>
                                        <th className={`px-2 md:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          Status
                                        </th>
                                        <th className={`hidden lg:table-cell px-2 md:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          Source
                                        </th>
                                        <th className={`hidden xl:table-cell px-2 md:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          Latest Remark
                                        </th>
                                        <th className={`hidden xl:table-cell px-2 md:px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider ${
                                          isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                        }`}>
                                          Created
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className={`divide-y ${
                                      isDarkMode ? 'divide-gray-600' : 'divide-green-200'
                                    }`}>
                                      {filteredLeads.map((leadItem, index) => (
                                        <tr key={`${message.id}-${index}`} className={`transition-colors ${
                                          isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-amber-50'
                                        }`}>
                                          <td className="px-2 md:px-4 py-3">
                                            {(message.intent === 'view_leads' || message.intent === 'delete_leads') && (
                                              <button
                                                onClick={() => handleLeadSelect(leadItem.lead_id || leadItem.id, message.intent)}
                                                className={`w-4 h-4 md:w-5 md:h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                  selectedLeads.includes(leadItem.lead_id || leadItem.id)
                                                    ? 'bg-green-600 border-green-600 text-white'
                                                    : isDarkMode
                                                    ? 'bg-gray-700 border-gray-500 hover:border-green-400'
                                                    : 'bg-white border-gray-300 hover:border-green-400'
                                                }`}
                                              >
                                                {selectedLeads.includes(leadItem.lead_id || leadItem.id) ? (
                                                  <CheckSquare className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                ) : (
                                                  <Square className="w-2.5 h-2.5 md:w-3 md:h-3" />
                                                )}
                                              </button>
                                            )}
                                          </td>
                                          <td className="px-2 md:px-4 py-3">
                                            <div className="flex items-center gap-2 md:gap-3">
                                              <div className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                                                <User className="w-2.5 h-2.5 md:w-3 md:h-3 text-white" />
                                              </div>
                                              <span className={`font-medium truncate text-sm md:text-base ${
                                                isDarkMode ? 'text-gray-100' : 'text-gray-900'
                                              }`}>
                                                {leadItem.name || 'Unknown Lead'}
                                              </span>
                                            </div>
                                          </td>
                                          <td className={`hidden sm:table-cell px-2 md:px-4 py-3 text-sm truncate max-w-xs ${
                                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                          }`}>
                                            {leadItem.email || 'No email'}
                                          </td>
                                          <td className={`hidden md:table-cell px-2 md:px-4 py-3 text-sm ${
                                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                          }`}>
                                            {leadItem.phone || 'No phone'}
                                          </td>
                                          <td className="px-2 md:px-4 py-3">
                                            <span className={`px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs font-medium ${
                                              leadItem.status === 'new' ? 'bg-blue-100 text-blue-800' :
                                              leadItem.status === 'contacted' ? 'bg-purple-100 text-purple-800' :
                                              leadItem.status === 'responded' ? 'bg-green-100 text-green-800' :
                                              leadItem.status === 'qualified' ? 'bg-orange-100 text-orange-800' :
                                              leadItem.status === 'converted' ? 'bg-emerald-100 text-emerald-800' :
                                              leadItem.status === 'lost' ? 'bg-gray-100 text-gray-800' :
                                              leadItem.status === 'invalid' ? 'bg-red-100 text-red-800' :
                                              'bg-gray-100 text-gray-800'
                                            }`}>
                                              {leadItem.status ? leadItem.status.charAt(0).toUpperCase() + leadItem.status.slice(1) : 'Unknown'}
                                            </span>
                                          </td>
                                          <td className={`hidden lg:table-cell px-2 md:px-4 py-3 text-sm ${
                                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                          }`}>
                                            {leadItem.source || leadItem.source_platform || 'Unknown'}
                                          </td>
                                          <td className={`hidden xl:table-cell px-2 md:px-4 py-3 text-sm max-w-xs truncate ${
                                            isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                          }`} title={leadItem.last_remark}>
                                            {leadItem.last_remark || 'No remarks'}
                                          </td>
                                          <td className={`hidden xl:table-cell px-2 md:px-4 py-3 text-sm ${
                                            isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                          }`}>
                                            {leadItem.created_at || 'Unknown'}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </>
                            )
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Render lead cards if available */}
                    {message.lead_id && fetchedLeads[message.lead_id] && (
                      <div className="mt-4 flex flex-wrap gap-4">
                        <LeadCard
                          key={message.lead_id}
                          lead={fetchedLeads[message.lead_id]}
                          onClick={() => setSelectedLeadId(message.lead_id)}
                          isSelected={selectedLeadId === message.lead_id}
                          selectionMode={true}
                          isDarkMode={isDarkMode}
                        />
                      </div>
                    )}

                    {/* Selection controls for lead operations */}
                    {message.intent === 'view_leads' && message.lead_items && message.lead_items.length > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-3 p-3 rounded-lg">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              const allLeadIds = message.lead_items.map(item => item.lead_id || item.id)
                              setSelectedLeads(allLeadIds)
                            }}
                            className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                          >
                            <CheckSquare className="w-4 h-4" />
                            <span>Select All</span>
                          </button>
                          <button
                            onClick={() => setSelectedLeads([])}
                            className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                    isDarkMode
                                      ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                      : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                                  }`}
                          >
                            <Square className="w-4 h-4" />
                            <span>Deselect All</span>
                          </button>
                          <span className="text-base text-gray-600">
                            {selectedLeads.length}/{message.lead_items.length} selected
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Lead Action Buttons for Selected Leads */}
                    {selectedLeads.length > 0 && (
                      <div className={`mt-4 flex flex-wrap items-center gap-3 p-4 backdrop-blur-md border rounded-xl shadow-lg ${
                        isDarkMode
                          ? 'bg-gray-800/90 border-gray-700'
                          : 'bg-white/90 border-gray-200'
                      }`}>
                        <div className="flex gap-2">
                          <button
                            onClick={handleEditSelectedLead}
                            disabled={selectedLeads.length !== 1}
                            className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                              isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <Edit className="w-4 h-4" />
                            <span>Edit Lead {selectedLeads.length !== 1 ? '(Select 1)' : ''}</span>
                          </button>
                          <button
                            onClick={handleDeleteSelectedLeads}
                            disabled={isDeleting}
                            className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-lg ${
                              isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {isDeleting ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4" />
                                Delete Selected ({selectedLeads.length})
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Render calendar table for create_calendar */}
                    {message.calendar_entries && message.calendar_entries.length > 0 && (
                      <div className="mt-4">
                        {/* Calendar Header */}
                        <div className={`rounded-xl shadow-lg border p-4 mb-4 ${
                          isDarkMode
                            ? 'bg-gray-800 border-gray-700 shadow-gray-900/50'
                            : 'bg-blue-50 border-blue-200'
                        }`}>
                          <div className="flex items-center gap-3 mb-3">
                            <Calendar className="w-6 h-6 text-blue-600" />
                            <h3 className={`text-lg font-semibold ${
                              isDarkMode ? 'text-blue-300' : 'text-blue-800'
                            }`}>
                              📅 Your Content Calendar
                            </h3>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className={`font-medium ${
                                isDarkMode ? 'text-blue-300' : 'text-blue-700'
                              }`}>Platform:</span>
                              <span className={`ml-2 ${
                                isDarkMode ? 'text-gray-200' : 'text-gray-800'
                              }`}>
                                {message.calendar_entries[0]?.platform_emoji} {message.calendar_entries[0]?.platform?.charAt(0).toUpperCase() + message.calendar_entries[0]?.platform?.slice(1)}
                              </span>
                            </div>
                            <div>
                              <span className={`font-medium ${
                                isDarkMode ? 'text-blue-300' : 'text-blue-700'
                              }`}>Total Posts:</span>
                              <span className={`ml-2 ${
                                isDarkMode ? 'text-gray-200' : 'text-gray-800'
                              }`}>{message.calendar_entries.length}</span>
                            </div>
                            <div>
                              <span className={`font-medium ${
                                isDarkMode ? 'text-blue-300' : 'text-blue-700'
                              }`}>Frequency:</span>
                              <span className={`ml-2 ${
                                isDarkMode ? 'text-gray-200' : 'text-gray-800'
                              }`}>
                                {message.intent === 'create_calendar' && message.result ?
                                  message.result.split('**Posting Frequency:**')[1]?.split('**')[0]?.trim() || 'Weekly'
                                  : 'Weekly'}
                              </span>
                            </div>
                            <div>
                              <span className={`font-medium ${
                                isDarkMode ? 'text-blue-300' : 'text-blue-700'
                              }`}>Status:</span>
                              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                                isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800'
                              }`}>Ready to Schedule</span>
                            </div>
                          </div>
                        </div>

                        {/* Calendar Table */}
                        <div className={`rounded-xl shadow-lg border overflow-hidden ${
                          isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                        }`}>
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className={`${
                                isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                              }`}>
                                <tr>
                                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                                  }`}>Date</th>
                                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                                  }`}>Content Type</th>
                                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                                  }`}>Topic</th>
                                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                                  }`}>Theme</th>
                                  <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${
                                    isDarkMode ? 'text-gray-300' : 'text-gray-500'
                                  }`}>RL Settings</th>
                                </tr>
                              </thead>
                              <tbody className={`divide-y ${
                                isDarkMode ? 'divide-gray-700' : 'divide-gray-200'
                              }`}>
                                {message.calendar_entries.map((calendarItem, index) => (
                                  <tr key={calendarItem.entry_id || `calendar-${index}`} className={`${
                                    isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                                  } transition-colors`}>
                                    <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${
                                      isDarkMode ? 'text-gray-200' : 'text-gray-900'
                                    }`}>
                                      {calendarItem.date_display || new Date(calendarItem.entry_date).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                      })}
                                    </td>
                                    <td className={`px-4 py-3 whitespace-nowrap text-sm ${
                                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                      <div className="flex items-center gap-2">
                                        <span>{calendarItem.content_type_emoji}</span>
                                        <span>{calendarItem.content_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                                      </div>
                                    </td>
                                    <td className={`px-4 py-3 text-sm ${
                                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                      <div className="max-w-xs truncate" title={calendarItem.topic}>
                                        {calendarItem.topic}
                                      </div>
                                    </td>
                                    <td className={`px-4 py-3 whitespace-nowrap text-sm ${
                                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                                    }`}>
                                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                        calendarItem.content_theme === 'educational' ? (isDarkMode ? 'bg-blue-900 text-blue-300' : 'bg-blue-100 text-blue-800') :
                                        calendarItem.content_theme === 'promotional' ? (isDarkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-800') :
                                        calendarItem.content_theme === 'engagement' ? (isDarkMode ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-800') :
                                        calendarItem.content_theme === 'entertainment' ? (isDarkMode ? 'bg-pink-900 text-pink-300' : 'bg-pink-100 text-pink-800') :
                                        (isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-800')
                                      }`}>
                                        {calendarItem.content_theme.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                      </span>
                                    </td>
                                    <td className={`px-4 py-3 text-xs ${
                                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                                    }`}>
                                      <div className="space-y-1">
                                        {calendarItem.hook_type && (
                                          <div>Hook: {calendarItem.hook_type}</div>
                                        )}
                                        {calendarItem.tone && (
                                          <div>Tone: {calendarItem.tone}</div>
                                        )}
                                        {calendarItem.creativity && (
                                          <div>Creativity: {calendarItem.creativity}</div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* Calendar Actions */}
                        <div className={`mt-4 flex flex-wrap items-center gap-3 p-4 backdrop-blur-md border rounded-xl shadow-lg ${
                          isDarkMode
                            ? 'bg-gray-800/90 border-gray-700'
                            : 'bg-white/90 border-gray-200'
                        }`}>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                // Placeholder for schedule all functionality
                                console.log('Schedule all calendar entries');
                              }}
                              className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                isDarkMode
                                  ? 'bg-blue-700 hover:bg-blue-600 text-white border-blue-600 hover:border-blue-500'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-500 hover:border-blue-600'
                              }`}
                            >
                              <Calendar className="w-4 h-4" />
                              Schedule All Posts
                            </button>
                            <button
                              onClick={() => {
                                // Placeholder for export functionality
                                console.log('Export calendar');
                              }}
                              className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                                isDarkMode
                                  ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                  : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                              }`}
                            >
                              <Download className="w-4 h-4" />
                              Export Calendar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lead Action Buttons */}
                    {message.lead_id && fetchedLeads[message.lead_id] && (
                      <div className={`mt-4 flex flex-wrap items-center gap-3 p-4 backdrop-blur-md border rounded-xl shadow-lg ${
                        isDarkMode
                          ? 'bg-gray-800/90 border-gray-700'
                          : 'bg-white/90 border-gray-200'
                      }`}>
                        <div className="flex gap-2">
                          <button
                            onClick={handleEditLead}
                            className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                              isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <Edit className="w-4 h-4" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={handleSaveLead}
                            className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                              isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <Save className="w-4 h-4" />
                            <span>Save</span>
                          </button>
                          <button
                            onClick={handleDeleteLead}
                            className={`px-4 py-3 rounded-xl border transition-all duration-200 text-sm font-normal shadow-sm hover:shadow-md transform hover:scale-105 flex items-center gap-2 ${
                              isDarkMode
                                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200 hover:text-white border-gray-600 hover:border-gray-500'
                                : 'bg-gray-100 hover:bg-gray-200 text-gray-800 hover:text-gray-900 border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <p className="text-base whitespace-pre-wrap pr-16 text-left">{message.text}</p>
                    <div className={`absolute bottom-0 right-0 text-xs ${
                      message.sender === 'user' ? 'text-white' : 'text-gray-400'
                    }`}>
                      {(() => {
                        const date = new Date(message.timestamp);
                        const hours = date.getHours();
                        const minutes = date.getMinutes().toString().padStart(2, '0');
                        const ampm = hours >= 12 ? 'PM' : 'AM';
                        const displayHours = hours % 12 || 12;
                        return `${displayHours}:${minutes} ${ampm}`;
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Message metadata - Hidden */}
              {/* {message.intent && (
                <div className="mt-1 text-xs text-gray-500 flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                    {message.intent}
                  </span>
                  {message.step && (
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                      {message.step}
                    </span>
                  )}
                </div>
              )} */}

              {/* Thinking text below user messages when loading */}
              {isLoading && message.sender === 'user' && index === messages.length - 1 && (
                <div className="mt-2 ml-12">
                  <span className={`text-sm italic animate-pulse ${isDarkMode ? 'text-white' : 'text-gray-600'}`}>
                    {getThinkingMessage()}
                  </span>
                </div>
              )}
            </div>
          </div>
        ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input Area - Always Visible in Chat */}
        <div className="flex-shrink-0 p-4">
            {/* New Chat Option */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={handleReset}
                className={`flex items-center gap-2 text-sm font-medium transition-colors ${
                  isDarkMode
                    ? 'text-white hover:text-gray-200'
                    : 'text-blue-600 hover:text-blue-700'
                }`}
              >
                <span className="text-lg">+</span>
                <span>New Chat</span>
              </button>
              <div className={`text-xs ${
                isDarkMode ? 'text-gray-400' : 'text-gray-500'
              }`}>
                Press Enter to send
              </div>
            </div>

          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask me to manage your content or leads..."
              className={`w-full px-6 pr-14 py-4 text-base rounded-[20px] backdrop-blur-sm focus:outline-none shadow-lg ${
                isDarkMode
                  ? 'bg-gray-700/80 border-0 focus:ring-0 text-gray-100 placeholder-gray-400'
                  : 'bg-white/80 border border-white/20 focus:ring-2 focus:ring-white/30 focus:border-white/50 text-gray-900 placeholder-gray-500'
              }`}
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-7 h-7 transition-all flex items-center justify-center ${
                isDarkMode
                  ? 'text-green-400 hover:text-green-300 disabled:text-gray-500'
                  : 'text-blue-600 hover:text-blue-700 disabled:text-gray-400'
              } disabled:cursor-not-allowed`}
            >
              <Send className="w-5 h-5 transform rotate-45" />
            </button>
        </div>
        
          <div className={`mt-2 text-xs text-center ${
            isDarkMode ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Try: "Show scheduled posts" • "Create lead" • "View analytics"
          </div>
        </div>

      {/* ATSN Content Modal */}
      {showContentModal && selectedContentForModal && (
        <ATSNContentModal
          content={selectedContentForModal}
          onClose={handleCloseContentModal}
          onContentUpdated={(updatedContent) => setSelectedContentForModal(updatedContent)}
        />
      )}

      {/* Reel Modal */}
      {showReelModal && selectedContentForModal && (
        <ReelModal
          content={selectedContentForModal}
          onClose={handleCloseReelModal}
        />
      )}

      {/* Date Picker Modal */}
      {showDatePicker && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleDatePickerCancel()
            }
          }}
        >
          <div
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-md w-full mx-4 shadow-xl`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Select Date Range</h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Start Date
                </label>
                <input
                  type="date"
                  value={selectedDateRange.start}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min="2024-01-01"
                  max="2030-12-31"
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  End Date (Optional - leave empty for single date)
                </label>
                <input
                  type="date"
                  value={selectedDateRange.end}
                  onChange={(e) => setSelectedDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={selectedDateRange.start || "2024-01-01"}
                  max="2030-12-31"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleDatePickerCancel}
                className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                  isDarkMode ? 'text-gray-200 bg-gray-700 hover:bg-gray-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleDatePickerConfirm}
                disabled={!selectedDateRange.start}
                className={`flex-1 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single Date Picker Modal for Lead Follow-up */}
      {showSingleDatePicker && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleSingleDatePickerCancel()
            }
          }}
        >
          <div
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-md w-full mx-4 shadow-xl`}
          >
            <h3 className={`text-lg font-semibold mb-4 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Select Follow-up Date</h3>

            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                  Follow-up Date
                </label>
                <input
                  type="date"
                  value={selectedSingleDate}
                  onChange={(e) => setSelectedSingleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  min={new Date().toISOString().split('T')[0]} // Today or later
                  max="2030-12-31"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleSingleDatePickerCancel}
                className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                  isDarkMode ? 'text-gray-200 bg-gray-700 hover:bg-gray-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={handleSingleDatePickerConfirm}
                disabled={!selectedSingleDate}
                className={`flex-1 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Media Upload Modal */}
      {showMediaUploadModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowMediaUploadModal(false)
            }
          }}
        >
          <div
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {selectedFilesForUpload.length > 0 ? 'Confirm Upload' : 'Upload Media for Your Post'}
              </h3>
              <button
                onClick={() => {
                  setShowMediaUploadModal(false)
                  setSelectedFilesForUpload([])
                }}
                className={`transition-colors ${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              {selectedFilesForUpload.length === 0 ? (
                <>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Select an image or video file from your computer. Supported formats: JPG, PNG, GIF, WebP, MP4, MOV, AVI, WebM.
                  </p>

                  <div className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                       isDarkMode ? 'border-gray-600 hover:border-gray-500' : 'border-gray-300 hover:border-gray-400'
                     }`}
                       onClick={() => document.getElementById('media-file-input').click()}>
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    <div className="space-y-1">
                      <p className={`text-sm font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                        Click to select a file
                      </p>
                      <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        Images: PNG, JPG, GIF, WebP up to 10MB | Videos: MP4, MOV, AVI, WebM up to 50MB
                      </p>
                    </div>
                    <input
                      id="media-file-input"
                      type="file"
                      accept="image/*,video/*"
                      onChange={(e) => {
                        const file = e.target.files[0]
                        if (file) {
                          // Validate file type
                          const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
                          const allowedVideoTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/webm']
                          const allowedTypes = [...allowedImageTypes, ...allowedVideoTypes]

                          if (!allowedTypes.includes(file.type)) {
                            showError('Please select a valid image or video file')
                            return
                          }

                          // Validate file size
                          const isVideo = allowedVideoTypes.includes(file.type)
                          const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
                          if (file.size > maxSize) {
                            showError(`File size must be less than ${isVideo ? '50MB' : '10MB'}`)
                            return
                          }

                          handleFileSelection([file])
                        }
                      }}
                      className="hidden"
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                    Please confirm you want to upload this file:
                  </p>

                  <div className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-50'} rounded-lg p-4 mb-4`}>
                    <div className="flex items-start gap-4">
                      {selectedFilesForUpload[0].type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(selectedFilesForUpload[0])}
                          alt="Selected file"
                          className="w-20 h-20 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className={`w-20 h-20 rounded-lg flex items-center justify-center ${isDarkMode ? 'bg-gray-600' : 'bg-gray-200'}`}>
                          <Video className={`w-8 h-8 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                        </div>
                      )}

                      <div className="flex-1">
                        <h4 className={`font-medium mb-1 ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                          {selectedFilesForUpload[0].name}
                        </h4>
                        <p className={`text-sm mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Type: {selectedFilesForUpload[0].type.split('/')[1].toUpperCase()}
                        </p>
                        <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          Size: {(selectedFilesForUpload[0].size / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className={`${isDarkMode ? 'bg-blue-900/20 border-blue-700' : 'bg-blue-50 border-blue-200'} border rounded-lg p-4 mb-4`}>
                    <div className="flex items-start gap-3">
                      <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isDarkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                      <div>
                        <h4 className={`text-sm font-medium mb-1 ${isDarkMode ? 'text-blue-200' : 'text-blue-900'}`}>
                          Ready to upload
                        </h4>
                        <p className={`text-sm ${isDarkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                          This file will be uploaded to our secure storage and used in your content creation.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-3">
              {selectedFilesForUpload.length === 0 ? (
                <button
                  onClick={() => {
                    setShowMediaUploadModal(false)
                    setSelectedFilesForUpload([])
                  }}
                  className={`flex-1 px-4 py-2 rounded-md transition-colors ${
                    isDarkMode ? 'text-gray-200 bg-gray-700 hover:bg-gray-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  Cancel
                </button>
              ) : (
                <>
                  <button
                    onClick={handleCancelUpload}
                    disabled={isUploadingMedia}
                    className={`flex-1 px-4 py-2 rounded-md transition-colors disabled:opacity-50 ${
                      isDarkMode ? 'text-gray-200 bg-gray-700 hover:bg-gray-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    Change File
                  </button>
                  <button
                    onClick={handleConfirmUpload}
                    disabled={isUploadingMedia}
                    className={`flex-1 px-4 py-2 text-white rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${
                      isDarkMode ? 'bg-blue-700 hover:bg-blue-600' : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isUploadingMedia ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Upload & Continue
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditLeadModal && editLeadData && (
        <div
          className={`fixed inset-0 ${isDarkMode ? 'bg-black bg-opacity-75' : 'bg-black bg-opacity-50'} flex items-center justify-center z-50`}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditLeadModal(false)
              setEditLeadData(null)
            }
          }}
        >
          <div
            className={`${isDarkMode ? 'bg-gray-800' : 'bg-white'} rounded-xl p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>Edit Lead</h3>
              <button
                onClick={() => {
                  setShowEditLeadModal(false)
                  setEditLeadData(null)
                }}
                className={`${isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-400 hover:text-gray-600'} transition-colors`}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault()
              try {
                const formData = new FormData(e.target)

                // Update lead status if it changed
                const newStatus = formData.get('status')
                const remarks = formData.get('remarks')

                if (newStatus !== editLeadData.status) {
                  await leadsAPI.updateLeadStatus(editLeadData.id, newStatus, remarks || null)
                }

                // Update other lead details directly in database
                const updatedLeadData = {
                  name: formData.get('name'),
                  email: formData.get('email'),
                  phone_number: formData.get('phone'),
                  source_platform: formData.get('source_platform')
                }

                // Direct API call to update lead details
                await leadsAPI.updateLead(editLeadData.id, updatedLeadData)

                showSuccess('Lead updated successfully')

                setShowEditLeadModal(false)
                setEditLeadData(null)
                setSelectedLeads([])

                // Refresh the current view to reflect the changes
                if (messages.length > 0) {
                  const lastMessage = messages[messages.length - 1]
                  if (lastMessage.intent === 'view_leads' || lastMessage.intent === 'delete_leads') {
                    // Trigger a refresh by sending a new view leads command
                    await sendMessage('Show my leads')
                  }
                }
              } catch (error) {
                console.error('Error updating lead:', error)
                showError('Failed to update lead. Please try again.')
              }
            }} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Lead Name
                </label>
                <input
                  type="text"
                  name="name"
                  defaultValue={editLeadData.name}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900'}`}
                  required
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={editLeadData.email}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  defaultValue={editLeadData.phone}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Status
                </label>
                <select
                  name="status"
                  defaultValue={editLeadData.status}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-300 bg-white text-gray-900'}`}
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

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Source Platform
                </label>
                <select
                  name="source_platform"
                  defaultValue={editLeadData.source_platform}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200' : 'border-gray-300 bg-white text-gray-900'}`}
                >
                  <option value="Website">Website</option>
                  <option value="Facebook">Facebook</option>
                  <option value="Instagram">Instagram</option>
                  <option value="LinkedIn">LinkedIn</option>
                  <option value="Walk Ins">Walk Ins</option>
                  <option value="Referral">Referral</option>
                  <option value="Email">Email</option>
                  <option value="Phone Call">Phone Call</option>
                  <option value="Manual Entry">Manual Entry</option>
                </select>
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  defaultValue={editLeadData.last_remark}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isDarkMode ? 'border-gray-600 bg-gray-700 text-gray-200 placeholder-gray-400' : 'border-gray-300 bg-white text-gray-900'}`}
                  placeholder="Add any additional notes or remarks..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditLeadModal(false)
                    setEditLeadData(null)
                  }}
                  className={`flex-1 px-4 py-2 rounded-md transition-colors ${isDarkMode ? 'text-gray-300 bg-gray-700 hover:bg-gray-600' : 'text-gray-700 bg-gray-100 hover:bg-gray-200'}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`flex-1 px-4 py-2 rounded-md transition-colors ${isDarkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
                >
                  Update Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Success Modal */}
      {showPublishSuccessModal && publishSuccessData && (
        <div className="fixed inset-0 flex items-center justify-center p-4 z-50">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowPublishSuccessModal(false)} />
          <div className={`relative max-w-md w-full rounded-2xl shadow-2xl overflow-hidden ${
            isDarkMode ? 'bg-gray-800' : 'bg-white'
          }`}>
            <div className="p-6">
              <div className="text-center mb-4">
                <div className={`text-4xl mb-2 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`}>🎉</div>
                <h3 className={`text-lg font-semibold mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>
                  Content Published Successfully!
                </h3>
              </div>

              <div className={`p-4 rounded-lg mb-4 ${
                isDarkMode ? 'bg-gray-700' : 'bg-blue-50'
              }`}>
                <div className={`absolute left-0 top-4 transform -translate-x-2 w-0 h-0 ${
                  isDarkMode
                    ? 'border-t-8 border-t-gray-700 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                    : 'border-t-8 border-t-blue-50 border-r-8 border-r-transparent border-b-8 border-b-transparent border-l-8 border-l-transparent'
                }`} />

                <p className={`text-sm leading-relaxed ${
                  isDarkMode ? 'text-gray-200' : 'text-gray-800'
                }`}>
                  <span className="font-normal text-pink-500">Emily here!</span> 🎉<br />
                  Your content has been successfully published to {publishSuccessData.platform}!
                  {publishSuccessData.postUrl && (
                    <a href={publishSuccessData.postUrl} target="_blank" rel="noopener noreferrer"
                       className="text-blue-500 hover:underline ml-1">
                      View post →
                    </a>
                  )}
                </p>
              </div>

              <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              console.log('Closing publish success modal')
              setShowPublishSuccessModal(false)
              setPublishSuccessData(null)
            }}
                  className="px-6 py-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white rounded-lg font-medium hover:from-pink-600 hover:to-purple-600 transition-all duration-200 transform hover:scale-105"
                >
                  Awesome! ✨
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Character Card Tooltip */}
      <CharacterCard
        agentName={tooltipAgent}
        isVisible={!!tooltipAgent}
        position={tooltipPosition}
        isDarkMode={isDarkMode}
        likesCount={agentProfiles[tooltipAgent?.toLowerCase()]?.likes_count || 0}
        tasksCount={agentProfiles[tooltipAgent?.toLowerCase()]?.tasks_completed_count || 0}
      />
    </div>
  )
}

export default ATSNChatbot

