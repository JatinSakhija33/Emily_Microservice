import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { adminAPI } from '../services/admin'
import SettingsMenu from './SettingsMenu'
import UsageStats from './UsageStats'
// Custom Discussions Icon Component
const DiscussionsIcon = ({ className, isDarkMode }) => (
  <img
    src="/discussions.svg"
    alt="Discussions"
    className={className}
    style={{
      width: '24px',
      height: '24px',
      objectFit: 'contain',
      filter: isDarkMode ? 'brightness(0) invert(1)' : 'none'
    }}
  />
)
import {
  Home,
  FileText,
  Settings,
  Hand,
  BarChart3,
  Share2,
  Megaphone,
  BookOpen,
  ChevronDown,
  ChevronRight,
  UserPlus,
  MessageSquare,
  Lightbulb,
  Pen,
  TrendingUp,
  Shield
} from 'lucide-react'

const SideNavbar = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const [profileFetched, setProfileFetched] = useState(false)
  const [expandedMenus, setExpandedMenus] = useState({})
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userPlan, setUserPlan] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Check localStorage for saved preference, default to dark mode
    const saved = localStorage.getItem('darkMode')
    return saved !== null ? saved === 'true' : true // Default to true (dark mode)
  })

  // Cache key for localStorage
  const getCacheKey = (userId) => `profile_${userId}`

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

  // Get authentication token from session
  const getAuthToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }



  // Load profile from cache or fetch from API
  const loadProfile = useCallback(async () => {
    try {
      if (!user) return

      const cacheKey = getCacheKey(user.id)
      
      // Try to load from cache first
      const cachedProfile = localStorage.getItem(cacheKey)
      if (cachedProfile) {
        const parsedProfile = JSON.parse(cachedProfile)
        setProfile(parsedProfile)
        setProfileFetched(true)
        return
      }

      // If not in cache, fetch from API
      const { data, error } = await supabase
        .from('profiles')
        .select('logo_url, business_name, name')
        .eq('id', user.id)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
        setProfileFetched(true)
        return
      }

      // Cache the profile data
      localStorage.setItem(cacheKey, JSON.stringify(data))
      setProfile(data)
      setProfileFetched(true)
    } catch (error) {
      console.error('Error loading profile:', error)
      setProfileFetched(true)
    }
  }, [user])

  useEffect(() => {
    if (user && !profileFetched) {
      loadProfile()
    }
  }, [user, profileFetched, loadProfile])

  // Check admin status based on subscription plan
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user) {
        setIsAdmin(false)
        return
      }
      
      try {
        // Get user profile to check subscription plan
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('subscription_plan')
          .eq('id', user.id)
          .single()
        
        if (error || !profile) {
          setIsAdmin(false)
          setUserPlan('')
          return
        }
        
        // Store user plan and check if admin
        setUserPlan(profile.subscription_plan || '')
        setIsAdmin(profile.subscription_plan === 'admin')
      } catch (error) {
        console.error('Error checking admin status:', error)
        setIsAdmin(false)
      }
    }
    
    if (user) {
      checkAdminStatus()
    }
  }, [user])

  const navigationItems = [
    {
      name: 'Discussions',
      href: '/dashboard',
      icon: DiscussionsIcon
    },
    {
      name: 'Content',
      href: '/created-content',
      icon: FileText
    },
    // Temporarily hidden - Writings dashboard
    // {
    //   name: 'Writings',
    //   href: '/blogs',
    //   icon: Pen
    // },
    {
      name: 'Happenings',
      href: '/social',
      icon: TrendingUp
    },
    // Temporarily hidden - Analytics dashboard
    // {
    //   name: 'Analytics',
    //   href: '/analytics',
    //   icon: BarChart3
    // },
    // {
    //   name: 'Ads',
    //   href: '/ads',
    //   icon: Megaphone
    // },
    {
      name: 'Leads',
      href: '/leads',
      icon: UserPlus
    }
  ]

  const handleLogout = () => {
    // Clear profile cache on logout
    if (user) {
      const cacheKey = getCacheKey(user.id)
      localStorage.removeItem(cacheKey)
    }
    logout()
    navigate('/login')
  }

  const isActive = (href) => {
    return location.pathname === href
  }

  const toggleSubmenu = (menuName) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuName]: !prev[menuName]
    }))
  }

  const isSubmenuActive = (submenuItems) => {
    return submenuItems.some(item => isActive(item.href))
  }

  // Auto-expand submenus when their child pages are active
  useEffect(() => {
    const newExpandedMenus = {}
    navigationItems.forEach(item => {
      if (item.hasSubmenu && item.submenu) {
        const hasActiveChild = item.submenu.some(subItem => isActive(subItem.href))
        if (hasActiveChild) {
          newExpandedMenus[item.name] = true
        }
      }
    })
    setExpandedMenus(prev => ({ ...prev, ...newExpandedMenus }))
  }, [location.pathname])


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

  // Listen for dark mode changes from other components (like SettingsMenu)
  useEffect(() => {
    const handleCustomChange = (event) => {
      if (event.detail && event.detail.key === 'darkMode') {
        const newValue = event.detail.newValue === 'true'
        setIsDarkMode(newValue)
      }
    }

    window.addEventListener('localStorageChange', handleCustomChange)

    return () => {
      window.removeEventListener('localStorageChange', handleCustomChange)
    }
  }, [])

  const displayName = useMemo(() => {
    return profile?.name || user?.user_metadata?.name || user?.email || 'User'
  }, [profile, user])


  // Function to refresh profile cache (can be called from other components)
  const refreshProfileCache = useCallback(() => {
    if (user) {
      const cacheKey = getCacheKey(user.id)
      localStorage.removeItem(cacheKey)
      setProfileFetched(false)
      setProfile(null)
    }
  }, [user])

  return (
    <div className={`hidden md:block shadow-lg transition-all duration-300 fixed left-0 top-0 h-screen z-50 w-48 xl:w-64 flex flex-col overflow-hidden ${
      isDarkMode ? 'bg-gray-900' : 'bg-white'
    }`} style={{position: 'fixed', zIndex: 50}}>
      {/* Header */}
      <div className={`p-3 lg:p-4 border-b ${
        isDarkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col space-y-1">
            <h1 className={`text-xl lg:text-2xl font-bold ${
              isDarkMode ? 'text-gray-200' : 'text-gray-600'
            }`}>atsn ai</h1>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 lg:p-4 space-y-1 lg:space-y-2 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const active = item.href ? isActive(item.href) : isSubmenuActive(item.submenu || [])
          const isExpanded = expandedMenus[item.name]
          
          if (item.hasSubmenu) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => toggleSubmenu(item.name)}
                  className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-all duration-200 group ${
                    active
                      ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                      : isDarkMode
                      ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {item.name === 'Discussions' ? (
                    <DiscussionsIcon className="w-5 h-5 mr-3" isDarkMode={isDarkMode} />
                  ) : (
                  <Icon className="w-5 h-5 mr-3" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="font-medium">{item.name}</div>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="w-5 h-5" />
                  ) : (
                    <ChevronRight className="w-5 h-5" />
                  )}
                </button>
                
                {/* Submenu */}
                {isExpanded && item.submenu && (
                  <div className="ml-4 mt-2 space-y-1 lg:space-y-2">
                    {item.submenu.map((subItem) => {
                      const SubIcon = subItem.icon
                      const subActive = isActive(subItem.href)
                      
                      return (
                        <button
                          key={subItem.name}
                          onClick={() => navigate(subItem.href)}
                          className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-all duration-200 group ${
                            subActive
                              ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white shadow-lg'
                              : isDarkMode
                              ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <SubIcon className="w-5 h-5 mr-2 lg:mr-3" />
                          <div className="flex-1 text-left">
                            <div className="font-medium text-sm lg:text-base">{subItem.name}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }
          
          // Regular menu item
          return (
            <button
              key={item.name}
              onClick={() => {
                if (item.onClick) {
                  item.onClick()
                } else if (item.href) {
                  navigate(item.href)
                }
              }}
              className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-all duration-200 group ${
                active
                  ? isDarkMode
                    ? 'bg-gray-700/50 backdrop-blur-md text-gray-100 border border-gray-600/30 shadow-sm'
                    : 'bg-gray-200/50 backdrop-blur-md text-gray-900 border border-gray-300/30 shadow-sm'
                  : isDarkMode
                  ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.name === 'Discussions' ? (
                <DiscussionsIcon className="w-5 h-5 mr-3" isDarkMode={isDarkMode} />
              ) : (
              <Icon className="w-5 h-5 mr-3" />
              )}
              <div className="flex-1 text-left">
                <div className="font-medium">{item.name}</div>
              </div>
            </button>
          )
        })}
      </nav>

      {/* User Section */}
      <div className={`p-4 border-t flex-shrink-0 space-y-1 ${
        isDarkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        {isAdmin && (
          <button
            onClick={() => navigate('/admin')}
            className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-colors group ${
              location.pathname === '/admin'
                ? isDarkMode
                  ? 'bg-gray-700/50 backdrop-blur-md text-gray-100 border border-gray-600/30 shadow-sm'
                  : 'bg-gray-200/50 backdrop-blur-md text-gray-900 border border-gray-300/30 shadow-sm'
                : isDarkMode
                ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <Shield className="w-5 h-5 mr-3" />
            <span className="font-medium">Admin</span>
          </button>
        )}
        <button
          onClick={() => setIsSettingsMenuOpen(true)}
          className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-colors group ${
            isDarkMode
              ? 'text-gray-300 hover:bg-gray-800 hover:text-gray-100'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          }`}
        >
          <Settings className="w-5 h-5 mr-3" />
          <span className="font-medium">Settings</span>
        </button>
        <button
          onClick={handleLogout}
          className={`w-full flex items-center p-2 lg:p-3 rounded-lg transition-colors group ${
            isDarkMode
              ? 'text-gray-300 hover:bg-red-900/50 hover:text-red-400'
              : 'text-gray-600 hover:bg-red-50 hover:text-red-600'
          }`}
        >
          <Hand className="w-5 h-5 mr-3" style={{ transform: 'rotate(-20deg)' }} />
          <span className="font-medium">Say Bye</span>
        </button>

      </div>

      {/* Usage Stats Section */}
      <div className={`px-4 py-3 border-t ${
        isDarkMode ? 'border-gray-700' : 'border-gray-200'
      }`}>
        <UsageStats userPlan={userPlan} />
      </div>

      {/* Settings Menu */}
      <SettingsMenu
        isOpen={isSettingsMenuOpen}
        onClose={() => setIsSettingsMenuOpen(false)}
        isDarkMode={isDarkMode} 
      />
    </div>
  )
}

export default SideNavbar
