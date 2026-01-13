import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Save, Send, Trash2, Plus, Lock, Edit, X, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../lib/api';
import { WeeklyCalendar } from './WeeklyCalendar';
import { getWeekStartDate, formatDate, getWeekDays, formatWeekRange, normalizeDateString, getWeekCstr } from '../../utils/dateUtils';
import { AutocompleteInput } from '../ui/AutocompleteInput';

const initialEntryData = {
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
  const { showMessage } = useNotification();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStartDate(new Date()));
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedEntryId, setSelectedEntryId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [editingEntries, setEditingEntries] = useState({}); // Track which entries are being edited
  const [loading, setLoading] = useState(false);
  
  // LC Options for autocomplete
  const [clefImputationOptions, setClefImputationOptions] = useState([]);
  const [libelleOptions, setLibelleOptions] = useState([]);
  const [fonctionOptions, setFonctionOptions] = useState([]);
  const [lcLoading, setLcLoading] = useState(true);
  const tableScrollContainerRef = useRef(null);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [modificationEntryId, setModificationEntryId] = useState(null);
  const [modificationData, setModificationData] = useState({ ...initialEntryData, comment: '' });
  const [pendingRequests, setPendingRequests] = useState(new Set());

  const weekDays = getWeekDays(currentWeekStart);

  // Get entries for the selected day
  const getEntriesForSelectedDay = () => {
    if (!selectedDay) return [];
    const dayDate = weekDays[selectedDay - 1];
    const dayDateStr = formatDate(dayDate);
    return entries.filter(e => normalizeDateString(e.date_pointage) === dayDateStr);
  };

  useEffect(() => {
    loadEntriesForWeek();
    loadLCOptions();
    checkPendingRequests();
  }, [currentWeekStart, user]);

  useEffect(() => {
    // Check for pending requests periodically
    const interval = setInterval(checkPendingRequests, 30000);
    return () => clearInterval(interval);
  }, [entries]);

  useEffect(() => {
    // Initialize editing state for all entries when day is selected
    if (selectedDay) {
      const dayEntries = getEntriesForSelectedDay();
      setEditingEntries(prevEditingEntries => {
        const editingState = {};
        dayEntries.forEach(entry => {
          editingState[entry.id] = {
            ...initialEntryData,
            clef_imputation: entry.clef_imputation || '',
            libelle: entry.libelle || '',
            fonction: entry.fonction || '',
            date_besoin: entry.date_besoin || '',
            heures_theoriques: entry.heures_theoriques || '',
            heures_passees: entry.heures_passees || '',
            commentaires: entry.commentaires || '',
          };
        });
        // Preserve any "new-" entries that are being created
        Object.keys(prevEditingEntries).forEach(key => {
          if (key.startsWith('new-')) {
            editingState[key] = prevEditingEntries[key];
          }
        });
        return editingState;
      });
    } else {
      setEditingEntries({});
      setSelectedEntryId(null);
    }
  }, [selectedDay, entries]);

  // Scroll to selected entry in table
  useEffect(() => {
    if (selectedEntryId && tableScrollContainerRef.current) {
      const timer = setTimeout(() => {
        const container = tableScrollContainerRef.current;
        const selectedRow = container.querySelector(`tr[data-entry-id="${selectedEntryId}"]`);
        if (selectedRow && container) {
          // Get bounding rectangles to check visibility
          const containerRect = container.getBoundingClientRect();
          const rowRect = selectedRow.getBoundingClientRect();
          
          // Check if row is fully visible in container
          const isFullyVisible = 
            rowRect.top >= containerRect.top &&
            rowRect.bottom <= containerRect.bottom;
          
          if (!isFullyVisible) {
            // Calculate scroll position using getBoundingClientRect
            // Get the difference between row and container positions
            const rowTopRelativeToContainer = rowRect.top - containerRect.top + container.scrollTop;
            const containerHeight = container.clientHeight;
            const rowHeight = rowRect.height;
            
            // Calculate target scroll position to center the row
            const targetScrollTop = rowTopRelativeToContainer - (containerHeight / 2) + (rowHeight / 2);
            
            container.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedEntryId]);

  const loadLCOptions = async () => {
    try {
      setLcLoading(true);
      const data = await api.getLCOptions();
      setClefImputationOptions(data.clef_imputation || []);
      setLibelleOptions(data.libelle || []);
      setFonctionOptions(data.fonction || []);
    } catch (err) {
      console.error('Error loading LC options:', err);
      setClefImputationOptions([]);
      setLibelleOptions([]);
      setFonctionOptions([]);
    } finally {
      setLcLoading(false);
    }
  };

  const checkPendingRequests = async () => {
    try {
      const data = await api.getMyModificationRequests(0, 1000);
      const pending = new Set();
      (data.requests || []).forEach(req => {
        if (req.status === 'pending' && req.entry_id) {
          pending.add(req.entry_id);
        }
      });
      setPendingRequests(pending);
    } catch (err) {
      console.error('Error checking pending requests:', err);
    }
  };

  const handleRequestModification = (entryId) => {
    const entry = entries.find(e => e.id === entryId);
    if (!entry) return;

    const entryData = editingEntries[entryId] || entry;
    setModificationEntryId(entryId);
    setModificationData({
      clef_imputation: entryData.clef_imputation || '',
      libelle: entryData.libelle || '',
      fonction: entryData.fonction || '',
      date_besoin: entryData.date_besoin || '',
      heures_theoriques: entryData.heures_theoriques || '',
      heures_passees: entryData.heures_passees || '',
      commentaires: entryData.commentaires || '',
      comment: '',
    });
    setShowModificationModal(true);
  };

  const handleSubmitModificationRequest = async () => {
    if (!modificationEntryId) return;

    try {
      setLoading(true);
      const requestedData = {
        clef_imputation: modificationData.clef_imputation,
        libelle: modificationData.libelle,
        fonction: modificationData.fonction,
        date_besoin: modificationData.date_besoin,
        heures_theoriques: modificationData.heures_theoriques,
        heures_passees: modificationData.heures_passees,
        commentaires: modificationData.commentaires,
      };

      await api.createModificationRequest(
        modificationEntryId,
        requestedData,
        modificationData.comment || null
      );

      showMessage('success', 'Modification request created successfully');
      setShowModificationModal(false);
      setModificationEntryId(null);
      setModificationData({ ...initialEntryData, comment: '' });
      await checkPendingRequests();
    } catch (error) {
      console.error('Error creating modification request:', error);
      showMessage('error', error.message || 'Failed to create modification request');
    } finally {
      setLoading(false);
    }
  };

  const loadEntriesForWeek = async (showLoading = true) => {
    if (!user) return [];

    try {
      if (showLoading) {
        setLoading(true);
      }
      const weekStartStr = formatDate(currentWeekStart);
      const data = await api.getPointageEntriesForWeek(weekStartStr);
      
      const rawEntries = data.entries || data || [];
      const formattedEntries = rawEntries.map(entry => ({
        id: entry.id,
        date_pointage: normalizeDateString(entry.date_pointage),
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
      
      // Replace entries with server data, but keep optimistic entries that aren't in server response
      // This handles cases where the entry might be in a different week due to calculation differences
      setEntries(prev => {
        const serverIds = new Set(formattedEntries.map(e => e.id));
        // Keep optimistic entries that aren't in server response (they might be in a different week)
        const optimisticEntries = prev.filter(e => e.id && !serverIds.has(e.id));
        // Server entries take precedence, then add any optimistic entries not yet confirmed
        return [...formattedEntries, ...optimisticEntries];
      });
      return formattedEntries;
    } catch (error) {
      console.error('Error loading entries:', error);
      setEntries([]);
      return [];
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };


  const validateEntry = (entryData) => {
    const requiredFields = {
      'clef_imputation': "Clef d'imputation",
      'libelle': 'Libellé',
      'fonction': 'Fonction',
      'date_besoin': 'Date du besoin',
      'heures_theoriques': "Nbre d'heures théoriques",
      'heures_passees': 'Heures passées',
    };

    const missingFields = [];
    for (const [field, label] of Object.entries(requiredFields)) {
      if (!entryData[field] || entryData[field].trim() === '') {
        missingFields.push(label);
      }
    }

    if (missingFields.length > 0) {
      showMessage('error', `Please fill in all required fields: ${missingFields.join(', ')}`);
      return false;
    }

    return true;
  };

  const handleSaveEntry = async (entryId) => {
    if (!user || selectedDay === null) return;

    const entryData = editingEntries[entryId];
    if (!entryData) return;

    if (!validateEntry(entryData)) {
      return;
    }

    setLoading(true);
    try {
      const dayDate = weekDays[selectedDay - 1];
      const dayDateStr = formatDate(dayDate);

      let savedEntryId = null;
      
      if (entryId.startsWith('new-')) {
        // Create new entry
        const response = await api.createPointageEntry({
          date_pointage: dayDateStr,
          clef_imputation: entryData.clef_imputation,
          libelle: entryData.libelle,
          fonction: entryData.fonction,
          date_besoin: entryData.date_besoin,
          heures_theoriques: entryData.heures_theoriques,
          heures_passees: entryData.heures_passees,
          commentaires: entryData.commentaires,
        });
        showMessage('success', 'Entry saved successfully');
        
        savedEntryId = response.id;
        console.log('Current week start:', formatDate(currentWeekStart));
        console.log('Date pointage sent:', dayDateStr);
        console.log('Saved entry ID:', savedEntryId);
        
        // Remove the "new-" entry from editingEntries immediately
        setEditingEntries(prev => {
          const newEditingEntries = { ...prev };
          delete newEditingEntries[entryId];
          return newEditingEntries;
        });
        
        // Optimistically add the entry to the state immediately
        // The useEffect will handle adding it to editingEntries when entries changes
        const optimisticEntry = {
          id: response.id,
          date_pointage: dayDateStr,
          clef_imputation: entryData.clef_imputation,
          libelle: entryData.libelle,
          fonction: entryData.fonction,
          date_besoin: entryData.date_besoin,
          heures_theoriques: entryData.heures_theoriques,
          heures_passees: entryData.heures_passees,
          commentaires: entryData.commentaires,
          status: 'draft',
        };
        setEntries(prev => {
          // Check if entry already exists (avoid duplicates)
          const exists = prev.some(e => e.id === response.id);
          if (exists) return prev;
          return [...prev, optimisticEntry];
        });
        
        // Select the new entry
        setSelectedEntryId(response.id);
      } else {
        // Update existing entry
        await api.updatePointageEntry(entryId, {
          clef_imputation: entryData.clef_imputation,
          libelle: entryData.libelle,
          fonction: entryData.fonction,
          date_besoin: entryData.date_besoin,
          heures_theoriques: entryData.heures_theoriques,
          heures_passees: entryData.heures_passees,
          commentaires: entryData.commentaires,
        });
        showMessage('success', 'Entry updated successfully');
      }

      // Reload entries to get the updated data from the server
      // Don't show loading spinner since we're already in a loading state
      const reloadedEntries = await loadEntriesForWeek(false);
      
      console.log('Reloaded entries after save:', reloadedEntries);
      console.log('Selected day:', selectedDay);
      if (entryId.startsWith('new-')) {
        console.log('Looking for entry with date:', dayDateStr);
      }
      
      // If no entries returned, wait a bit and retry (database might need time to commit)
      if (entryId.startsWith('new-') && (!reloadedEntries || reloadedEntries.length === 0)) {
        console.log('No entries found, retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 500));
        const retryEntries = await loadEntriesForWeek(false);
        console.log('Retry entries:', retryEntries);
        if (retryEntries && retryEntries.length > 0) {
          return; // Entries will be set by loadEntriesForWeek
        }
      }
      
      // After reload, the useEffect will automatically update editingEntries
      // Just ensure the entry is selected if it was saved
      if (entryId.startsWith('new-') && savedEntryId) {
        // The entry should be in reloadedEntries or in the optimistic entries
        // The useEffect will handle updating editingEntries when entries changes
        setSelectedEntryId(savedEntryId);
      }
    } catch (error) {
      console.error('Error saving entry:', error);
      showMessage('error', error.message || 'Failed to save entry');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitEntry = async (entryId) => {
    if (!entryId || entryId.startsWith('new-')) return;

    setLoading(true);
    try {
      await api.submitPointageEntry(entryId);
      showMessage('success', 'Entry submitted and locked');
      await loadEntriesForWeek();
    } catch (error) {
      console.error('Error submitting entry:', error);
      showMessage('error', error.message || 'Failed to submit entry');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEntry = async (entryId) => {
    if (entryId.startsWith('new-')) {
      // Remove new entry from editing state
      const newEditingEntries = { ...editingEntries };
      delete newEditingEntries[entryId];
      setEditingEntries(newEditingEntries);
      return;
    }

    if (!window.confirm('Are you sure you want to delete this entry?')) {
      return;
    }

    setLoading(true);
    try {
      await api.deletePointageEntry(entryId);
      showMessage('success', 'Entry deleted successfully');
      await loadEntriesForWeek();
    } catch (error) {
      console.error('Error deleting entry:', error);
      showMessage('error', error.message || 'Failed to delete entry');
    } finally {
      setLoading(false);
    }
  };

  const handleAddNewEntry = () => {
    if (!selectedDay) return;
    
    const newId = `new-${Date.now()}`;
    const dayDate = weekDays[selectedDay - 1];
    const dayDateStr = formatDate(dayDate);
    
    setEditingEntries({
      ...editingEntries,
      [newId]: {
        ...initialEntryData,
        date_pointage: dayDateStr,
      },
    });
  };

  const updateEditingEntry = (entryId, field, value) => {
    setEditingEntries({
      ...editingEntries,
      [entryId]: {
        ...editingEntries[entryId],
        [field]: value,
      },
    });
  };

  const navigateWeek = (direction) => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(getWeekStartDate(newDate));
    setSelectedDay(null);
  };

  const dayEntries = getEntriesForSelectedDay();
  // Combine existing entries with new entries being created
  const allEntries = [
    ...dayEntries,
    ...Object.keys(editingEntries)
      .filter(id => id.startsWith('new-'))
      .map(id => ({
        id,
        date_pointage: editingEntries[id].date_pointage || formatDate(weekDays[selectedDay - 1]),
        clef_imputation: editingEntries[id].clef_imputation,
        libelle: editingEntries[id].libelle,
        fonction: editingEntries[id].fonction,
        date_besoin: editingEntries[id].date_besoin,
        heures_theoriques: editingEntries[id].heures_theoriques,
        heures_passees: editingEntries[id].heures_passees,
        commentaires: editingEntries[id].commentaires,
        status: 'draft',
      })),
  ];

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col">
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-2">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-slate-700" />
            </button>

            <div className="flex flex-col items-center">
              <h2 className="text-base font-semibold text-slate-900">
                {formatWeekRange(currentWeekStart)}
              </h2>
              <span className="text-xs font-bold text-slate-600 mt-0.5">
                {getWeekCstr(currentWeekStart)}
              </span>
            </div>

            <button
              onClick={() => navigateWeek('next')}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-slate-700" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-shrink-0">
            <WeeklyCalendar
              weekDays={weekDays}
              entries={entries}
              selectedDay={selectedDay}
              selectedEntryId={selectedEntryId}
              onSelectDay={setSelectedDay}
              onSelectEntry={setSelectedEntryId}
            />
          </div>
          
          {selectedDay && (
            <div className="bg-white border-t border-slate-200 flex-1 flex flex-col overflow-hidden">
              <div className="p-6 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900">
                  Entries for {weekDays[selectedDay - 1].toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                </h3>
                <button
                  onClick={handleAddNewEntry}
                  disabled={loading || lcLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Entry
                </button>
              </div>

              {allEntries.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  No entries yet. Click "Add Entry" to create one.
                </div>
              ) : (
                <div ref={tableScrollContainerRef} className="flex-1 overflow-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Clef d'imputation *
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Libellé *
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Fonction *
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Date du besoin *
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Heures théoriques *
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Heures passées *
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider border-r border-slate-200">
                          Commentaires
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {allEntries.map((entry) => {
                        const entryData = editingEntries[entry.id] || entry;
                        const isSubmitted = entry.status === 'submitted';
                        const isNew = entry.id.startsWith('new-');
                        const isSelected = selectedEntryId === entry.id;
                        
                        return (
                          <tr
                            key={entry.id}
                            data-entry-id={entry.id}
                            onClick={() => setSelectedEntryId(entry.id)}
                            className={`cursor-pointer hover:bg-slate-50 ${isSubmitted ? 'bg-green-50' : ''} ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : ''}`}
                          >
                            {/* Clef d'imputation */}
                            <td className="px-4 py-3 border-r border-slate-200">
                              {isSubmitted ? (
                                <div className="text-sm text-slate-900">{entryData.clef_imputation || '-'}</div>
                              ) : (
                                <div className="min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                                  <AutocompleteInput
                                    label=""
                                    value={entryData.clef_imputation}
                                    onChange={(value) => updateEditingEntry(entry.id, 'clef_imputation', value)}
                                    options={clefImputationOptions}
                                    disabled={loading || lcLoading}
                                    placeholder="Select..."
                                  />
                                </div>
                              )}
                            </td>

                            {/* Libellé */}
                            <td className="px-4 py-3 border-r border-slate-200">
                              {isSubmitted ? (
                                <div className="text-sm text-slate-900">{entryData.libelle || '-'}</div>
                              ) : (
                                <div className="min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                                  <AutocompleteInput
                                    label=""
                                    value={entryData.libelle}
                                    onChange={(value) => updateEditingEntry(entry.id, 'libelle', value)}
                                    options={libelleOptions}
                                    disabled={loading || lcLoading}
                                    placeholder="Select..."
                                  />
                                </div>
                              )}
                            </td>

                            {/* Fonction */}
                            <td className="px-4 py-3 border-r border-slate-200">
                              {isSubmitted ? (
                                <div className="text-sm text-slate-900">{entryData.fonction || '-'}</div>
                              ) : (
                                <div className="min-w-[150px]" onClick={(e) => e.stopPropagation()}>
                                  <AutocompleteInput
                                    label=""
                                    value={entryData.fonction}
                                    onChange={(value) => updateEditingEntry(entry.id, 'fonction', value)}
                                    options={fonctionOptions}
                                    disabled={loading || lcLoading}
                                    placeholder="Select..."
                                  />
                                </div>
                              )}
                            </td>

                            {/* Date du besoin */}
                            <td className="px-4 py-3 border-r border-slate-200">
                              {isSubmitted ? (
                                <div className="text-sm text-slate-900">{entryData.date_besoin || '-'}</div>
                              ) : (
                                <input
                                  type="date"
                                  value={entryData.date_besoin || ''}
                                  onChange={(e) => updateEditingEntry(entry.id, 'date_besoin', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={loading}
                                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                                />
                              )}
                            </td>

                            {/* Heures théoriques */}
                            <td className="px-4 py-3 border-r border-slate-200">
                              {isSubmitted ? (
                                <div className="text-sm text-slate-900">{entryData.heures_theoriques || '-'}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={entryData.heures_theoriques || ''}
                                  onChange={(e) => updateEditingEntry(entry.id, 'heures_theoriques', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={loading}
                                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                                  placeholder="Enter hours..."
                                />
                              )}
                            </td>

                            {/* Heures passées */}
                            <td className="px-4 py-3 border-r border-slate-200">
                              {isSubmitted ? (
                                <div className="text-sm text-slate-900">{entryData.heures_passees || '-'}</div>
                              ) : (
                                <input
                                  type="text"
                                  value={entryData.heures_passees || ''}
                                  onChange={(e) => updateEditingEntry(entry.id, 'heures_passees', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={loading}
                                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                                  placeholder="Enter hours..."
                                />
                              )}
                            </td>

                            {/* Commentaires */}
                            <td className="px-4 py-3 border-r border-slate-200">
                              {isSubmitted ? (
                                <div className="text-sm text-slate-900 max-w-xs truncate" title={entryData.commentaires || ''}>
                                  {entryData.commentaires || '-'}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={entryData.commentaires || ''}
                                  onChange={(e) => updateEditingEntry(entry.id, 'commentaires', e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  disabled={loading}
                                  className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                                  placeholder="Enter comment..."
                                />
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-2">
                                {!isSubmitted && (
                                  <>
                                    <button
                                      onClick={() => handleSaveEntry(entry.id)}
                                      disabled={loading}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title={isNew ? 'Save' : 'Update'}
                                    >
                                      <Save className="w-4 h-4" />
                                    </button>
                                    {!isNew && (
                                      <button
                                        onClick={() => handleSubmitEntry(entry.id)}
                                        disabled={loading}
                                        className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Submit"
                                      >
                                        <Send className="w-4 h-4" />
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteEntry(entry.id)}
                                      disabled={loading}
                                      className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                                {isSubmitted && (
                                  <div className="flex items-center gap-2">
                                    {pendingRequests.has(entry.id) ? (
                                      <div className="flex items-center gap-1 text-yellow-600" title="Modification request pending">
                                        <Clock className="w-4 h-4" />
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => handleRequestModification(entry.id)}
                                        disabled={loading}
                                        className="p-1.5 text-orange-600 hover:bg-orange-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        title="Request Modification"
                                      >
                                        <Edit className="w-4 h-4" />
                                      </button>
                                    )}
                                    <div className="flex items-center gap-1 text-green-600" title="Submitted">
                                      <Lock className="w-4 h-4" />
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modification Request Modal */}
      {showModificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">
                Request Modification
              </h3>
              <button
                onClick={() => {
                  setShowModificationModal(false);
                  setModificationEntryId(null);
                  setModificationData({ ...initialEntryData, comment: '' });
                }}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-slate-600 mb-4">
                Update the fields you want to modify. Leave unchanged fields as they are.
              </p>

              {/* Clef d'imputation */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Clef d'imputation
                </label>
                <AutocompleteInput
                  label=""
                  value={modificationData.clef_imputation}
                  onChange={(value) => setModificationData({ ...modificationData, clef_imputation: value })}
                  options={clefImputationOptions}
                  disabled={loading || lcLoading}
                  placeholder="Select..."
                />
              </div>

              {/* Libellé */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Libellé
                </label>
                <AutocompleteInput
                  label=""
                  value={modificationData.libelle}
                  onChange={(value) => setModificationData({ ...modificationData, libelle: value })}
                  options={libelleOptions}
                  disabled={loading || lcLoading}
                  placeholder="Select..."
                />
              </div>

              {/* Fonction */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Fonction
                </label>
                <AutocompleteInput
                  label=""
                  value={modificationData.fonction}
                  onChange={(value) => setModificationData({ ...modificationData, fonction: value })}
                  options={fonctionOptions}
                  disabled={loading || lcLoading}
                  placeholder="Select..."
                />
              </div>

              {/* Date du besoin */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date du besoin
                </label>
                <input
                  type="date"
                  value={modificationData.date_besoin || ''}
                  onChange={(e) => setModificationData({ ...modificationData, date_besoin: e.target.value })}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                />
              </div>

              {/* Heures théoriques */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Heures théoriques
                </label>
                <input
                  type="text"
                  value={modificationData.heures_theoriques || ''}
                  onChange={(e) => setModificationData({ ...modificationData, heures_theoriques: e.target.value })}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                  placeholder="Enter hours..."
                />
              </div>

              {/* Heures passées */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Heures passées
                </label>
                <input
                  type="text"
                  value={modificationData.heures_passees || ''}
                  onChange={(e) => setModificationData({ ...modificationData, heures_passees: e.target.value })}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                  placeholder="Enter hours..."
                />
              </div>

              {/* Commentaires */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Commentaires
                </label>
                <input
                  type="text"
                  value={modificationData.commentaires || ''}
                  onChange={(e) => setModificationData({ ...modificationData, commentaires: e.target.value })}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                  placeholder="Enter comment..."
                />
              </div>

              {/* Request Comment */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Request Comment (Optional)
                </label>
                <textarea
                  value={modificationData.comment || ''}
                  onChange={(e) => setModificationData({ ...modificationData, comment: e.target.value })}
                  rows={3}
                  disabled={loading}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
                  placeholder="Explain why you need this modification..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModificationModal(false);
                  setModificationEntryId(null);
                  setModificationData({ ...initialEntryData, comment: '' });
                }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitModificationRequest}
                disabled={loading}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
