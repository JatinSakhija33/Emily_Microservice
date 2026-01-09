/**
 * Hydration Manager
 * Implements cache-first strategy for loading data
 */

import localCache from './localCache'

class HydrationManager {
  constructor() {
    this.cacheInitialized = false
  }

  async init() {
    if (!this.cacheInitialized) {
      await localCache.init()
      this.cacheInitialized = true
      
      // Cleanup old cache on startup (non-blocking)
      localCache.cleanupCache().catch(err => {
        console.warn('Cache cleanup error:', err)
      })
    }
  }

  /**
   * Hydrate conversations with cache-first strategy
   */
  async hydrateConversations(apiCall, userId = null) {
    await this.init()

    try {
      // Try cache first
      const cached = await localCache.getCachedConversations(userId)
      
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} conversations from cache`)
        
        // Return cached immediately, then refresh in background
        this.refreshConversationsInBackground(apiCall, userId)
        
        return {
          data: cached,
          source: 'cache',
          hydrated: true
        }
      }

      // No cache, fetch from API
      console.log('📡 No cache found, fetching from API...')
      const fresh = await apiCall()
      
      if (fresh && fresh.conversations) {
        await localCache.cacheConversations(fresh.conversations)
        return {
          data: fresh.conversations,
          source: 'network',
          hydrated: true
        }
      }

      return {
        data: [],
        source: 'network',
        hydrated: true
      }
    } catch (error) {
      console.error('Hydrate conversations error:', error)
      // Fallback to API
      try {
        const fresh = await apiCall()
        return {
          data: fresh?.conversations || [],
          source: 'network',
          hydrated: true,
          error: error.message
        }
      } catch (apiError) {
        return {
          data: [],
          source: 'error',
          hydrated: true,
          error: apiError.message
        }
      }
    }
  }

  /**
   * Refresh conversations in background
   */
  async refreshConversationsInBackground(apiCall, userId = null) {
    try {
      console.log('🔄 Refreshing conversations in background...')
      const fresh = await apiCall()
      
      if (fresh && fresh.conversations) {
        await localCache.cacheConversations(fresh.conversations)
        console.log(`✅ Background refresh complete: ${fresh.conversations.length} conversations`)
        
        // Emit event for UI update
        window.dispatchEvent(new CustomEvent('conversations-refreshed', {
          detail: { conversations: fresh.conversations }
        }))
      }
    } catch (error) {
      console.error('Background refresh error:', error)
    }
  }

  /**
   * Hydrate content/posts with cache-first strategy
   */
  async hydrateContent(apiCall) {
    await this.init()

    try {
      // Try cache first
      const cached = await localCache.getCachedPosts(50, 0)
      
      if (cached.length > 0) {
        console.log(`✅ Loaded ${cached.length} posts from cache`)
        
        // Load images from cache
        const withCachedImages = await this.loadCachedImages(cached)
        
        // Return cached immediately, then refresh in background
        this.refreshContentInBackground(apiCall)
        
        return {
          data: withCachedImages,
          source: 'cache',
          hydrated: true
        }
      }

      // No cache, fetch from API
      console.log('📡 No cache found, fetching posts from API...')
      const fresh = await apiCall()
      
      if (fresh && Array.isArray(fresh)) {
        await localCache.cachePosts(fresh)
        return {
          data: fresh,
          source: 'network',
          hydrated: true
        }
      }

      return {
        data: [],
        source: 'network',
        hydrated: true
      }
    } catch (error) {
      console.error('Hydrate content error:', error)
      // Fallback to API
      try {
        const fresh = await apiCall()
        return {
          data: Array.isArray(fresh) ? fresh : [],
          source: 'network',
          hydrated: true,
          error: error.message
        }
      } catch (apiError) {
        return {
          data: [],
          source: 'error',
          hydrated: true,
          error: apiError.message
        }
      }
    }
  }

  /**
   * Refresh content in background
   */
  async refreshContentInBackground(apiCall) {
    try {
      console.log('🔄 Refreshing content in background...')
      const fresh = await apiCall()
      
      if (fresh && Array.isArray(fresh)) {
        await localCache.cachePosts(fresh)
        console.log(`✅ Background refresh complete: ${fresh.length} posts`)
        
        // Emit event for UI update
        window.dispatchEvent(new CustomEvent('content-refreshed', {
          detail: { posts: fresh }
        }))
      }
    } catch (error) {
      console.error('Background refresh error:', error)
    }
  }

  /**
   * Load cached images for posts
   */
  async loadCachedImages(posts) {
    if (!posts || !Array.isArray(posts)) return posts

    return Promise.all(
      posts.map(async (post) => {
        const processed = { ...post }

        // Process media_url
        if (post.media_url) {
          const cached = await localCache.getCachedImage(post.media_url)
          if (cached && cached.localPath) {
            // Use cached local path (already converted to blob URL)
            processed.media_url = cached.localPath
          } else {
            // Cache in background
            localCache.cacheImage(post.media_url, post.id).catch(err => {
              console.warn('Background image cache error:', err)
            })
          }
        }

        // Process images array
        if (post.images && Array.isArray(post.images)) {
          processed.images = await Promise.all(
            post.images.map(async (url) => {
              const cached = await localCache.getCachedImage(url)
              if (cached && cached.localPath) {
                return cached.localPath // Already converted to blob URL
              }
              // Cache in background
              localCache.cacheImage(url, post.id).catch(err => {
                console.warn('Background image cache error:', err)
              })
              return url // Return original while caching
            })
          )
        }

        // Process raw_data images
        if (post.raw_data?.images) {
          processed.raw_data = {
            ...post.raw_data,
            images: await Promise.all(
              post.raw_data.images.map(async (url) => {
                const cached = await localCache.getCachedImage(url)
                if (cached && cached.localPath) {
                  return cached.localPath // Already converted to blob URL
                }
                localCache.cacheImage(url, post.id).catch(err => {
                  console.warn('Background image cache error:', err)
                })
                return url
              })
            )
          }
        }

        return processed
      })
    )
  }

  /**
   * Process a single post's images (for new posts)
   */
  async processPostImages(post) {
    await this.init()
    return this.loadCachedImages([post]).then(posts => posts[0])
  }
}

// Singleton instance
const hydrationManager = new HydrationManager()

export default hydrationManager

