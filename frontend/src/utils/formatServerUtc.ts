export function normalizeUtcString(utcString) {
  if (!utcString) return null;
  // If string already has timezone indicator, leave it; otherwise append 'Z' to force UTC parsing
  return utcString.endsWith("Z") ? utcString : utcString + "Z";
}

/** Return a JS Date parsed from the server UTC string (or null) */
export function parseServerUtcToDate(utcString) {
  const s = normalizeUtcString(utcString);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Format server UTC string into the browser's local human-readable string */
export function formatServerUtc(utcString) {
  const d = parseServerUtcToDate(utcString);
  if (!d) return "";
  return d.toLocaleString();
}
