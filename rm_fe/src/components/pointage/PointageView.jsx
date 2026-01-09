import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Save, Send, RotateCcw, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { LCSidebar } from './LCSidebar';
import { WeeklyCalendar } from './WeeklyCalendar';
import { getWeekStartDate, formatDate, getWeekDays, formatWeekRange } from '../../utils/dateUtils';

const initialFormData = {
  clef_imputation: '',
  libelle: '',
  fonction: '',
  date_besoin: '',
  heures_theoriques: '',
  heures_passees: '',
  commentaires: '',
};


export function PointageView() {
  const { user } = useAuth();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStartDate(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [formData, setFormData] = useState(initialFormData);
  const [entries, setEntries] = useState([]);
  const [currentEntry, setCurrentEntry] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const weekDays = getWeekDays(currentWeekStart);
  const isSubmitted = currentEntry?.status === 'submitted';

  useEffect(() => {
    loadEntriesForWeek();
  }, [currentWeekStart, user]);

  useEffect(() => {
    if (selectedDay) {
      loadEntryForDay(selectedDay);
    } else {
      setCurrentEntry(null);
      setFormData(initialFormData);
    }
  }, [selectedDay, entries]);

  const loadEntriesForWeek = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const weekStartStr = formatDate(currentWeekStart);
      console.log('📅 Loading entries for week:', weekStartStr);
      const data = await api.getPointageEntriesForWeek(weekStartStr);
      console.log('📦 API Response:', data);
      
      // Normalize date_pointage to ensure consistent format (YYYY-MM-DD)
      const normalizeDate = (dateStr) => {
        if (!dateStr) return null;
        // If it's already in YYYY-MM-DD format, return as is
        // If it has time component, extract just the date part
        return dateStr.split('T')[0];
      };
      
      // Map entries to match the expected format
      const rawEntries = data.entries || data || [];
      console.log('📋 Raw entries from API:', rawEntries);
      const formattedEntries = rawEntries.map(entry => ({
        id: entry.id,
        date_pointage: normalizeDate(entry.date_pointage),
        clef_imputation: entry.clef_imputation || '',
        libelle: entry.libelle || '',
        fonction: entry.fonction || '',
        date_besoin: entry.date_besoin || '',
        heures_theoriques: entry.heures_theoriques || '',
        heures_passees: entry.heures_passees || '',
        commentaires: entry.commentaires || '',
        status: entry.status || 'draft',
        submitted_at: entry.submitted_at,
        created_at: entry.created_at,
        updated_at: entry.updated_at,
      }));
      
      console.log('✅ Formatted entries:', formattedEntries);
      console.log('📊 Entries count:', formattedEntries.length);
      setEntries(formattedEntries);
      return formattedEntries; // Return entries so we can use them immediately
    } catch (error) {
      console.error('Error loading entries:', error);
      setEntries([]);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadEntryForDay = (dayOfWeek, entriesToSearch = null) => {
    // Find entry for the selected day
    const dayDate = weekDays[dayOfWeek - 1];
    const dayDateStr = formatDate(dayDate);
    
    // Normalize date strings for comparison (remove time if present)
    const normalizeDate = (dateStr) => {
      if (!dateStr) return null;
      return dateStr.split('T')[0]; // Get just the date part
    };
    
    // Use provided entries or current state
    const entriesList = entriesToSearch || entries;
    
    const entry = entriesList.find(e => {
      const entryDate = normalizeDate(e.date_pointage);
      return entryDate === dayDateStr;
    });
    
    console.log('🔍 Looking for entry:', { dayDateStr, entriesCount: entriesList.length, found: !!entry });
    
    if (entry) {
      setCurrentEntry(entry);
      setFormData({
        clef_imputation: entry.clef_imputation || '',
        libelle: entry.libelle || '',
        fonction: entry.fonction || '',
        date_besoin: entry.date_besoin || '',
        heures_theoriques: entry.heures_theoriques || '',
        heures_passees: entry.heures_passees || '',
        commentaires: entry.commentaires || '',
      });
    } else {
      setCurrentEntry(null);
      // Set date_pointage for new entry
      setFormData({
        ...initialFormData,
        date_pointage: dayDateStr,
      });
    }
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!user || selectedDay === null) return;

    setLoading(true);
    try {
      const dayDate = weekDays[selectedDay - 1];
      const dayDateStr = formatDate(dayDate);

      let saveResult;
      if (currentEntry) {
        // Update existing entry
        console.log('💾 Updating entry:', currentEntry.id);
        saveResult = await api.updatePointageEntry(currentEntry.id, {
          clef_imputation: formData.clef_imputation,
          libelle: formData.libelle,
          fonction: formData.fonction,
          date_besoin: formData.date_besoin,
          heures_theoriques: formData.heures_theoriques,
          heures_passees: formData.heures_passees,
          commentaires: formData.commentaires,
        });
        console.log('✅ Update result:', saveResult);
        showMessage('success', 'Entry updated successfully');
      } else {
        // Create new entry
        console.log('💾 Creating new entry for date:', dayDateStr);
        saveResult = await api.createPointageEntry({
          date_pointage: dayDateStr,
          clef_imputation: formData.clef_imputation,
          libelle: formData.libelle,
          fonction: formData.fonction,
          date_besoin: formData.date_besoin,
          heures_theoriques: formData.heures_theoriques,
          heures_passees: formData.heures_passees,
          commentaires: formData.commentaires,
        });
        console.log('✅ Create result:', saveResult);
        showMessage('success', 'Entry saved successfully');
      }

      console.log('💾 Save completed, reloading entries...');
      // Load entries and immediately reload the selected day's entry
      const loadedEntries = await loadEntriesForWeek();
      console.log('💾 After save - loaded entries:', loadedEntries);
      console.log('💾 Selected day:', selectedDay);
      // Reload entry for the selected day using the freshly loaded entries
      if (selectedDay !== null) {
        console.log('🔄 Reloading entry for day:', selectedDay);
        loadEntryForDay(selectedDay, loadedEntries);
      } else {
        console.log('⚠️ No selected day, cannot reload entry');
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      showMessage('error', error.message || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentEntry) return;

    setLoading(true);
    try {
      await api.submitPointageEntry(currentEntry.id);
      showMessage('success', 'Entry submitted and locked');
      // Load entries and immediately reload the selected day's entry
      const loadedEntries = await loadEntriesForWeek();
      // Reload entry for the selected day after submitting
      if (selectedDay !== null) {
        loadEntryForDay(selectedDay, loadedEntries);
      }
    } catch (error) {
      console.error('Error submitting entry:', error);
      showMessage('error', error.message || 'Failed to submit entry');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (currentEntry) {
      loadEntryForDay(selectedDay);
    } else {
      setFormData(initialFormData);
    }
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(getWeekStartDate(newDate));
    setSelectedDay(null);
  };

  return (
    <div className="flex h-[calc(100vh-73px)]">
      <LCSidebar formData={formData} onChange={setFormData} disabled={isSubmitted} />

      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>

            <h2 className="text-lg font-semibold text-slate-900">
              {formatWeekRange(currentWeekStart)}
            </h2>

            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
          </div>

          {message && (
            <div
              className={`px-4 py-2 rounded-lg text-sm ${
                message.type === 'success'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {message.text}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto">
          <WeeklyCalendar
            weekDays={weekDays}
            entries={entries}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
        </div>

        {selectedDay && (
          <div className="bg-white border-t border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                {currentEntry ? (
                  <>
                    Entry for {weekDays[selectedDay - 1].toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                    {isSubmitted && (
                      <span className="ml-2 inline-flex items-center gap-1 text-green-600 font-medium">
                        <Lock className="w-4 h-4" /> Submitted
                      </span>
                    )}
                  </>
                ) : (
                  `New entry for ${weekDays[selectedDay - 1].toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  disabled={loading || isSubmitted}
                  className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset
                </button>

                <button
                  onClick={handleSave}
                  disabled={loading || isSubmitted}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  {currentEntry ? 'Update' : 'Save'}
                </button>

                {currentEntry && !isSubmitted && (
                  <button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Submit
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
