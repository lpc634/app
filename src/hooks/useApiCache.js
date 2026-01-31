import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../useAuth';

const STORAGE_PREFIX = 'api_cache:';
const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes — stale after this, but still shown instantly

// Tier 1: In-memory Map (fastest, survives SPA navigations)
const memCache = new Map();

// --- localStorage helpers ---
function readStorage(endpoint) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + endpoint);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    return { data, ts };
  } catch {
    return null;
  }
}

function writeStorage(endpoint, data) {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + endpoint,
      JSON.stringify({ data, ts: Date.now() })
    );
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function removeStorage(endpoint) {
  try {
    localStorage.removeItem(STORAGE_PREFIX + endpoint);
  } catch {
    // ignore
  }
}

function clearAllStorage() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// --- Resolve cached value from either tier ---
function getCached(endpoint) {
  // Tier 1: in-memory (instant)
  if (memCache.has(endpoint)) return memCache.get(endpoint);

  // Tier 2: localStorage (survives refresh)
  const stored = readStorage(endpoint);
  if (stored) {
    // Promote back into memory for next access
    memCache.set(endpoint, stored.data);
    return stored.data;
  }

  return null;
}

function setCache(endpoint, data) {
  memCache.set(endpoint, data);
  writeStorage(endpoint, data);
}

/**
 * Stale-while-revalidate hook for GET API calls.
 *
 * - First-ever visit: shows loading → fetches → caches to memory + localStorage
 * - Page refresh / direct navigation: shows localStorage data instantly → refreshes in background
 * - SPA navigation: shows in-memory data instantly → refreshes in background
 */
export function useApiData(endpoint, { enabled = true } = {}) {
  const { apiCall } = useAuth();
  const cached = enabled ? getCached(endpoint) : null;

  const [data, setData] = useState(cached ?? null);
  const [loading, setLoading] = useState(enabled && !cached);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    (async () => {
      // Only show loading spinner when there's zero cached data (neither tier)
      if (!getCached(endpoint)) setLoading(true);

      try {
        const result = await apiCall(endpoint);
        if (cancelled) return;
        setCache(endpoint, result);
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
    setCache(endpoint, result);
    setData(result);
    setError(null);
    return result;
  }, [endpoint, apiCall]);

  return { data, loading, error, refetch };
}

/** Clear one or all cached entries (both tiers) */
export function invalidateCache(endpoint) {
  if (endpoint) {
    memCache.delete(endpoint);
    removeStorage(endpoint);
  } else {
    memCache.clear();
    clearAllStorage();
  }
}

/** Eagerly fetch an endpoint and warm both cache tiers (fire-and-forget) */
export function prefetch(endpoint, apiCallFn) {
  if (getCached(endpoint)) return; // already have data in some tier
  apiCallFn(endpoint)
    .then((data) => setCache(endpoint, data))
    .catch(() => {});
}
