import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { TeamPointageTable } from '../responsible/TeamPointageTable';

export function AdminResponsibleView() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Roadmap Manager
              </h1>
              <p className="text-slate-600">
                {user?.user_type === 'admin' ? 'Administrator' : 'Responsible'} Dashboard
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {user?.user_type === 'admin' ? 'A' : 'R'}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm text-slate-600 space-y-1">
                  <div>
                    <span className="font-medium">User Type:</span>{' '}
                    <span className="text-slate-900">{user?.user_type || 'unknown'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Email:</span>{' '}
                    <span className="text-slate-900">{user?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="font-medium">Name:</span>{' '}
                    <span className="text-slate-900">{user?.name || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Team Pointage Table */}
        <div className="mb-6">
          <TeamPointageTable />
        </div>
      </div>
    </div>
  );
}
