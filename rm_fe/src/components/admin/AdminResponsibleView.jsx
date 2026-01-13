import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { TeamPointageTable } from '../responsible/TeamPointageTable';
import { ModificationRequests } from '../responsible/ModificationRequests';
import { api } from '../../lib/api';

export function AdminResponsibleView() {
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('entries');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);

  useEffect(() => {
    loadPendingRequestsCount();
    // Poll for new requests every 30 seconds
    const interval = setInterval(loadPendingRequestsCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingRequestsCount = async () => {
    try {
      const data = await api.getModificationRequests(0, 1000);
      setPendingRequestsCount(data.requests?.filter(r => r.status === 'pending').length || 0);
    } catch (err) {
      console.error('Error loading pending requests count:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Roadmap Manager</h1>
            </div>
            <span className="px-3 py-1 bg-amber-100 text-amber-800 text-xs font-semibold rounded-full border border-amber-300">
              DEMO MODE
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">{user?.name || user?.email}</p>
              <p className="text-xs text-slate-500">{user?.user_type || 'unknown'}</p>
            </div>
            <button
              onClick={() => signOut()}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="p-4">
        <div className="max-w-7xl mx-auto">
          {/* Tabs */}
          <div className="mb-6 border-b border-slate-200">
            <nav className="flex gap-1">
              <button
                onClick={() => setActiveTab('entries')}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'entries'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Team Entries
              </button>
              <button
                onClick={() => {
                  setActiveTab('requests');
                  loadPendingRequestsCount();
                }}
                className={`px-6 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'requests'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Modification Requests
                {pendingRequestsCount > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-600 text-white text-xs font-semibold rounded-full">
                    {pendingRequestsCount}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          {activeTab === 'entries' && (
            <div className="mb-6">
              <TeamPointageTable />
            </div>
          )}
          {activeTab === 'requests' && (
            <div className="mb-6">
              <ModificationRequests />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
