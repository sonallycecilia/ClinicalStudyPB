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
    const summary = within(form).getByRole('region', { name: 'Resumo do candidato' });
    expect(within(summary).getByText(candidate.name)).toBeTruthy();
    expect(within(summary).getByText('Estudo de interesse')).toBeTruthy();
    expect(within(dialog).getAllByText(candidate.name)).toHaveLength(1);
    expect(within(dialog).queryByText(/A inclusão depende de elegibilidade aprovada/)).toBeNull();
    expect(within(dialog).queryByText('Confirma a inclusão deste candidato como participante?')).toBeNull();
    expect(within(form).getAllByRole('button').map((button) => button.textContent)).toEqual(['Cancelar', 'Confirmar inclusão']);
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
    expect(dialog.querySelector('[aria-busy="true"]')).toBeNull();
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
    [400, 'CANDIDATE_INELIGIBLE', 'O candidato não atende aos critérios de elegibilidade do estudo.', 'Inelegível'],
    [400, 'ELIGIBILITY_PENDING', 'A avaliação de elegibilidade do candidato ainda não foi concluída.', 'Em avaliação'],
    [400, 'CONSENT_MISSING', 'O consentimento simulado do candidato ainda não foi registrado.', 'Elegível'],
    [400, 'CONSENT_NOT_GRANTED', 'O candidato não possui consentimento válido para participar.', 'Elegível'],
    [400, 'STUDY_FULL', 'O estudo não possui vagas disponíveis.', 'Elegível'],
    [400, 'CANDIDATE_ALREADY_INCLUDED', 'Este candidato já foi incluído no estudo.', 'Elegível'],
    [400, undefined, 'Não foi possível concluir a inclusão. Tente novamente.', 'Elegível'],
    [400, 'UNKNOWN_CODE', 'Não foi possível concluir a inclusão. Tente novamente.', 'Elegível'],
    [401, undefined, 'Sua sessão expirou ou não está autorizada.', 'Elegível'],
    [403, undefined, 'Você não tem permissão para realizar esta inclusão.', 'Elegível'],
    [404, undefined, 'Estudo ou candidato não encontrado.', 'Elegível'],
    [500, undefined, 'Não foi possível concluir a inclusão. Tente novamente.', 'Elegível'],
    [0, undefined, 'Não foi possível concluir a inclusão. Tente novamente.', 'Elegível'],
  ] as const)('mantém confirmação e status após recusa %s: %s', async (status, code, message, candidateStatus) => {
    persistedStatus = candidateStatus;
    post = async () => { if (!status) throw new TypeError('offline'); return json({ code, message: 'Motivo interno do servidor.' }, status); };
    const { dialog } = await open();
    fireEvent.submit(within(dialog).getByRole('form'));
    const alert = await within(dialog).findByRole('alert');
    expect(within(dialog).getAllByRole('alert')).toHaveLength(1);
    expect(within(alert).getByRole('heading', { name: 'Não foi possível incluir o participante' })).toBeTruthy();
    expect(alert.querySelector('p')?.textContent).toContain(message);
    expect(alert.querySelectorAll('p')).toHaveLength(1);
    expect(within(dialog).getByText(candidate.name)).toBeTruthy();
    expect(within(dialog).getByText('Sono')).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Incluir participante' })).toBe(dialog);
    expect(within(dialog).getByRole('form').getAttribute('aria-busy')).toBe('false');
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
