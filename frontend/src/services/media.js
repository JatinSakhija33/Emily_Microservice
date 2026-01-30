/**
 * Media Generation Service
 * Handles API calls for generating media content
 */

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'https://agent-emily.onrender.com').replace(/\/$/, '')

class MediaService {
  /**
   * Get authentication token from Supabase
   */
  async getAuthToken() {
    const { supabase } = await import('../lib/supabase')
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  /**
   * Generate media for a specific post
   * @param {string} postId - The ID of the post to generate media for
   * @param {Object} options - Optional parameters for media generation
   * @returns {Promise<Object>} Generation result
   */
  async generateMedia(postId, options = {}) {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/media/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          post_id: postId,
          ...options
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error generating media:', error)
      throw error
    }
  }

  /**
   * Generate all carousel images for a carousel post
   * @param {string} postId - The ID of the carousel post
   * @returns {Promise<Object>} Generation result with carousel images
   */
  async generateCarouselImages(postId) {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/content/${postId}/generate-all-carousel-images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error generating carousel images:', error)
      throw error
    }
  }

  /**
   * Generate media for multiple posts in batch
   * @param {string[]} postIds - Array of post IDs
   * @param {Object} options - Optional parameters for media generation
   * @returns {Promise<Object>} Batch generation result
   */
  async generateMediaBatch(postIds, options = {}) {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/media/generate/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          post_ids: postIds,
          ...options
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error generating media batch:', error)
      throw error
    }
  }

  /**
   * Get all generated images for a specific post
   * @param {string} postId - The ID of the post
   * @returns {Promise<Object>} Post images data
   */
  async getPostImages(postId) {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/media/posts/${postId}/images`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching post images:', error)
      throw error
    }
  }

  /**
   * Get all generated images for the current user
   * @param {Object} params - Query parameters
   * @returns {Promise<Object>} User images data
   */
  async getUserImages(params = {}) {
    try {
      const token = await this.getAuthToken()
      
      const queryParams = new URLSearchParams({
        limit: params.limit || 50,
        offset: params.offset || 0,
        ...params
      })
      
      const response = await fetch(`${API_BASE_URL}/media/user/images?${queryParams}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching user images:', error)
      throw error
    }
  }

  /**
   * Approve a generated image
   * @param {string} imageId - The ID of the image to approve
   * @returns {Promise<Object>} Approval result
   */
  async approveImage(imageId) {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/media/images/${imageId}/approve`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error approving image:', error)
      throw error
    }
  }

  /**
   * Delete a generated image
   * @param {string} imageId - The ID of the image to delete
   * @returns {Promise<Object>} Deletion result
   */
  async deleteImage(imageId) {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/media/images/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error deleting image:', error)
      throw error
    }
  }

  /**
   * Delete uploaded media (image or video) for a specific post
   * @param {string} postId - The ID of the post
   * @returns {Promise<Object>} Deletion result
   */
  async deleteUploadedMedia(postId) {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/media/uploaded-media/${postId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error deleting uploaded media:', error)
      throw error
    }
  }

  /**
   * Get available image styles and sizes
   * @returns {Promise<Object>} Available styles and sizes
   */
  async getAvailableStyles() {
    try {
      const response = await fetch(`${API_BASE_URL}/media/styles`, {
        method: 'GET'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching available styles:', error)
      throw error
    }
  }

  /**
   * Get media generation statistics for the current user
   * @returns {Promise<Object>} Media statistics
   */
  async getMediaStats() {
    try {
      const token = await this.getAuthToken()
      
      const response = await fetch(`${API_BASE_URL}/media/stats`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Error fetching media stats:', error)
      throw error
    }
  }
}

// Create and export a singleton instance
const mediaService = new MediaService()
export default mediaService
