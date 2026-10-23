import type { AccountStatus, User, UserRole } from '../types';

const STORAGE_KEY = 'clinicalstudy.demo-users';

const defaultUsers: User[] = [
  { id: 'usr-researcher', name: 'Marina Costa', email: 'marina.costa@clinicalstudypb.test', phone: '(81) 7788-4444', role: 'Pesquisador', status: 'Ativo', createdAt: '2026-10-02T12:00:00.000Z' },
  { id: 'usr-coordinator', name: 'Rafael Lima', email: 'rafael.lima@clinicalstudypb.test', phone: '(83) 98888-1111', role: 'Coordenador', status: 'Ativo', createdAt: '2026-10-03T12:00:00.000Z' },
  { id: 'usr-admin', name: 'Ana Maria', email: 'ana.souza@clinicalstudypb.test', phone: '(83) 99900-0001', role: 'Administrador', status: 'Ativo', createdAt: '2026-10-01T12:00:00.000Z' },
];

function read(): User[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) as User[] : defaultUsers;
  } catch {
    return defaultUsers;
  }
}

function write(users: User[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
}

export function listLocalUsers(): User[] {
  const users = read();
  if (!localStorage.getItem(STORAGE_KEY)) write(users);
  return users;
}

export function createLocalUser(input: Omit<User, 'id' | 'createdAt' | 'status'> & { password: string }): User {
  const users = read();
  if (users.some((user) => user.email.toLowerCase() === input.email.toLowerCase())) throw new Error('Já existe uma conta com este e-mail.');
  const user: User = { id: `demo-${crypto.randomUUID()}`, name: input.name, email: input.email, phone: input.phone, role: input.role, status: 'Ativo', createdAt: new Date().toISOString() };
  write([...users, user]);
  return user;
}

export function updateLocalUser(id: string, input: { name?: string; email?: string; phone?: string; role?: UserRole; status?: AccountStatus }): User[] {
  const users = read();
  if (input.email && users.some((user) => user.id !== id && user.email.toLowerCase() === input.email?.toLowerCase())) throw new Error('Já existe uma conta com este e-mail.');
  const updated = users.map((user) => user.id === id ? { ...user, ...input } : user);
  write(updated);
  return updated;
}

export function deleteLocalUser(id: string): User[] {
  const updated = read().filter((user) => user.id !== id);
  write(updated);
  return updated;
}
