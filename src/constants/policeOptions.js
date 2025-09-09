export const ALL = "ALL";

export const POLICE_FORCES = Object.freeze([
  "Metropolitan Police",
  "Surrey Police",
  "Kent Police",
  "Sussex Police",
  "Thames Valley Police",
  "Hampshire Constabulary",
  "Essex Police",
  "Hertfordshire Constabulary",
  "Bedfordshire Police",
]);

export const REASONS = Object.freeze(["Section 61", "Welfare check", "Site visit", "Other"]);
export const OUTCOMES = Object.freeze(["S61 granted", "S61 refused", "Standby only", "No support", "Other"]);
export const HELP_RANGE = Object.freeze(["1", "2", "3", "4", "5"]);

export function outcomeBadgeVariant(outcome) {
  const o = String(outcome || '').toLowerCase();
  if (o.includes('granted')) return 'success';
  if (o.includes('refused')) return 'destructive';
  if (o.includes('standby')) return 'warning';
  if (o.includes('no support')) return 'secondary';
  return 'default';
}


