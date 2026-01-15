import { useAuth } from '../../hooks/useAuth';
import { CELayout } from './CELayout';

export function RoleBasedLayout({ children }) {
  const { user } = useAuth();

  if (!user) {
    return null;
  }
  return <CELayout>{children}</CELayout>;
}
