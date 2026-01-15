import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useNotification } from '../../contexts/NotificationContext';

export function AddRemoveUsers() {
  const { showMessage } = useNotification();
  const [users, setUsers] = useState([]);
  const [responsibles, setResponsibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null); // { userId, field }
  const [editValue, setEditValue] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUser, setNewUser] = useState({
    name: '',
    email: '',
    user_type: 'collaborator',
    status: 'active',
    responsible_id: '',
  });

  useEffect(() => {
    loadUsers();
    loadResponsibles();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await api.getAllUsers();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error loading users:', err);
      showMessage('error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadResponsibles = async () => {
    try {
      const data = await api.getAllUsers();
      // Filter to get only responsibles
      const responsiblesList = (data.users || []).filter(u => u.user_type === 'responsible');
      setResponsibles(responsiblesList);
    } catch (err) {
      console.error('Error loading responsibles:', err);
    }
  };

  const handleCellClick = (userId, field, currentValue) => {
    setEditingUser({ userId, field });
    setEditValue(currentValue || '');
  };

  const handleCellBlur = async () => {
    if (!editingUser) return;

    const { userId, field } = editingUser;
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) return;

    const currentValue = currentUser[field] || '';
    const newValue = editValue || '';

    // Only update if value changed
    if (newValue !== currentValue) {
      try {
        const updateData = { [field]: newValue || null };
        await api.updateUser(userId, updateData);
        
        // Reload users and responsibles to get updated data
        await loadUsers();
        await loadResponsibles();
        
        showMessage('success', 'User updated successfully');
      } catch (err) {
        console.error('Error updating user:', err);
        showMessage('error', err.message || 'Failed to update user');
        // Revert to original value on error
        setEditValue(currentValue);
      }
    }

    setEditingUser(null);
    setEditValue('');
  };

  const handleCellKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    } else if (e.key === 'Escape') {
      if (editingUser) {
        const { userId, field } = editingUser;
        const currentUser = users.find(u => u.id === userId);
        if (currentUser) {
          setEditValue(currentUser[field] || '');
        }
      }
      setEditingUser(null);
      setEditValue('');
    }
  };

  const handleAddUser = async () => {
    if (!newUser.name.trim()) {
      showMessage('error', 'Name is required');
      return;
    }

    if (newUser.user_type === 'collaborator' && !newUser.responsible_id) {
      showMessage('error', 'Please select a responsible for the collaborator');
      return;
    }

    try {
      const userData = { ...newUser };
      // Only include responsible_id if user_type is collaborator
      if (userData.user_type !== 'collaborator') {
        delete userData.responsible_id;
      }
      await api.createUser(userData);
      showMessage('success', 'User created successfully');
      setShowAddForm(false);
      setNewUser({
        name: '',
        email: '',
        user_type: 'collaborator',
        status: 'active',
        responsible_id: '',
      });
      await loadUsers();
      await loadResponsibles();
    } catch (err) {
      console.error('Error creating user:', err);
      showMessage('error', err.message || 'Failed to create user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }

    try {
      // For now, we'll just update status to inactive
      // In a full implementation, you might want a delete endpoint
      await api.updateUser(userId, { status: 'inactive' });
      showMessage('success', 'User deactivated successfully');
      await loadUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      showMessage('error', err.message || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Add/Remove Collaborators and Responsibles</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add User
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="User name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">User Type</label>
              <select
                value={newUser.user_type}
                onChange={(e) => setNewUser({ ...newUser, user_type: e.target.value, responsible_id: e.target.value === 'collaborator' ? newUser.responsible_id : '' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="collaborator">Collaborator</option>
                <option value="responsible">Responsible</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                value={newUser.status}
                onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            {newUser.user_type === 'collaborator' && (
              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsible *</label>
                <select
                  value={newUser.responsible_id || ''}
                  onChange={(e) => setNewUser({ ...newUser, responsible_id: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a responsible...</option>
                  {responsibles.map((responsible) => (
                    <option key={responsible.id} value={responsible.id}>
                      {responsible.name} {responsible.email ? `(${responsible.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleAddUser}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create User
            </button>
            <button
              onClick={() => {
                setShowAddForm(false);
                setNewUser({
                  name: '',
                  email: '',
                  user_type: 'collaborator',
                  status: 'active',
                  responsible_id: '',
                });
              }}
              className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                User Type
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Responsible
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {users.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-4 py-8 text-center text-slate-500">
                  No users found
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    {editingUser?.userId === user.id && editingUser?.field === 'status' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    ) : (
                      <div
                        onClick={() => handleCellClick(user.id, 'status', user.status)}
                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded ${
                            user.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.status || 'active'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingUser?.userId === user.id && editingUser?.field === 'user_type' ? (
                      <select
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      >
                        <option value="collaborator">Collaborator</option>
                        <option value="responsible">Responsible</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <div
                        onClick={() => handleCellClick(user.id, 'user_type', user.user_type)}
                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        {user.user_type || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingUser?.userId === user.id && editingUser?.field === 'name' ? (
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
                        onClick={() => handleCellClick(user.id, 'name', user.name)}
                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        {user.name || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {editingUser?.userId === user.id && editingUser?.field === 'email' ? (
                      <input
                        type="email"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={handleCellBlur}
                        onKeyDown={handleCellKeyDown}
                        className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                      />
                    ) : (
                      <div
                        onClick={() => handleCellClick(user.id, 'email', user.email)}
                        className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                      >
                        {user.email || '-'}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.user_type === 'collaborator' ? (
                      editingUser?.userId === user.id && editingUser?.field === 'responsible_id' ? (
                        <select
                          value={editValue || ''}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleCellBlur}
                          onKeyDown={handleCellKeyDown}
                          className="w-full px-2 py-1 border border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        >
                          <option value="">No responsible</option>
                          {responsibles.map((responsible) => (
                            <option key={responsible.id} value={responsible.id}>
                              {responsible.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div
                          onClick={() => handleCellClick(user.id, 'responsible_id', user.responsible_id || '')}
                          className="cursor-pointer hover:bg-blue-50 px-2 py-1 rounded transition-colors"
                        >
                          {user.responsible_id ? (
                            (() => {
                              const responsible = responsibles.find(r => r.id === user.responsible_id);
                              return responsible ? responsible.name : user.responsible_id;
                            })()
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </div>
                      )
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteUser(user.id)}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      title="Delete user"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
