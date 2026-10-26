import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { canAccessRoute, getHomeForRole } from '../security/access';

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Validando sessão…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function RequireRole() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status">Validando sessão…</p>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!canAccessRoute(user.role, location.pathname)) return <Navigate to="/403" replace state={{ home: getHomeForRole(user.role) }} />;
  return <Outlet />;
}
