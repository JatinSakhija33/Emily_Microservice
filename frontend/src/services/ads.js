import { supabase } from '../lib/supabase'

const API_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

class AdsAPI {
  async getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async getAdsByDate(date) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/by-date?date=${date}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching ads by date:', error)
      throw error
    }
  }

  async getCampaigns() {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/campaigns`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      throw error
    }
  }

  async generateAds() {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error generating ads:', error)
      throw error
    }
  }

  async getAd(adId) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/${adId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching ad:', error)
      throw error
    }
  }

  async updateAd(adId, adData) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/${adId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(adData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error updating ad:', error)
      throw error
    }
  }

  async approveAd(adId) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/${adId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error approving ad:', error)
      throw error
    }
  }

  async rejectAd(adId) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/${adId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error rejecting ad:', error)
      throw error
    }
  }

  async deleteAd(adId) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/${adId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error deleting ad:', error)
      throw error
    }
  }

  async getAdPerformance(adId) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/${adId}/performance`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching ad performance:', error)
      throw error
    }
  }

  async getCampaign(campaignId) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/campaigns/${campaignId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching campaign:', error)
      throw error
    }
  }

  async updateCampaign(campaignId, campaignData) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/campaigns/${campaignId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(campaignData)
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error updating campaign:', error)
      throw error
    }
  }

  async deleteCampaign(campaignId) {
    try {
      const token = await this.getAuthToken()
      const response = await fetch(`${API_URL}/api/ads/campaigns/${campaignId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error deleting campaign:', error)
      throw error
    }
  }
}

export const adsAPI = new AdsAPI()
