import { useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, Eye, EyeOff, HeartPulse, LockKeyhole, Mail, UserRoundPlus } from 'lucide-react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getHomeForRole } from '../security/access';

export function LoginPage() {
  const { user, login, loading: checkingSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (checkingSession) return <p role="status">Validando sessão…</p>;
  if (user) return <Navigate to={getHomeForRole(user.role)} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedUser = await login(email.trim(), password);
      const from = (location.state as { from?: string } | null)?.from;
      navigate(from ?? getHomeForRole(loggedUser.role), { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <header className="login-brandbar">
        <Link className="brand brand-light" to="/login" aria-label="ClinicalStudyPB, página inicial">
          <HeartPulse size={27} strokeWidth={2.5} />
          <span>ClinicalStudyPB</span>
        </Link>
      </header>
      <main className="login-scene">
        <div className="login-glow login-glow-one" />
        <div className="login-glow login-glow-two" />
        <section className="login-card" aria-labelledby="login-title">
          <div className="login-symbol"><Activity size={20} /></div>
          <h1 id="login-title">Acesse sua conta</h1>
          <form onSubmit={handleSubmit} className="login-form">
            <label className="field-with-icon">
              <span className="sr-only">E-mail</span>
              <Mail size={15} aria-hidden="true" />
              <input autoComplete="username" type="email" placeholder="E-mail" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="field-with-icon">
              <span className="sr-only">Senha</span>
              <LockKeyhole size={15} aria-hidden="true" />
              <input autoComplete="current-password" type={showPassword ? 'text' : 'password'} placeholder="Senha" value={password} onChange={(event) => setPassword(event.target.value)} required />
              <button className="icon-button password-toggle" type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="button button-primary button-full" type="submit" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          <div className="login-separator"><span />ou<span /></div>
          <Link className="button button-soft button-full" to="/criar-conta" onClick={(event) => { event.preventDefault(); setError('O cadastro público ficará desabilitado nesta etapa. Solicite uma conta a um administrador.'); }}>
            <UserRoundPlus size={16} /> Criar uma conta
          </Link>
        </section>
        <p className="login-footer">Acesso restrito a usuários autorizados</p>
      </main>
    </div>
  );
}
