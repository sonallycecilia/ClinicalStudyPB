import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoordinatorCandidatesPage } from './coordenatorPage';
import { CANDIDATE_STATUSES } from '../candidates/candidatesApi';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request }) }));

const studies = [{ id: 'study-1', title: 'Sono' }, { id: 'study-2', title: 'Atividade física' }];
const row = { id: 'candidate-1', studyId: 'study-1', name: 'Ana Silva', email: null, status: 'Em avaliação', registeredAt: '2026-11-07 00:30:00.123+00' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
function renderPage(studyId = 'study-1') { render(<MemoryRouter initialEntries={[`/?studyId=${studyId}`]}><CoordinatorCandidatesPage /></MemoryRouter>); }
async function selectStudy(id: string) {
  await screen.findByRole('option', { name: 'Sono' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por estudo' }), { target: { value: id } });
}
async function openForm(studyId = 'study-1') {
  fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
  const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
  await within(dialog).findByRole('option', { name: 'Sono' });
  fireEvent.change(within(dialog).getByLabelText(/Nome completo/), { target: { value: '  Ana Silva  ' } });
  fireEvent.change(within(dialog).getByLabelText(/^Estudo/), { target: { value: studyId } });
  return dialog;
}
beforeEach(() => request.mockReset());
afterEach(cleanup);

describe('RF08 — telas com o adaptador HTTP real e transporte autenticado simulado', () => {
  it.each(['study-1', 'study-2'])('confirma somente após HTTP de sucesso, bloqueia duplicatas e consulta o estudo cadastrado %s', async (studyId) => {
    let finish!: (response: Response) => void;
    let persisted = false;
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/studies/disponiveis-recrutamento') return json(studies);
      if (options?.method === 'POST') return new Promise<Response>((resolve) => { finish = resolve; });
      return json(persisted && path === `/studies/${studyId}/candidates` ? [{ ...row, studyId }] : []);
    });
    renderPage(studyId);
    await selectStudy(studyId);
    await screen.findByText('O estudo selecionado não possui candidatos cadastrados.');
    const dialog = await openForm(studyId);
    const form = within(dialog).getByRole('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(within(dialog).getByRole('button', { name: 'Cadastrando…' }).hasAttribute('disabled')).toBe(true);
    expect(form.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole('dialog', { name: 'Cadastrar candidato' })).toBe(dialog);
    expect(within(dialog).queryByText('Candidato cadastrado com sucesso.')).toBeNull();
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(request).toHaveBeenCalledWith(`/studies/${studyId}/candidates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Ana Silva' }),
    });
    persisted = true;
    await act(async () => finish(json({ ...row, studyId }, 201)));
    await screen.findByText('Candidato cadastrado com sucesso!');
    expect(screen.queryByRole('dialog')).toBeNull();
    const table = screen.getByRole('table', { name: 'Candidatos do estudo' });
    const candidate = await within(table).findByRole('row', { name: /Ana Silva/ });
    expect(within(candidate).getByText('07/11/2026')).toBeTruthy();
    expect(within(candidate).getByText(studies.find((study) => study.id === studyId)!.title)).toBeTruthy();
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).value).toBe(studyId);
    expect(request.mock.calls.filter(([path, options]) => path === `/studies/${studyId}/candidates` && !options?.method)).toHaveLength(2);
    expect(request.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1);
    expect(request.mock.calls.some(([path]) => /include|participant|consents|eligibility/.test(path))).toBe(false);
    expect(screen.queryByRole('button', { name: 'Voltar à listagem' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Ana Silva')).toBeTruthy();
  });

  it('impede campos inválidos antes de chamar o POST', async () => {
    request.mockImplementation(async () => json(studies));
    renderPage();
    const dialog = await openForm();
    fireEvent.change(within(dialog).getByLabelText(/Nome completo/), { target: { value: '   ' } });
    fireEvent.change(within(dialog).getByLabelText('E-mail (opcional)'), { target: { value: 'invalido' } });
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(within(dialog).getAllByRole('alert')).toHaveLength(2);
    expect(request.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(false);
  });

  it.each([
    [400, 'Confira o e-mail informado.'],
    [401, 'Sua sessão expirou ou é inválida. Entre novamente para continuar.'],
    [403, 'Você não tem permissão para cadastrar ou consultar candidatos neste estudo.'],
    [500, 'Não foi possível concluir a solicitação. Tente novamente.'],
  ])('apresenta HTTP %s sem confirmar cadastro nem recarregar candidatos', async (status, message) => {
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/studies/disponiveis-recrutamento') return json(studies);
      if (options?.method === 'POST') return json({ message: 'Confira o e-mail informado.' }, Number(status));
      return json([]);
    });
    renderPage();
    await selectStudy('study-1');
    await screen.findByText('O estudo selecionado não possui candidatos cadastrados.');
    const dialog = await openForm();
    fireEvent.submit(within(dialog).getByRole('form'));
    expect((await within(dialog).findByRole('alert')).textContent).toBe(message);
    expect(within(dialog).queryByText('Candidato cadastrado com sucesso.')).toBeNull();
    expect((within(dialog).getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('  Ana Silva  ');
    expect((within(dialog).getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement).disabled).toBe(false);
    expect(request.mock.calls.filter(([path, options]) => path.includes('/candidates') && !options?.method)).toHaveLength(1);
  });

  it('lista e filtra todos os status do backend, sem deduzir consentimento, e formata datas e timestamps', async () => {
    const rows = CANDIDATE_STATUSES.map((status, index) => ({ ...row, id: String(index), name: `Pessoa ${index}`, status,
      registeredAt: index === 0 ? '2026-10-16' : index === 1 ? '2026-11-07T00:30:00.000Z' : row.registeredAt }));
    request.mockImplementation(async (path: string) => json(path === '/studies/disponiveis-recrutamento' ? studies : [...rows, { ...row, studyId: 'other' }]));
    renderPage();
    await selectStudy('study-1');
    const table = screen.getByRole('table', { name: 'Candidatos do estudo' });
    await within(table).findByText('Pessoa 0');
    expect(within(table).getAllByRole('row')).toHaveLength(7);
    expect(within(table).getByText('16/10/2026')).toBeTruthy();
    expect(within(table).getAllByText('07/11/2026')).toHaveLength(5);
    expect(screen.queryByText('Ana Silva')).toBeNull();
    expect(screen.queryByText('Consentimento pendente')).toBeNull();
    for (const [index, status] of CANDIDATE_STATUSES.entries()) {
      fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: status } });
      expect(within(table).getAllByRole('row')).toHaveLength(2);
      expect(within(table).getByText(`Pessoa ${index}`)).toBeTruthy();
      expect(within(table).getByText(status)).toBeTruthy();
    }
  });

  it.each([401, 403, 500])('mostra falha HTTP %s na listagem e permite nova tentativa', async (status) => {
    let failed = true;
    request.mockImplementation(async (path: string) => path === '/studies/disponiveis-recrutamento'
      ? json(studies) : failed ? json({ message: 'Erro' }, status) : json([row]));
    renderPage();
    await selectStudy('study-1');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(status === 401 ? 'Sua sessão expirou' : status === 403 ? 'Você não tem permissão' : 'Não foi possível concluir');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    failed = false;
    fireEvent.click(within(alert).getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Ana Silva');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each(['sucesso', 'erro'])('ignora resposta HTTP atrasada (%s) depois da troca de estudo', async (outcome) => {
    let finish!: (response: Response) => void;
    let firstSignal: AbortSignal | undefined;
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/studies/disponiveis-recrutamento') return json(studies);
      if (path === '/studies/study-1/candidates') {
        firstSignal = options?.signal ?? undefined;
        return new Promise<Response>((resolve) => { finish = resolve; });
      }
      return json([{ ...row, id: 'candidate-2', studyId: 'study-2', name: 'Bruno Lima' }]);
    });
    renderPage();
    await selectStudy('study-1');
    await waitFor(() => expect(firstSignal).toBeDefined());
    await selectStudy('study-2');
    await screen.findByText('Bruno Lima');
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => finish(outcome === 'sucesso' ? json([row]) : json({}, 500)));
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.queryByText('Ana Silva')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
