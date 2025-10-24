# Job types constants - single source of truth
# These must match the frontend constants exactly

JOB_TYPES = {
    "TRAVELLER_EVICTION": "Traveller Eviction",
    "SQUATTER_EVICTION": "Squatter Eviction",
    "TRAVELLER_NOTICE_SERVE": "Traveller Notice Serve",
    "SQUATTER_NOTICE_SERVE": "Squatter Notice Serve",
    "VEHICLE_TORTS_NOTICE": "Vehicle Torts Notice",
    "LEASE_FORFEITURE": "Lease Forfeiture",
    "ROUGH_SLEEPER": "Rough sleeper",
}

ALLOWED_JOB_TYPE_CODES = set(JOB_TYPES.keys())

def get_job_type_label(code):
    """Get human-readable label for a job type code"""
    return JOB_TYPES.get(code, code or "Unknown")

def is_valid_job_type_code(code):
    """Check if a job type code is valid"""
    return code in ALLOWED_JOB_TYPE_CODES