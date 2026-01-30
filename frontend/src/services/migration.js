import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

export const migrationAPI = {
  // Get user's migration status
  async getMigrationStatus() {
    const api = createApiInstance();
    return await api.get('/api/subscription/migration-status');
  },

  // Get user discount (for existing users)
  async getUserDiscount() {
    const api = createApiInstance();
    return await api.get('/api/subscription/user-discount');
  },

  // Migrate user to subscription
  async migrateToSubscription(planId) {
    const api = createApiInstance();
    return await api.post('/api/subscription/migrate-to-subscription', { plan_id: planId });
  }
};
