import React, { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useNotifications } from '../contexts/NotificationContext'
import SideNavbar from './SideNavbar'
import MobileNavigation from './MobileNavigation'
import CalendarContentModal from './CalendarContentModal'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

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

const CalendarDashboard = () => {
  const { user } = useAuth()
  const { showError } = useNotifications()
  
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(getDarkModePreference)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [calendars, setCalendars] = useState([])
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedEntries, setSelectedEntries] = useState([])

  // Listen for dark mode changes
  useStorageListener('darkMode', setIsDarkMode)

  // Get auth token
  const getAuthToken = async () => {
    const { data: { session } } = await import('../lib/supabase').then(m => m.supabase.auth.getSession())
    return session?.access_token || localStorage.getItem('authToken')
  }

  // Fetch calendars and entries
  const fetchCalendarData = useCallback(async (forceRefresh = false) => {
    if (!user) return

    const CACHE_KEY = `calendar_data_${user.id}`

    try {
      // Try to load from cache first (unless force refresh)
      if (!forceRefresh) {
        const cachedData = localStorage.getItem(CACHE_KEY)
        if (cachedData) {
          try {
            const { calendars: cachedCalendars, entries: cachedEntries, timestamp } = JSON.parse(cachedData)
            console.log('Using cached calendar data from:', new Date(timestamp).toLocaleString())
            console.log('Cached entries count:', cachedEntries.length)
            console.log('Cached entries by platform:', cachedEntries.reduce((acc, entry) => {
              acc[entry.platform] = (acc[entry.platform] || 0) + 1
              return acc
            }, {}))
            setCalendars(cachedCalendars)
            setEntries(cachedEntries)
            setLoading(false)
            return
          } catch (parseError) {
            console.error('Error parsing cached calendar data:', parseError)
            // Continue to fetch from API
          }
        }
      }

      setLoading(true)
      const token = await getAuthToken()
      if (!token) {
        showError('Authentication required', 'Please log in again.')
        return
      }

      // Fetch all calendars
      const response = await fetch(`${API_BASE_URL}/calendars`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch calendars: ${response.status}`)
      }

      const data = await response.json()
      const fetchedCalendars = Array.isArray(data) ? data : data.calendars || []
      setCalendars(fetchedCalendars)

      // Fetch entries from ALL calendars and combine them
      let fetchedEntries = []
      if (fetchedCalendars.length > 0) {
        console.log(`Fetching entries from ${fetchedCalendars.length} calendars...`)
        
        // Fetch entries for each calendar
        const entryPromises = fetchedCalendars.map(calendar =>
          fetch(`${API_BASE_URL}/calendars/${calendar.id}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          })
        )

        const responses = await Promise.all(entryPromises)
        
        // Combine all entries from all calendars
        for (const response of responses) {
          if (response.ok) {
            const detailData = await response.json()
            const entries = detailData.entries || []
            fetchedEntries = [...fetchedEntries, ...entries]
          }
        }
        
        console.log(`Total entries loaded: ${fetchedEntries.length} from ${fetchedCalendars.length} calendars`)
        console.log('Entries by platform:', fetchedEntries.reduce((acc, entry) => {
          acc[entry.platform] = (acc[entry.platform] || 0) + 1
          return acc
        }, {}))
        setEntries(fetchedEntries)
      }

      // Cache the data
      const cacheData = {
        calendars: fetchedCalendars,
        entries: fetchedEntries,
        timestamp: Date.now()
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData))
      console.log('Calendar data cached successfully')

    } catch (error) {
      console.error('Error fetching calendar data:', error)
      showError('Error', 'Failed to fetch calendar data.')
    } finally {
      setLoading(false)
    }
  }, [user, showError])

  useEffect(() => {
    if (user) {
      fetchCalendarData()
    }
  }, [user, fetchCalendarData])

  // Listen for calendar regeneration events
  useEffect(() => {
    const handleCalendarRegeneration = () => {
      console.log('Calendar regeneration detected, refreshing data...')
      fetchCalendarData(true) // Force refresh
    }

    window.addEventListener('calendarRegenerated', handleCalendarRegeneration)

    return () => {
      window.removeEventListener('calendarRegenerated', handleCalendarRegeneration)
    }
  }, [fetchCalendarData])

  // Calendar navigation
  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Get calendar data
  const getDaysInMonth = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfMonth = new Date(year, month, 1).getDay()
    
    return { daysInMonth, firstDayOfMonth }
  }

  const { daysInMonth, firstDayOfMonth } = getDaysInMonth(currentDate)
  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const today = new Date()
  
  // Calculate number of rows needed for the calendar
  const totalCells = firstDayOfMonth + daysInMonth
  const numRows = Math.ceil(totalCells / 7)
  
  const isToday = (day) => {
    return today.getDate() === day &&
           today.getMonth() === currentDate.getMonth() &&
           today.getFullYear() === currentDate.getFullYear()
  }

  // Get entries for a specific day
  const getEntriesForDate = (day) => {
    const dateKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const filtered = entries.filter(entry => {
      const entryDate = new Date(entry.entry_date)
      const entryKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}-${String(entryDate.getDate()).padStart(2, '0')}`
      return entryKey === dateKey
    })
    
    // Debug: Log if we have multiple entries for a date
    if (filtered.length > 1) {
      console.log(`📅 Date ${dateKey} has ${filtered.length} entries:`, filtered.map(e => `${e.platform} - ${e.content_type}`))
    }
    
    return filtered
  }

  // Handle entry click to open modal for single entry
  const handleEntryClick = (entry, event) => {
    event.stopPropagation() // Prevent date click

    // If content has been created for this calendar entry, navigate to content view
    if (entry.content_id) {
      console.log('Content exists for calendar entry, navigating to content view:', entry.content_id)
      // Navigate to content dashboard with the specific content
      window.location.href = `/content?content_id=${entry.content_id}&from_calendar=true`
      return
    }

    // Otherwise, open the calendar modal
    const entryDate = new Date(entry.entry_date)
    setSelectedDate(entryDate.toISOString())
    setSelectedEntries([entry]) // Single entry in array
    setIsModalOpen(true)
  }

  // Handle date click to open modal for all entries (fallback)
  const handleDateClick = (day, dayEntries) => {
    if (dayEntries && dayEntries.length > 0) {
      const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
      setSelectedDate(clickedDate.toISOString())
      setSelectedEntries(dayEntries)
      setIsModalOpen(true)
    }
  }

  // Get content type color
  const getContentTypeColor = (contentType) => {
    switch (contentType?.toLowerCase()) {
      case 'reel':
      case 'video':
        return isDarkMode ? 'bg-purple-900 text-purple-200' : 'bg-purple-100 text-purple-800'
      case 'carousel':
        return isDarkMode ? 'bg-blue-900 text-blue-200' : 'bg-blue-100 text-blue-800'
      case 'static_post':
      case 'image':
        return isDarkMode ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800'
      case 'story':
        return isDarkMode ? 'bg-orange-900 text-orange-200' : 'bg-orange-100 text-orange-800'
      default:
        return isDarkMode ? 'bg-gray-800 text-gray-200' : 'bg-gray-100 text-gray-800'
    }
  }

  // Get platform icon
  const getPlatformIcon = (platform) => {
    switch (platform?.toLowerCase()) {
      case 'instagram':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.162c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
          </svg>
        )
      case 'facebook':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
          </svg>
        )
      case 'youtube':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
          </svg>
        )
      case 'linkedin':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
        )
      default:
        return null
    }
  }

  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className={`min-h-screen flex ${isDarkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <SideNavbar />
      <MobileNavigation />

      <div className="flex-1 ml-64 lg:ml-64 h-screen flex flex-col">
        <div className="p-6 flex-1 flex flex-col">
          {/* Calendar */}
          <div className={`flex-1 flex flex-col rounded-xl shadow-lg border p-6 ${
            isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
          }`}>
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className={`text-3xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                  {monthYear}
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => fetchCalendarData(true)}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                    title="Refresh calendar data"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                  <button
                    onClick={previousMonth}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className={`p-2 rounded-lg transition-all duration-200 ${
                      isDarkMode
                        ? 'hover:bg-gray-700 text-gray-400 hover:text-white'
                        : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
            </div>

            {/* Days of Week */}
            <div className="grid grid-cols-7 gap-2 mb-2">
              {days.map(day => (
                <div
                  key={day}
                  className={`text-center font-semibold text-base py-2 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 flex-1" style={{ gridTemplateRows: `repeat(${numRows}, minmax(0, 1fr))` }}>
              {/* Empty cells for days before month starts */}
              {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                <div key={`empty-${index}`} className="h-full" />
              ))}

              {/* Days of the month */}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1
                const dayEntries = getEntriesForDate(day)
                const hasEntries = dayEntries.length > 0

                return (
                  <div
                    key={day}
                    className={`h-full border rounded-lg p-3 transition-all duration-200 relative ${
                      hasEntries ? 'hover:scale-105' : ''
                    } ${
                      isDarkMode
                        ? 'border-gray-700 hover:border-gray-600 hover:bg-gray-750'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${isToday(day) ? (isDarkMode ? 'bg-blue-900/20 border-blue-600' : 'bg-blue-50 border-blue-400') : ''}`}
                  >
                    {/* Day Number */}
                    <div className={`absolute top-2 left-2 text-sm font-semibold ${
                      isToday(day)
                        ? (isDarkMode ? 'text-blue-400' : 'text-blue-600')
                        : (isDarkMode ? 'text-gray-300' : 'text-gray-700')
                    }`}>
                      {day}
                    </div>
                    
                    {/* Entry Count Badge */}
                    {hasEntries && (
                      <div className={`absolute top-2 right-2 text-xs font-bold px-2 py-0.5 rounded-full ${
                        isDarkMode ? 'bg-blue-600 text-white' : 'bg-blue-500 text-white'
                      }`}>
                        {dayEntries.length}
                      </div>
                    )}

                    {/* Entry Indicators */}
                    {hasEntries && (
                      <div className="space-y-2 overflow-y-auto h-full pt-6">
                        {dayEntries.slice(0, 3).map((entry, idx) => (
                          <div
                            key={idx}
                            className={`text-sm px-2 py-1 rounded cursor-pointer hover:opacity-80 transition-opacity ${getContentTypeColor(entry.content_type)}`}
                            title={`${entry.topic} - Click to view details`}
                            onClick={(event) => handleEntryClick(entry, event)}
                          >
                            <div className="flex items-center gap-1 font-medium truncate">
                              {getPlatformIcon(entry.platform)}
                              <span>{entry.content_type?.replace('_', ' ')}</span>
                            </div>
                            <div className="text-xs truncate opacity-90">
                              {entry.topic}
                            </div>
                          </div>
                        ))}
                        {dayEntries.length > 3 && (
                          <div className={`text-sm px-2 py-1 rounded text-center font-medium cursor-pointer hover:opacity-80 transition-opacity ${
                            isDarkMode ? 'bg-gray-700 text-gray-300 hover:bg-gray-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                          title={`Click to view all ${dayEntries.length} entries for this date`}
                          onClick={(event) => {
                            event.stopPropagation()
                            handleDateClick(day, dayEntries)
                          }}>
                            +{dayEntries.length - 3} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Legend */}
            <div className={`mt-6 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
              <h3 className={`text-base font-semibold mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                Content Types
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-purple-500"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Reel/Video</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Carousel</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Image</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-500"></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Story</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${isDarkMode ? 'bg-blue-600' : 'bg-blue-400'} ring-2 ${isDarkMode ? 'ring-blue-400' : 'ring-blue-600'}`}></div>
                  <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Today</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Content Modal */}
      <CalendarContentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        date={selectedDate}
        entries={selectedEntries}
        isDarkMode={isDarkMode}
      />
    </div>
  )
}

export default CalendarDashboard
