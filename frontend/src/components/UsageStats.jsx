import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const UsageStats = ({ userPlan }) => {
  const { user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previousUsage, setPreviousUsage] = useState(null);
  const [cachedUsage, setCachedUsage] = useState(null);
  const [cachedPlan, setCachedPlan] = useState(null);

  useEffect(() => {
    // Load from cache first if available
    const cached = localStorage.getItem('usageStatsData');
    if (cached) {
      try {
        const cachedData = JSON.parse(cached);
        setCachedUsage(cachedData.usage);
        setCachedPlan(cachedData.plan);
        setUsage(cachedData.usage);
        console.log('Loaded usage stats and plan from cache:', cachedData);
      } catch (error) {
        console.error('Error parsing cached usage stats:', error);
      }
    }

    // Initial fetch (force refresh to ensure we have latest data)
    fetchUsageStats(true);

    // Check for updates more frequently (every 30 seconds)
    const interval = setInterval(() => {
      fetchUsageStats(false); // Don't force refresh, only update if counts increased
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Save to cache whenever usage or plan updates
  useEffect(() => {
    if (usage || cachedPlan) {
      const cacheData = {
        usage: usage || cachedUsage,
        plan: userPlan || cachedPlan,
        timestamp: Date.now()
      };
      localStorage.setItem('usageStatsData', JSON.stringify(cacheData));
      console.log('Saved usage stats and plan to cache:', cacheData);
    }
  }, [usage, userPlan]);

  const fetchUsageStats = async (forceRefresh = false) => {
    try {
      setLoading(true);
      const response = await fetch('/api/profile/usage-stats', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Check if usage has increased compared to cached data
        const shouldUpdate = forceRefresh ||
          !cachedUsage ||
          data.tasks_used > cachedUsage.tasks_used ||
          data.images_used > cachedUsage.images_used;

        if (shouldUpdate) {
          setPreviousUsage(usage); // Store previous data
          setUsage(data);
          setCachedUsage(data); // Update cache
          console.log('Usage stats updated:', data);
        } else {
          console.log('Usage stats unchanged, keeping cached data');
          setPreviousUsage(usage);
          setUsage(cachedUsage); // Use cached data
        }
      } else {
        console.error('Failed to fetch usage stats');
      }
    } catch (error) {
      console.error('Error fetching usage stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Don't show anything while loading for the first time
  if (!usage && !previousUsage) return null;

  // Use current usage data, or fall back to previous usage if still loading
  const displayUsage = usage || previousUsage;

  const getProgressColor = (used, limit) => {
    const percentage = limit === -1 ? 0 : (used / limit) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatLimit = (limit) => {
    return limit === -1 ? '∞' : limit.toString();
  };

  return (
    <div className={`space-y-3 ${loading ? 'opacity-75' : ''}`}>
      <h3 className="text-xs font-normal text-gray-600 dark:text-gray-400 uppercase tracking-wide">
        {(userPlan || cachedPlan) ? `${(userPlan || cachedPlan).replace('_', ' ').toUpperCase()} - ` : ''}Monthly Usage
        {loading && <span className="ml-1 text-xs">⟳</span>}
      </h3>

      <div className="space-y-3">
        {/* Tasks Usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">Tasks</span>
            <span className="text-gray-500 dark:text-gray-100 font-medium">
              {usage.tasks_used}/{usage.tasks_limit === -1 ? '∞' : formatLimit(usage.tasks_limit)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            {usage.tasks_limit === -1 ? (
              <div className="w-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full h-1.5">
              </div>
            ) : (
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(usage.tasks_used, usage.tasks_limit)}`}
                style={{
                  width: `${Math.min((usage.tasks_used / (usage.tasks_limit === -1 ? usage.tasks_used + 1 : usage.tasks_limit)) * 100, 100)}%`
                }}
              ></div>
            )}
          </div>
        </div>

        {/* Images Usage */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600 dark:text-gray-400">Posts</span>
            <span className="text-gray-500 dark:text-gray-100 font-medium">
              {usage.images_used}/{usage.images_limit === -1 ? '∞' : formatLimit(usage.images_limit)}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
            {usage.images_limit === -1 ? (
              <div className="w-full bg-gradient-to-r from-green-400 to-blue-500 rounded-full h-1.5">
              </div>
            ) : (
              <div
                className={`h-1.5 rounded-full transition-all duration-300 ${getProgressColor(usage.images_used, usage.images_limit)}`}
                style={{
                  width: `${Math.min((usage.images_used / usage.images_limit) * 100, 100)}%`
                }}
              ></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsageStats;
