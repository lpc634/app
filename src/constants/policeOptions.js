export const POLICE_FORCES = [
  "Metropolitan Police","Surrey Police","Kent Police","Sussex Police","Thames Valley Police",
  "Hampshire Constabulary","Essex Police","Hertfordshire Constabulary","Bedfordshire Police",
] as const;

export const REASONS = ["Section 61","Welfare check","Site visit","Other"] as const;
export const OUTCOMES = ["S61 granted","S61 refused","Standby only","No support","Other"] as const;
export const HELP_RANGE = [1,2,3,4,5] as const;

export function outcomeBadgeVariant(outcome) {
  const o = (outcome || '').toLowerCase();
  if (o.includes('granted')) return 'success';
  if (o.includes('refused')) return 'destructive';
  if (o.includes('standby')) return 'warning';
  if (o.includes('no support')) return 'secondary';
  return 'default';
}


