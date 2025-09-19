export const JOB_TYPES = [
  {
    value: 'SECURITY_GUARD',
    label: 'Security Guard'
  },
  {
    value: 'EVICTION_SUPPORT',
    label: 'Eviction Support'
  },
  {
    value: 'UNAUTHORISED_ENCAMPMENT_REMOVAL',
    label: 'Unauthorised Encampment Removal'
  },
  {
    value: 'SITE_CLEARANCE',
    label: 'Site Clearance'
  },
  {
    value: 'WASTE_REMOVAL',
    label: 'Waste Removal'
  },
  {
    value: 'CCTV_DEPLOYMENT',
    label: 'CCTV Deployment'
  },
  {
    value: 'EVENT_SECURITY',
    label: 'Event Security'
  },
  {
    value: 'MOBILE_PATROL',
    label: 'Mobile Patrol'
  },
  {
    value: 'STATIC_SECURITY',
    label: 'Static Security'
  },
  {
    value: 'ALARM_RESPONSE',
    label: 'Alarm Response'
  }
]

export const getJobTypeLabel = (value) => {
  const jobType = JOB_TYPES.find(type => type.value === value)
  return jobType ? jobType.label : value
}