import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoordinatorCandidatesPage } from './coordenatorPage';
import type { CandidateInclusion, CandidateStatus } from '../candidates/candidatesApi';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request, user: { id: 'coordinator-id', name: 'Rafael Lima' } }) }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const candidate = { id: 'c1', studyId: 's1', name: 'Ana Silva', email: null, registeredAt: '2026-11-08' };
const path = '/studies/s1/candidates/c1/include';
const inclusion: CandidateInclusion = { participationId: 'p1', candidateId: 'c1', studyId: 's1', includedAt: '2026-11-08', participationStatus: 'Ativo', participantsLinked: 1, participantLimit: 5 };
const success = 'Participante incluído com sucesso!';
let persistedStatus: CandidateStatus;
let post: () => Promise<Response>;
beforeEach(() => {
  persistedStatus = 'Elegível';
  post = async () => { persistedStatus = 'Incluído'; return json(inclusion, 201); };
  request.mockReset().mockImplementation(async (url: string) => {
    if (url === '/studies/disponiveis-recrutamento') return json([{ id: 's1', title: 'Sono' }]);
    if (url === '/studies/s1/candidates') return json([{ ...candidate, status: persistedStatus }]);
    if (url === path) return post();
    throw new Error(`Requisição inesperada: ${url}`);
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
const posts = () => request.mock.calls.filter(([, options]) => options?.method === 'POST');
async function details() {
  const view = render(<MemoryRouter initialEntries={['/coordenador/candidatos?studyId=s1']}><CoordinatorCandidatesPage /></MemoryRouter>);
  const row = await screen.findByRole('row', { name: /Ana Silva/ });
  fireEvent.click(within(row).getByRole('button', { name: 'Detalhes' }));
  return { view, dialog: screen.getByRole('dialog', { name: 'Detalhes do candidato' }) };
}
async function open() {
  const result = await details();
  fireEvent.click(within(result.dialog).getByRole('button', { name: 'Incluir participante' }));
  expect(screen.getByRole('dialog', { name: 'Incluir participante' })).toBe(result.dialog);
  return result;
}

describe('RF11 — modal com integração HTTP autenticada', () => {
  it('solicita confirmação e permite cancelar sem enviar nem alterar o candidato', async () => {
    const { dialog } = await open();
    const form = within(dialog).getByRole('form', { name: 'Inclusão de participante' });
    expect(within(form).getByText(candidate.name)).toBeTruthy();
    expect(within(form).getByText('Sono')).toBeTruthy();
    expect(within(form).getByText('Confirma a inclusão deste candidato como participante?')).toBeTruthy();
    expect(posts()).toHaveLength(0);
    fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
    expect(within(dialog).getByText('Elegível')).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it('aguarda POST sem corpo, bloqueia duplicatas, retorna aos detalhes e recupera a inclusão após remontar', async () => {
    let finish!: (response: Response) => void;
    post = () => new Promise((resolve) => { finish = resolve; });
    const { dialog, view } = await open();
    const form = within(dialog).getByRole('form');
    fireEvent.click(within(form).getByRole('button', { name: 'Confirmar inclusão' }));
    fireEvent.submit(form);
    expect(posts()).toHaveLength(1);
    expect(request).toHaveBeenCalledWith(path, { method: 'POST', signal: expect.any(AbortSignal) });
    expect(posts()[0][1].body).toBeUndefined();
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect((within(form).getByRole('button', { name: 'Confirmar inclusão' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(form).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).queryByText(success)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole('dialog', { name: 'Incluir participante' })).toBe(dialog);
    expect(within(screen.getByRole('row', { name: /Ana Silva/ })).getByText('Elegível')).toBeTruthy();
    persistedStatus = 'Incluído';
    await act(async () => finish(json(inclusion, 201)));
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).queryByRole('form')).toBeNull();
    expect(within(dialog).getByRole('status').textContent).toContain(success);
    expect(within(within(dialog).getByRole('region', { name: 'Resumo do candidato' })).getByText('Incluído')).toBeTruthy();
    const row = await screen.findByRole('row', { name: /Ana Silva.*Incluído/ });
    expect(within(row).getByText('Incluído')).toBeTruthy();
    expect(request.mock.calls.filter(([url]) => url === '/studies/s1/candidates')).toHaveLength(2);
    const repeat = within(dialog).getByRole('button', { name: 'Incluir participante' }) as HTMLButtonElement;
    expect(repeat.disabled).toBe(true);
    fireEvent.click(repeat);
    expect(posts()).toHaveLength(1);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Fechar' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar confirmação de inclusão' }));
    expect(within(dialog).queryByRole('status')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    view.unmount();
    const reopened = await details();
    expect(within(reopened.dialog).getByText('Incluído')).toBeTruthy();
    expect(within(reopened.dialog).queryByText(success)).toBeNull();
    expect(request.mock.calls.some(([url]) => /consents|eligibility-assessments/.test(url))).toBe(false);
  });

  it('fecha a confirmação após seis segundos e mantém os detalhes visíveis', async () => {
    const { dialog } = await open();
    vi.useFakeTimers();
    await act(async () => fireEvent.submit(within(dialog).getByRole('form')));
    expect(within(dialog).getByRole('status').textContent).toContain(success);
    act(() => { vi.advanceTimersByTime(6000); });
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
  });

  it.each([
    [400, 'Candidato inelegível: avalie e aprove todos os critérios antes da inclusão.', 'Inelegível'],
    [400, 'Candidato inelegível: todos os critérios ativos devem estar avaliados e atendidos.', 'Em avaliação'],
    [400, 'Consentimento ausente ou não concedido: registre o consentimento antes da inclusão.', 'Elegível'],
    [400, 'Limite de vagas atingido: não há vagas disponíveis neste estudo.', 'Elegível'],
    [400, 'O candidato já foi incluído neste estudo.', 'Elegível'],
    [400, 'Não é possível incluir participantes em um estudo encerrado.', 'Elegível'],
    [401, 'Sua sessão expirou ou não está autorizada.', 'Elegível'],
    [403, 'Você não tem permissão para incluir participantes neste estudo.', 'Elegível'],
    [404, 'Candidato ou estudo não encontrado.', 'Elegível'],
    [500, 'Não foi possível confirmar a inclusão no servidor.', 'Elegível'],
    [0, 'Não foi possível comunicar com o servidor.', 'Elegível'],
  ] as const)('mantém confirmação e status após recusa %s: %s', async (status, message, candidateStatus) => {
    persistedStatus = candidateStatus;
    post = async () => { if (!status) throw new TypeError('offline'); return json({ message }, status); };
    const { dialog } = await open();
    fireEvent.submit(within(dialog).getByRole('form'));
    expect((await within(dialog).findByRole('alert')).textContent).toContain(message);
    expect(screen.getByRole('dialog', { name: 'Incluir participante' })).toBe(dialog);
    expect(within(dialog).queryByText(success)).toBeNull();
    expect(within(screen.getByRole('row', { name: /Ana Silva/ })).getByText(candidateStatus)).toBeTruthy();
    expect(request.mock.calls.filter(([url]) => url === '/studies/s1/candidates')).toHaveLength(1);
    expect((within(dialog).getByRole('button', { name: 'Confirmar inclusão' }) as HTMLButtonElement).disabled).toBe(false);
    if (status === 400 || status >= 500 || !status) {
      post = async () => { persistedStatus = 'Incluído'; return json(inclusion, 201); };
      fireEvent.submit(within(dialog).getByRole('form'));
      await within(dialog).findByText(success);
      expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
    } else {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
      expect(within(dialog).getByText(candidateStatus)).toBeTruthy();
    }
  });

  it.each([
    null, { ...inclusion, candidateId: 'other' }, { ...inclusion, studyId: 'other' },
    { ...inclusion, participantsLinked: undefined }, { ...inclusion, participationStatus: 'Inativo' },
  ])('não confirma resposta de sucesso inválida: %j', async (response) => {
    post = async () => json(response, 201);
    const { dialog } = await open();
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByRole('alert');
    expect(screen.getByRole('dialog', { name: 'Incluir participante' })).toBe(dialog);
    expect(within(dialog).queryByText(success)).toBeNull();
    expect(within(screen.getByRole('row', { name: /Ana Silva/ })).getByText('Elegível')).toBeTruthy();
    expect(request.mock.calls.filter(([url]) => url === '/studies/s1/candidates')).toHaveLength(1);
  });
});
