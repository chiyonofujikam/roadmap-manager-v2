import { useState, useEffect, useMemo } from 'react';
import { Check, X, Clock, MessageSquare } from 'lucide-react';
import { useAuth, isAdminOrResponsible } from '../../hooks/useAuth';
import { useNotification } from '../../contexts/NotificationContext';
import { api } from '../../lib/api';
import { formatDateString } from '../../utils/dateUtils';

// Helper function to format date with time
const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
};

// Helper function to format field names for display
const formatFieldName = (key) => {
  const fieldNames = {
    clef_imputation: "Clef d'imputation",
    libelle: "Libellé",
    fonction: "Fonction",
    date_besoin: "Date besoin",
    heures_theoriques: "H. théoriques",
    heures_passees: "H. passées",
    commentaires: "Commentaires",
  };
  return fieldNames[key] || key;
};

export function ModificationRequests({ onView }) {
  const { user } = useAuth();
  const { showMessage } = useNotification();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewingRequestId, setReviewingRequestId] = useState(null);
  const [reviewComment, setReviewComment] = useState('');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewAction, setReviewAction] = useState(null); // 'approve' or 'reject'

  const isResponsible = isAdminOrResponsible(user);

  useEffect(() => {
    loadRequests();
    // Poll for new requests every 30 seconds
    const interval = setInterval(loadRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  // Notify parent when component is viewed (for collaborators)
  useEffect(() => {
    if (!isResponsible && onView) {
      // Mark all reviewed requests as viewed when component mounts
      const markReviewedAsViewed = async () => {
        try {
          const data = await api.getMyModificationRequests(0, 1000);
          const reviewedRequestIds = (data.requests || [])
            .filter(r => r.status !== 'pending' && r.reviewed_at)
            .map(r => r.id);
          
          if (reviewedRequestIds.length > 0) {
            const viewed = JSON.parse(localStorage.getItem('viewed_modification_requests') || '[]');
            const newViewed = new Set(viewed);
            reviewedRequestIds.forEach(id => newViewed.add(id));
            localStorage.setItem('viewed_modification_requests', JSON.stringify(Array.from(newViewed)));
            
            // Notify parent to update count
            if (onView) {
              onView();
            }
          }
        } catch (err) {
          console.error('Error marking requests as viewed:', err);
        }
      };
      
      markReviewedAsViewed();
    }
  }, [isResponsible, onView]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let data;
      if (isResponsible) {
        // For responsible/admin: get all requests (full history)
        data = await api.getModificationRequests(0, 1000);
      } else {
        // For collaborators: get all their requests
        data = await api.getMyModificationRequests(0, 1000);
      }
      
      setRequests(data.requests || []);
    } catch (err) {
      console.error('Error loading modification requests:', err);
      setError(err.message || 'Failed to load modification requests');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (requestId, action) => {
    setReviewingRequestId(requestId);
    setReviewAction(action);
    setReviewComment('');
    setShowReviewModal(true);
  };

  const handleConfirmReview = async () => {
    if (!reviewingRequestId || !reviewAction) return;

    try {
      setLoading(true);
      await api.reviewModificationRequest(
        reviewingRequestId,
        reviewAction === 'approve' ? 'approved' : 'rejected',
        reviewComment || null
      );
      
      showMessage('success', `Request ${reviewAction === 'approve' ? 'approved' : 'rejected'} successfully`);
      setShowReviewModal(false);
      setReviewingRequestId(null);
      setReviewAction(null);
      setReviewComment('');
      await loadRequests();
    } catch (err) {
      console.error('Error reviewing request:', err);
      showMessage('error', err.message || 'Failed to review request');
    } finally {
      setLoading(false);
    }
  };

  // Count pending requests for notification
  const pendingCount = useMemo(() => {
    if (isResponsible) {
      return requests.filter(r => r.status === 'pending').length;
    } else {
      // For collaborators, count requests with new responses (reviewed but not seen)
      // For now, we'll count pending requests
      return requests.filter(r => r.status === 'pending').length;
    }
  }, [requests, isResponsible]);

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      approved: { label: 'Approved', className: 'bg-green-100 text-green-800', icon: Check },
      rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', icon: X },
    };
    
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: Clock };
    const Icon = config.icon;
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.className} flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };


  if (loading && requests.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading modification requests...</p>
        </div>
      </div>
    );
  }

  if (error && requests.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
        <p className="text-red-700">Error: {error}</p>
        <button
          onClick={loadRequests}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">
            Modification Requests
          </h3>
          <div className="text-sm text-slate-600">
            Total: <span className="font-medium text-slate-900">{requests.length}</span> requests
            {pendingCount > 0 && (
              <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <p className="text-lg mb-2">No modification requests found</p>
            <p className="text-sm">
              {isResponsible 
                ? "No pending modification requests from team members."
                : "You haven't created any modification requests yet."}
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {isResponsible && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    User
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Date Pointage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Changes
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Comment
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Created
                </th>
                {isResponsible && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Actions
                  </th>
                )}
                {!isResponsible && (
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Review Comment
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {requests.map((request) => (
                <tr key={request.id} className="hover:bg-slate-50 transition-colors">
                  {isResponsible && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">
                        {request.user_name || 'Unknown'}
                      </div>
                      {request.user_email && (
                        <div className="text-xs text-slate-500">
                          {request.user_email}
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-900">
                    {formatDateString(request.date_pointage) || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {getStatusBadge(request.status)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-900">
                    <div className="space-y-2 max-w-2xl">
                      {request.requested_data && Object.keys(request.requested_data).length > 0 ? (() => {
                        // Filter to show only changed fields
                        const changedFields = Object.entries(request.requested_data).filter(([key, newValue]) => {
                          const oldValue = request.current_data?.[key] || '';
                          return String(oldValue) !== String(newValue || '');
                        });
                        
                        if (changedFields.length === 0) {
                          return <span className="text-slate-400">No changes</span>;
                        }
                        
                        return changedFields.map(([key, newValue]) => {
                          const oldValue = request.current_data?.[key] || '';
                          
                          return (
                            <div key={key} className="text-xs border-l-2 border-blue-500 pl-2">
                              <div className="font-medium text-slate-700 mb-1">
                                {formatFieldName(key)}
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <div className="bg-slate-50 p-1.5 rounded">
                                  <div className="text-slate-500 text-xs mb-0.5">Old:</div>
                                  <div className="text-slate-700">{String(oldValue || '-')}</div>
                                </div>
                                <div className="bg-blue-50 p-1.5 rounded">
                                  <div className="text-blue-600 font-medium text-xs mb-0.5">
                                    New:
                                  </div>
                                  <div className="text-blue-700 font-medium">
                                    {String(newValue || '-')}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        });
                      })() : (
                        <span className="text-slate-400">No changes</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                    {request.comment ? (
                      <div className="flex items-start gap-1">
                        <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <span className="truncate">{request.comment}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-600">
                    {formatDate(request.created_at)}
                  </td>
                  {isResponsible && (
                    <td className="px-4 py-3 whitespace-nowrap">
                      {request.status === 'pending' ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleReview(request.id, 'approve')}
                            disabled={loading}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                          >
                            <Check className="w-4 h-4" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(request.id, 'reject')}
                            disabled={loading}
                            className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 text-sm"
                          >
                            <X className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="text-sm text-slate-500">
                          {request.review_comment && (
                            <div className="flex items-start gap-1">
                              <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span>{request.review_comment}</span>
                            </div>
                          )}
                          {request.reviewed_at && (
                            <div className="text-xs mt-1">
                              {formatDate(request.reviewed_at)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  )}
                  {!isResponsible && (
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-xs">
                      {request.review_comment ? (
                        <div className="flex items-start gap-1">
                          <MessageSquare className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <span>{request.review_comment}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {reviewAction === 'approve' ? 'Approve' : 'Reject'} Modification Request
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Review Comment (Optional)
              </label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Add a comment about your decision..."
              />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setReviewingRequestId(null);
                  setReviewAction(null);
                  setReviewComment('');
                }}
                className="px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReview}
                disabled={loading}
                className={`px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  reviewAction === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {reviewAction === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
