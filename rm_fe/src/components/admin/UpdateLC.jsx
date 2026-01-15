import { useState, useEffect } from 'react';
import { Upload, Save, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';

export function UpdateLC() {
  const { showMessage } = useNotification();
  const [items, setItems] = useState([]);
  const [originalItems, setOriginalItems] = useState([]); // Store original values
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingCell, setEditingCell] = useState(null); // { itemIndex, field }
  const [editValue, setEditValue] = useState('');
  const [conditionalLists, setConditionalLists] = useState([]);
  const [activeLCName, setActiveLCName] = useState('');
  const [loadingLCs, setLoadingLCs] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadedItems, setUploadedItems] = useState([]);
  const [uploadMode, setUploadMode] = useState(null); // 'merge' or 'create'
  const [newLCName, setNewLCName] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    loadConditionalLists();
    loadActiveLC();
    loadLCItems();
  }, []);

  const loadConditionalLists = async () => {
    try {
      setLoadingLCs(true);
      const data = await api.getAllConditionalLists();
      setConditionalLists(data.lists || []);
    } catch (err) {
      console.error('Error loading conditional lists:', err);
      showMessage('error', 'Failed to load conditional lists');
    } finally {
      setLoadingLCs(false);
    }
  };

  const loadActiveLC = async () => {
    try {
      const data = await api.getActiveConditionalList();
      setActiveLCName(data.active_lc_name || 'Default LC');
    } catch (err) {
      console.error('Error loading active LC:', err);
      setActiveLCName('Default LC'); // Fallback
    }
  };

  const handleActiveLCChange = async (e) => {
    const newLCName = e.target.value;
    if (!newLCName) return;

    try {
      await api.setActiveConditionalList(newLCName);
      setActiveLCName(newLCName);
      showMessage('success', `Active conditional list set to '${newLCName}'`);
      // Reload items for the new active LC
      await loadLCItems();
    } catch (err) {
      console.error('Error setting active LC:', err);
      showMessage('error', err.message || 'Failed to set active conditional list');
    }
  };

  const loadLCItems = async () => {
    try {
      setLoading(true);
      const data = await api.getAllLCItems();
      const itemsData = data.items || [];
      setItems(itemsData);
      setOriginalItems(JSON.parse(JSON.stringify(itemsData))); // Deep copy for comparison
    } catch (err) {
      console.error('Error loading LC items:', err);
      showMessage('error', 'Failed to load LC items');
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (itemIndex, field, currentValue) => {
    setEditingCell({ itemIndex, field });
    setEditValue(currentValue || '');
  };

  const handleCellBlur = () => {
    if (!editingCell) return;

    const { itemIndex, field } = editingCell;
    const currentItem = items[itemIndex];
    
    // Update local state immediately (no API call)
    const updatedItems = [...items];
    updatedItems[itemIndex] = {
      ...updatedItems[itemIndex],
      [field]: editValue,
    };
    setItems(updatedItems);

    setEditingCell(null);
    setEditValue('');
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      if (editingCell) {
        const { itemIndex, field } = editingCell;
        const currentItem = items[editingCell.itemIndex];
        setEditValue(currentItem[field] || '');
      }
      setEditingCell(null);
      setEditValue('');
    }
  };

  const hasChanges = () => {
    // Check if there are any differences between items and originalItems
    if (items.length !== originalItems.length) return true;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const original = originalItems[i];
      if (
        item.clef_imputation !== original.clef_imputation ||
        item.libelle !== original.libelle ||
        item.fonction !== original.fonction ||
        item.is_active !== original.is_active
      ) {
        return true;
      }
    }
    return false;
  };

  const handleUpdateAll = async () => {
    if (!hasChanges()) {
      showMessage('info', 'No changes to save');
      return;
    }

    setSaving(true);
    const changes = [];
    
    // Collect all changes grouped by item index
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const original = originalItems[i];
      
      const itemChanges = {
        itemIndex: i,
        fields: {},
        is_active: null,
      };
      
      // Check each field
      if (item.clef_imputation !== original.clef_imputation) {
        itemChanges.fields.clef_imputation = item.clef_imputation;
      }
      if (item.libelle !== original.libelle) {
        itemChanges.fields.libelle = item.libelle;
      }
      if (item.fonction !== original.fonction) {
        itemChanges.fields.fonction = item.fonction;
      }
      if (item.is_active !== original.is_active) {
        itemChanges.is_active = item.is_active;
      }
      
      if (Object.keys(itemChanges.fields).length > 0 || itemChanges.is_active !== null) {
        changes.push(itemChanges);
      }
    }

    try {
      // Apply all changes
      for (const change of changes) {
        const fields = Object.keys(change.fields);
        
        // Update each field that changed
        for (const field of fields) {
          await api.updateLCItem(
            change.itemIndex,
            field,
            change.fields[field],
            change.is_active !== null ? change.is_active : undefined
          );
        }
        
        // If only is_active changed (no field changes), update it with the first field
        if (fields.length === 0 && change.is_active !== null) {
          await api.updateLCItem(
            change.itemIndex,
            'clef_imputation',
            items[change.itemIndex].clef_imputation,
            change.is_active
          );
        }
      }

      // Update originalItems to reflect saved state
      setOriginalItems(JSON.parse(JSON.stringify(items)));
      showMessage('success', `Successfully updated ${changes.length} item(s)`);
    } catch (err) {
      console.error('Error updating LC items:', err);
      showMessage('error', err.message || 'Failed to update LC items');
      // Reload items on error to revert changes
      await loadLCItems();
    } finally {
      setSaving(false);
    }
  };

  const handleExcelUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const result = await api.parseExcelFile(file);
        setUploadedItems(result.items || []);
        setShowUploadModal(true);
        setUploadMode(null);
        setNewLCName('');
      } catch (err) {
        showMessage('error', err.message || 'Failed to parse Excel file');
      }
    };
    input.click();
  };

  const handleMerge = async () => {
    if (!activeLCName) {
      showMessage('error', 'No active LC selected');
      return;
    }
    
    setUploading(true);
    try {
      const result = await api.mergeLCItems(activeLCName, uploadedItems, true);
      showMessage('success', result.message || `Merged ${result.added} items (${result.duplicates_skipped} duplicates skipped)`);
      setShowUploadModal(false);
      setUploadedItems([]);
      await loadLCItems();
      await loadConditionalLists();
    } catch (err) {
      showMessage('error', err.message || 'Failed to merge items');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateNew = async () => {
    if (!newLCName.trim()) {
      showMessage('error', 'Please enter a name for the new conditional list');
      return;
    }
    
    // Check if name already exists
    if (conditionalLists.some(lc => lc.name === newLCName.trim())) {
      showMessage('error', 'A conditional list with this name already exists');
      return;
    }
    
    setUploading(true);
    try {
      await api.createConditionalList({
        name: newLCName.trim(),
        description: `Created from Excel upload with ${uploadedItems.length} items`,
        items: uploadedItems
      });
      showMessage('success', `Created new conditional list '${newLCName}' with ${uploadedItems.length} items`);
      setShowUploadModal(false);
      setUploadedItems([]);
      setNewLCName('');
      await loadConditionalLists();
      // Optionally set as active and load items
      await api.setActiveConditionalList(newLCName.trim());
      setActiveLCName(newLCName.trim());
      await loadLCItems();
    } catch (err) {
      showMessage('error', err.message || 'Failed to create new conditional list');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-500">Loading LC items...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Update LC</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdateAll}
              disabled={!hasChanges() || saving}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                hasChanges() && !saving
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              {saving ? 'Updating...' : 'Update All Changes'}
            </button>
            <button
              onClick={handleExcelUpload}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              Upload Excel File
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-700">
            Active Conditional List:
          </label>
          <select
            value={activeLCName}
            onChange={handleActiveLCChange}
            disabled={loadingLCs}
            className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
          >
            {loadingLCs ? (
              <option>Loading...</option>
            ) : conditionalLists.length === 0 ? (
              <option>No lists available</option>
            ) : (
              conditionalLists.map((lc) => (
                <option key={lc.name} value={lc.name}>
                  {lc.name}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
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
                Active
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {items.length === 0 ? (
              <tr>
                <td colSpan="4" className="px-4 py-8 text-center text-slate-500">
                  No LC items found
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr key={index} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {editingCell?.itemIndex === index && editingCell?.field === 'clef_imputation' ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(index, 'clef_imputation', item.clef_imputation)}
                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        {item.clef_imputation || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingCell?.itemIndex === index && editingCell?.field === 'libelle' ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(index, 'libelle', item.libelle)}
                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        {item.libelle || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingCell?.itemIndex === index && editingCell?.field === 'fonction' ? (
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(index, 'fonction', item.fonction)}
                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        {item.fonction || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-1 text-xs font-semibold rounded ${
                        item.is_active
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {item.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Excel Upload - {uploadedItems.length} items found</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadedItems([]);
                  setUploadMode(null);
                  setNewLCName('');
                }}
                className="p-1 hover:bg-slate-100 rounded transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="p-6">
              {!uploadMode ? (
                <div className="space-y-4">
                  <p className="text-slate-700">Choose how to handle the uploaded items:</p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => setUploadMode('merge')}
                      className="p-4 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition-colors text-left"
                    >
                      <div className="font-semibold text-slate-900 mb-1">Merge with Current LC</div>
                      <div className="text-sm text-slate-600">
                        Add items to "{activeLCName}". Duplicates will be removed.
                      </div>
                    </button>
                    <button
                      onClick={() => setUploadMode('create')}
                      className="p-4 border-2 border-green-500 rounded-lg hover:bg-green-50 transition-colors text-left"
                    >
                      <div className="font-semibold text-slate-900 mb-1">Create New LC</div>
                      <div className="text-sm text-slate-600">
                        Create a new conditional list with these items.
                      </div>
                    </button>
                  </div>
                  
                  <div className="mt-4 p-4 bg-slate-50 rounded-lg">
                    <div className="text-sm font-medium text-slate-700 mb-2">Preview (first 5 items):</div>
                    <div className="space-y-1 text-xs">
                      {uploadedItems.slice(0, 5).map((item, idx) => (
                        <div key={idx} className="text-slate-600">
                          {item.clef_imputation} | {item.libelle} | {item.fonction}
                        </div>
                      ))}
                      {uploadedItems.length > 5 && (
                        <div className="text-slate-500 italic">... and {uploadedItems.length - 5} more</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : uploadMode === 'merge' ? (
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-900">
                      <strong>Merge with:</strong> {activeLCName}
                    </p>
                    <p className="text-xs text-blue-700 mt-1">
                      {uploadedItems.length} items will be added. Duplicate items (matching all three fields) will be skipped.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleMerge}
                      disabled={uploading}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'Merging...' : 'Merge Items'}
                    </button>
                    <button
                      onClick={() => setUploadMode(null)}
                      disabled={uploading}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      New Conditional List Name *
                    </label>
                    <input
                      type="text"
                      value={newLCName}
                      onChange={(e) => setNewLCName(e.target.value)}
                      placeholder="Enter unique name..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      disabled={uploading}
                    />
                    {newLCName && conditionalLists.some(lc => lc.name === newLCName.trim()) && (
                      <p className="mt-1 text-xs text-red-600">This name already exists</p>
                    )}
                  </div>
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-900">
                      A new conditional list will be created with {uploadedItems.length} items.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateNew}
                      disabled={uploading || !newLCName.trim() || conditionalLists.some(lc => lc.name === newLCName.trim())}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'Creating...' : 'Create New LC'}
                    </button>
                    <button
                      onClick={() => setUploadMode(null)}
                      disabled={uploading}
                      className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
