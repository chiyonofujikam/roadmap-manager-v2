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
  for (let i = 0; i < 7; i++) {
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
  weekEnd.setDate(weekStart.getDate() + 6);

  const options = { month: 'short', day: 'numeric' };
  return `${weekStart.toLocaleDateString('en-US', options)} - ${weekEnd.toLocaleDateString('en-US', options)}, ${weekEnd.getFullYear()}`;
}

export function getWeekCstr(weekStart) {
  const year = weekStart.getFullYear();
  const yearLastTwoDigits = year.toString().slice(-2);
  const date = new Date(weekStart);
  date.setHours(0, 0, 0, 0);

  const dayOfWeek = date.getDay() || 7;
  date.setDate(date.getDate() + 4 - dayOfWeek);

  const yearStart = new Date(date.getFullYear(), 0, 1);
  const weekNumber = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  const weekNumberStr = weekNumber.toString().padStart(2, '0');
  return `S${yearLastTwoDigits}${weekNumberStr}`;
}

/**
 * Convert cstr_semaine from "YYYY-W%V" format (e.g., "2026-W01") to "SXXYY" format (e.g., "S2601")
 */
export function convertCstrSemaineToSXXYY(cstrSemaine) {
  if (!cstrSemaine) return null;
  
  // Handle format like "2026-W01"
  const match = cstrSemaine.match(/(\d{4})-W(\d{2})/);
  if (match) {
    const year = match[1];
    const week = match[2];
    const yearLastTwoDigits = year.slice(-2);
    return `S${yearLastTwoDigits}${week}`;
  }
  
  // If already in SXXYY format, return as is
  if (cstrSemaine.match(/^S\d{4}$/)) {
    return cstrSemaine;
  }
  
  return null;
}