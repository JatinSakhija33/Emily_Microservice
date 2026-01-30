import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import { onboardingAPI } from '../services/onboarding'
import { supabase } from '../lib/supabase'
import { loadTauriAPI } from '../utils/tauri'
import SideNavbar from './SideNavbar'


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
import AgentCards from './AgentCards'
import NewPostModal from './NewPostModal'
import { Sparkles, TrendingUp, Target, BarChart3, FileText, PanelRight, PanelLeft, X, ChevronRight, RefreshCw, Send } from 'lucide-react'

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
  const [todayCalendarEntries, setTodayCalendarEntries] = useState([])
  const [calendarEntriesLoading, setCalendarEntriesLoading] = useState(true)
  const [upcomingCalendarCount, setUpcomingCalendarCount] = useState(0)
  const [upcomingCalendarLoading, setUpcomingCalendarLoading] = useState(true)
  const [scheduledPostsCount, setScheduledPostsCount] = useState(0)
  const [scheduledPostsLoading, setScheduledPostsLoading] = useState(true)
  const [todaysNewLeadsCount, setTodaysNewLeadsCount] = useState(0)
  const [todaysNewLeadsLoading, setTodaysNewLeadsLoading] = useState(true)
  const [showChatbot, setShowChatbot] = useState(false)
  const [showNewPostModal, setShowNewPostModal] = useState(false)

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

  const handleRefreshAllData = async () => {
    try {
      // Clear all caches
      const cacheKeys = [
        `overdue_leads_count_${user?.id}`,
        `today_calendar_entries_${user?.id}`,
        `upcoming_calendar_count_${user?.id}`,
        `scheduled_posts_count_${user?.id}`,
        `todays_new_leads_count_${user?.id}`
      ]

      cacheKeys.forEach(key => {
        localStorage.removeItem(key)
      })

      // Refetch all data
      if (user) {
        await Promise.all([
          fetchOverdueLeadsCount(true),
          fetchTodayCalendarEntries(true),
          fetchUpcomingCalendarCount(true),
          fetchScheduledPostsCount(true),
          fetchTodaysNewLeadsCount(true)
        ])
      }

      showSuccess('Data refreshed', 'All data has been updated with fresh information.')
    } catch (error) {
      console.error('Error refreshing data:', error)
      showError('Refresh failed', 'There was an error refreshing the data.')
    }
  }

  const handleCreateNewPost = async (payload) => {
    try {
      const token = localStorage.getItem('authToken')
      if (!token) {
        showError('Authentication Error', 'Please log in to create content.')
        return
      }

      // Open the chatbot to show content generation
      setShowChatbot(true)

      // Send the payload to create content via chatbot
      const response = await fetch(`${API_BASE_URL}/atsn/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: `Create content with these specifications: ${JSON.stringify(payload, null, 2)}`,
          user_id: user?.id
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to create post')
      }

      // The chatbot will handle displaying the content generation process
      // No need to show additional success message since chatbot will show the result

    } catch (error) {
      console.error('Error creating post:', error)
      showError('Creation Failed', error.message || 'There was an error creating your post. Please try again.')
      setShowChatbot(false) // Close chatbot on error
    }
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

      // Get all leads using Supabase directly (like todaysNewLeadsCount)
      const { data: allLeads, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching leads for overdue count:', error)
        setOverdueLeadsCount(0)
        return
      }

      console.log('Total leads fetched for overdue count:', allLeads.length)
      console.log('All leads sample:', allLeads.slice(0, 10))
      console.log('Leads with follow_up_at:', allLeads.filter(l => l.follow_up_at))
      console.log('Sample leads with follow_up_at:', allLeads.filter(l => l.follow_up_at).slice(0, 10))

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
            diffInDays: diffInDays,
            followUpDate: followUpDate.toISOString(),
            today: today.toISOString()
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

  // Fetch today's calendar entries
  const fetchTodayCalendarEntries = async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `today_calendar_entries_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    try {
      // Check if we have cached data from today
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          const { entries, timestamp, date } = JSON.parse(cachedData)
          const cacheAge = Date.now() - timestamp
          const today = new Date().toDateString()
          const cacheDate = new Date(date).toDateString()

          // Use cached data if it's from today and less than 24 hours old
          if (cacheDate === today && cacheAge < CACHE_EXPIRATION_MS) {
            console.log('Using cached today calendar entries:', entries)
            setTodayCalendarEntries(entries)
            setCalendarEntriesLoading(false)
            return
          }
        }
      }

      setCalendarEntriesLoading(true)
      const token = await supabase.auth.getSession().then(res => res.data.session?.access_token)
      
      if (!token) return

      // Get today's date in YYYY-MM-DD format
      const today = new Date()
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

      // Fetch all calendars for the user
      const calendarsResponse = await fetch(`${API_BASE_URL}/calendars`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (calendarsResponse.ok) {
        const calendars = await calendarsResponse.json()
        
        // Fetch entries for each calendar and filter for today
        let todayEntries = []
        for (const calendar of calendars) {
          const entriesResponse = await fetch(`${API_BASE_URL}/calendars/${calendar.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (entriesResponse.ok) {
            const calendarData = await entriesResponse.json()
            const entries = calendarData.entries || []
            
            // Filter for today's entries
            const todaysEntries = entries.filter(entry => {
              const entryDate = new Date(entry.entry_date)
              const entryDateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`
              return entryDateStr === todayStr
            })
            
            todayEntries = [...todayEntries, ...todaysEntries]
          }
        }
        
        // Cache the data
        const cacheData = {
          entries: todayEntries,
          timestamp: Date.now(),
          date: today.toISOString()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
        
        console.log('Today calendar entries:', todayEntries)
        setTodayCalendarEntries(todayEntries)
      }
    } catch (error) {
      console.error('Error fetching today calendar entries:', error)
      setTodayCalendarEntries([])
    } finally {
      setCalendarEntriesLoading(false)
    }
  }

  // Fetch upcoming calendar content for next 7 days
  const fetchUpcomingCalendarCount = async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `upcoming_calendar_count_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    try {
      // Check if we have cached data
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          const { count, timestamp } = JSON.parse(cachedData)
          const cacheAge = Date.now() - timestamp

          // Use cached data if less than 24 hours old
          if (cacheAge < CACHE_EXPIRATION_MS) {
            console.log('Using cached upcoming calendar count:', count)
            setUpcomingCalendarCount(count)
            setUpcomingCalendarLoading(false)
            return
          }
        }
      }

      setUpcomingCalendarLoading(true)
      const token = await supabase.auth.getSession().then(res => res.data.session?.access_token)

      if (!token) return

      // Get date range for next 7 days
      const today = new Date()
      const nextWeek = new Date(today)
      nextWeek.setDate(today.getDate() + 7)

      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      const nextWeekStr = `${nextWeek.getFullYear()}-${String(nextWeek.getMonth() + 1).padStart(2, '0')}-${String(nextWeek.getDate()).padStart(2, '0')}`

      // Fetch all calendars for the user
      const calendarsResponse = await fetch(`${API_BASE_URL}/calendars`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (calendarsResponse.ok) {
        const calendars = await calendarsResponse.json()

        // Fetch entries for each calendar and filter for next 7 days
        let upcomingCount = 0
        for (const calendar of calendars) {
          const entriesResponse = await fetch(`${API_BASE_URL}/calendars/${calendar.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })

          if (entriesResponse.ok) {
            const calendarData = await entriesResponse.json()
            const entries = calendarData.entries || []

            // Filter for entries in the next 7 days (excluding today)
            const upcomingEntries = entries.filter(entry => {
              const entryDate = new Date(entry.entry_date)
              const entryDateStr = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`
              return entryDateStr > todayStr && entryDateStr <= nextWeekStr
            })

            upcomingCount += upcomingEntries.length
          }
        }

        // Cache the result with current timestamp
        const cacheData = {
          count: upcomingCount,
          timestamp: Date.now()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

        console.log('Upcoming calendar content count (next 7 days):', upcomingCount)
        setUpcomingCalendarCount(upcomingCount)
      }
    } catch (error) {
      console.error('Error fetching upcoming calendar count:', error)
      setUpcomingCalendarCount(0)
    } finally {
      setUpcomingCalendarLoading(false)
    }
  }

  // Fetch scheduled posts count from created_content table
  const fetchScheduledPostsCount = async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `scheduled_posts_count_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    try {
      // Check if we have cached data
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          const { count, timestamp } = JSON.parse(cachedData)
          const cacheAge = Date.now() - timestamp

          // Use cached data if less than 24 hours old
          if (cacheAge < CACHE_EXPIRATION_MS) {
            console.log('Using cached scheduled posts count:', count)
            setScheduledPostsCount(count)
            setScheduledPostsLoading(false)
            return
          }
        }
      }

      setScheduledPostsLoading(true)

      // Fetch scheduled posts from content_posts table (joined with content_campaigns for user filtering)
      const { data, error } = await supabase
        .from('content_posts')
        .select('id, content_campaigns!inner(*)')
        .eq('content_campaigns.user_id', user.id)
        .eq('status', 'scheduled')
        .gte('scheduled_date', new Date().toISOString().split('T')[0]) // From today onwards

      if (error) {
        console.error('Error fetching scheduled posts:', error)
        setScheduledPostsCount(0)
      } else {
        const count = data?.length || 0

        // Cache the result with current timestamp
        const cacheData = {
          count: count,
          timestamp: Date.now()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

        console.log('Scheduled posts count:', count)
        console.log('Scheduled posts data:', data)
        setScheduledPostsCount(count)
      }
    } catch (error) {
      console.error('Error fetching scheduled posts count:', error)
      setScheduledPostsCount(0)
    } finally {
      setScheduledPostsLoading(false)
    }
  }

  // Fetch today's new leads count
  const fetchTodaysNewLeadsCount = async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `todays_new_leads_count_${user.id}`
    const CACHE_EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours

    try {
      // Check if we have cached data
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          const { count, timestamp, date } = JSON.parse(cachedData)
          const cacheAge = Date.now() - timestamp
          const today = new Date().toDateString()

          // Use cached data if it's from today and less than 24 hours old
          if (date === today && cacheAge < CACHE_EXPIRATION_MS) {
            console.log('Using cached todays new leads count:', count)
            setTodaysNewLeadsCount(count)
            setTodaysNewLeadsLoading(false)
            return
          }
        }
      }

      setTodaysNewLeadsLoading(true)

      // Get today's date range
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999)

      // Fetch leads created today from Supabase
      const { data, error } = await supabase
        .from('leads')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString())

      if (error) {
        console.error('Error fetching todays new leads:', error)
        setTodaysNewLeadsCount(0)
      } else {
        const count = data?.length || 0

        // Cache the result with current timestamp and date
        const cacheData = {
          count: count,
          timestamp: Date.now(),
          date: today.toDateString()
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))

        console.log('Todays new leads count:', count)
        setTodaysNewLeadsCount(count)
      }
    } catch (error) {
      console.error('Error fetching todays new leads count:', error)
      setTodaysNewLeadsCount(0)
    } finally {
      setTodaysNewLeadsLoading(false)
    }
  }

  // Fetch overdue leads count periodically (cached for 24 hours)
  useEffect(() => {
    if (user) {
      fetchOverdueLeadsCount()
      // Refresh every 24 hours
      const interval = setInterval(() => fetchOverdueLeadsCount(true), 24 * 60 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Fetch today's calendar entries
  useEffect(() => {
    if (user) {
      fetchTodayCalendarEntries()
      // Refresh every 24 hours
      const interval = setInterval(() => fetchTodayCalendarEntries(true), 24 * 60 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Fetch upcoming calendar content count
  useEffect(() => {
    if (user) {
      fetchUpcomingCalendarCount()
      // Refresh every 24 hours
      const interval = setInterval(() => fetchUpcomingCalendarCount(true), 24 * 60 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Fetch scheduled posts count
  useEffect(() => {
    if (user) {
      fetchScheduledPostsCount()
      // Refresh every 24 hours
      const interval = setInterval(() => fetchScheduledPostsCount(true), 24 * 60 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [user])

  // Fetch today's new leads count
  useEffect(() => {
    if (user) {
      fetchTodaysNewLeadsCount()
      // Refresh every hour for more frequent updates on new leads
      const interval = setInterval(() => fetchTodaysNewLeadsCount(true), 60 * 60 * 1000)
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
        const cleanedConversations = (data.conversations || []).map(conv => {
          // Clean messages text to remove stray characters
          if (conv.messages && Array.isArray(conv.messages)) {
            conv.messages = conv.messages.map(msg => {
              if (msg.text) {
                let cleanText = msg.text;
                // Remove trailing )} patterns
                cleanText = cleanText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                // Remove any standalone )} patterns
                cleanText = cleanText.replace(/\s*\)\s*\}\s*/g, '');
                // Remove other stray patterns
                cleanText = cleanText.replace(/^[\(\[\{\*\)\]\}\s]*/g, '').replace(/[\(\[\{\*\)\]\}\s]*$/g, '').trim();
                // Remove multiple consecutive braces
                cleanText = cleanText.replace(/[\(\)\{\}\[\]\*]{2,}/g, '').trim();
                msg.text = cleanText;
              }
              return msg;
            });
          }
          return conv;
        });
        setConversations(cleanedConversations)
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
    <div className={`h-screen overflow-hidden custom-scrollbar ${
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
      <div className={`md:ml-48 xl:ml-64 flex flex-col overflow-hidden pt-16 md:pt-0 bg-transparent ${
        isDarkMode ? 'md:bg-gray-900' : 'md:bg-white'
      }`} style={{ height: '100vh', overflow: 'hidden' }}>
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
                {/* Refresh Button */}
                <button
                  onClick={handleRefreshAllData}
                  className={`p-2 rounded-md transition-colors border ${
                    isDarkMode
                      ? 'hover:bg-gray-700 border-gray-600 text-gray-300'
                      : 'hover:bg-gray-100 border-gray-200'
                  }`}
                  title="Refresh all data"
                >
                  <RefreshCw className={`w-5 h-5 ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-700'
                  }`} />
                </button>

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
        <div className={`flex-1 flex bg-transparent ${
          isDarkMode ? 'md:bg-gray-800' : 'md:bg-gray-50'
        }`} style={{ minHeight: 0, overflow: 'hidden' }}>
            <div className="w-full h-full flex gap-2">
                {/* Main Chat Area */}
              <div className="flex-1 h-full overflow-hidden">
                <div className={`h-full relative ${
                  isDarkMode ? 'dark-mode' : 'light-mode'
                }`}>
                  {showChatbot ? (
                    <div className="h-full pt-0.5 px-8">
                      <ATSNChatbot
                        key="atsn-chatbot-fresh"
                        onMinimize={() => setShowChatbot(false)}
                      />
                    </div>
                  ) : (
                    <AgentCards
                      isDarkMode={isDarkMode}
                      onInputClick={() => setShowChatbot(true)}
                      upcomingCalendarCount={upcomingCalendarCount}
                      upcomingCalendarLoading={upcomingCalendarLoading}
                      scheduledPostsCount={scheduledPostsCount}
                      scheduledPostsLoading={scheduledPostsLoading}
                      overdueLeadsCount={overdueLeadsCount}
                      overdueLeadsLoading={overdueLeadsLoading}
                      todaysNewLeadsCount={todaysNewLeadsCount}
                      todaysNewLeadsLoading={todaysNewLeadsLoading}
                      todayCalendarEntries={todayCalendarEntries}
                      calendarEntriesLoading={calendarEntriesLoading}
                      navigate={navigate}
                    />
                  )}
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

                    </div>
                  </div>
                )}
          </div>
        </div>
      </div>
      </div>

      {/* Quick Actions - only show when not showing chatbot */}
      {!showChatbot && (
        <div className="fixed bottom-20 left-0 right-0 z-10 p-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div
                onClick={() => setShowNewPostModal(true)}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-blue-900/50' : 'bg-blue-100'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      isDarkMode ? 'text-blue-400' : 'text-blue-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Design a new post
                  </span>
                </div>
              </div>

              <div
                onClick={() => navigate('/content')}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-green-900/50' : 'bg-green-100'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      isDarkMode ? 'text-green-400' : 'text-green-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Upload a new post
                  </span>
                </div>
              </div>

              <div
                onClick={() => navigate('/leads')}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-purple-900/50' : 'bg-purple-100'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      isDarkMode ? 'text-purple-400' : 'text-purple-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Upload a new lead
                  </span>
                </div>
              </div>

              <div
                onClick={() => navigate('/analytics')}
                className={`p-4 rounded-xl border transition-all cursor-pointer hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-700 hover:bg-gray-750'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex flex-col items-center text-center space-y-2">
                  <div className={`p-3 rounded-lg ${
                    isDarkMode ? 'bg-orange-900/50' : 'bg-orange-100'
                  }`}>
                    <svg className={`w-6 h-6 ${
                      isDarkMode ? 'text-orange-400' : 'text-orange-600'
                    }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className={`text-sm font-medium ${
                    isDarkMode ? 'text-gray-200' : 'text-gray-700'
                  }`}>
                    Quick Analytics
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input Bar at bottom of dashboard - only show when not showing chatbot */}
      {!showChatbot && (
        <div className="fixed bottom-0 left-0 right-0 z-10 p-4">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <div
                onClick={() => setShowChatbot(true)}
                className={`w-full px-6 pr-14 py-4 text-base rounded-[20px] backdrop-blur-sm cursor-pointer transition-all hover:shadow-lg ${
                  isDarkMode
                    ? 'bg-gray-700/80 border-0 hover:bg-gray-600/80 text-gray-100'
                    : 'bg-white/80 border border-white/20 hover:bg-gray-50/80 text-gray-900'
                }`}
              >
                <span className={`${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Talk to your AI teammates
                </span>
              </div>
              <div className={`absolute right-3 top-1/2 transform -translate-y-1/2 w-7 h-7 transition-all flex items-center justify-center cursor-pointer ${
                isDarkMode
                  ? 'text-green-400 hover:text-green-300'
                  : 'text-blue-600 hover:text-blue-700'
              }`}>
                <Send className="w-5 h-5 transform rotate-45" />
              </div>
            </div>

            <div className={`mt-2 text-xs text-center ${
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            }`}>
              Click to start a conversation
            </div>
          </div>
        </div>
      )}

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

                    // Clean message text to remove stray characters
                    let cleanText = lastMessage.text || '';
                    // Remove trailing )} patterns (with or without whitespace)
                    cleanText = cleanText.replace(/\s*\)\s*\}\s*$/g, '').trim();
                    // Remove any standalone )} patterns throughout the text
                    cleanText = cleanText.replace(/\s*\)\s*\}\s*/g, '');
                    // Remove other common stray patterns: (, {, [, ], *, etc. at start/end
                    cleanText = cleanText.replace(/^[\(\[\{\*\)\]\}\s]*/g, '').replace(/[\(\[\{\*\)\]\}\s]*$/g, '').trim();
                    // Remove multiple consecutive braces/brackets
                    cleanText = cleanText.replace(/[\(\)\{\}\[\]\*]{2,}/g, '').trim();

                    const preview = cleanText?.substring(0, 100) +
                      (cleanText?.length > 100 ? '...' : '')
                    
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

      {/* New Post Modal */}
      <NewPostModal
        isOpen={showNewPostModal}
        onClose={() => setShowNewPostModal(false)}
        onSubmit={handleCreateNewPost}
        isDarkMode={isDarkMode}
      />
    </div>
  )
}

export default EmilyDashboard

