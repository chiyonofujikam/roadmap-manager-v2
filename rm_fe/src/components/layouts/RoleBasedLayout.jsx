import { useAuth } from '../../hooks/useAuth';
import { CELayout } from './CELayout';

// This component is now mainly for collaborator view
// Admin/Responsible users are handled in App.jsx
export function RoleBasedLayout({ children }) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  // For collaborators, show the CE layout with pointage view
  return <CELayout>{children}</CELayout>;
}
