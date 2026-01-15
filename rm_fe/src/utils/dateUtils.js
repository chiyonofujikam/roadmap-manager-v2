export function getWeekStartDate(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export function formatDate(date) {
  return date.toISOString().split('T')[0];
}

export function normalizeDateString(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).split('T')[0];
}

export function formatDateString(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    });
  } catch {
    return dateStr;
  }
}

export function getWeekDays(weekStart) {
  const days = [];
  // Only return weekdays (Monday-Friday, 5 days)
  for (let i = 0; i < 5; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    days.push(day);
  }
  return days;
}

export function getDayName(dayOfWeek) {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return days[dayOfWeek - 1] || '';
}

export function formatWeekRange(weekStart) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 4); // Friday (4 days after Monday)

  const options = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekEnd.getFullYear()}`;
}

/**
 * Get ISO week number for a date (ISO 8601 standard)
 * Returns week number (1-53)
 */
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Generate cstr_semaine in SXXYY format from a week start date (Monday).
 * Format: S + last 2 digits of year + 2-digit ISO week number
 * Example: S2403 for week 3 of 2024
 */
export function getWeekCstr(weekStart) {
  const year = weekStart.getFullYear();
  const yearLastTwoDigits = year.toString().slice(-2);
  const isoWeek = getISOWeek(weekStart);
  const weekNumberStr = isoWeek.toString().padStart(2, '0');
  return `S${yearLastTwoDigits}${weekNumberStr}`;
}