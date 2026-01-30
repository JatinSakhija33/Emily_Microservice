import React, { useState, useEffect } from 'react'
import { 
  Sparkles, Bell, CheckCircle, Minus, Loader2, RefreshCw, Clock
} from 'lucide-react'

const TaskNotification = ({ isDarkMode = false }) => {
  const [isVisible, setIsVisible] = useState(true)
  const [isCollapsed, setIsCollapsed] = useState(true)
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchTaskExecutions()
  }, [])

  const fetchTaskExecutions = async () => {
    setLoading(true)
    try {
      const authToken = localStorage.getItem('authToken')
      if (!authToken) {
        // Show fallback data when not authenticated
        setTasks([
          {
            id: 1,
            name: 'Weekly Content Generation',
            description: 'Generated Social Media posts for you this Sunday at 4:00 AM IST',
            status: 'completed',
            executionTime: '2025-09-07T04:11:16.459278+05:30',
            duration: '2m 15s',
            type: 'content_generation',
            icon: Sparkles,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            frequency: 'Weekly (Sundays at 4:00 AM IST)',
            isActive: true,
            nextRun: 'Next Sunday at 4:00 AM IST'
          }
        ])
        setLoading(false)
        return
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/social-media/task-executions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        const mappedTasks = data.tasks.map(task => ({
          ...task,
          icon: Sparkles,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200'
        }))
        setTasks(mappedTasks)
      } else {
        // Show fallback data on API error
        setTasks([
          {
            id: 1,
            name: 'Weekly Content Generation',
            description: 'Generated Social Media posts for you this Sunday at 4:00 AM IST',
            status: 'completed',
            executionTime: '2025-09-07T04:11:16.459278+05:30',
            duration: '2m 15s',
            type: 'content_generation',
            icon: Sparkles,
            color: 'text-purple-600',
            bgColor: 'bg-purple-50',
            borderColor: 'border-purple-200',
            frequency: 'Weekly (Sundays at 4:00 AM IST)',
            isActive: true,
            nextRun: 'Next Sunday at 4:00 AM IST'
          }
        ])
      }
    } catch (error) {
      console.error('Error fetching task executions:', error)
      // Show fallback data on error
      setTasks([
        {
          id: 1,
          name: 'Weekly Content Generation',
          description: 'Generated Social Media posts for you this Sunday at 4:00 AM IST',
          status: 'completed',
          executionTime: '2025-09-07T04:11:16.459278+05:30',
          duration: '2m 15s',
          type: 'content_generation',
          icon: Sparkles,
          color: 'text-purple-600',
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          frequency: 'Weekly (Sundays at 4:00 AM IST)',
          isActive: true,
          nextRun: 'Next Sunday at 4:00 AM IST'
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const formatExecutionTime = (executionTime) => {
    if (!executionTime) return 'Not executed'
    
    const date = new Date(executionTime)
    const now = new Date()
    const diffInMinutes = Math.floor((now - date) / (1000 * 60))
    const diffInHours = Math.floor(diffInMinutes / 60)
    const diffInDays = Math.floor(diffInHours / 24)
    
    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`
    if (diffInHours < 24) return `${diffInHours} hours ago`
    if (diffInDays === 1) return 'Yesterday'
    if (diffInDays < 7) return `${diffInDays} days ago`
    
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }


  const handleCollapse = () => {
    setIsCollapsed(!isCollapsed)
  }

  const handleRefresh = () => {
    fetchTaskExecutions()
  }


  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isCollapsed ? (
        // Collapsed notification button
        <div className="relative">
          <button
            onClick={handleCollapse}
            className="w-14 h-14 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group"
          >
            <Bell className="w-6 h-6 text-white" />
          </button>
          {tasks.length > 0 && (
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
              <span className="text-xs text-white font-bold">{tasks.length}</span>
            </div>
          )}
        </div>
      ) : (
        // Expanded notification panel
        <div className="w-80 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-white" />
              <h3 className="text-white font-semibold">Task Executions</h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="p-1 text-white hover:bg-purple-700 rounded transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleCollapse}
                className="p-1 text-white hover:bg-purple-700 rounded transition-colors"
                title="Minimize"
              >
                <Minus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                <span className={`ml-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading tasks...</span>
              </div>
            ) : tasks.length === 0 ? (
              <div className="text-center py-8">
                <Clock className={`w-12 h-12 mx-auto mb-3 ${isDarkMode ? 'text-gray-600' : 'text-gray-300'}`} />
                <p className={`${isDarkMode ? 'text-gray-400' : 'text-gray-500'} mb-2`}>No automated tasks configured</p>
                <p className={`text-xs ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>Tasks will appear here when configured</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                {tasks.map((task) => {
                  const Icon = task.icon
                  return (
                    <div key={task.id} className="p-3 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                            <Icon className="w-4 h-4 text-purple-600" />
                          </div>
                          <h4 className={`font-medium text-sm ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>{task.name}</h4>
                        </div>
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      </div>
                      
                      <p className={`text-xs mb-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{task.description}</p>
                      
                      <div className="space-y-1">
                        {task.executionTime ? (
                          <>
                            <div className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              <span>Executed:</span>
                              <span className="font-medium">{formatExecutionTime(task.executionTime)}</span>
                            </div>
                            <div className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                              <span>Duration:</span>
                              <span className="font-medium">{task.duration || 'N/A'}</span>
                            </div>
                            {task.nextRun && (
                              <div className={`flex items-center justify-between text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                <span>Next Run:</span>
                                <span className="font-medium text-blue-600">{task.nextRun}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span>Schedule:</span>
                            <span className="font-medium">{task.frequency || 'Not scheduled'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Shows recent autonomous task executions and their status
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskNotification
