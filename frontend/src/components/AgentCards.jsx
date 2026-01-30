import React from 'react'
import { Calendar, ChevronRight, Clock, Mail } from 'lucide-react'

const AgentCards = ({ isDarkMode, onInputClick, upcomingCalendarCount, upcomingCalendarLoading, scheduledPostsCount, scheduledPostsLoading, overdueLeadsCount, overdueLeadsLoading, todaysNewLeadsCount, todaysNewLeadsLoading, todayCalendarEntries, calendarEntriesLoading, navigate }) => {
  const agents = [
    {
      name: 'Emily',
      description: 'Digital Marketing Manager',
      logo: '/emily_icon.png',
      color: 'from-pink-400 to-purple-500',
      showScheduledPosts: true,
      showTodaysCalendar: true
    },
    {
      name: 'Chase',
      description: 'Leads Manager',
      logo: '/chase_logo.png',
      color: 'from-blue-400 to-cyan-500',
      showOverdueLeads: true,
      showTodaysNewLeads: true
    },
    {
      name: 'Leo',
      description: 'Content Creator',
      logo: '/leo_logo.png',
      color: 'from-green-400 to-emerald-500',
      showUpcomingCalendar: true
    },
    {
      name: 'Orion',
      description: 'Performance Insights',
      logo: '/orion.png',
      color: 'from-orange-400 to-red-500'
    }
  ]

  return (
    <div className="flex-1 flex items-center justify-center px-8 py-12">
      <div className="max-w-4xl w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <div
              key={agent.name}
              className={`relative p-6 rounded-xl border transition-all ${
                isDarkMode
                  ? 'bg-gray-800 border-gray-700'
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Mail icon in top right */}
              <div className="absolute top-3 right-3">
                <Mail className={`w-5 h-5 ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`} />
              </div>

              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4 flex-1">
                  <div className={`w-16 h-16 rounded-full bg-gradient-to-br ${agent.color} flex items-center justify-center flex-shrink-0`}>
                    {agent.logo ? (
                      <img src={agent.logo} alt={agent.name} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <span className="text-white font-bold text-2xl">
                        {agent.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`text-lg font-semibold ${
                      isDarkMode ? 'text-white' : 'text-gray-900'
                    }`}>
                      {agent.name}
                    </h3>
                    <p className={`text-sm ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      {agent.description}
                    </p>
                    {agent.showUpcomingCalendar && !upcomingCalendarLoading && upcomingCalendarCount > 0 && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/calendars');
                        }}
                        className={`mt-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-blue-900/50 text-blue-300 hover:bg-blue-800/50 hover:text-blue-200'
                            : 'bg-blue-100 text-blue-800 hover:bg-blue-200'
                        }`}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {upcomingCalendarCount} posts to be designed this week
                      </div>
                    )}
                    {agent.showScheduledPosts && !scheduledPostsLoading && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/content');
                        }}
                        className={`mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-green-900/50 text-green-300 hover:bg-green-800/50 hover:text-green-200'
                            : 'bg-green-100 text-green-800 hover:bg-green-200'
                        }`}
                      >
                        <Clock className="w-3 h-3 mr-1" />
                        {scheduledPostsCount} scheduled post this week
                      </div>
                    )}
                    {agent.showTodaysCalendar && !calendarEntriesLoading && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/calendars');
                        }}
                        className={`mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50 hover:text-yellow-200'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        }`}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {todayCalendarEntries.length} posts suggested for today
                      </div>
                    )}
                    {agent.showTodaysNewLeads && !todaysNewLeadsLoading && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/leads');
                        }}
                        className={`mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-purple-900/50 text-purple-300 hover:bg-purple-800/50 hover:text-purple-200'
                            : 'bg-purple-100 text-purple-800 hover:bg-purple-200'
                        }`}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {todaysNewLeadsCount} leads captured today
                      </div>
                    )}
                    {agent.showOverdueLeads && !overdueLeadsLoading && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/leads?filter=overdue_followups');
                        }}
                        className={`mt-1 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                          isDarkMode
                            ? 'bg-yellow-900/50 text-yellow-300 hover:bg-yellow-800/50 hover:text-yellow-200'
                            : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                        }`}
                      >
                        <Calendar className="w-3 h-3 mr-1" />
                        {overdueLeadsCount} leads overdue followup
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AgentCards