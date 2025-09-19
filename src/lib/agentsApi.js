// Centralized API helpers for agent-related endpoints
// Ensures proper URL construction and error handling

/**
 * Get agents available for a specific date
 * @param {string} dateISO - Date in YYYY-MM-DD format
 * @param {function} apiCall - The apiCall function from useAuth
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getAgentsAvailable(dateISO, apiCall) {
  if (!dateISO) {
    return { data: [], error: null }
  }

  try {
    const params = new URLSearchParams({
      start: dateISO,
      end: dateISO
    }).toString()

    const result = await apiCall(`/agents/available?${params}`)
    return { data: result.agents || [], error: null }
  } catch (error) {
    console.warn('getAgentsAvailable error:', error)
    return { data: [], error }
  }
}

/**
 * Get agents available for a date range
 * @param {string} startISO - Start date in YYYY-MM-DD format
 * @param {string} endISO - End date in YYYY-MM-DD format
 * @param {function} apiCall - The apiCall function from useAuth
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getAgentsAvailableRange(startISO, endISO, apiCall) {
  if (!startISO || !endISO) {
    return { data: [], error: null }
  }

  try {
    const params = new URLSearchParams({
      start: startISO,
      end: endISO
    }).toString()

    const result = await apiCall(`/agents/available?${params}`)
    return { data: result.agents || [], error: null }
  } catch (error) {
    console.warn('getAgentsAvailableRange error:', error)
    return { data: [], error }
  }
}

/**
 * Get all active agents
 * @param {function} apiCall - The apiCall function from useAuth
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getAllAgents(apiCall) {
  try {
    const params = new URLSearchParams({ active: 'true' }).toString()
    const result = await apiCall(`/agents?${params}`)
    return { data: result.agents || [], error: null }
  } catch (error) {
    console.warn('getAllAgents error:', error)
    return { data: [], error }
  }
}

/**
 * Get most reliable agents based on acceptance rate
 * @param {number} limit - Maximum number of agents to return (default 20)
 * @param {function} apiCall - The apiCall function from useAuth
 * @returns {Promise<{data: Array, error: any}>}
 */
export async function getReliableAgents(limit = 20, apiCall) {
  try {
    const params = new URLSearchParams({ limit: limit.toString() }).toString()
    const result = await apiCall(`/agents/reliability?${params}`)
    return { data: result.agents || [], error: null }
  } catch (error) {
    console.warn('getReliableAgents error:', error)
    return { data: [], error }
  }
}