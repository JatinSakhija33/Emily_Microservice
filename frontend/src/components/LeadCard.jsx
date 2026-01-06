import React from 'react'
import { 
  User, 
  Mail, 
  Phone, 
  Facebook, 
  Instagram, 
  MessageCircle, 
  CheckCircle,
  XCircle,
  AlertCircle,
  Trash2,
  Globe,
  Users,
  LogIn,
  Calendar
} from 'lucide-react'

const LeadCard = ({ lead, onClick, onDelete, isSelected = false, onSelect = null, selectionMode = false, isDarkMode = false }) => {
  const getStatusConfig = (status) => {
    const configs = {
      new: {
        color: 'text-yellow-500',
        bgColor: 'bg-transparent',
        textColor: 'text-yellow-500',
        borderColor: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        icon: AlertCircle,
        label: 'New'
      },
      contacted: {
        color: 'text-blue-500',
        bgColor: 'bg-transparent',
        textColor: 'text-blue-500',
        borderColor: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        icon: MessageCircle,
        label: 'Contacted'
      },
      responded: {
        color: 'text-green-500',
        bgColor: 'bg-transparent',
        textColor: 'text-green-500',
        borderColor: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        icon: CheckCircle,
        label: 'Responded'
      },
      qualified: {
        color: 'text-purple-500',
        bgColor: 'bg-transparent',
        textColor: 'text-purple-500',
        borderColor: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        icon: CheckCircle,
        label: 'Qualified'
      },
      converted: {
        color: 'text-emerald-500',
        bgColor: 'bg-transparent',
        textColor: 'text-emerald-500',
        borderColor: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        icon: CheckCircle,
        label: 'Converted'
      },
      lost: {
        color: 'text-orange-500',
        bgColor: 'bg-transparent',
        textColor: 'text-orange-500',
        borderColor: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        icon: XCircle,
        label: 'Lost'
      },
      invalid: {
        color: 'text-red-500',
        bgColor: 'bg-transparent',
        textColor: 'text-red-500',
        borderColor: isDarkMode ? 'border-gray-600' : 'border-gray-300',
        icon: XCircle,
        label: 'Invalid'
      }
    }
    return configs[status] || configs.new
  }

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'Facebook':
        return <Facebook className="w-6 h-6" />
      case 'Instagram':
        return <Instagram className="w-6 h-6" />
      case 'Walk Ins':
        return <LogIn className="w-6 h-6" />
      case 'Referral':
        return <Users className="w-6 h-6" />
      case 'Email':
        return <Mail className="w-6 h-6" />
      case 'Website':
        return <Globe className="w-6 h-6" />
      case 'Phone Call':
        return <Phone className="w-6 h-6" />
      case 'Manual Entry':
      default:
        return <User className="w-6 h-6" />
    }
  }

  const getPlatformColor = (platform) => {
    switch (platform) {
      case 'Facebook':
        return 'from-green-600 to-green-800'
      case 'Instagram':
        return 'from-amber-500 via-green-500 to-amber-600'
      case 'Walk Ins':
        return 'from-green-500 to-green-700'
      case 'Referral':
        return 'from-amber-600 to-amber-800'
      case 'Email':
        return 'from-green-400 to-green-600'
      case 'Website':
        return 'from-amber-500 to-amber-700'
      case 'Phone Call':
        return 'from-green-600 to-amber-700'
      case 'Manual Entry':
      default:
        return 'from-gray-500 to-gray-700'
    }
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
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    })
  }

  const formatFollowUpDate = (dateString) => {
    if (!dateString) return null
    
    const date = new Date(dateString)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const followUpDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const diffInDays = Math.floor((followUpDate - today) / (1000 * 60 * 60 * 24))
    
    if (diffInDays === 0) return 'Today'
    if (diffInDays === 1) return 'Tomorrow'
    if (diffInDays === -1) return 'Yesterday'
    if (diffInDays < 0) return `${Math.abs(diffInDays)} days ago`
    if (diffInDays <= 7) return `In ${diffInDays} days`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const statusConfig = getStatusConfig(lead.status)
  const StatusIcon = statusConfig.icon
  const platformColor = getPlatformColor(lead.source_platform)

  // Check if follow-up date is overdue (shows "ago" or "Yesterday")
  const isFollowUpOverdue = () => {
    if (!lead.follow_up_at) return false
    const formatted = formatFollowUpDate(lead.follow_up_at)
    return formatted && (formatted.includes('ago') || formatted === 'Yesterday')
  }

  const handleCardClick = (e) => {
    // Don't trigger onClick if clicking on checkbox or delete button
    if (e.target.closest('input[type="checkbox"]') || e.target.closest('button')) {
      return
    }
    if (onClick && !selectionMode) {
      onClick(lead)
    }
  }

  const handleCheckboxChange = (e) => {
    e.stopPropagation()
    if (onSelect) {
      onSelect(lead.id, e.target.checked)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className={`${isDarkMode ? 'bg-gray-800/80' : 'bg-white/90'} backdrop-blur-sm rounded-lg shadow-lg overflow-hidden ${selectionMode ? 'cursor-default' : 'cursor-pointer'} border border-white/20 ${isSelected ? 'ring-2 ring-green-500' : ''}`}
    >
      {/* Header */}
      <div className={`${isDarkMode ? 'bg-gray-700/60' : 'bg-white/70'} backdrop-blur-sm p-2 border-b ${isDarkMode ? 'border-gray-600/50' : 'border-white/30'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5 flex-1 min-w-0">
            {selectionMode && (
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleCheckboxChange}
                onClick={(e) => e.stopPropagation()}
                className={`w-4 h-4 rounded ${isDarkMode ? 'border-gray-600 bg-gray-700 text-green-400 focus:ring-green-400' : 'border-gray-300 bg-white text-green-600 focus:ring-green-500'} focus:ring-2 cursor-pointer flex-shrink-0`}
              />
            )}
            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
              lead.source_platform === 'Facebook' ? (isDarkMode ? 'bg-blue-700 text-blue-100' : 'bg-blue-200 text-blue-800') :
              lead.source_platform === 'Instagram' ? (isDarkMode ? 'bg-pink-700 text-pink-100' : 'bg-pink-200 text-pink-800') :
              lead.source_platform === 'Walk Ins' ? (isDarkMode ? 'bg-purple-700 text-purple-100' : 'bg-purple-200 text-purple-800') :
              lead.source_platform === 'Referral' ? (isDarkMode ? 'bg-indigo-700 text-indigo-100' : 'bg-indigo-200 text-indigo-800') :
              lead.source_platform === 'Email' ? (isDarkMode ? 'bg-red-700 text-red-100' : 'bg-red-200 text-red-800') :
              lead.source_platform === 'Website' ? (isDarkMode ? 'bg-teal-700 text-teal-100' : 'bg-teal-200 text-teal-800') :
              lead.source_platform === 'Phone Call' ? (isDarkMode ? 'bg-orange-700 text-orange-100' : 'bg-orange-200 text-orange-800') :
              (isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-200 text-gray-800')
            }`}>
              {getPlatformIcon(lead.source_platform)}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className={`font-normal text-sm truncate ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                {(lead.name || 'Unknown Lead').charAt(0).toUpperCase() + (lead.name || 'Unknown Lead').slice(1)}
              </h3>
              <div className={`flex items-center space-x-0.5 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <span className="capitalize truncate">{lead.source_platform}</span>
                <span>•</span>
                <span className="truncate">{formatTimeAgo(lead.created_at)}</span>
              </div>
            </div>
          </div>
          {!selectionMode && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete(lead)
              }}
              className={`p-1 ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'} rounded flex-shrink-0 ml-0.5 transition-colors`}
              title="Delete lead"
            >
              <Trash2 className={`w-3 h-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
            </button>
          )}
        </div>
      </div>

      {/* Follow-up Date */}
      {lead.follow_up_at && (
          <div className={`p-1.5 border-t ${isDarkMode ? 'border-gray-600/50' : 'border-white/30'}`}>
          <div className={`flex items-center space-x-1 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
            <Calendar className="w-5 h-5" />
            <span className="font-normal">Follow-up:</span>
            <span className={isFollowUpOverdue() ? 'text-yellow-500 font-medium' : ''}>{formatFollowUpDate(lead.follow_up_at)}</span>
          </div>
        </div>
      )}

      {/* Remarks Section */}
      {lead.last_remark && (
          <div className={`p-1.5 ${isDarkMode ? 'bg-gray-700/40' : 'bg-white/60'} border-t ${isDarkMode ? 'border-gray-600/50' : 'border-white/30'}`}>
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-700'} line-clamp-2`}>
            {lead.last_remark.charAt(0).toUpperCase() + lead.last_remark.slice(1)}
          </p>
        </div>
      )}

      {/* Content - Only show if form data exists */}
      {lead.form_data && Object.keys(lead.form_data).length > 0 && (
        <div className="p-1.5">
          <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}>
            {Object.keys(lead.form_data).length} form field{Object.keys(lead.form_data).length !== 1 ? 's' : ''} captured
          </p>
        </div>
      )}
    </div>
  )
}

export default LeadCard

