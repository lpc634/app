import React, { useEffect, useState } from "react";
import { useController, Control } from "react-hook-form";
import { useAuth } from "@/useAuth.jsx";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Option = { value: string; label: string };

type Props = {
  control: Control<any>;
  name: string; // e.g. "job_id"
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  defaultJob?: { id: string; label: string };
};

export function JobSelect({ control, name, label = "Job", placeholder = "Select a job", disabled, defaultJob }: Props) {
  const { apiCall, user } = useAuth();
  const { field, fieldState } = useController({ control, name, rules: { required: "Job is required" } });
  const [options, setOptions] = useState<Option[]>(defaultJob ? [{ value: defaultJob.id, label: defaultJob.label }] : []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadJobs = async () => {
      setLoading(true);
      try {
        if (user?.role === 'agent') {
          const res = await apiCall(`/agent/jobs/completed`);
          setOptions(res.jobs.map((j: any) => ({
            value: String(j.id),
            label: j.address || j.title || `Job #${j.id}`
          })));
        } else {
          const res = await apiCall(`/jobs/search?limit=100`);
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
    };

    loadJobs();
  }, [apiCall, user?.role]);

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-v3-text">
        {label}<span className="text-red-500 ml-1">*</span>
      </label>
      <Select
        value={field.value || ""}
        onValueChange={(v) => field.onChange(v)}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading…" : placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.length === 0 && !loading && (
            <div className="p-2 text-sm text-gray-500">No jobs available</div>
          )}
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
