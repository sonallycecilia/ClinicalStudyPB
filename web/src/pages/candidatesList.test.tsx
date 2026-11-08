import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { CoordinatorCandidatesPage } from './coordenatorPage';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request }) }));
const studies = [{ id: 's1', title: 'Sono' }, { id: 's2', title: 'Atividade' }];
const ana = { id: 'c1', studyId: 's1', name: 'Ana Silva', email: null, registeredAt: '2026-11-08', status: 'Novo' };
const bruno = { ...ana, id: 'c2', studyId: 's2', name: 'Bruno Lima', status: 'Elegível' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const studyFilter = () => screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement;
const table = () => screen.getByRole('table', { name: 'Candidatos do estudo' });
let rows: typeof ana[];
let available: typeof studies;

beforeEach(() => {
  rows = [ana, bruno];
  available = studies;
  request.mockReset().mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/studies/disponiveis-recrutamento') return json(available);
    const studyId = path.split('/')[2];
    if (options?.method === 'POST') {
      const body = JSON.parse(options.body as string);
      const created = { ...ana, studyId, id: 'c3', name: body.name };
      rows = [...rows, created];
      return json(created, 201);
    }
    return json(rows.filter((row) => row.studyId === studyId));
  });
});
afterEach(cleanup);
function Location() { const location = useLocation(); return <output aria-label="URL atual">{location.pathname}{location.search}</output>; }
function page(url = '/coordenador/candidatos') {
  return render(<MemoryRouter initialEntries={[url]}><CoordinatorCandidatesPage /><Location /></MemoryRouter>);
}
const url = () => screen.getByLabelText('URL atual').textContent!;
const candidateGets = () => request.mock.calls.filter(([path, options]) => path.endsWith('/candidates') && options?.method !== 'POST');
async function register(studyId = 's1') {
  fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
  const dialog = screen.getByRole('dialog');
  await within(dialog).findByRole('option', { name: 'Sono' });
  fireEvent.change(within(dialog).getByLabelText(/Nome completo/), { target: { value: 'Nova pessoa' } });
  fireEvent.change(within(dialog).getByLabelText(/^Estudo/), { target: { value: studyId } });
  fireEvent.submit(within(dialog).getByRole('form'));
  return dialog;
}

describe('Listagem do Coordenador — todos os estudos, URL e retorno do cadastro', () => {
  it('consulta automaticamente todos os estudos autorizados e recupera os candidatos novamente após remontar a página', async () => {
    const view = page();
    await within(table()).findByText('Ana Silva');
    expect(within(table()).getByText('Bruno Lima')).toBeTruthy();
    expect(studyFilter().value).toBe('');
    expect(screen.getByRole('option', { name: 'Todos os estudos' })).toBeTruthy();
    expect(candidateGets()).toHaveLength(2);
    view.unmount();
    page(); // Equivalente a reconstruir a página após Ctrl+R, com transporte consultado novamente.
    await within(table()).findByText('Ana Silva');
    expect(within(table()).getByText('Bruno Lima')).toBeTruthy();
    expect(candidateGets()).toHaveLength(4);
    expect(candidateGets().map(([path]) => path)).toEqual([
      '/studies/s1/candidates', '/studies/s2/candidates', '/studies/s1/candidates', '/studies/s2/candidates',
    ]);
  });

  it('combina estudo, nome e status e preserva somente o estudo na URL após recarregar', async () => {
    const view = page('/coordenador/candidatos?other=preservar');
    await within(table()).findByText('Ana Silva');
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'BRUNO' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'Elegível' } });
    expect(within(table()).queryByText('Ana Silva')).toBeNull();
    expect(within(table()).getByText('Bruno Lima')).toBeTruthy();
    fireEvent.change(studyFilter(), { target: { value: 's1' } });
    await screen.findByText('Nenhum candidato encontrado para os filtros selecionados.');
    fireEvent.change(studyFilter(), { target: { value: 's2' } });
    await within(table()).findByText('Bruno Lima');
    expect(url()).toContain('studyId=s2');
    expect(url()).toContain('other=preservar');
    const selectedUrl = url();
    view.unmount();
    const reloaded = page(selectedUrl);
    await within(table()).findByText('Bruno Lima');
    expect(studyFilter().value).toBe('s2');
    expect(within(table()).queryByText('Ana Silva')).toBeNull();
    expect(candidateGets().at(-1)?.[0]).toBe('/studies/s2/candidates');
    fireEvent.change(studyFilter(), { target: { value: '' } });
    await within(table()).findByText('Ana Silva');
    expect(url()).not.toContain('studyId=');
    const allUrl = url();
    reloaded.unmount();
    page(allUrl);
    await within(table()).findByText('Ana Silva');
    expect(within(table()).getByText('Bruno Lima')).toBeTruthy();
  });

  it('descarta estudo inexistente ou não autorizado da URL e consulta apenas os estudos permitidos', async () => {
    page('/coordenador/candidatos?studyId=proibido');
    await within(table()).findByText('Ana Silva');
    expect(studyFilter().value).toBe('');
    await waitFor(() => expect(url()).not.toContain('studyId='));
    expect(request.mock.calls.some(([path]) => path.includes('proibido'))).toBe(false);
    expect(candidateGets()).toHaveLength(2);
  });

  it('retorna com segurança a todos quando o estudo selecionado perde acesso', async () => {
    page('/coordenador/candidatos?studyId=s2');
    await within(table()).findByText('Bruno Lima');
    available = [studies[0]];
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar estudos' }));
    await within(table()).findByText('Ana Silva');
    expect(within(table()).queryByText('Bruno Lima')).toBeNull();
    await waitFor(() => expect(url()).not.toContain('studyId='));
    expect(studyFilter().value).toBe('');
  });

  it('retém resultados de consultas bem-sucedidas, informa falha parcial e permite nova tentativa sem duplicatas', async () => {
    const transport = request.getMockImplementation()!;
    let failed = true;
    request.mockImplementation(async (path: string, options?: RequestInit) => path === '/studies/s2/candidates' && failed
      ? json({ message: 'Erro' }, 503) : path === '/studies/s1/candidates' ? json([ana, ana, bruno]) : transport(path, options));
    page();
    await within(table()).findByText('Ana Silva');
    expect(within(table()).getAllByRole('row')).toHaveLength(2);
    expect(screen.getByRole('alert').textContent).toContain('A lista está incompleta');
    expect(screen.getByRole('alert').textContent).toContain('Atividade');
    expect(within(table()).queryByText('Bruno Lima')).toBeNull();
    failed = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await within(table()).findByText('Bruno Lima');
    expect(within(table()).getAllByRole('row')).toHaveLength(3);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['sucesso', 'erro'])('ignora %s atrasado de Todos os estudos após selecionar um estudo', async (outcome) => {
    const transport = request.getMockImplementation()!;
    let finish!: (response: Response) => void;
    let oldSignal!: AbortSignal;
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/studies/s1/candidates') {
        oldSignal = options!.signal as AbortSignal;
        return new Promise<Response>((resolve) => { finish = resolve; });
      }
      return transport(path, options);
    });
    page();
    await waitFor(() => expect(oldSignal).toBeDefined());
    expect(table().getAttribute('aria-busy')).toBe('true');
    fireEvent.change(studyFilter(), { target: { value: 's2' } });
    await within(table()).findByText('Bruno Lima');
    expect(oldSignal.aborted).toBe(true);
    await act(async () => finish(outcome === 'sucesso' ? json([ana]) : json({}, 500)));
    expect(within(table()).queryByText('Ana Silva')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('distingue resultado vazio de falha total de consulta', async () => {
    rows = [];
    const view = page();
    await screen.findByText('Nenhum candidato cadastrado nos estudos autorizados.');
    view.unmount();
    const transport = request.getMockImplementation()!;
    request.mockImplementation(async (path: string, options?: RequestInit) => path.endsWith('/candidates') ? json({}, 500) : transport(path, options));
    page();
    await screen.findByRole('alert');
    expect(screen.queryByText('Nenhum candidato cadastrado nos estudos autorizados.')).toBeNull();
  });

  it.each(['', 's1', 's2'])('fecha cadastro, confirma discretamente, reconsulta API e preserva filtro %j', async (studyId) => {
    page(`/coordenador/candidatos${studyId ? `?studyId=${studyId}` : ''}`);
    await within(table()).findByText(studyId === 's2' ? 'Bruno Lima' : 'Ana Silva');
    await register(); // Sempre cadastra em s1, inclusive quando o filtro está em s2.
    await screen.findByText('Candidato cadastrado com sucesso!');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Voltar à listagem' })).toBeNull();
    expect(studyFilter().value).toBe(studyId);
    if (studyId !== 's2') await within(table()).findByText('Nova pessoa');
    else {
      await within(table()).findByText('Bruno Lima');
      expect(within(table()).queryByText('Nova pessoa')).toBeNull();
    }
    expect(candidateGets()).toHaveLength(studyId ? 2 : 4);
  });
});
