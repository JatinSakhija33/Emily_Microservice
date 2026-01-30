// Connections cache service
// Loads connections in background on login and caches them
// Clears cache on logout

const CACHE_KEY = 'connections_cache'
const CACHE_TIMESTAMP_KEY = 'connections_cache_timestamp'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

class ConnectionsCacheService {
  // Get cached connections
  getCachedConnections() {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)
      
      if (!cached || !timestamp) {
        return null
      }
      
      const age = Date.now() - parseInt(timestamp, 10)
      if (age > CACHE_DURATION) {
        // Cache expired
        this.clearCache()
        return null
      }
      
      return JSON.parse(cached)
    } catch (error) {
      console.error('Error reading connections cache:', error)
      return null
    }
  }

  // Set cached connections
  setCachedConnections(connections) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(connections))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
    } catch (error) {
      console.error('Error setting connections cache:', error)
    }
  }

  // Clear cache
  clearCache() {
    try {
      localStorage.removeItem(CACHE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    } catch (error) {
      console.error('Error clearing connections cache:', error)
    }
  }

  // Check if cache exists and is valid
  hasValidCache() {
    const cached = this.getCachedConnections()
    return cached !== null
  }
}

export const connectionsCache = new ConnectionsCacheService()

