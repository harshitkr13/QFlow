/**
 * Safely formats a doctor's display name, guaranteeing that the 'Dr.' prefix appears
 * exactly once without duplicating existing titles (e.g., 'Dr. Dr. Alex Demo' -> 'Dr. Alex Demo')
 * and without corrupting valid doctor names that begin with 'Dr' (e.g., 'Drew', 'Drake').
 *
 * @param {string} name - Raw full name or doctor name string
 * @returns {string} Formatted doctor name prefixed with 'Dr. '
 */
export function formatDoctorName(name) {
  if (!name || typeof name !== 'string') return 'Doctor';
  const clean = name.trim();
  if (!clean) return 'Doctor';

  // Strip any leading occurrences of 'Dr.', 'Dr', or 'Doctor' followed by a period, whitespace, or end of string.
  // This preserves names starting with 'Dr' that don't match the title boundary (e.g. 'Drew', 'Drake').
  const withoutPrefix = clean.replace(/^(?:(?:Dr\.|Dr|Doctor)(?:\.|\s+|$))+/i, '').trim();
  if (!withoutPrefix) return 'Doctor';
  return `Dr. ${withoutPrefix}`;
}
