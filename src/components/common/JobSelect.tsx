import React, { useEffect, useMemo, useState } from "react";
import { useController, Control } from "react-hook-form";
import { useAuth } from "@/useAuth.jsx";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function debounce<T extends (...args: any[]) => void>(fn: T, wait = 300) {
  let t: ReturnType<typeof setTimeout> | undefined;
  return (...args: Parameters<T>) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

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
  const { apiCall, user } = useAuth();
  const { field, fieldState } = useController({ control, name, rules: { required: "Job is required" } });
  const [options, setOptions] = useState<Option[]>(defaultJob ? [{ value: defaultJob.id, label: defaultJob.label }] : []);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  const fetchJobs = useMemo(() => debounce(async (q: string) => {
    setLoading(true);
    try {
      if (user?.role === 'agent') {
        // Agents use /agent/jobs/completed endpoint
        const res = await apiCall(`/agent/jobs/completed`);
        setOptions(res.jobs.map((j: any) => ({
          value: String(j.id),
          label: j.address || j.title || `Job #${j.id}`
        })));
      } else {
        // Admins/managers use /jobs/search endpoint
        const params = new URLSearchParams({ q: q || "", limit: "20" });
        const res = await apiCall(`/jobs/search?${params}`);
        setOptions(res.items.map((j: any) => ({
          value: String(j.id),
          label: j.reference || j.address || j.site_name || `Job #${j.id}`
        })));
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, 300), [apiCall, user?.role]);

  useEffect(() => {
    fetchJobs("");
  }, [fetchJobs]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    fetchJobs(newQuery);
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-v3-text">
        {label}<span className="text-red-500 ml-1">*</span>
      </label>
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleSearchChange}
        disabled={disabled}
        className="text-sm"
      />
      <Select
        value={field.value || ""}
        onValueChange={(v) => field.onChange(v)}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading…" : "Select a job"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {fieldState.error && (
        <p className="text-xs text-red-500">{fieldState.error.message}</p>
      )}
    </div>
  );
}
