import React, { useEffect, useMemo, useState } from "react";
import { useController, Control } from "react-hook-form";
import { useAuth } from "@/useAuth.jsx";
import debounce from "lodash.debounce";

type Option = { value: string; label: string };

type Props = {
  control: Control<any>;
  name: string; // e.g. "job_id"
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  defaultJob?: { id: string; label: string };
};

export function JobSelect({ control, name, label = "Job", placeholder = "Search jobs…", disabled, defaultJob }: Props) {
  const { apiCall } = useAuth();
  const { field, fieldState } = useController({ control, name, rules: { required: "Job is required" } });
  const [options, setOptions] = useState<Option[]>(defaultJob ? [{ value: defaultJob.id, label: defaultJob.label }] : []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const fetchJobs = useMemo(() => debounce(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ q: q || "", limit: "20" });
      const res = await apiCall(`/jobs/search?${params}`);
      setOptions(res.items.map((j: any) => ({
        value: j.id,
        label: j.reference || j.address || j.site_name || `Job #${j.id}`
      })));
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, 300), [apiCall]);

  useEffect(() => {
    fetchJobs("");
  }, [fetchJobs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    fetchJobs(newQuery);
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-v3-text">
        {label}<span className="text-red-500 ml-1">*</span>
      </label>
      <input
        type="text"
        className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-3 py-2 text-sm text-v3-text placeholder-v3-text-muted focus:outline-none focus:ring-2 focus:ring-v3-orange focus:border-v3-orange"
        placeholder={placeholder}
        value={query}
        onChange={handleSearchChange}
        disabled={disabled}
      />
      <select
        className="w-full bg-v3-bg-dark border border-v3-border rounded-lg px-3 py-2 text-sm text-v3-text focus:outline-none focus:ring-2 focus:ring-v3-orange focus:border-v3-orange"
        value={field.value || ""}
        onChange={(e) => field.onChange(e.target.value)}
        onBlur={field.onBlur}
        disabled={disabled || loading}
      >
        <option value="" disabled>
          {loading ? "Loading…" : "Select a job"}
        </option>
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {fieldState.error && (
        <p className="text-xs text-red-500">{fieldState.error.message}</p>
      )}
    </div>
  );
}
