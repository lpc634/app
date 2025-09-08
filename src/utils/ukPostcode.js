// Robust UK postcode extraction and validation utilities

// Matches GIR 0AA and all standard outward/inward combinations.
// Allows optional space between outward and inward codes.
const UK_POSTCODE_REGEX = /\b(GIR\s?0AA|(?:(?:[A-PR-UWYZ][0-9][0-9]?)|(?:[A-PR-UWYZ][A-HK-Y][0-9][0-9]?)|(?:[A-PR-UWYZ][0-9][A-HJKS-UW])|(?:[A-PR-UWYZ][A-HK-Y][0-9][ABEHMNPRV-Y]))\s?[0-9][ABD-HJLNP-UW-Z]{2})\b/i;

function normalizePostcode(match) {
  if (!match) return null;
  const raw = String(match).toUpperCase().trim();
  // Ensure a single space before the final three characters (inward code)
  const compact = raw.replace(/\s+/g, "");
  if (compact.length < 5) return raw; // safety fallback
  const outward = compact.slice(0, compact.length - 3);
  const inward = compact.slice(-3);
  return `${outward} ${inward}`;
}

export function extractUkPostcode(address) {
  if (!address || typeof address !== 'string') return null;
  const m = address.match(UK_POSTCODE_REGEX);
  return normalizePostcode(m && m[0]);
}

export function isUkPostcode(value) {
  if (!value || typeof value !== 'string') return false;
  const m = value.match(UK_POSTCODE_REGEX);
  return Boolean(m);
}

export { UK_POSTCODE_REGEX };


