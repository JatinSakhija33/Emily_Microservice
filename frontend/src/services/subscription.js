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

export const subscriptionAPI = {
  // Get all available subscription plans
  async getPlans() {
    const api = createApiInstance();
    return await api.get('/api/subscription/plans');
  },

  // Get user's subscription status
  async getSubscriptionStatus() {
    const api = createApiInstance();
    return await api.get('/api/subscription/status');
  },

  // Create a new subscription
  async createSubscription(subscriptionData) {
    const api = createApiInstance();
    return await api.post('/api/subscription/create', subscriptionData);
  },

  // Verify payment
  async verifyPayment(paymentData) {
    const api = createApiInstance();
    return await api.post('/api/subscription/verify-payment', paymentData);
  },

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    const api = createApiInstance();
    return await api.post('/api/subscription/cancel', { subscription_id: subscriptionId });
  },

  // Get billing history
  async getBillingHistory() {
    const api = createApiInstance();
    return await api.get('/api/subscription/billing-history');
  }
};
