import { AuthProvider } from './contexts/AuthContext';
import { useAuth, isAdminOrResponsible } from './hooks/useAuth';
import { LoginForm } from './components/auth/LoginForm';
import { RoleBasedLayout } from './components/layouts/RoleBasedLayout';
import { PointageView } from './components/pointage/PointageView';
import { AdminResponsibleView } from './components/admin/AdminResponsibleView';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  if (isAdminOrResponsible(user)) {
    return <AdminResponsibleView />;
  }

  return (
    <RoleBasedLayout>
      <PointageView />
    </RoleBasedLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
