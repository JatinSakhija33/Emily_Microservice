import { useState, useEffect, useCallback } from 'react'

/**
 * Custom hook for managing lazy loading states
 * @param {Function} loadFunction - Function that returns a Promise
 * @param {Array} dependencies - Dependencies array for the load function
 * @param {Object} options - Configuration options
 * @returns {Object} Loading state and data
 */
export const useLazyLoading = (loadFunction, dependencies = [], options = {}) => {
  const {
    initialLoading = true,
    retryOnError = true,
    maxRetries = 3,
    retryDelay = 1000,
    onSuccess = null,
    onError = null
  } = options

  const [loading, setLoading] = useState(initialLoading)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [retryCount, setRetryCount] = useState(0)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      const result = await loadFunction()
      setData(result)
      setRetryCount(0)
      
      if (onSuccess) {
        onSuccess(result)
      }
    } catch (err) {
      console.error('Lazy loading error:', err)
      setError(err)
      
      if (onError) {
        onError(err)
      }
      
      // Retry logic
      if (retryOnError && retryCount < maxRetries) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1)
          loadData()
        }, retryDelay * (retryCount + 1))
      }
    } finally {
      setLoading(false)
    }
  }, dependencies)

  useEffect(() => {
    loadData()
  }, [loadData])

  const refetch = useCallback(() => {
    setRetryCount(0)
    loadData()
  }, [loadData])

  return {
    loading,
    data,
    error,
    refetch,
    retryCount
  }
}

/**
 * Hook for managing component visibility and lazy loading
 * @param {Object} options - Configuration options
 * @returns {Object} Visibility state and handlers
 */
export const useVisibilityLazyLoading = (options = {}) => {
  const {
    threshold = 0.1,
    rootMargin = '50px',
    triggerOnce = true
  } = options

  const [isVisible, setIsVisible] = useState(false)
  const [hasTriggered, setHasTriggered] = useState(false)

  const ref = useCallback((node) => {
    if (node && !hasTriggered) {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            if (triggerOnce) {
              setHasTriggered(true)
              observer.disconnect()
            }
          } else if (!triggerOnce) {
            setIsVisible(false)
          }
        },
        {
          threshold,
          rootMargin
        }
      )
      
      observer.observe(node)
      
      return () => {
        observer.disconnect()
      }
    }
  }, [threshold, rootMargin, triggerOnce, hasTriggered])

  return {
    ref,
    isVisible: isVisible || hasTriggered,
    hasTriggered
  }
}

/**
 * Hook for managing skeleton loading states
 * @param {Object} options - Configuration options
 * @returns {Object} Skeleton state and handlers
 */
export const useSkeletonLoading = (options = {}) => {
  const {
    minLoadingTime = 500,
    maxLoadingTime = 2000,
    showSkeleton = true
  } = options

  const [showSkeletonState, setShowSkeletonState] = useState(showSkeleton)
  const [skeletonStartTime] = useState(Date.now())

  useEffect(() => {
    if (showSkeleton) {
      const elapsed = Date.now() - skeletonStartTime
      const remainingTime = Math.max(0, minLoadingTime - elapsed)
      
      const timer = setTimeout(() => {
        setShowSkeletonState(false)
      }, remainingTime)

      return () => clearTimeout(timer)
    }
  }, [showSkeleton, minLoadingTime, skeletonStartTime])

  const resetSkeleton = useCallback(() => {
    setShowSkeletonState(true)
  }, [])

  return {
    showSkeleton: showSkeletonState,
    resetSkeleton
  }
}

export default {
  useLazyLoading,
  useVisibilityLazyLoading,
  useSkeletonLoading
}
