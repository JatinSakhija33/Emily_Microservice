/**
 * Admin API Service
 * Handles all admin-related API calls for token usage tracking and budget analysis
 */

import api from './api';

const adminAPI = {
  /**
   * Get token usage data with filters
   */
  async getTokenUsage(filters = {}) {
    const params = new URLSearchParams();
    
    // Handle array filters - append multiple query params for arrays
    if (filters.userId) {
      if (Array.isArray(filters.userId)) {
        filters.userId.forEach(id => params.append('user_id', id));
      } else {
        params.append('user_id', filters.userId);
      }
    }
    if (filters.featureType) {
      if (Array.isArray(filters.featureType)) {
        filters.featureType.forEach(type => params.append('feature_type', type));
      } else {
        params.append('feature_type', filters.featureType);
      }
    }
    if (filters.modelName) {
      if (Array.isArray(filters.modelName)) {
        filters.modelName.forEach(model => params.append('model_name', model));
      } else {
        params.append('model_name', filters.modelName);
      }
    }
    
    // Format dates to ISO format with time
    if (filters.startDate) {
      // Add start of day (00:00:00) to start_date
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      params.append('start_date', startDate.toISOString());
    }
    if (filters.endDate) {
      // Add end of day (23:59:59.999) to end_date
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      params.append('end_date', endDate.toISOString());
    }
    
    if (filters.limit) params.append('limit', filters.limit);
    if (filters.offset) params.append('offset', filters.offset);
    
    const response = await api.get(`/admin/token-usage?${params.toString()}`);
    return response.data;
  },

  /**
   * Get aggregated token usage statistics
   */
  async getTokenUsageStats(startDate = null, endDate = null, userId = null, featureType = null, modelName = null) {
    const params = new URLSearchParams();
    
    // Handle array filters - append multiple query params for arrays
    if (userId) {
      if (Array.isArray(userId)) {
        userId.forEach(id => params.append('user_id', id));
      } else {
        params.append('user_id', userId);
      }
    }
    if (featureType) {
      if (Array.isArray(featureType)) {
        featureType.forEach(type => params.append('feature_type', type));
      } else {
        params.append('feature_type', featureType);
      }
    }
    if (modelName) {
      if (Array.isArray(modelName)) {
        modelName.forEach(model => params.append('model_name', model));
      } else {
        params.append('model_name', modelName);
      }
    }
    
    // Format dates to ISO format with time
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      params.append('start_date', start.toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      params.append('end_date', end.toISOString());
    }
    
    const response = await api.get(`/admin/token-usage/stats?${params.toString()}`);
    return response.data;
  },

  /**
   * Get list of users with their total costs
   */
  async getUsers(startDate = null, endDate = null) {
    const params = new URLSearchParams();
    
    // Format dates to ISO format with time
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      params.append('start_date', start.toISOString());
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      params.append('end_date', end.toISOString());
    }
    
    const response = await api.get(`/admin/token-usage/users?${params.toString()}`);
    return response.data;
  },

  /**
   * Export token usage data
   */
  async exportTokenUsage(format = 'json', filters = {}) {
    const params = new URLSearchParams();
    params.append('format', format);
    
    // Handle array filters - append multiple query params for arrays
    if (filters.userId) {
      if (Array.isArray(filters.userId)) {
        filters.userId.forEach(id => params.append('user_id', id));
      } else {
        params.append('user_id', filters.userId);
      }
    }
    if (filters.featureType) {
      if (Array.isArray(filters.featureType)) {
        filters.featureType.forEach(type => params.append('feature_type', type));
      } else {
        params.append('feature_type', filters.featureType);
      }
    }
    if (filters.modelName) {
      if (Array.isArray(filters.modelName)) {
        filters.modelName.forEach(model => params.append('model_name', model));
      } else {
        params.append('model_name', filters.modelName);
      }
    }
    
    // Format dates to ISO format with time
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      start.setHours(0, 0, 0, 0);
      params.append('start_date', start.toISOString());
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      params.append('end_date', end.toISOString());
    }
    
    // Get auth token for the request
    const { supabase } = await import('../lib/supabase');
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || localStorage.getItem('authToken');
    
    // Use fetch for blob responses to properly handle file downloads
    const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
    const apiUrl = API_BASE_URL.startsWith(':') 
      ? `http://localhost${API_BASE_URL}` 
      : (API_BASE_URL.startsWith('http') ? API_BASE_URL : `http://${API_BASE_URL}`);
    
    const response = await fetch(`${apiUrl}/admin/token-usage/export?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Export failed: ${response.status}`);
    }
    
    // Get filename from Content-Disposition header or use default
    const contentDisposition = response.headers.get('Content-Disposition');
    let filename = `token_usage_${new Date().toISOString().split('T')[0]}.${format}`;
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
      if (filenameMatch) {
        filename = filenameMatch[1];
      }
    }
    
    // Create blob and download
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return { success: true };
  },

  /**
   * Get budget analysis
   */
  async getBudgetAnalysis(days = 30) {
    const response = await api.get(`/admin/token-usage/budget-analysis?days=${days}`);
    return response.data;
  },

  async runProfileEmbeddings(limit = 200) {
    const response = await api.post(`/profile/refresh-embeddings?limit=${limit}`);
    return response.data;
  },

  /**
   * Get all model pricing configurations
   */
  async getPricing() {
    const response = await api.get('/admin/pricing');
    return response.data;
  },

  /**
   * Get pricing for a specific model
   */
  async getPricingForModel(modelName) {
    const response = await api.get(`/admin/pricing/${modelName}`);
    return response.data;
  },

  /**
   * Update pricing for a model
   */
  async updatePricing(modelName, pricing) {
    const response = await api.put(`/admin/pricing/${modelName}`, pricing);
    return response.data;
  },

  /**
   * Refresh pricing cache
   */
  async refreshPricingCache() {
    const response = await api.post('/admin/pricing/refresh');
    return response.data;
  },

  /**
   * Check if current user is admin based on subscription plan
   */
  async checkAdminStatus() {
    try {
      // Check user's subscription plan from profile
      const { supabase } = await import('../lib/supabase');
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return { data: { is_admin: false } };
      }
      
      // Get user profile to check subscription plan
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('subscription_plan')
        .eq('id', user.id)
        .single();
      
      if (error || !profile) {
        return { data: { is_admin: false } };
      }
      
      // Check if subscription plan is 'admin'
      const is_admin = profile.subscription_plan === 'admin';
      
      return { data: { is_admin } };
    } catch (error) {
      console.error('Error checking admin status:', error);
      return { data: { is_admin: false } };
    }
  }
};

export default adminAPI;
export { adminAPI };
