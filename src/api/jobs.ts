export const jobsApi = {
  async search({ query = "", limit = 20, page = 1 }: { query?: string; limit?: number; page?: number }) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      page: String(page)
    });
    const response = await fetch(`/api/jobs/search?${params}`, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch jobs');
    }
    return response.json(); // { items: [{ id, reference, address, site_name, ... }], total }
  }
};
