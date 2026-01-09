import { getDayName, formatDate, normalizeDateString } from '../../utils/dateUtils';
import { Check, Lock, Edit2 } from 'lucide-react';

/**
 * Weekly calendar component displaying pointage entries for each day of the week.
 * 
 * @param {Array} weekDays - Array of Date objects for the week (Monday-Sunday)
 * @param {Array} entries - Array of pointage entry objects
 * @param {number} selectedDay - Selected day of week (1-7)
 * @param {Function} onSelectDay - Callback when a day is selected
 */
export function WeeklyCalendar({ weekDays, entries, selectedDay, onSelectDay }) {
  const getEntriesForDay = (dayOfWeek) => {
    const dayDate = weekDays[dayOfWeek - 1];
    const dayDateStr = formatDate(dayDate);
    
    const dayEntries = entries.filter(entry => {
      const entryDate = normalizeDateString(entry.date_pointage);
      return entryDate === dayDateStr;
    });
    
    return dayEntries;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 border-slate-300';
      case 'saved':
        return 'bg-blue-50 border-blue-300';
      case 'modified':
        return 'bg-amber-50 border-amber-300';
      case 'submitted':
        return 'bg-green-50 border-green-300';
      default:
        return 'bg-slate-100 border-slate-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'submitted':
        return <Lock className="w-4 h-4 text-green-600" />;
      case 'modified':
        return <Edit2 className="w-4 h-4 text-amber-600" />;
      case 'saved':
        return <Check className="w-4 h-4 text-blue-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="grid grid-cols-7 gap-4 p-6">
      {weekDays.map((day, index) => {
        const dayOfWeek = index + 1;
        const dayEntries = getEntriesForDay(dayOfWeek);
        const isSelected = selectedDay === dayOfWeek;

        return (
          <div key={dayOfWeek} className="flex flex-col">
            <div className="text-center mb-3">
              <div className="text-sm font-semibold text-slate-900">
                {getDayName(dayOfWeek)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>

            <button
              onClick={() => onSelectDay(dayOfWeek)}
              className={`flex-1 min-h-[120px] p-3 border-2 rounded-lg transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {dayEntries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No entries
                </div>
              ) : (
                <div className="space-y-2">
                  {dayEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className={`p-2 border rounded text-left text-xs ${getStatusColor(entry.status)}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-slate-700 capitalize">
                          {entry.status}
                        </span>
                        {getStatusIcon(entry.status)}
                      </div>
                      {(entry.date_besoin || entry.column_h) && (
                        <div className="text-slate-600 truncate" title={entry.date_besoin || entry.column_h}>
                          {entry.date_besoin || entry.column_h}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
