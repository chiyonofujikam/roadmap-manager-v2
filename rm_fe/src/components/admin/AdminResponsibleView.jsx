import { LogOut } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { TeamPointageTable } from '../responsible/TeamPointageTable';

export function AdminResponsibleView() {
  const { user, signOut } = useAuth();

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
          {/* Team Pointage Table */}
          <div className="mb-6">
            <TeamPointageTable />
          </div>
        </div>
      </main>
    </div>
  );
}
