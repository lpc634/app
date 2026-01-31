import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';

// Module-level cache — survives across navigations within the SPA
const cache = new Map();

/**
 * Lightweight stale-while-revalidate hook for GET API calls.
 *
 * - First visit:  shows loading → fetches → caches
 * - Return visit: shows cached data instantly → silently refreshes
 */
export function useApiData(endpoint, { enabled = true } = {}) {
  const { apiCall } = useAuth();
  const cached = enabled ? cache.get(endpoint) : null;

  const [data, setData] = useState(cached ?? null);
  const [loading, setLoading] = useState(enabled && !cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      // Only show loading spinner when there's no cached data
      if (!cache.has(endpoint)) setLoading(true);

      try {
        const result = await apiCall(endpoint);
        if (cancelled) return;
        cache.set(endpoint, result);
        setData(result);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [endpoint, enabled]);

  const refetch = useCallback(async () => {
    const result = await apiCall(endpoint);
    cache.set(endpoint, result);
    setData(result);
    setError(null);
    return result;
  }, [endpoint, apiCall]);

  return { data, loading, error, refetch };
}

/** Clear one or all cached entries */
export function invalidateCache(endpoint) {
  if (endpoint) cache.delete(endpoint);
  else cache.clear();
}
