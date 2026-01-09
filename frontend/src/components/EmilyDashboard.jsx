import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { onboardingAPI } from '../services/onboarding'
import { supabase } from '../lib/supabase'
import SideNavbar from './SideNavbar'

// Tauri imports for desktop app (lazy loaded)
const loadTauriAPI = async () => {
  try {
    const { listen } = await import('@tauri-apps/api/event')
    return listen
  } catch (e) {
    return null // Not in desktop environment
  }
}

// Get dark mode state from localStorage or default to light mode
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

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')
import MobileNavigation from './MobileNavigation'
import LoadingBar from './LoadingBar'
import MainContentLoader from './MainContentLoader'
import ATSNChatbot from './ATSNChatbot'
import RecentTasks from './RecentTasks'
import ContentCard from './ContentCard'
import { Sparkles, TrendingUp, Target, BarChart3, FileText, PanelRight, PanelLeft, X, ChevronRight, RefreshCw } from 'lucide-react'

// Voice Orb Component with animated border (spring-like animation)
const VoiceOrb = ({ isSpeaking }) => {
  const [borderWidth, setBorderWidth] = useState(0)
  const velocityRef = useRef(0)
  const animationRef = useRef(null)
  const lastTimeRef = useRef(performance.now())

  useEffect(() => {
    if (isSpeaking) {
      // Spring animation parameters (similar to React Native Reanimated)
      const stiffness = 90
      const damping = 12
      const mass = 0.5
      const targetWidth = 8 + Math.random() * 4 // Vary between 8-12px based on "volume"
      
      const animate = (currentTime) => {
        const deltaTime = (currentTime - lastTimeRef.current) / 16.67 // Normalize to ~60fps
        lastTimeRef.current = currentTime
        
        setBorderWidth(prev => {
          const current = prev
          const diff = targetWidth - current
          
          // Spring physics: F = -kx - bv
          const springForce = (stiffness / mass) * diff
          const dampingForce = (damping / mass) * velocityRef.current
          const acceleration = springForce - dampingForce
          
          // Update velocity
          velocityRef.current += acceleration * (deltaTime * 0.01)
          velocityRef.current *= 0.95 // Additional damping
          
          // Update position
          const newWidth = current + velocityRef.current * (deltaTime * 0.01)
          
          return Math.max(0, newWidth)
        })
        
        if (isSpeaking) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }
      lastTimeRef.current = performance.now()
      animationRef.current = requestAnimationFrame(animate)
    } else {
      // Smoothly return to 0 with spring animation
      const stiffness = 90
      const damping = 12
      const mass = 0.5
      const targetWidth = 0
      
      const animate = (currentTime) => {
        const deltaTime = (currentTime - lastTimeRef.current) / 16.67
        lastTimeRef.current = currentTime
        
        setBorderWidth(prev => {
          if (prev < 0.1 && Math.abs(velocityRef.current) < 0.1) {
            velocityRef.current = 0
            return 0
          }
          
          const current = prev
          const diff = targetWidth - current
          
          const springForce = (stiffness / mass) * diff
          const dampingForce = (damping / mass) * velocityRef.current
          const acceleration = springForce - dampingForce
          
          velocityRef.current += acceleration * (deltaTime * 0.01)
          velocityRef.current *= 0.95
          
          const newWidth = current + velocityRef.current * (deltaTime * 0.01)
          
          return Math.max(0, newWidth)
        })
        
        if (borderWidth > 0.1 || Math.abs(velocityRef.current) > 0.1) {
          animationRef.current = requestAnimationFrame(animate)
        }
      }
      lastTimeRef.current = performance.now()
      animationRef.current = requestAnimationFrame(animate)
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [isSpeaking])

  return (
    <div className="relative flex items-center justify-center">
      {/* Outer animated border container */}
      <div 
        className="absolute rounded-full border-2 flex items-center justify-center"
        style={{
          width: '290px',
          height: '290px',
          borderRadius: '145px',
          borderWidth: `${borderWidth}px`,
          borderColor: isSpeaking ? 'rgb(96, 165, 250)' : 'transparent',
          transition: 'border-color 0.2s ease',
        }}
      >
        {/* Inner orb */}
        <div 
          className="rounded-full bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center"
          style={{
            width: '280px',
            height: '280px',
            borderRadius: '140px',
          }}
        >
          <span className="text-white font-bold text-4xl">E</span>
        </div>
      </div>
    </div>
  )
}

// Import components directly

function EmilyDashboard() {
  const { user, logout } = useAuth()
  const { showContentGeneration, showSuccess, showError, showInfo } = useNotifications()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [conversations, setConversations] = useState([])
  const [loadingConversations, setLoadingConversations] = useState(false)
  const [messageFilter, setMessageFilter] = useState('all') // 'all', 'emily', 'chase', 'leo'
  const [showMobileChatHistory, setShowMobileChatHistory] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)
  const [overdueLeadsCount, setOverdueLeadsCount] = useState(0)
  const [overdueLeadsLoading, setOverdueLeadsLoading] = useState(true)

  // Today's conversations only (no historical data)

  // Listen for dark mode changes from other components (like SideNavbar)
  useStorageListener('darkMode', setIsDarkMode)

  // Listen for Tauri app updates (desktop only)
  useEffect(() => {
    const setupTauriListener = async () => {
      const listenFn = await loadTauriAPI()
      if (listenFn) {
        const unlisten = await listenFn('tauri://update-available', ({ payload }) => {
          showInfo('Update Available', 'A new version of ATSN AI is ready. The app will restart to install it.')
        })
        return () => unlisten()
      }
    }
    setupTauriListener()
  }, [])

// Date filtering removed - chatbot starts fresh

  const handleRefreshChat = async () => {
    // ATSN chatbot handles its own state clearing
    showSuccess('Chat refreshed', 'The conversation has been reset to start fresh.')
  }

  // Fetch overdue leads count
  const fetchOverdueLeadsCount = async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `overdue_leads_count_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    try {
      // Check if we have cached data from today
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          const { count, timestamp } = JSON.parse(cachedData)
          const cacheAge = Date.now() - timestamp

          // Use cached data if it's less than 24 hours old
          if (cacheAge < CACHE_EXPIRATION_MS) {
            console.log('Using cached overdue leads count:', count)
            setOverdueLeadsCount(count)
            setOverdueLeadsLoading(false)
            return
          }
        }
      }

      setOverdueLeadsLoading(true)
      const leadsAPI = (await import('../services/leads')).leadsAPI

      // Get all leads using pagination (API limit is 100 per request)
      let allLeads = []
      let offset = 0
      const limit = 100

      while (true) {
        const response = await leadsAPI.getLeads({ limit, offset })
        const leads = response.data || []

        if (leads.length === 0) break // No more leads

        allLeads = [...allLeads, ...leads]
        offset += limit

        // Safety check to prevent infinite loops
        if (offset > 10000) break
      }

      console.log('Total leads fetched for overdue count:', allLeads.length)
      console.log('Sample leads with follow_up_at:', allLeads.filter(l => l.follow_up_at).slice(0, 5))

      // Count leads with overdue follow-ups (follow-up date shows "ago" or "Yesterday")
      const overdueCount = allLeads.filter(lead => {
        if (!lead.follow_up_at) return false

        const date = new Date(lead.follow_up_at)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const followUpDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const diffInDays = Math.floor((followUpDate - today) / (1000 * 60 * 60 * 24))

        const isOverdue = diffInDays < 0
        if (isOverdue) {
          console.log('Overdue lead found:', {
            id: lead.id,
            name: lead.name,
            follow_up_at: lead.follow_up_at,
            diffInDays: diffInDays
          })
        }

        return isOverdue
      }).length

      // Cache the result with current timestamp
      const cacheData = {
        count: overdueCount,
        timestamp: Date.now()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

      console.log('Overdue leads count:', overdueCount)
      setOverdueLeadsCount(overdueCount)
    } catch (error) {
      console.error('Error fetching overdue leads count:', error)
      setOverdueLeadsCount(0)
    } finally {
      setOverdueLeadsLoading(false)
    }
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await onboardingAPI.getProfile()
        setProfile(response.data)
      } catch (error) {
        console.error('Error fetching profile:', error)
        // If profile doesn't exist, that's okay - user just completed onboarding
        setProfile(null)
      } finally {
        setLoading(false)
      }
    }

    if (user) {
      fetchProfile()
    } else {
      setLoading(false)
    }
  }, [user])

  // Fetch today's conversations when panel opens
  useEffect(() => {
    if (isPanelOpen && user) {
      fetchTodayConversations()
    }
  }, [isPanelOpen, user])

  // Fetch overdue leads count periodically (cached for 24 hours)
  useEffect(() => {
    if (user) {
      fetchOverdueLeadsCount()
      // Refresh every 24 hours
      const interval = setInterval(() => fetchOverdueLeadsCount(true), 24 * 60 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user])

  // No conversation history loading - only today's conversations

// Date filtering removed - chatbot starts fresh

// Date filter dropdown removed - chatbot starts fresh

  // Apply dark mode to document body
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    // Save preference to localStorage
    localStorage.setItem('darkMode', isDarkMode.toString())
  }, [isDarkMode])

  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  const fetchTodayConversations = async () => {
    setLoadingConversations(true)
    try {
      const authToken = await getAuthToken()
      if (!authToken) {
        console.error('No auth token available')
        setLoadingConversations(false)
        return
      }

      // Fetch only today's conversations from daily cache
      const response = await fetch(`${API_BASE_URL}/atsn/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setConversations(data.conversations || [])
      }
    } catch (error) {
      console.error('Error fetching today conversations:', error)
      setConversations([])
    } finally {
      setLoadingConversations(false)
    }
  }

  // Group conversations by date and get only the last conversation per date
  const groupConversationsByDate = (conversations) => {
    const grouped = {}
    const dateMap = {} // Map dateKey to actual Date object for sorting
    
    conversations.forEach(conv => {
      const date = new Date(conv.created_at)
      const dateKey = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
        // Store the date object for sorting (use start of day)
        const dateForSorting = new Date(date)
        dateForSorting.setHours(0, 0, 0, 0)
        dateMap[dateKey] = dateForSorting
      }
      grouped[dateKey].push(conv)
    })

    // Sort dates (newest first) using the date objects
    const sortedDates = Object.keys(grouped).sort((a, b) => {
      return dateMap[b] - dateMap[a]
    })

    // Return only the last conversation for each date
    return sortedDates.map(date => {
      const dateConversations = grouped[date].sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      )
      // Get the last conversation (most recent)
      const lastConversation = dateConversations[dateConversations.length - 1]
      // Also store the date object for filtering
      const dateObj = dateMap[date]
      
      return {
        date,
        dateObj, // Store date object for filtering
        lastConversation,
        allConversations: dateConversations // Store all conversations for this date
      }
    })
  }

  // Function to load ATSN conversations for the selected date filter
// ATSN conversation loading removed - chatbot starts fresh

// Conversation loading functions removed - chatbot starts fresh

  if (!user) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Not Authenticated</h1>
          <p className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Please log in to access the dashboard.</p>
        </div>
      </div>
    )
  }


  return (
    <div className={`h-screen overflow-hidden md:overflow-auto custom-scrollbar ${
      isDarkMode ? 'bg-gray-900 dark-mode' : 'bg-white light-mode'
    }`}>
      {/* Mobile Navigation */}
      <MobileNavigation 
        setShowCustomContentChatbot={() => {}} // Dashboard doesn't have these functions
        handleGenerateContent={() => {}}
        generating={false}
        fetchingFreshData={false}
        onOpenChatHistory={() => {
          setShowMobileChatHistory(true)
          if (!conversations.length && user) {
            fetchTodayConversations()
          }
        }}
        showChatHistory={showMobileChatHistory}
      />
      
      {/* Side Navbar */}
      <SideNavbar />
      
      {/* Main Content */}
      <div className={`md:ml-48 xl:ml-64 flex flex-col h-screen overflow-hidden pt-16 md:pt-0 bg-transparent ${
        isDarkMode ? 'md:bg-gray-900' : 'md:bg-white'
      }`}>
        {/* Header */}
        <div className={`hidden md:block shadow-sm border-b z-30 flex-shrink-0 ${
          isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
        }`}>
          <div className="px-4 lg:px-6 py-3 lg:py-4">
            <div className="flex justify-between items-center">
              <div className="hidden md:flex items-center gap-3">
                {/* Agent Filter Icons */}
                <div className="flex items-center gap-1">
                  {/* All Messages */}
                  <button
                    onClick={() => setMessageFilter('all')}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      messageFilter === 'all'
                        ? 'bg-gray-600 text-white ring-2 ring-gray-300'
                        : isDarkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title="All Messages"
                  >
                    All
                  </button>

                  {/* Emily */}
                  <button
                    onClick={() => setMessageFilter('emily')}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 border-gray-300 ${
                      messageFilter === 'emily'
                        ? 'ring-2 ring-purple-300'
                        : 'hover:opacity-80'
                    }`}
                    title="Emily Messages"
                  >
                    <img src="/emily_icon.png" alt="Emily" className="w-9 h-9 rounded-full object-cover" />
                  </button>

                  {/* Chase */}
                  <button
                    onClick={() => setMessageFilter('chase')}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 border-gray-300 ${
                      messageFilter === 'chase'
                        ? 'ring-2 ring-blue-300'
                        : 'hover:opacity-80'
                    }`}
                    title="Chase Messages"
                  >
                    <img src="/chase_logo.png" alt="Chase" className="w-9 h-9 rounded-full object-cover" />
                  </button>

                  {/* Leo */}
                  <button
                    onClick={() => setMessageFilter('leo')}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 border-gray-300 ${
                      messageFilter === 'leo'
                        ? 'ring-2 ring-green-300'
                        : 'hover:opacity-80'
                    }`}
                    title="Leo Messages"
                  >
                    <img src="/leo_logo.png" alt="Leo" className="w-9 h-9 rounded-full object-cover" />
                  </button>
                </div>


                <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>|</span>
                <div className={`text-sm lg:text-base ${
                  isDarkMode ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {profile?.business_name || user?.user_metadata?.name || 'you'}
                </div>
                <span className={isDarkMode ? 'text-gray-500' : 'text-gray-400'}>|</span>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Panel Toggle Button */}
                <button
                  onClick={() => setIsPanelOpen(!isPanelOpen)}
                  className={`p-2 rounded-md transition-colors border ${
                    isDarkMode
                      ? 'hover:bg-gray-700 border-gray-600 text-gray-300'
                      : 'hover:bg-gray-100 border-gray-200'
                  }`}
                  title={isPanelOpen ? "Close Panel" : "Open Panel"}
                >
                  {isPanelOpen ? (
                    <PanelLeft className={`w-5 h-5 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`} />
                  ) : (
                    <PanelRight className={`w-5 h-5 ${
                      isDarkMode ? 'text-gray-300' : 'text-gray-700'
                    }`} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className={`flex-1 flex items-start bg-transparent ${
          isDarkMode ? 'md:bg-gray-800' : 'md:bg-gray-50'
        }`} style={{ minHeight: 0, overflow: 'hidden' }}>
            <div className="w-full h-full flex gap-2">
                {/* Main Chat Area */}
              <div className="flex-1 h-full overflow-hidden">
                <div className={`h-full relative pt-0.5 px-8 overflow-y-auto custom-scrollbar ${
                  isDarkMode ? 'dark-mode' : 'light-mode'
                }`}>
                  <ATSNChatbot
                    key="atsn-chatbot-fresh"
                  />
                </div>
              </div>

              {/* Right Side Panel - Part of main content - STICKY */}
              <div
                className={`hidden md:flex sticky top-0 self-start transition-all duration-300 ease-in-out overflow-hidden h-full ${
                  isDarkMode
                    ? 'bg-gray-900'
                    : isDarkMode ? 'bg-gray-800' : 'bg-white'
                } ${
                  isPanelOpen ? 'w-48 xl:w-64' : 'w-0'
                }`}
              >
                {isPanelOpen && (
                  <div className="w-full h-full flex flex-col">
                    {/* Panel Header */}
                    <div className={`p-3 lg:p-4 border-b flex items-center justify-between flex-shrink-0 ${
                      isDarkMode
                        ? 'border-gray-700'
                        : 'border-gray-200'
                    }`}>
                      <span className={`text-lg font-normal ${
                        isDarkMode ? 'text-gray-100' : 'text-gray-800'
                      }`}>
                        Reminders
                      </span>
                    </div>

                    {/* Panel Content - Scrollable */}
                    <div className="flex-1 p-3 lg:p-4 overflow-y-auto min-h-0">
                      {/* Overdue Leads Count - Only show after loading */}
                      {!overdueLeadsLoading && (
                        <div
                          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                            isDarkMode
                              ? 'bg-gray-800 border-gray-600 hover:bg-gray-700'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                          }`}
                          onClick={() => navigate('/leads?filter=overdue_followups')}
                          title="Click to view all leads"
                        >
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm font-bold ${
                              overdueLeadsCount > 0
                                ? 'text-yellow-600'
                                : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {overdueLeadsCount}
                            </span>
                            <span className={`text-sm font-medium ${
                              isDarkMode ? 'text-gray-200' : 'text-gray-700'
                            }`}>
                              : Leads to follow up
                            </span>
                          </div>
                          {overdueLeadsCount > 0 && (
                            <p className={`text-xs mt-1 ${
                              isDarkMode ? 'text-gray-400' : 'text-gray-500'
                            }`}>
                              {overdueLeadsCount === 1 ? 'Lead has' : 'Leads have'} overdue follow-ups
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
          </div>
        </div>
      </div>
      </div>

      

      {/* Mobile Today's Conversations Panel - Full Screen */}
      {showMobileChatHistory && (
        <div className={`md:hidden fixed inset-0 z-50 ${
          isDarkMode ? 'bg-gray-900' : 'bg-white'
        }`}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between flex-shrink-0 ${
              isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
            }`}>
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? 'text-gray-100' : 'text-gray-900'
              }`}>
                Today's Conversations
              </h2>
              <button
                onClick={() => setShowMobileChatHistory(false)}
                className={`p-2 rounded-md transition-colors ${
                  isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'
                }`}
                title="Close"
              >
                <X className={`w-5 h-5 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-8">
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Loading today's conversations...
                  </div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    No conversations today
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {conversations.map((conv) => {
                    const lastMessage = conv.messages && conv.messages.length > 0
                      ? conv.messages[conv.messages.length - 1]
                      : null

                    if (!lastMessage) return null

                    const isUser = lastMessage.sender === 'user'
                    const preview = lastMessage.text?.substring(0, 100) +
                      (lastMessage.text?.length > 100 ? '...' : '')

                    return (
                      <div key={conv.id} className={`p-3 rounded-lg border ${
                        isDarkMode
                          ? 'border-gray-700 bg-gray-800'
                          : 'border-gray-200 bg-white'
                      }`}>
                        <div className="flex items-center gap-3">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm ${
                            isUser
                              ? 'bg-pink-400'
                              : 'bg-gradient-to-br from-pink-400 to-purple-500'
                          }`}>
                            {isUser ? (
                              profile?.logo_url ? (
                                <img src={profile.logo_url} alt="User" className="w-10 h-10 rounded-full object-cover" />
                              ) : (
                                <span className="text-white">U</span>
                              )
                            ) : (
                              <span className="text-white font-bold">E</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-sm font-medium ${
                                isUser ? 'text-pink-700' : 'text-purple-700'
                              }`}>
                                {isUser ? 'You' : conv.primary_agent_name || 'Emily'}
                              </span>
                              <span className={`text-xs ${
                                isDarkMode ? 'text-gray-400' : 'text-gray-500'
                              }`}>
                                {conv.total_messages} messages
                              </span>
                            </div>
                            <p className={`text-sm line-clamp-2 ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-700'
                            }`}>
                              {preview || 'No preview available'}
                            </p>
                            <p className={`text-xs mt-1 ${
                              isDarkMode ? 'text-gray-500' : 'text-gray-400'
                            }`}>
                              {new Date(conv.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmilyDashboard

