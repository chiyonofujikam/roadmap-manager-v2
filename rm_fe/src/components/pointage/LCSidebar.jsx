import { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { AutocompleteInput } from '../ui/AutocompleteInput';

export function LCSidebar({ formData, onChange, disabled }) {
  const [clefImputationOptions, setClefImputationOptions] = useState([]);
  const [libelleOptions, setLibelleOptions] = useState([]);
  const [fonctionOptions, setFonctionOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch LC options from the API
      const data = await api.getLCOptions();
      
      // Set options for each field
      setClefImputationOptions(data.clef_imputation || []);
      setLibelleOptions(data.libelle || []);
      setFonctionOptions(data.fonction || []);
      
      console.log('✅ Loaded LC options from database:', {
        clef_imputation: data.clef_imputation?.length || 0,
        libelle: data.libelle?.length || 0,
        fonction: data.fonction?.length || 0,
      });
    } catch (err) {
      console.error('❌ Error loading LC options:', err);
      setError(err.message || 'Failed to load LC options');
      // Set empty arrays on error
      setClefImputationOptions([]);
      setLibelleOptions([]);
      setFonctionOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  return (
    <div className="w-80 bg-white border-r border-slate-200 p-6 overflow-y-auto">
      <h2 className="text-lg font-semibold text-slate-900 mb-6">Entry Details</h2>

      {loading && (
        <div className="mb-4 text-sm text-slate-500">
          Loading LC options...
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          Error: {error}
        </div>
      )}

      <div className="space-y-4">
        <AutocompleteInput
          label="Clef d'imputation"
          value={formData.clef_imputation}
          onChange={(value) => updateField('clef_imputation', value)}
          options={clefImputationOptions}
          disabled={disabled || loading}
          placeholder={loading ? "Loading..." : "Select clef d'imputation..."}
        />

        <AutocompleteInput
          label="Libellé"
          value={formData.libelle}
          onChange={(value) => updateField('libelle', value)}
          options={libelleOptions}
          disabled={disabled || loading}
          placeholder={loading ? "Loading..." : "Select libellé..."}
        />

        <AutocompleteInput
          label="Fonction"
          value={formData.fonction}
          onChange={(value) => updateField('fonction', value)}
          options={fonctionOptions}
          disabled={disabled || loading}
          placeholder={loading ? "Loading..." : "Select fonction..."}
        />

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Date du besoin
          </label>
          <input
            type="date"
            value={formData.date_besoin}
            onChange={(e) => updateField('date_besoin', e.target.value)}
            disabled={disabled}
            placeholder="Select date..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nbre d'heures théoriques
          </label>
          <input
            type="text"
            value={formData.heures_theoriques}
            onChange={(e) => updateField('heures_theoriques', e.target.value)}
            disabled={disabled}
            placeholder="Enter heures théoriques..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Heures passées
          </label>
          <input
            type="text"
            value={formData.heures_passees}
            onChange={(e) => updateField('heures_passees', e.target.value)}
            disabled={disabled}
            placeholder="Enter heures passées..."
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Commentaires
          </label>
          <textarea
            value={formData.commentaires}
            onChange={(e) => updateField('commentaires', e.target.value)}
            disabled={disabled}
            placeholder="Enter commentaires..."
            rows={4}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100 disabled:cursor-not-allowed resize-none"
          />
        </div>
      </div>
    </div>
  );
}
