import { useState, useEffect } from 'react';
import { api } from '../../lib/api';

export function TeamPointageTable() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadTeamEntries();
  }, []);

  const loadTeamEntries = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await api.getTeamPointageEntries();
      setEntries(data.entries || []);
    } catch (err) {
      console.error('❌ Error loading team pointage entries:', err);
      setError(err.message || 'Failed to load team pointage entries');
      setEntries([]);
    } finally {
      setLoading(false);
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

  if (entries.length === 0) {
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
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Team Pointage Entries
          </h3>
          <div className="text-sm text-slate-600">
            Total: <span className="font-medium text-slate-900">{entries.length}</span> entries
          </div>
        </div>
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
            {entries.map((entry) => (
              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="text-sm font-medium text-slate-900">
                    {entry.user_name}
                  </div>
                  <div className="text-xs text-slate-500">
                    {entry.user_email}
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
                  {getStatusBadge(entry.status)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600 max-w-xs truncate">
                  {entry.commentaires || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
