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