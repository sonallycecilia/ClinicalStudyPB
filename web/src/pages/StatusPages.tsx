import { ArrowLeft, HeartPulse, ShieldX } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeForRole } from '../security/access';

export function ForbiddenPage() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const home = (location.state as { home?: string } | null)?.home ?? (user ? getHomeForRole(user.role) : '/login');
  const unsupportedProfile = home === '/403';
  function goBack() {
    if (unsupportedProfile) { logout(); navigate('/login', { replace: true }); return; }
    navigate(home);
  }
  return <div className="status-page"><div className="status-art status-art-forbidden"><ShieldX size={118} strokeWidth={1.1} /><span>403</span></div><h1>Acesso não permitido</h1><p>{unsupportedProfile ? 'Ainda não há uma tela definida para este perfil neste protótipo.' : 'Seu perfil não tem permissão para acessar esta página.'}</p><button className="button button-primary" type="button" onClick={goBack}><ArrowLeft size={16} /> {unsupportedProfile ? 'Voltar ao login' : 'Voltar para minha área'}</button></div>;
}

export function NotFoundPage() {
  const { user } = useAuth();
  const home = user ? getHomeForRole(user.role) : '/login';
  return <div className="status-page"><div className="status-art"><HeartPulse size={110} strokeWidth={1.1} /><span>404</span></div><h1>Página não encontrada</h1><p>Ops! Parece que este link não existe mais.</p><Link className="button button-primary" to={home}>Voltar ao início</Link></div>;
}
