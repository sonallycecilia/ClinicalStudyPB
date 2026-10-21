import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppLayout } from './components/AppLayout';
import { RequireAuth, RequireRole } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { UsersPage } from './pages/UsersPage';
import { ForbiddenPage, NotFoundPage } from './pages/StatusPages';
import { getHomeForRole } from './security/access';

function LandingRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? getHomeForRole(user.role) : '/login'} replace />;
}

function AppRoutes() {
  return <Routes>
    <Route path="/" element={<LandingRedirect />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/403" element={<ForbiddenPage />} />
    <Route element={<RequireAuth />}>
      <Route element={<AppLayout />}>
        <Route element={<RequireRole />}>
          <Route path="/usuarios" element={<UsersPage />} />
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<NotFoundPage />} />
  </Routes>;
}

export default function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}
