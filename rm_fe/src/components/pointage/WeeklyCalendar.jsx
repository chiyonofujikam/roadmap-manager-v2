import { getDayName, formatDate, normalizeDateString } from '../../utils/dateUtils';
import { Check, Lock, Edit2 } from 'lucide-react';

/**
 * Weekly calendar component displaying pointage entries for each day of the week.
 * 
 * @param {Array} weekDays - Array of Date objects for the week (Monday-Sunday)
 * @param {Array} entries - Array of pointage entry objects
 * @param {number} selectedDay - Selected day of week (1-7)
 * @param {string} selectedEntryId - ID of the selected entry
 * @param {Function} onSelectDay - Callback when a day is selected
 * @param {Function} onSelectEntry - Callback when an entry is selected
 */
export function WeeklyCalendar({ weekDays, entries, selectedDay, selectedEntryId, onSelectDay, onSelectEntry }) {
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
    <div className="grid grid-cols-5 gap-3 p-3">
      {weekDays.map((day, index) => {
        const dayOfWeek = index + 1;
        const dayEntries = getEntriesForDay(dayOfWeek);
        const isSelected = selectedDay === dayOfWeek;

        return (
          <div key={dayOfWeek} className="flex flex-col">
            <div className="text-center mb-2">
              <div className="text-xs font-semibold text-slate-900">
                {getDayName(dayOfWeek)}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>

            <button
              onClick={() => onSelectDay(dayOfWeek)}
              className={`flex-1 min-h-[80px] max-h-[120px] p-2 border-2 rounded-lg transition-all overflow-hidden flex flex-col ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
              }`}
            >
              {dayEntries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                  No entries
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                  {dayEntries.map((entry) => {
                    const isEntrySelected = selectedEntryId === entry.id;
                    return (
                      <div
                        key={entry.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEntry(entry.id);
                          onSelectDay(dayOfWeek);
                        }}
                        className={`p-1.5 border rounded text-left text-xs cursor-pointer transition-all ${
                          getStatusColor(entry.status)
                        } ${
                          isEntrySelected 
                            ? 'ring-2 ring-blue-500 bg-blue-100 border-blue-400' 
                            : 'hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-medium text-slate-700 capitalize">
                            {entry.status}
                          </span>
                          {getStatusIcon(entry.status)}
                        </div>
                        {(entry.date_besoin || entry.column_h) && (
                          <div className="text-slate-600 truncate text-xs" title={entry.date_besoin || entry.column_h}>
                            {entry.date_besoin || entry.column_h}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
