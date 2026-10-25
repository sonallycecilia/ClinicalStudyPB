import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, EyeOff, Plus, Search, ShieldCheck, Trash2, UserRound, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { createLocalUser, deleteLocalUser, listLocalUsers, updateLocalUser } from '../auth/localUsers';
import type { AccountStatus, User, UserRole } from '../types';

const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3000';
const roles: UserRole[] = ['Administrador', 'Pesquisador', 'Coordenador'];

interface UserForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: UserRole;
  status: AccountStatus;
}

const blankForm: UserForm = { name: '', email: '', phone: '', password: '', role: 'Pesquisador', status: 'Ativo' };

export function UsersPage() {
  const { accessToken, demoMode, useDemoMode, user: signedInUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos os perfis');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UserForm>(blankForm);
  const [formError, setFormError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      if (demoMode || !accessToken) {
        if (!cancelled) setUsers(listLocalUsers());
        if (!cancelled) setIsLoading(false);
        return;
      }
      try {
        const response = await fetch(`${API_URL}/users`, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) throw new Error('A API não respondeu com sucesso.');
        const data = await response.json() as User[];
        if (!cancelled) setUsers(data);
      } catch {
        useDemoMode();
        if (!cancelled) setUsers(listLocalUsers());
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [accessToken, demoMode]);

  useEffect(() => {
    if (!deleteTarget) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deletingUser) closeDeleteConfirmation();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, deletingUser]);

  const filteredUsers = useMemo(() => users.filter((entry) => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = !term || entry.name.toLocaleLowerCase('pt-BR').includes(term) || entry.email.toLocaleLowerCase('pt-BR').includes(term);
    const matchesRole = roleFilter === 'Todos os perfis' || entry.role === roleFilter;
    return matchesSearch && matchesRole;
  }), [users, search, roleFilter]);

  function openCreate() {
    setEditing(null);
    setForm(blankForm);
    setFormError('');
    setShowPassword(false);
    setModalOpen(true);
  }

  function openEdit(entry: User) {
    setEditing(entry);
    setForm({ name: entry.name, email: entry.email, phone: formatPhone(entry.phone), password: '', role: entry.role, status: entry.status });
    setFormError('');
    setShowPassword(false);
    setModalOpen(true);
  }

  function closeModal() {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setFormError('');
  }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    if (form.name.trim().length < 3) return setFormError('Informe o nome completo.');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setFormError('Informe um e-mail válido.');
    if (![10, 11].includes(form.phone.replace(/\D/g, '').length)) return setFormError('Informe um telefone com DDD e 10 ou 11 dígitos.');
    if (editing?.id === signedInUser?.id && form.status === 'Inativo') return setFormError('Não é permitido inativar a própria conta.');
    if (editing?.id === signedInUser?.id && form.role !== 'Administrador') return setFormError('Não é permitido remover o próprio perfil de administrador.');
    if (!editing && form.password.length < 8) return setFormError('A senha precisa ter pelo menos 8 caracteres.');
    setSaving(true);
    try {
      const payload: Record<string, string> = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role, status: form.status };
      if (form.password.trim()) payload.password = form.password;
      if (!demoMode && accessToken) {
        const response = await fetch(editing ? `${API_URL}/users/${editing.id}` : `${API_URL}/users`, {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify(editing ? payload : { ...payload, password: form.password }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => null) as { message?: string | string[] } | null;
          let message = 'Não foi possível salvar a conta na API.';
          const responseMessage = body?.message;
          if (Array.isArray(responseMessage)) message = responseMessage.join(' ');
          else if (typeof responseMessage === 'string') message = responseMessage;
          throw new Error(message);
        }
        const saved = await response.json() as User;
        setUsers((current) => editing ? current.map((entry) => entry.id === saved.id ? saved : entry) : [...current, saved]);
      } else if (editing) {
        const updated = updateLocalUser(editing.id, { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role, status: form.status });
        setUsers(updated);
      } else {
        const created = createLocalUser({ name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), role: form.role, password: form.password });
        setUsers((current) => [...current, created]);
      }
      setModalOpen(false);
      setEditing(null);
      setNotice(editing ? 'Alterações salvas com sucesso.' : 'Usuário cadastrado com sucesso.');
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível salvar a conta.');
    } finally {
      setSaving(false);
    }
  }

  function requestDeleteUser(entry: User) {
    if (entry.id === signedInUser?.id) {
      setNotice('Por segurança, você não pode excluir a própria conta.');
      return;
    }
    setNotice('');
    setDeleteError('');
    setDeleteTarget(entry);
  }

  function closeDeleteConfirmation() {
    if (deletingUser) return;
    setDeleteTarget(null);
    setDeleteError('');
  }

  async function confirmDeleteUser() {
    if (!deleteTarget || deletingUser) return;
    const entry = deleteTarget;
    setDeletingUser(true);
    setDeleteError('');
    try {
      if (!demoMode && accessToken) {
        const response = await fetch(`${API_URL}/users/${entry.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } });
        if (!response.ok) throw new Error('Não foi possível excluir a conta na API.');
        setUsers((current) => current.filter((user) => user.id !== entry.id));
      } else {
        setUsers(deleteLocalUser(entry.id));
      }
      setDeleteTarget(null);
      setNotice('Conta excluída com sucesso.');
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : 'Não foi possível excluir a conta.');
    } finally {
      setDeletingUser(false);
    }
  }

  const activeCount = users.filter((entry) => entry.status === 'Ativo').length;

  return (
    <div className="page-wrap users-page">
      <section className="page-heading users-heading">
        <div><p className="eyebrow">CLINICALSTUDYPB / ADMINISTRAÇÃO</p><h1>Administração de usuários</h1><p>Gerencie as contas e os perfis de acesso ao sistema.</p></div>
        <button className="button button-primary new-user-button" type="button" onClick={openCreate}><Plus size={16} /> Novo usuário</button>
      </section>
      <div className="page-content-offset">
        {notice && <div className="notice" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={15} /></button></div>}
        <section className="stat-grid" aria-label="Resumo de contas">
          <article className="stat-card"><div className="stat-icon"><UserRound size={18} /></div><div><p>Contas cadastradas</p><strong>{String(users.length).padStart(2, '0')}</strong></div></article>
          <article className="stat-card"><div className="stat-icon stat-icon-green"><ShieldCheck size={18} /></div><div><p>Contas ativas</p><strong>{String(activeCount).padStart(2, '0')}</strong></div></article>
        </section>
        <section className="table-card">
          <div className="table-card-header"><div><h2>Contas do sistema</h2><p>Consulte e atualize os usuários cadastrados.</p></div></div>
          <div className="table-tools">
            <label className="search-control"><Search size={16} /><span className="sr-only">Buscar por nome ou e-mail</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou e-mail" /></label>
            <label className="filter-control"><span className="sr-only">Filtrar por perfil</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>Todos os perfis</option>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
          </div>
          <div className="table-scroll">
            <table className="users-table">
              <thead><tr><th>Usuário</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th className="actions-heading">Ações</th></tr></thead>
              <tbody>
                {isLoading && <tr><td colSpan={5} className="table-message">Carregando contas…</td></tr>}
                {!isLoading && filteredUsers.map((entry) => <tr key={entry.id}>
                  <td><div className="user-cell"><div className="avatar">{getInitials(entry.name)}</div><strong>{entry.name}</strong></div></td>
                  <td className="email-cell">{entry.email}</td>
                  <td><span className={`role-pill role-${slug(entry.role)}`}>{entry.role}</span></td>
                  <td><span className={`status-pill status-${entry.status.toLowerCase()}`}><span />{entry.status}</span></td>
                  <td><div className="row-actions"><button type="button" className="text-action edit-action" onClick={() => openEdit(entry)}>Editar</button><button type="button" className="text-action delete-action" onClick={() => requestDeleteUser(entry)}>Excluir</button></div></td>
                </tr>)}
                {!isLoading && filteredUsers.length === 0 && <tr><td colSpan={5} className="table-message">Nenhuma conta corresponde à busca.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="table-footer"><span>Exibindo {filteredUsers.length} de {users.length} contas</span><span>Os perfis determinam os menus e as rotas disponíveis.</span></footer>
        </section>
      </div>
      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
        <section className="user-modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
          <header className="modal-header"><div><p className="eyebrow">CONTA DE ACESSO</p><h2 id="user-modal-title">{editing ? 'Informações da conta' : 'Novo usuário'}</h2><p>{editing ? 'Atualize as informações e as permissões desta conta.' : 'Preencha os dados para cadastrar um novo usuário.'}</p></div><button type="button" className="icon-button close-modal" aria-label="Fechar formulário" onClick={closeModal}><X size={20} /></button></header>
          <form onSubmit={saveUser} className="user-form">
            <label className="form-field form-field-wide"><span>Nome completo <b>*</b></span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Digite o nome completo" required minLength={3} /></label>
            <label className="form-field"><span>E-mail <b>*</b></span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="nome@exemplo.com" required /></label>
            <label className="form-field"><span>Telefone <b>*</b></span><input type="tel" inputMode="numeric" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: formatPhone(event.target.value) })} placeholder="(00) 00000-0000" maxLength={15} required /></label>
            <label className="form-field"><span>Senha {editing ? '(opcional)' : <b>*</b>}</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={editing ? 'Deixe em branco para manter' : 'Mínimo de 8 caracteres'} required={!editing} minLength={editing && !form.password ? undefined : 8} autoComplete="new-password" /><button type="button" className="icon-button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
            <label className="form-field"><span>Perfil de acesso <b>*</b></span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as UserRole })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
            {editing && <label className="form-field"><span>Situação da conta <b>*</b></span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as AccountStatus })}><option>Ativo</option><option>Inativo</option></select></label>}
            {formError && <p className="form-error form-error-wide" role="alert">{formError}</p>}
            <footer className="modal-actions"><button className="button button-outline" type="button" onClick={closeModal} disabled={saving}>Cancelar</button><button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar usuário'}</button></footer>
          </form>
        </section>
      </div>}
      {deleteTarget && <div className="modal-backdrop delete-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDeleteConfirmation(); }}>
        <section className="delete-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="delete-user-title" aria-describedby="delete-user-description">
          <header className="delete-confirm-header">
            <div className="delete-confirm-icon"><Trash2 size={19} aria-hidden="true" /></div>
            <h2 id="delete-user-title">Excluir usuário?</h2>
          </header>
          <p id="delete-user-description" className="delete-confirm-description">Deseja realmente excluir esta conta do sistema?</p>
          <div className="delete-user-preview">
            <div className="avatar">{getInitials(deleteTarget.name)}</div>
            <div className="delete-user-copy"><strong>{deleteTarget.name}</strong><span>{deleteTarget.role}</span></div>
          </div>
          {deleteError && <p className="form-error delete-confirm-error" role="alert">{deleteError}</p>}
          <footer className="delete-confirm-actions">
            <button className="button button-outline" type="button" onClick={closeDeleteConfirmation} disabled={deletingUser}>Cancelar</button>
            <button className="button button-danger" type="button" onClick={() => void confirmDeleteUser()} disabled={deletingUser}>
              <Trash2 size={15} aria-hidden="true" />{deletingUser ? 'Excluindo…' : 'Excluir usuário'}
            </button>
          </footer>
        </section>
      </div>}
    </div>
  );
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

function slug(role: UserRole): string {
  return role.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;

  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  if (local.length <= 4) return `(${area}) ${local}`;

  const prefixSize = local.length > 8 ? 5 : 4;
  return `(${area}) ${local.slice(0, prefixSize)}-${local.slice(prefixSize)}`;
}
