/**
 * Local Cache Service for Tauri Desktop App
 * Handles caching of posts, images, and conversations locally
 */

import { invoke } from '@tauri-apps/api/tauri'
import { exists, createDir, writeBinaryFile, readBinaryFile } from '@tauri-apps/api/fs'
import { appDataDir, join } from '@tauri-apps/api/path'

class LocalCache {
  constructor() {
    this.cacheDir = null
    this.dbName = 'atsn-cache'
    this.dbVersion = 1
    this.db = null
    this.maxCacheSize = 500 * 1024 * 1024 // 500MB
    this.maxImageAge = 7 * 24 * 60 * 60 * 1000 // 7 days
    this.maxConversationAge = 1 * 24 * 60 * 60 * 1000 // 1 day
    this.initialized = false
  }

  async init() {
    if (this.initialized) return

    try {
      // Check if running in Tauri
      const isTauri = window.__TAURI_INTERNALS__ !== undefined
      if (!isTauri) {
        console.log('⚠️ Not running in Tauri, using IndexedDB only')
        await this.initDB()
        this.initialized = true
        return
      }

      // Initialize cache directory
      const appDir = await appDataDir()
      this.cacheDir = await join(appDir, 'atsn-ai', 'cache')
      
      const dirExists = await exists(this.cacheDir)
      if (!dirExists) {
        await createDir(this.cacheDir, { recursive: true })
        const imagesDir = await join(this.cacheDir, 'images')
        await createDir(imagesDir, { recursive: true })
      }

      // Initialize IndexedDB
      await this.initDB()
      
      console.log('✅ Local cache initialized:', this.cacheDir)
      this.initialized = true
    } catch (error) {
      console.error('❌ Cache init error:', error)
      // Fallback to IndexedDB only
      await this.initDB()
      this.initialized = true
    }
  }

  async initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result

        // Posts metadata store
        if (!db.objectStoreNames.contains('posts')) {
          const postsStore = db.createObjectStore('posts', { keyPath: 'id' })
          postsStore.createIndex('updated_at', 'updated_at', { unique: false })
          postsStore.createIndex('platform', 'platform', { unique: false })
          postsStore.createIndex('cached_at', 'cached_at', { unique: false })
        }

        // Conversations metadata store
        if (!db.objectStoreNames.contains('conversations')) {
          const convStore = db.createObjectStore('conversations', { keyPath: 'session_id' })
          convStore.createIndex('cached_at', 'cached_at', { unique: false })
          convStore.createIndex('user_id', 'user_id', { unique: false })
        }

        // Images metadata store
        if (!db.objectStoreNames.contains('images')) {
          const imagesStore = db.createObjectStore('images', { keyPath: 'url' })
          imagesStore.createIndex('cached_at', 'cached_at', { unique: false })
          imagesStore.createIndex('post_id', 'post_id', { unique: false })
        }

        // Cache stats store
        if (!db.objectStoreNames.contains('stats')) {
          db.createObjectStore('stats', { keyPath: 'key' })
        }
      }
    })
  }

  /**
   * Cache an image from URL
   */
  async cacheImage(imageUrl, postId = null) {
    if (!imageUrl || !imageUrl.includes('http')) {
      return imageUrl // Return original if not a valid URL
    }

    // Check if already cached
    const cached = await this.getCachedImage(imageUrl)
    if (cached) {
      return cached.localPath
    }

    try {
      // Check if running in Tauri
      const isTauri = window.__TAURI_INTERNALS__ !== undefined
      if (!isTauri) {
        // Web version - just return URL
        return imageUrl
      }

      // Download image
      const response = await fetch(imageUrl)
      if (!response.ok) throw new Error('Failed to fetch image')
      
      const blob = await response.blob()
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Generate filename from URL hash
      const urlHash = await this.hashString(imageUrl)
      const extension = this.getImageExtension(imageUrl) || 'jpg'
      const filename = `${urlHash}.${extension}`
      const imagesDir = await join(this.cacheDir, 'images')
      const filePath = await join(imagesDir, filename)

      // Save to disk
      await writeBinaryFile(filePath, uint8Array)

      // Save metadata to IndexedDB
      await this.saveImageMetadata(imageUrl, filePath, postId)

      // Return local file path - convert to blob URL for Tauri
      return await this.getFileUrl(filePath)
    } catch (error) {
      console.error('Image cache error:', error)
      return imageUrl // Fallback to original URL
    }
  }

  /**
   * Get cached image path if exists
   */
  async getCachedImage(imageUrl) {
    try {
      if (!this.db) await this.initDB()

      const transaction = this.db.transaction(['images'], 'readonly')
      const store = transaction.objectStore('images')
      const request = store.get(imageUrl)

      return new Promise((resolve, reject) => {
        request.onsuccess = async () => {
          const result = request.result
          if (!result) {
            resolve(null)
            return
          }

          // Check if file still exists (only in Tauri)
          const isTauri = window.__TAURI_INTERNALS__ !== undefined
          if (isTauri && result.localPath) {
            try {
              const fileExists = await exists(result.localPath)
              if (!fileExists) {
                // Clean up stale metadata
                await this.removeImageMetadata(imageUrl)
                resolve(null)
                return
              }
            } catch (e) {
              // File check failed, assume it exists
            }
          }

          // Check if expired
          const age = Date.now() - result.cached_at
          if (age > this.maxImageAge) {
            resolve(null) // Expired, will re-cache
            return
          }

          // Convert local path to displayable URL (async)
          this.getFileUrl(result.localPath).then(displayUrl => {
            resolve({
              ...result,
              localPath: displayUrl
            })
          }).catch(() => {
            // Fallback to original path if conversion fails
            resolve(result)
          })
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Get cached image error:', error)
      return null
    }
  }

  /**
   * Cache multiple images in parallel
   */
  async cacheImages(imageUrls, postId = null) {
    if (!imageUrls || !Array.isArray(imageUrls)) return []
    
    const promises = imageUrls
      .filter(url => url && url.includes('http'))
      .map(url => this.cacheImage(url, postId))
    
    return Promise.all(promises)
  }

  /**
   * Cache post metadata
   */
  async cachePost(post) {
    try {
      if (!this.db) await this.initDB()

      const transaction = this.db.transaction(['posts'], 'readwrite')
      const store = transaction.objectStore('posts')
      
      // Process images in post
      const processedPost = { ...post }
      
      if (post.media_url) {
        processedPost.media_url = await this.cacheImage(post.media_url, post.id)
      }
      
      if (post.images && Array.isArray(post.images)) {
        processedPost.images = await this.cacheImages(post.images, post.id)
      }

      if (post.raw_data?.images) {
        processedPost.raw_data = {
          ...post.raw_data,
          images: await this.cacheImages(post.raw_data.images, post.id)
        }
      }

      processedPost.cached_at = Date.now()
      
      await store.put(processedPost)
      return processedPost
    } catch (error) {
      console.error('Cache post error:', error)
      return post
    }
  }

  /**
   * Cache multiple posts
   */
  async cachePosts(posts) {
    if (!posts || !Array.isArray(posts)) return []
    const promises = posts.map(post => this.cachePost(post))
    return Promise.all(promises)
  }

  /**
   * Get cached posts
   */
  async getCachedPosts(limit = 50, offset = 0) {
    try {
      if (!this.db) await this.initDB()

      const transaction = this.db.transaction(['posts'], 'readonly')
      const store = transaction.objectStore('posts')
      const index = store.index('cached_at')
      
      return new Promise((resolve, reject) => {
        const request = index.openCursor(null, 'prev')
        const results = []
        let count = 0

        request.onsuccess = (event) => {
          const cursor = event.target.result
          if (cursor && count < offset + limit) {
            if (count >= offset) {
              results.push(cursor.value)
            }
            count++
            cursor.continue()
          } else {
            resolve(results)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Get cached posts error:', error)
      return []
    }
  }

  /**
   * Cache conversation
   */
  async cacheConversation(conversation) {
    try {
      if (!this.db) await this.initDB()

      const transaction = this.db.transaction(['conversations'], 'readwrite')
      const store = transaction.objectStore('conversations')
      
      const cachedConv = {
        ...conversation,
        cached_at: Date.now()
      }
      
      await store.put(cachedConv)
      return cachedConv
    } catch (error) {
      console.error('Cache conversation error:', error)
      return conversation
    }
  }

  /**
   * Cache multiple conversations
   */
  async cacheConversations(conversations) {
    if (!conversations || !Array.isArray(conversations)) return []
    const promises = conversations.map(conv => this.cacheConversation(conv))
    return Promise.all(promises)
  }

  /**
   * Get cached conversations
   */
  async getCachedConversations(userId = null) {
    try {
      if (!this.db) await this.initDB()

      const transaction = this.db.transaction(['conversations'], 'readonly')
      const store = transaction.objectStore('conversations')
      
      return new Promise((resolve, reject) => {
        const request = store.getAll()
        request.onsuccess = () => {
          let results = request.result || []
          
          // Filter by user if provided
          if (userId) {
            results = results.filter(conv => conv.user_id === userId)
          }

          // Filter expired conversations
          const now = Date.now()
          results = results.filter(conv => {
            const age = now - (conv.cached_at || 0)
            return age < this.maxConversationAge
          })

          // Sort by cached_at descending
          results.sort((a, b) => (b.cached_at || 0) - (a.cached_at || 0))
          
          resolve(results)
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Get cached conversations error:', error)
      return []
    }
  }

  /**
   * Clear old cache
   */
  async cleanupCache() {
    try {
      if (!this.db) await this.initDB()

      // Clean up expired images
      const transaction = this.db.transaction(['images'], 'readwrite')
      const store = transaction.objectStore('images')
      const index = store.index('cached_at')
      const cutoff = Date.now() - this.maxImageAge

      return new Promise((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.upperBound(cutoff))
        let deleted = 0

        request.onsuccess = async (event) => {
          const cursor = event.target.result
          if (cursor) {
            const filePath = cursor.value.localPath
            
            // Delete file if in Tauri
            const isTauri = window.__TAURI_INTERNALS__ !== undefined
            if (isTauri && filePath) {
              try {
                await invoke('delete_file', { path: filePath })
              } catch (e) {
                console.warn('Could not delete file:', filePath, e)
              }
            }
            
            cursor.delete()
            deleted++
            cursor.continue()
          } else {
            console.log(`🧹 Cleaned up ${deleted} old cached images`)
            resolve(deleted)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Cleanup error:', error)
      return 0
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    try {
      if (!this.db) await this.initDB()

      // Clear IndexedDB stores
      const stores = ['posts', 'conversations', 'images', 'stats']
      for (const storeName of stores) {
        const transaction = this.db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        await store.clear()
      }

      console.log('✅ All cache cleared')
    } catch (error) {
      console.error('Clear cache error:', error)
    }
  }

  // Helper methods
  async hashString(str) {
    const encoder = new TextEncoder()
    const data = encoder.encode(str)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16)
  }

  getImageExtension(url) {
    const match = url.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i)
    return match ? match[1] : null
  }

  async saveImageMetadata(url, localPath, postId) {
    if (!this.db) await this.initDB()

    const transaction = this.db.transaction(['images'], 'readwrite')
    const store = transaction.objectStore('images')
    await store.put({
      url,
      localPath,
      post_id: postId,
      cached_at: Date.now()
    })
  }

  async removeImageMetadata(url) {
    if (!this.db) await this.initDB()

    const transaction = this.db.transaction(['images'], 'readwrite')
    const store = transaction.objectStore('images')
    await store.delete(url)
  }

  /**
   * Convert file path to displayable URL
   * In Tauri v1, we read the file and create a blob URL
   */
  async getFileUrl(filePath) {
    if (!filePath) return filePath
    
    // If already a URL, return as-is
    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('blob:')) {
      return filePath
    }

    // Check if running in Tauri
    const isTauri = window.__TAURI_INTERNALS__ !== undefined
    if (isTauri && filePath) {
      try {
        // Read file and create blob URL
        const fileData = await readBinaryFile(filePath)
        const blob = new Blob([fileData], { type: 'image/jpeg' }) // Default to jpeg, could detect from extension
        const blobUrl = URL.createObjectURL(blob)
        return blobUrl
      } catch (e) {
        console.warn('Failed to read cached file:', e)
        return filePath
      }
    }
    
    return filePath
  }
}

// Singleton instance
const localCache = new LocalCache()

export default localCache

