import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { useAuth, isAdminOrResponsible } from './hooks/useAuth';
import { LoginForm } from './components/auth/LoginForm';
import { RoleBasedLayout } from './components/layouts/RoleBasedLayout';
import { PointageView } from './components/pointage/PointageView';
import { AdminResponsibleView } from './components/admin/AdminResponsibleView';
import { ModificationRequests } from './components/responsible/ModificationRequests';
import { api } from './lib/api';

function CollaboratorView() {
  const [activeTab, setActiveTab] = useState('pointage');
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const { user } = useAuth();

  // Get viewed request IDs from localStorage
  const getViewedRequestIds = () => {
    try {
      const viewed = localStorage.getItem('viewed_modification_requests');
      return viewed ? new Set(JSON.parse(viewed)) : new Set();
    } catch {
      return new Set();
    }
  };

  // Mark requests as viewed
  const markRequestsAsViewed = (requestIds) => {
    try {
      const viewed = getViewedRequestIds();
      requestIds.forEach(id => viewed.add(id));
      localStorage.setItem('viewed_modification_requests', JSON.stringify(Array.from(viewed)));
    } catch (err) {
      console.error('Error saving viewed requests:', err);
    }
  };

  useEffect(() => {
    loadPendingRequestsCount();
    const interval = setInterval(loadPendingRequestsCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadPendingRequestsCount = async () => {
    try {
      const data = await api.getMyModificationRequests(0, 1000);
      const viewedIds = getViewedRequestIds();
      
      // Count only reviewed requests that haven't been viewed yet
      const reviewedRequests = (data.requests || []).filter(r => 
        r.status !== 'pending' && r.reviewed_at && !viewedIds.has(r.id)
      );
      
      setPendingRequestsCount(reviewedRequests.length);
    } catch (err) {
      console.error('Error loading pending requests count:', err);
    }
  };

  const handleTabChange = async (tab) => {
    setActiveTab(tab);
    
    // When switching to requests tab, mark all reviewed requests as viewed
    if (tab === 'requests') {
      try {
        const data = await api.getMyModificationRequests(0, 1000);
        const reviewedRequestIds = (data.requests || [])
          .filter(r => r.status !== 'pending' && r.reviewed_at)
          .map(r => r.id);
        
        if (reviewedRequestIds.length > 0) {
          markRequestsAsViewed(reviewedRequestIds);
          // Update the count immediately
          setPendingRequestsCount(0);
        }
      } catch (err) {
        console.error('Error marking requests as viewed:', err);
      }
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-73px)]">
      {/* Tabs */}
      <div className="bg-white border-b border-slate-200">
        <nav className="flex gap-1 px-4">
          <button
            onClick={() => handleTabChange('pointage')}
            className={`px-6 py-3 text-sm font-medium transition-colors relative ${
              activeTab === 'pointage'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Pointage
          </button>
          <button
            onClick={() => handleTabChange('requests')}
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
      <div className="flex-1 overflow-hidden">
        {activeTab === 'pointage' && <PointageView />}
        {activeTab === 'requests' && (
          <div className="p-4 h-full overflow-auto">
            <ModificationRequests onView={() => loadPendingRequestsCount()} />
          </div>
        )}
      </div>
    </div>
  );
}

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
      <CollaboratorView />
    </RoleBasedLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
