export const formsApi = {
  async start(payload: {
    job_id: string;
    template_id: string;
    [key: string]: any
  }) {
    const response = await fetch("/api/forms/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Failed to start form" }));
      throw new Error(error.error || "Failed to start form");
    }
    return response.json();
  }
};
