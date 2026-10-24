/**
 * Formats current date in Asia/Kolkata timezone as YYYY-MM-DD.
 * Reliable across system timezones and midnight boundaries.
 */
export const getTodayDateIST = () => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
};

/**
 * Formats an array of day-of-week strings into a concise, sorted human-readable string.
 * e.g., ['WEDNESDAY', 'MONDAY'] -> "Mon, Wed"
 */
export const formatWorkingDays = (days) => {
  if (!days || days.length === 0) return 'Schedule not configured';
  const shortMap = {
    MONDAY: 'Mon',
    TUESDAY: 'Tue',
    WEDNESDAY: 'Wed',
    THURSDAY: 'Thu',
    FRIDAY: 'Fri',
    SATURDAY: 'Sat',
    SUNDAY: 'Sun',
  };
  const order = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const sorted = [...days].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return sorted.map((d) => shortMap[d] || d).join(', ');
};
