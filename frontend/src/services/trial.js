// Trial API service for frontend
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com';

// Create axios instance with auth token
const createApiInstance = () => {
  const token = localStorage.getItem('authToken');
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    },
  });
};

export const trialAPI = {
  // Get trial status
  async getTrialStatus() {
    const api = createApiInstance();
    return await api.get('/api/trial/status');
  },

  // Get comprehensive trial information
  async getTrialInfo() {
    const api = createApiInstance();
    return await api.get('/api/trial/info');
  },

  // Activate trial (if needed)
  async activateTrial(trialData) {
    const api = createApiInstance();
    return await api.post('/api/trial/activate', trialData);
  },

  // Health check
  async healthCheck() {
    const api = createApiInstance();
    return await api.get('/api/trial/health');
  }
};
