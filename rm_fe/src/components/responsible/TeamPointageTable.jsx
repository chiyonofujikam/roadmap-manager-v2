import { useState, useEffect, useMemo, Fragment } from 'react';
import { Download } from 'lucide-react';
import { api } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';
import * as XLSX from 'xlsx';

export function TeamPointageTable() {
  const { showMessage } = useNotification();
  const [allEntries, setAllEntries] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState(new Set());

  // Filter states
  const [filterUser, setFilterUser] = useState('');
  const [filterCstrWeek, setFilterCstrWeek] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterClefImputation, setFilterClefImputation] = useState('');
  const [filterLibelle, setFilterLibelle] = useState('');
  const [filterFonction, setFilterFonction] = useState('');
  const [filterDateBesoin, setFilterDateBesoin] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  useEffect(() => {
    loadTeamEntries();
    loadTeamMembers();
  }, []);

  const loadTeamMembers = async () => {
    try {
      const data = await api.getTeamMembers();
      setTeamMembers(data.members || []);
    } catch (err) {
      console.error('Error loading team members:', err);
    }
  };

  const loadTeamEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all entries with a high limit to get all data for filters
      const data = await api.getTeamPointageEntries(0, 10000);
      setAllEntries(data.entries || []);
    } catch (err) {
      console.error('❌ Error loading team pointage entries:', err);
      setError(err.message || 'Failed to load team pointage entries');
      setAllEntries([]);
    } finally {
      setLoading(false);
    }
  };

  // Get unique CSTR week values (already in SXXYY format)
  const uniqueCstrWeeks = useMemo(() => {
    const weeks = new Set();
    allEntries.forEach(entry => {
      if (entry.cstr_semaine) {
        weeks.add(entry.cstr_semaine);
      }
    });
    return Array.from(weeks).sort();
  }, [allEntries]);

  // Get unique values for other filter columns
  const uniqueValues = useMemo(() => {
    return {
      clefImputation: [...new Set(allEntries.map(e => e.clef_imputation).filter(Boolean))].sort(),
      libelle: [...new Set(allEntries.map(e => e.libelle).filter(Boolean))].sort(),
      fonction: [...new Set(allEntries.map(e => e.fonction).filter(Boolean))].sort(),
      status: [...new Set(allEntries.map(e => e.status).filter(Boolean))].sort(),
    };
  }, [allEntries]);

  // Calculate total hours per week per user
  const weeklyHoursPerUser = useMemo(() => {
    const hoursMap = new Map();
    
    allEntries.forEach(entry => {
      if (entry.cstr_semaine && entry.user_name && entry.heures_passees) {
        const key = `${entry.cstr_semaine}_${entry.user_name}`;
        const currentHours = hoursMap.get(key) || 0;
        const heuresPassees = parseFloat(entry.heures_passees) || 0;
        hoursMap.set(key, currentHours + heuresPassees);
      }
    });
    
    return hoursMap;
  }, [allEntries]);

  // Check if a week has exactly 35 hours for a user
  const getWeekStatus = (cstrSemaine, userName) => {
    if (!cstrSemaine || !userName) return null;
    const key = `${cstrSemaine}_${userName}`;
    const totalHours = weeklyHoursPerUser.get(key) || 0;
    return totalHours === 35 ? 'complete' : 'incomplete';
  };

  // Format date string helper function
  const formatDateString = (dateStr) => {
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
  };

  // Filter entries based on all filter criteria
  const filteredEntries = useMemo(() => {
    return allEntries.filter(entry => {
      // Filter by user (name)
      if (filterUser && entry.user_name !== filterUser) {
        return false;
      }

      // Filter by CSTR week
      if (filterCstrWeek && entry.cstr_semaine !== filterCstrWeek) {
        return false;
      }

      // Filter by date
      if (filterDate) {
        const entryDate = formatDateString(entry.date_pointage);
        if (!entryDate.includes(filterDate)) {
          return false;
        }
      }

      // Filter by clef_imputation
      if (filterClefImputation && entry.clef_imputation !== filterClefImputation) {
        return false;
      }

      // Filter by libelle
      if (filterLibelle && entry.libelle !== filterLibelle) {
        return false;
      }

      // Filter by fonction
      if (filterFonction && entry.fonction !== filterFonction) {
        return false;
      }

      // Filter by date_besoin
      if (filterDateBesoin) {
        const entryDateBesoin = formatDateString(entry.date_besoin);
        if (!entryDateBesoin.includes(filterDateBesoin)) {
          return false;
        }
      }

      // Filter by status
      if (filterStatus && entry.status !== filterStatus) {
        return false;
      }

      return true;
    });
  }, [
    allEntries,
    filterUser,
    filterCstrWeek,
    filterDate,
    filterClefImputation,
    filterLibelle,
    filterFonction,
    filterDateBesoin,
    filterStatus,
  ]);

  // Group filtered entries by collaborator
  const groupedEntries = useMemo(() => {
    const groups = new Map();
    
    filteredEntries.forEach(entry => {
      const userName = entry.user_name || 'Unknown';
      if (!groups.has(userName)) {
        groups.set(userName, []);
      }
      groups.get(userName).push(entry);
    });
    
    // Convert to array and sort by user name
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredEntries]);

  const handleStatusChange = async (entryId, newStatus) => {
    try {
      setUpdatingStatus(prev => new Set(prev).add(entryId));
      await api.updatePointageEntryStatus(entryId, newStatus);
      showMessage('success', `Entry status updated to ${newStatus}`);
      
      // Update the entry in local state
      setAllEntries(prev => prev.map(entry => 
        entry.id === entryId 
          ? { ...entry, status: newStatus }
          : entry
      ));
    } catch (err) {
      console.error('Error updating entry status:', err);
      showMessage('error', err.message || 'Failed to update entry status');
    } finally {
      setUpdatingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(entryId);
        return newSet;
      });
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', className: 'bg-yellow-100 text-yellow-800' },
      submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-800' },
      validated: { label: 'Validated', className: 'bg-green-100 text-green-800' },
      rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800' },
    };
    
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        {config.label}
      </span>
    );
  };

  const handleExportToExcel = () => {
    // Prepare data for Excel export
    const excelData = filteredEntries.map(entry => ({
      'User': entry.user_name,
      'Date': formatDateString(entry.date_pointage),
      'CSTR Week': entry.cstr_semaine || '',
      'Clef d\'imputation': entry.clef_imputation || '',
      'Libellé': entry.libelle || '',
      'Fonction': entry.fonction || '',
      'Date besoin': formatDateString(entry.date_besoin) || '',
      'H. théoriques': entry.heures_theoriques || '',
      'H. passées': entry.heures_passees || '',
      'Status': entry.status || '',
      'Commentaires': entry.commentaires || '',
    }));

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Team Pointage Entries');

    // Set column widths
    const colWidths = [
      { wch: 20 }, // User
      { wch: 12 }, // Date
      { wch: 12 }, // CSTR Week
      { wch: 20 }, // Clef d'imputation
      { wch: 15 }, // Libellé
      { wch: 12 }, // Fonction
      { wch: 12 }, // Date besoin
      { wch: 15 }, // H. théoriques
      { wch: 15 }, // H. passées
      { wch: 12 }, // Status
      { wch: 30 }, // Commentaires
    ];
    ws['!cols'] = colWidths;

    // Generate filename with current date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `team-pointage-entries-${dateStr}.xlsx`;

    // Download file
    XLSX.writeFile(wb, filename);
  };

  const clearFilters = () => {
    setFilterUser('');
    setFilterCstrWeek('');
    setFilterDate('');
    setFilterClefImputation('');
    setFilterLibelle('');
    setFilterFonction('');
    setFilterDateBesoin('');
    setFilterStatus('');
  };

  const hasActiveFilters = filterUser || filterCstrWeek || filterDate || 
    filterClefImputation || filterLibelle || filterFonction || 
    filterDateBesoin || filterStatus;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading team pointage entries...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p className="text-red-700">Error: {error}</p>
        <button
          onClick={loadTeamEntries}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (allEntries.length === 0) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-8 text-center">
        <p className="text-slate-600 text-lg mb-2">No pointage entries found</p>
        <p className="text-slate-500 text-sm">
          Team members haven't created any pointage entries yet.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Team Pointage Entries
          </h3>
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-600">
              Total: <span className="font-medium text-slate-900">{filteredEntries.length}</span> entries
              {hasActiveFilters && (
                <span className="ml-2 text-blue-600">
                  (filtered from {allEntries.length})
                </span>
              )}
            </div>
            <button
              onClick={handleExportToExcel}
              disabled={filteredEntries.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download as Excel
            </button>
          </div>
        </div>

        {/* Filters Section */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {/* User Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              User
            </label>
            <select
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Users</option>
              {teamMembers.map((member) => (
                <option key={member.id} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          {/* CSTR Week Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              CSTR Week
            </label>
            <select
              value={filterCstrWeek}
              onChange={(e) => setFilterCstrWeek(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Weeks</option>
              {uniqueCstrWeeks.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Date
            </label>
            <input
              type="text"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Clef d'imputation Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Clef d'imputation
            </label>
            <select
              value={filterClefImputation}
              onChange={(e) => setFilterClefImputation(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              {uniqueValues.clefImputation.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          {/* Libellé Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Libellé
            </label>
            <select
              value={filterLibelle}
              onChange={(e) => setFilterLibelle(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              {uniqueValues.libelle.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          {/* Fonction Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Fonction
            </label>
            <select
              value={filterFonction}
              onChange={(e) => setFilterFonction(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              {uniqueValues.fonction.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>

          {/* Date besoin Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Date besoin
            </label>
            <input
              type="text"
              value={filterDateBesoin}
              onChange={(e) => setFilterDateBesoin(e.target.value)}
              placeholder="DD/MM/YYYY"
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All</option>
              {uniqueValues.status.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div className="mt-3">
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                User
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Clef d'imputation
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Libellé
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Fonction
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Date besoin
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                H. théoriques
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                H. passées
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Commentaires
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {groupedEntries.length === 0 ? (
              <tr>
                <td colSpan="10" className="px-4 py-8 text-center text-slate-500">
                  No entries match the current filters.
                </td>
              </tr>
            ) : (
              groupedEntries.map(([userName, userEntries]) => (
                <Fragment key={userName}>
                  {/* Collaborator Header Row */}
                  <tr className="bg-slate-100 border-t-2 border-slate-300">
                    <td colSpan="10" className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">
                            {userName}
                          </span>
                          <span className="text-xs text-slate-600">
                            ({userEntries.length} {userEntries.length === 1 ? 'entry' : 'entries'})
                          </span>
                        </div>
                        <div className="text-xs text-slate-600">
                          Total Hours: {userEntries.reduce((sum, e) => sum + (parseFloat(e.heures_passees) || 0), 0).toFixed(1)}h
                        </div>
                      </div>
                    </td>
                  </tr>
                  {/* Collaborator Entries */}
                  {userEntries.map((entry) => {
                    const weekStatus = getWeekStatus(entry.cstr_semaine, entry.user_name);
                    const rowBgColor = weekStatus === 'complete' 
                      ? 'bg-green-50 hover:bg-green-100' 
                      : weekStatus === 'incomplete'
                      ? 'bg-orange-50 hover:bg-orange-100'
                      : 'hover:bg-slate-50';
                    
                    return (
                    <tr key={entry.id} className={`${rowBgColor} transition-colors`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">
                          {entry.user_name}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                        {formatDateString(entry.date_pointage)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {entry.clef_imputation || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {entry.libelle || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {entry.fonction || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                        {formatDateString(entry.date_besoin) || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {entry.heures_theoriques || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-900">
                        {entry.heures_passees || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <select
                          value={entry.status || 'draft'}
                          onChange={(e) => handleStatusChange(entry.id, e.target.value)}
                          disabled={updatingStatus.has(entry.id)}
                          className={`px-2 py-1 text-xs font-medium rounded-full border-0 focus:ring-2 focus:ring-blue-500 ${
                            entry.status === 'draft' ? 'bg-yellow-100 text-yellow-800' :
                            entry.status === 'submitted' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          } ${updatingStatus.has(entry.id) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <option value="draft">Draft</option>
                          <option value="submitted">Submitted</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                        {entry.commentaires || '-'}
                      </td>
                    </tr>
                    );
                  })}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
