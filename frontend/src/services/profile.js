import api from './api'

export const profileAPI = {
  getAgentProfiles: () => api.get('/profile/agents/profiles'),
  incrementAgentLikes: (agentName) => api.post(`/profile/agents/${agentName}/like`),
  getUsageCounts: () => api.get('/profile/usage-counts'),
  getUsageStats: () => api.get('/profile/usage-stats'),
}

