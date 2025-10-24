// Job types constants - single source of truth
// These must match the backend constants exactly

export const JOB_TYPES = [
  { code: "TRAVELLER_EVICTION",          label: "Traveller Eviction" },
  { code: "SQUATTER_EVICTION",           label: "Squatter Eviction" },
  { code: "TRAVELLER_NOTICE_SERVE",      label: "Traveller Notice Serve" },
  { code: "SQUATTER_NOTICE_SERVE",       label: "Squatter Notice Serve" },
  { code: "VEHICLE_TORTS_NOTICE",        label: "Vehicle Torts Notice" },
  { code: "LEASE_FORFEITURE",            label: "Lease Forfeiture" },
  { code: "ROUGH_SLEEPER",               label: "Rough sleeper" },
]

// Helper functions
export const getJobTypeLabel = (code) => {
  const jobType = JOB_TYPES.find(jt => jt.code === code)
  return jobType ? jobType.label : code || "Unknown"
}

export const isValidJobTypeCode = (code) => {
  return JOB_TYPES.some(jt => jt.code === code)
}

// Export codes for validation
export const JOB_TYPE_CODES = JOB_TYPES.map(jt => jt.code)

// Backward compatibility - keep the old format for existing code
export const getJobTypeLabel_Legacy = (value) => {
  // First try new format
  const newJobType = JOB_TYPES.find(type => type.code === value)
  if (newJobType) return newJobType.label

  // Fallback to returning the value itself for old job types
  return value || "Unknown"
}