import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CoordinatorCandidatesPage } from './coordenatorPage';
import type { CandidateConsent, CandidateConsentStatus } from '../candidates/candidatesApi';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request, user: { id: 'coordinator-id', name: 'Rafael Lima' } }) }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const candidate = { id: 'c1', studyId: 's1', name: 'Ana Silva', email: null, status: 'Elegível', registeredAt: '2026-11-08' };
const path = '/studies/s1/candidates/c1/consents';
const unrecorded: CandidateConsent = { studyId: 's1', candidateId: 'c1', status: null, termVersion: null, registeredAt: null, registrarId: null, observation: null };
const recorded = (status: CandidateConsentStatus = 'Registrado'): CandidateConsent => ({
  ...unrecorded, status, termVersion: 'v-servidor', registeredAt: '2026-11-08 16:00:00.123+00', registrarId: 'coordinator-id', observation: 'Nota persistida',
});
let persisted: CandidateConsent;
let post: (options: RequestInit) => Promise<Response>;
beforeEach(() => {
  persisted = unrecorded;
  post = async (options) => { persisted = recorded(JSON.parse(options.body as string).status); return json(persisted, 201); };
  request.mockReset().mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === '/studies/disponiveis-recrutamento') return json([{ id: 's1', title: 'Sono' }]);
    if (url === '/studies/s1/candidates') return json([candidate]);
    if (url === path) return options?.method === 'POST' ? post(options) : json(persisted);
    throw new Error(`Requisição inesperada: ${url}`);
  });
});
afterEach(cleanup);

async function open(waitForConsent = true) {
  const view = render(<MemoryRouter initialEntries={['/coordenador/candidatos?studyId=s1']}><CoordinatorCandidatesPage /></MemoryRouter>);
  const row = await screen.findByRole('row', { name: /Ana Silva/ });
  fireEvent.click(within(row).getByRole('button', { name: 'Detalhes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Registrar consentimento' }));
  const dialog = screen.getByRole('dialog', { name: 'Registrar consentimento' });
  if (waitForConsent) await within(dialog).findByText(persisted.status ?? 'Não registrado', { selector: 'strong' });
  return { dialog, view };
}
function fill(status: CandidateConsentStatus = 'Registrado') {
  fireEvent.click(screen.getByRole('radio', { name: status }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Versão do termo simulado *' }), { target: { value: ' v-teste ' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Observações (opcional)' }), { target: { value: ' Nota RF10 ' } });
}
const posts = () => request.mock.calls.filter(([, options]) => options?.method === 'POST');

describe('RF10 — modal existente com adaptadores HTTP reais e transporte simulado', () => {
  it.each([null, 'Registrado', 'Recusado', 'Revogado'] as const)('consulta %s, apresenta os dados reais e preserva a indicação de simulação', async (status) => {
    persisted = status ? recorded(status) : unrecorded;
    const { dialog } = await open();
    expect(request).toHaveBeenCalledWith(path, { signal: expect.any(AbortSignal) });
    expect(within(dialog).getByText(/este registro é fictício e utilizado exclusivamente para fins educacionais/)).toBeTruthy();
    expect(within(dialog).queryByText(/Responsável pelo último registro \(ID\)/)).toBeNull();
    expect(within(dialog).queryByText('coordinator-id')).toBeNull();
    if (status) {
      expect(within(dialog).getByText('v-servidor', { selector: 'strong' })).toBeTruthy();
      expect(within(dialog).getByText('Rafael Lima')).toBeTruthy();
      expect(within(dialog).getByText('Nota persistida', { selector: 'strong' })).toBeTruthy();
      expect(dialog.querySelector('time')?.getAttribute('datetime')).toBe(persisted.registeredAt);
    } else {
      expect(within(dialog).queryByText('Recusado', { selector: 'strong' })).toBeNull();
      expect((within(dialog).getByRole('textbox', { name: 'Versão do termo simulado *' }) as HTMLInputElement).value).toBe('');
    }
  });

  it.each(['Registrado', 'Recusado', 'Revogado'] as const)('registra %s somente após HTTP válido, atualiza os campos e recupera após reabrir e remontar', async (status) => {
    let finish!: (response: Response) => void;
    post = () => new Promise((resolve) => { finish = resolve; });
    const { dialog, view } = await open();
    fill(status);
    const form = within(dialog).getByRole('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body as string)).toEqual({ status, termVersion: 'v-teste', observation: 'Nota RF10' });
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(within(dialog).queryByText('Consentimento simulado registrado com sucesso!')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole('dialog')).toBe(dialog);
    persisted = recorded(status);
    await act(async () => finish(json(persisted, 201)));
    await within(dialog).findByText('Consentimento simulado registrado com sucesso!');
    expect(within(dialog).getByText(status, { selector: 'strong' })).toBeTruthy();
    expect((within(dialog).getByRole('textbox', { name: 'Versão do termo simulado *' }) as HTMLInputElement).value).toBe('v-servidor');
    expect((within(dialog).getByRole('textbox', { name: 'Observações (opcional)' }) as HTMLTextAreaElement).value).toBe('Nota persistida');
    expect(within(dialog).getByText('Rafael Lima')).toBeTruthy();
    expect(dialog.querySelector('time')?.getAttribute('datetime')).toBe(persisted.registeredAt);
    fireEvent.submit(form);
    expect(posts()).toHaveLength(1);
    expect(within(screen.getByRole('row', { name: /Ana Silva/ })).getByText('Elegível')).toBeTruthy();
    expect(request.mock.calls.filter(([url]) => url === '/studies/s1/candidates')).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    fireEvent.click(within(screen.getByRole('row', { name: /Ana Silva/ })).getByRole('button', { name: 'Detalhes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar consentimento' }));
    await screen.findByText(status, { selector: 'strong' });
    expect((screen.getByRole('radio', { name: status }) as HTMLInputElement).checked).toBe(true);
    expect(request.mock.calls.filter(([url, options]) => url === path && options?.method !== 'POST')).toHaveLength(2);
    view.unmount(); // Reconstrói a página como no Ctrl+R, sem reutilizar dados em estado React.
    await open();
    expect(screen.getByText(status, { selector: 'strong' })).toBeTruthy();
    expect(request.mock.calls.some(([url]) => /eligibility|\/include/.test(url))).toBe(false);
  });

  it('mantém as validações de versão obrigatória, 50 caracteres e observação de 2.000 caracteres', async () => {
    const { dialog } = await open();
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(within(dialog).getAllByRole('alert')).toHaveLength(2);
    fill();
    fireEvent.change(screen.getByRole('textbox', { name: 'Versão do termo simulado *' }), { target: { value: 'a'.repeat(51) } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Observações (opcional)' }), { target: { value: 'a'.repeat(2001) } });
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(screen.getByText('A versão deve ter no máximo 50 caracteres.')).toBeTruthy();
    expect(screen.getByText('A observação deve ter no máximo 2.000 caracteres.')).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it.each([400, 401, 403, 404, 503, 0])('preserva valores e não confirma sucesso após falha %s', async (status) => {
    post = async () => { if (!status) throw new Error('offline'); return json({ message: 'Versão recusada.' }, status); };
    const { dialog } = await open();
    fill();
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByRole('alert');
    expect(within(dialog).queryByText('Consentimento simulado registrado com sucesso!')).toBeNull();
    expect((within(dialog).getByRole('textbox', { name: 'Versão do termo simulado *' }) as HTMLInputElement).value).toBe(' v-teste ');
    expect((within(dialog).getByRole('textbox', { name: 'Observações (opcional)' }) as HTMLTextAreaElement).value).toBe(' Nota RF10 ');
    expect(within(dialog).getByText('Não registrado')).toBeTruthy();
    post = async () => { persisted = recorded(); return json(persisted, 201); };
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByText('Consentimento simulado registrado com sucesso!');
  });

  it('trata falha de consulta e permite recarregar sem inventar ausência de consentimento', async () => {
    const transport = request.getMockImplementation()!;
    let failed = true;
    request.mockImplementation(async (url: string, options?: RequestInit) => url === path && failed ? json({}, 503) : transport(url, options));
    const { dialog } = await open(false);
    await within(dialog).findByRole('alert');
    expect(within(dialog).queryByText('Não registrado')).toBeNull();
    expect((within(dialog).getByRole('button', { name: 'Registrar consentimento' }) as HTMLButtonElement).disabled).toBe(true);
    failed = false;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tentar novamente' }));
    await within(dialog).findByText('Não registrado');
  });

  it('rejeita confirmação de outro candidato e preserva os valores', async () => {
    post = async () => json({ ...recorded(), candidateId: 'other' }, 201);
    const { dialog } = await open();
    fill();
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByRole('alert');
    expect(within(dialog).queryByText('Consentimento simulado registrado com sucesso!')).toBeNull();
    expect((within(dialog).getByRole('textbox', { name: 'Versão do termo simulado *' }) as HTMLInputElement).value).toBe(' v-teste ');
  });

  it.each(['sucesso', 'erro'])('ignora %s tardio ao fechar e selecionar outro candidato', async (outcome) => {
    const transport = request.getMockImplementation()!;
    let finish!: (response: Response) => void;
    let signal!: AbortSignal;
    request.mockImplementation(async (url: string, options?: RequestInit) => {
      if (url === '/studies/s1/candidates') return json([candidate, { ...candidate, id: 'c2', name: 'Bruno Lima' }]);
      if (url === path) { signal = options!.signal as AbortSignal; return new Promise<Response>((resolve) => { finish = resolve; }); }
      if (url.endsWith('/c2/consents')) return json({ ...unrecorded, candidateId: 'c2' });
      return transport(url, options);
    });
    const { dialog } = await open(false);
    await waitFor(() => expect(signal).toBeDefined());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    fireEvent.click(within(screen.getByRole('row', { name: /Bruno Lima/ })).getByRole('button', { name: 'Detalhes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Registrar consentimento' }));
    await screen.findByText('Não registrado');
    expect(signal.aborted).toBe(true);
    await act(async () => finish(outcome === 'sucesso' ? json(recorded()) : json({}, 500)));
    const current = screen.getByRole('dialog');
    expect(within(current).getByText('Não registrado')).toBeTruthy();
    expect(within(current).queryByText('v-servidor')).toBeNull();
    expect(within(current).queryByRole('alert')).toBeNull();
  });
});
