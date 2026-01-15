import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

// Available mock users for testing (names from rm_be/mockusers.json)
const MOCK_USERS = [
  { email: 'admin@example.com', label: 'PALLAS Fabrice', userType: 'admin' },
  { email: 'responsible@example.com', label: 'CAUSIT Arnauld', userType: 'responsible' },
  { email: 'responsible2@example.com', label: 'Erwin LE COZ', userType: 'responsible' },
  { email: 'collaborator1@example.com', label: 'Imane Nazih', userType: 'collaborator' },
  { email: 'collaborator2@example.com', label: 'Oumaima Yahya', userType: 'collaborator' },
  { email: 'collaborator3@example.com', label: 'Karim Gani', userType: 'collaborator' },
];

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (userEmail) => {
    setEmail(userEmail);
    handleSubmit(new Event('submit'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Roadmap Manager
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="admin@example.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Please wait...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6">
          <div className="text-center text-sm text-slate-600 mb-3">
            Quick login (for testing):
          </div>
          <div className="grid grid-cols-1 gap-2">
            {MOCK_USERS.map((mockUser) => (
              <button
                key={mockUser.email}
                type="button"
                onClick={() => handleQuickLogin(mockUser.email)}
                disabled={loading}
                className="px-3 py-2 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
              >
                <div className="font-medium text-slate-700">{mockUser.label}</div>
                <div className="text-xs text-slate-500">{mockUser.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
