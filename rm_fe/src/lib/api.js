/**
 * API client for backend communication
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Get authentication token from localStorage
 */
const getAuthToken = () => {
  return localStorage.getItem('auth_token');
};

/**
 * Set authentication token in localStorage
 */
const setAuthToken = (token) => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

/**
 * Make an authenticated API request
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = getAuthToken();
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Unauthorized - clear token and redirect to login
      setAuthToken(null);
      throw new Error('Authentication required');
    }
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
};

/**
 * API methods
 */
export const api = {
  /**
   * Authenticate with backend (mock mode - uses email as token)
   */
  async login(email) {
    // In mock mode, we use the email as the token
    // Store it for subsequent requests
    setAuthToken(email);
    
    // Verify authentication by getting user info
    const userData = await apiRequest('/auth/me');
    return userData;
  },

  /**
   * Get current user information
   */
  async getCurrentUser() {
    return apiRequest('/auth/me');
  },

  /**
   * Logout (clear token)
   */
  logout() {
    setAuthToken(null);
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return !!getAuthToken();
  },

  /**
   * Get stored token
   */
  getToken() {
    return getAuthToken();
  },

  /**
   * Get LC (Conditional List) items for autocomplete
   * Returns options for clef_imputation, libelle, and fonction fields
   */
  async getLCOptions() {
    return apiRequest('/api/v1/conditional-lists/default/items');
  },

  /**
   * Get team members for responsible/admin users
   * Returns all team members (collaborators) for the responsible's team (or all collaborators for admin)
   */
  async getTeamMembers() {
    return apiRequest('/api/v1/users/team-members');
  },

  /**
   * Get team pointage entries for responsible/admin users
   * Returns all pointage entries for the responsible's team (or all entries for admin)
   * weekStart is optional and should be in YYYY-MM-DD format (Monday of the week)
   */
  async getTeamPointageEntries(skip = 0, limit = 1000, weekStart = null) {
    let url = `/api/v1/pointage/team-entries?skip=${skip}&limit=${limit}`;
    if (weekStart) {
      url += `&week_start=${weekStart}`;
    }
    return apiRequest(url);
  },

  /**
   * Get pointage entries for a specific week
   * weekStart should be in YYYY-MM-DD format (Monday of the week)
   */
  async getPointageEntriesForWeek(weekStart) {
    return apiRequest(`/api/v1/pointage/entries/week/${weekStart}`);
  },

  /**
   * Create a new pointage entry
   */
  async createPointageEntry(entryData) {
    return apiRequest('/api/v1/pointage/entries', {
      method: 'POST',
      body: JSON.stringify(entryData),
    });
  },

  /**
   * Update an existing pointage entry
   */
  async updatePointageEntry(entryId, entryData) {
    return apiRequest(`/api/v1/pointage/entries/${entryId}`, {
      method: 'PUT',
      body: JSON.stringify(entryData),
    });
  },

  /**
   * Submit a pointage entry (locks it for validation)
   */
  async submitPointageEntry(entryId) {
    return apiRequest(`/api/v1/pointage/entries/${entryId}/submit`, {
      method: 'POST',
    });
  },

  /**
   * Delete a pointage entry
   */
  async deletePointageEntry(entryId) {
    return apiRequest(`/api/v1/pointage/entries/${entryId}`, {
      method: 'DELETE',
    });
  },

  /**
   * Update pointage entry status (for responsible/admin users)
   */
  async updatePointageEntryStatus(entryId, newStatus) {
    return apiRequest(`/api/v1/pointage/entries/${entryId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus }),
    });
  },

  /**
   * Create a modification request for a submitted entry
   */
  async createModificationRequest(entryId, requestedData, comment = null) {
    return apiRequest('/api/v1/pointage/modification-requests', {
      method: 'POST',
      body: JSON.stringify({
        entry_id: entryId,
        requested_data: requestedData,
        comment: comment,
      }),
    });
  },

  /**
   * Get modification requests (for responsible/admin)
   * status: optional filter ("pending", "approved", "rejected"). If null, returns all.
   */
  async getModificationRequests(skip = 0, limit = 100, status = null) {
    let url = `/api/v1/pointage/modification-requests?skip=${skip}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;
    }
    return apiRequest(url);
  },

  /**
   * Review (approve/reject) a modification request
   */
  async reviewModificationRequest(requestId, status, reviewComment = null) {
    return apiRequest(`/api/v1/pointage/modification-requests/${requestId}/review`, {
      method: 'POST',
      body: JSON.stringify({
        status: status,
        review_comment: reviewComment,
      }),
    });
  },

  /**
   * Get modification requests for the current collaborator
   */
  async getMyModificationRequests(skip = 0, limit = 100) {
    return apiRequest(`/api/v1/pointage/modification-requests/my-requests?skip=${skip}&limit=${limit}`);
  },

  /**
   * Check if an entry has a pending modification request
   */
  async checkPendingModificationRequest(entryId) {
    try {
      const data = await apiRequest(`/api/v1/pointage/modification-requests/my-requests?skip=0&limit=100`);
      const requests = data.requests || [];
      return requests.some(req => req.entry_id === entryId && req.status === 'pending');
    } catch (err) {
      console.error('Error checking pending request:', err);
      return false;
    }
  },
};

export default api;
