import { createContext, useEffect, useState } from 'react';
import { api } from '../lib/api';

export const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        if (api.isAuthenticated()) {
          const userData = await api.getCurrentUser();
          setUser(userData.user);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        // Clear invalid token
        api.logout();
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const signIn = async (email) => {
    try {
      const userData = await api.login(email);
      setUser(userData.user);
      return userData;
    } catch (error) {
      throw error;
    }
  };

  const signOut = async () => {
    api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
