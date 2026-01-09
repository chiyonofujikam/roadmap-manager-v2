import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Get user type from user object
 */
export function getUserType(user) {
  return user?.user_type || 'collaborator';
}

/**
 * Check if user is admin
 */
export function isAdmin(user) {
  return getUserType(user) === 'admin';
}

/**
 * Check if user is responsible
 */
export function isResponsible(user) {
  return getUserType(user) === 'responsible';
}

/**
 * Check if user is collaborator
 */
export function isCollaborator(user) {
  return getUserType(user) === 'collaborator';
}

/**
 * Check if user is admin or responsible
 */
export function isAdminOrResponsible(user) {
  const userType = getUserType(user);
  return userType === 'admin' || userType === 'responsible';
}