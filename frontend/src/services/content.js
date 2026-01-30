import { supabase } from '../lib/supabase'

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

// Helper function to build API URLs
const buildApiUrl = (endpoint) => {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${API_BASE_URL}${cleanEndpoint}`
}

class ContentAPI {
  // Get scheduled content for next day
  async getScheduledContent() {
    try {
      const authToken = await this.getAuthToken()
      console.log('Fetching scheduled content with token:', authToken ? 'present' : 'missing')
      
      const response = await fetch(buildApiUrl('/content/scheduled'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('Scheduled content response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Scheduled content API error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Scheduled content data:', data)
      
      return { data: data.content || [], date: data.date, count: data.count, error: null }
    } catch (error) {
      console.error('Error fetching scheduled content:', error)
      return { data: null, error: error.message }
    }
  }

  // Get all content
  async getAllContent(limit = 50, offset = 0) {
    try {
      const authToken = await this.getAuthToken()
      console.log('Fetching all content with token:', authToken ? 'present' : 'missing')
      
      const response = await fetch(buildApiUrl(`/content/all?limit=${limit}&offset=${offset}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('All content response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('All content API error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('All content data:', data)
      
      return { data: data.content || [], count: data.count, error: null }
    } catch (error) {
      console.error('Error fetching all content:', error)
      return { data: null, error: error.message }
    }
  }

  // Get campaigns (for calendar compatibility)
  async getCampaigns() {
    try {
      // For now, return empty array since we're focusing on content posts
      // This maintains compatibility with the calendar component
      return { data: [], error: null }
    } catch (error) {
      console.error('Error fetching campaigns:', error)
      return { data: null, error: error.message }
    }
  }

  // Get posts (alias for getAllContent for calendar compatibility)
  async getPosts() {
    try {
      const result = await this.getAllContent()
      return result
    } catch (error) {
      console.error('Error fetching posts:', error)
      return { data: null, error: error.message }
    }
  }

  // Get post contents from post_contents table
  async getPostContents(limit = 50, offset = 0, platform = null, postStatus = null) {
    try {
      const authToken = await this.getAuthToken()
      console.log('Fetching post contents with token:', authToken ? 'present' : 'missing')

      let url = `/content/post-contents?limit=${limit}&offset=${offset}`
      if (platform) url += `&platform=${platform}`
      if (postStatus) url += `&post_status=${postStatus}`

      const response = await fetch(buildApiUrl(url), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('Post contents response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Post contents API error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Post contents data:', data)

      return { data: data.data || [], count: data.count, error: null }
    } catch (error) {
      console.error('Error fetching post contents:', error)
      return { data: null, error: error.message }
    }
  }

  // Get content by specific date
  async getContentByDate(date) {
    try {
      const authToken = await this.getAuthToken()
      console.log('Fetching content for date:', date, 'with token:', authToken ? 'present' : 'missing')
      
      const response = await fetch(buildApiUrl(`/content/by-date?date=${date}`), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      console.log('Content by date response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Content by date API error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Content by date data:', data)
      
      return { data: data.content || [], date: data.date, count: data.count, error: null }
    } catch (error) {
      console.error('Error fetching content by date:', error)
      return { data: null, error: error.message }
    }
  }

  // Generate content
  async generateContent(generateImages = false) {
    try {
      const authToken = await this.getAuthToken()
      console.log('Generating content with token:', authToken ? 'present' : 'missing')
      
      const response = await fetch(buildApiUrl('/content/generate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          generate_images: generateImages
        })
      })

      console.log('Generate content response status:', response.status)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Generate content API error:', errorText)
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      console.log('Generate content data:', data)
      
      return { data: data, error: null }
    } catch (error) {
      console.error('Error generating content:', error)
      return { data: null, error: error.message }
    }
  }

  // Update content
  async updateContent(contentId, updateData) {
    try {
      const authToken = await this.getAuthToken()
      
      const response = await fetch(buildApiUrl(`/content/update/${contentId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify(updateData)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('Error updating content:', error)
      return { success: false, error: error.message }
    }
  }

  // Update content status
  async updateContentStatus(contentId, status) {
    try {
      const authToken = await this.getAuthToken()
      
      const response = await fetch(buildApiUrl(`/content/update-status/${contentId}`), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          status: status
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('Error updating content status:', error)
      return { success: false, error: error.message }
    }
  }

  // Register scheduled post with backend for exact-time publishing
  async registerScheduledPost(postId, scheduledAt, platform) {
    try {
      const authToken = await this.getAuthToken()
      
      const response = await fetch(buildApiUrl('/content/register-scheduled'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          post_id: postId,
          scheduled_at: scheduledAt,
          platform: platform
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('Error registering scheduled post:', error)
      return { success: false, error: error.message }
    }
  }

  // Delete created content (with automatic social media deletion)
  async deleteCreatedContent(contentId) {
    try {
      const authToken = await this.getAuthToken()

      const response = await fetch(buildApiUrl(`/content/created-content/${contentId}`), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, ${errorText}`)
      }

      const data = await response.json()
      return { success: true, data }
    } catch (error) {
      console.error('Error deleting created content:', error)
      return { success: false, error: error.message }
    }
  }

  // Helper method to get auth token
  async getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }
}

export const contentAPI = new ContentAPI()