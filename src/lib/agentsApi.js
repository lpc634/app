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
    const params = new URLSearchParams({ date: dateISO }).toString()
    const result = await apiCall(`/agents/available?${params}`)

    // Handle different response formats
    const agents = result.agents || result.available_agents || result || []
    return { data: Array.isArray(agents) ? agents : [], error: null }
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
    const agents = result.agents || result.available_agents || result || []
    return { data: Array.isArray(agents) ? agents : [], error: null }
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

    // Handle different response formats
    const agents = result.agents || result || []
    return { data: Array.isArray(agents) ? agents : [], error: null }
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
    // Calculate 90-day window
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - 90)

    const params = new URLSearchParams({
      start: startDate.toISOString().split('T')[0],
      end: endDate.toISOString().split('T')[0],
      limit: limit.toString()
    }).toString()

    const result = await apiCall(`/agents/reliability?${params}`)
    const agents = result.agents || result || []
    return { data: Array.isArray(agents) ? agents : [], error: null }
  } catch (error) {
    console.warn('getReliableAgents error:', error)
    return { data: [], error }
  }
}

/**
 * Get aggregated agent data for picker (all, available, reliable in one call)
 * @param {string} dateISO - Date in YYYY-MM-DD format (optional)
 * @param {function} apiCall - The apiCall function from useAuth
 * @returns {Promise<{data: {all: Array, available: Array, reliable: Array}, error: any}>}
 */
export async function getAgentsPicker(dateISO, apiCall) {
  try {
    const params = new URLSearchParams({
      window_days: '90'
    })

    if (dateISO) {
      params.set('date', dateISO.slice(0, 10)) // Ensure YYYY-MM-DD format
    }

    const result = await apiCall(`/agents/picker?${params.toString()}`)

    // Ensure we have the expected structure
    const data = {
      all: result.all || [],
      available: result.available || [],
      reliable: result.reliable || []
    }

    return { data, error: null }
  } catch (error) {
    console.warn('getAgentsPicker error:', error)
    return {
      data: { all: [], available: [], reliable: [] },
      error
    }
  }
}