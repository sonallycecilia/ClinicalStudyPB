import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { CoordinatorCandidatesPage } from './coordenatorPage';
import { useCandidateEligibilityCriteria } from '../candidates/useCandidateEligibilityCriteria';
import type { CandidateEligibilityAssessment } from '../candidates/candidatesApi';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request, user: { id: 'coordinator-id', name: 'Rafael Lima' } }) }));
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const criteria = [
  { id: 'inc', studyId: 's1', type: 'Inclusão', description: 'Idade mínima', active: true },
  { id: 'exc', studyId: 's1', type: 'Exclusão', description: 'Impedimento', active: true },
  { id: 'inactive', studyId: 's1', type: 'Inclusão', description: 'Desativado', active: false },
];
const candidate = { id: 'c1', studyId: 's1', name: 'Ana Silva', email: null, registeredAt: '2026-11-08', status: 'Novo' };
const base = '/studies/s1/candidates/c1/eligibility-assessments';
const empty: CandidateEligibilityAssessment = { studyId: 's1', candidateId: 'c1', status: 'Novo', evaluations: [] };
function saved(status: CandidateEligibilityAssessment['status'] = 'Elegível'): CandidateEligibilityAssessment {
  return { ...empty, status, evaluations: criteria.filter((item) => item.active).map((item) => ({
    id: `saved-${item.id}`, criterionId: item.id, criterionType: item.type as 'Inclusão' | 'Exclusão', criterionDescription: item.description,
    result: item.type === 'Inclusão' ? 'Atende' : 'Não atende', observation: item.id === 'inc' ? 'Resposta salva' : null,
    evaluatorId: 'coordinator-id', evaluatedAt: '2026-11-08 13:00:00.123+00',
  })) };
}
let persisted: CandidateEligibilityAssessment;
let post: (options: RequestInit) => Promise<Response>;
let activeCriteria: typeof criteria;
beforeEach(() => {
  persisted = empty;
  activeCriteria = criteria;
  post = async () => { persisted = saved(); return json(persisted, 201); };
  request.mockReset().mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/studies/disponiveis-recrutamento') return json([{ id: 's1', title: 'Sono' }]);
    if (path === '/studies/s1/criteria') return json(activeCriteria);
    if (path === base) return options?.method === 'POST' ? post(options) : json(persisted);
    if (path === '/studies/s1/candidates') return json([{ ...candidate, status: persisted.status }]);
    throw new Error(`Requisição inesperada: ${path}`);
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function open(waitForCriteria = true) {
  render(<StrictMode><MemoryRouter initialEntries={['/?studyId=s1']}><CoordinatorCandidatesPage /></MemoryRouter></StrictMode>);
  await screen.findByRole('option', { name: 'Sono' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por estudo' }), { target: { value: 's1' } });
  const row = await screen.findByRole('row', { name: /Ana Silva/ });
  fireEvent.click(within(row).getByRole('button', { name: 'Detalhes' }));
  fireEvent.click(screen.getByRole('button', { name: 'Avaliar elegibilidade' }));
  if (waitForCriteria) await screen.findByRole('group', { name: 'Idade mínima' });
  return screen.getByRole('dialog');
}
function answer() {
  fireEvent.click(within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('radio', { name: 'Atende' }));
  fireEvent.click(within(screen.getByRole('group', { name: 'Impedimento' })).getByRole('radio', { name: 'Não atende' }));
}
const posts = () => request.mock.calls.filter(([, options]) => options?.method === 'POST');

describe('RF09 — interface e adaptadores HTTP reais, transporte simulado', () => {
  it('consulta critérios reais e avaliações, separa ausência de avaliação de Pendente e mostra somente critérios ativos', async () => {
    const dialog = await open();
    expect(request).toHaveBeenCalledWith('/studies/s1/criteria', { signal: expect.any(AbortSignal) });
    expect(request).toHaveBeenCalledWith(base, { signal: expect.any(AbortSignal) });
    expect(within(dialog).queryByText('Nenhuma avaliação registrada para este candidato.')).toBeNull();
    expect(within(dialog).getAllByRole('radio').every((item) => !(item as HTMLInputElement).checked)).toBe(true);
    expect(within(dialog).queryByText('Desativado')).toBeNull();
    expect(within(dialog).queryByText(/ID do critério:/)).toBeNull();
    expect(within(dialog).queryByText(/Selecione um resultado para cada critério/)).toBeNull();
    expect(within(dialog).getByRole('form').querySelectorAll('.modal-actions button')).toHaveLength(2);
    const summary = within(dialog).getByRole('region', { name: 'Resumo do candidato' });
    expect(within(summary).getByText('Ana Silva')).toBeTruthy();
    expect(within(summary).getByText('Sono')).toBeTruthy();
    expect(within(summary).getByText('Novo')).toBeTruthy();
  });

  it('preenche resultados e observações salvos, data e identidade do avaliador', async () => {
    persisted = saved('Em avaliação');
    persisted.evaluations[0].result = 'Pendente';
    const dialog = await open();
    const group = within(dialog).getByRole('group', { name: 'Idade mínima' });
    expect((within(group).getByRole('radio', { name: 'Pendente' }) as HTMLInputElement).checked).toBe(true);
    expect((within(group).getByRole('textbox') as HTMLTextAreaElement).value).toBe('Resposta salva');
    expect(within(group).getByText(/Responsável: Rafael Lima/)).toBeTruthy();
    expect(within(dialog).queryByText(/coordinator-id/)).toBeNull();
    expect(group.querySelector('time')?.getAttribute('datetime')).toBe(persisted.evaluations[0].evaluatedAt);
    expect(within(dialog).queryByText(/Elegibilidade atual:/)).toBeNull();
    expect(within(dialog).queryByText('Nenhuma avaliação registrada para este candidato.')).toBeNull();
    fireEvent.click(within(group).getByRole('radio', { name: 'Não atende' }));
    fireEvent.change(within(group).getByRole('textbox'), { target: { value: '' } });
    expect((within(group).getByRole('radio', { name: 'Não atende' }) as HTMLInputElement).checked).toBe(true);
    expect((within(group).getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
    expect(posts()).toHaveLength(0);
  });

  it('oculta o identificador do responsável quando seu nome não está disponível', async () => {
    persisted = saved();
    persisted.evaluations.forEach((evaluation) => { evaluation.evaluatorId = 'other-evaluator-uuid'; });
    const dialog = await open();
    expect(within(dialog).queryByText(/other-evaluator-uuid/)).toBeNull();
    expect(within(dialog).queryByText(/Responsável:/)).toBeNull();
    expect(dialog.querySelectorAll('time')).toHaveLength(2);
  });

  it('sincroniza o resumo, os detalhes e a listagem quando a consulta da avaliação é mais recente', async () => {
    const transport = request.getMockImplementation()!;
    let listCalls = 0;
    persisted = saved('Inelegível');
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (path === '/studies/s1/candidates' && ++listCalls === 1) return json([{ ...candidate, status: 'Em avaliação' }]);
      return transport(path, options);
    });
    const dialog = await open();
    const summary = within(dialog).getByRole('region', { name: 'Resumo do candidato' });
    await within(summary).findByText('Inelegível');
    expect(screen.getByRole('dialog', { name: 'Avaliar elegibilidade' })).toBe(dialog);
    expect(within(summary).queryByText('Em avaliação')).toBeNull();
    const row = await screen.findByRole('row', { name: /Ana Silva.*Inelegível/ });
    expect(within(row).getByText('Inelegível')).toBeTruthy();
    expect(posts()).toHaveLength(0);
    expect(within(dialog).queryByText(/Avaliação registrada com sucesso/)).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Voltar aos detalhes' }));
    expect(within(screen.getByRole('dialog')).getByText('Inelegível')).toBeTruthy();
  });

  it.each([
    ['Atende', 'Não atende', 'Elegível'],
    ['Não atende', 'Não atende', 'Inelegível'],
    ['Atende', 'Atende', 'Inelegível'],
    ['Pendente', 'Não atende', 'Em avaliação'],
    ['Pendente', 'Atende', 'Inelegível'],
  ] as const)('mantém o contrato Inclusão %s / Exclusão %s e exibe %s salvo e reaberto', async (inclusion, exclusion, status) => {
    post = async (options) => {
      expect(JSON.parse(options.body as string)).toEqual({ evaluations: [
        { criterionId: 'inc', result: inclusion, observation: '' },
        { criterionId: 'exc', result: exclusion, observation: '' },
      ] });
      persisted = saved(status);
      persisted.evaluations[0].result = inclusion;
      persisted.evaluations[1].result = exclusion;
      return json(persisted, 201);
    };
    const dialog = await open();
    fireEvent.click(within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('radio', { name: inclusion }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Impedimento' })).getByRole('radio', { name: exclusion }));
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByText('Avaliação registrada com sucesso!');
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
    expect(within(dialog).queryByRole('form')).toBeNull();
    expect(within(within(dialog).getByRole('region', { name: 'Resumo do candidato' })).getByText(status)).toBeTruthy();
    await screen.findByRole('row', { name: new RegExp(`Ana Silva.*${status}`) });
    fireEvent.click(screen.getByRole('button', { name: 'Avaliar elegibilidade' }));
    const summary = within(screen.getByRole('dialog')).getByRole('region', { name: 'Resumo do candidato' });
    await waitFor(() => expect((within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('radio', { name: inclusion }) as HTMLInputElement).checked).toBe(true));
    expect((within(screen.getByRole('group', { name: 'Impedimento' })).getByRole('radio', { name: exclusion }) as HTMLInputElement).checked).toBe(true);
    expect(within(summary).getByText(status)).toBeTruthy();
  });

  it.each(['Elegível', 'Inelegível', 'Em avaliação'] as const)('aguarda confirmação, retorna aos detalhes com %s e reconsulta listagem e avaliação ao reabrir', async (status) => {
    let finish!: (response: Response) => void;
    post = () => new Promise((resolve) => { finish = resolve; });
    const dialog = await open();
    answer();
    fireEvent.change(within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('textbox'), { target: { value: 'Rascunho enviado' } });
    const form = within(dialog).getByRole('form');
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(posts()).toHaveLength(1);
    expect(JSON.parse(posts()[0][1].body as string)).toEqual({ evaluations: [
      { criterionId: 'inc', result: 'Atende', observation: 'Rascunho enviado' },
      { criterionId: 'exc', result: 'Não atende', observation: '' },
    ] });
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect((within(dialog).getByRole('button', { name: 'Registrando…' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(dialog).queryByText(/Avaliação registrada com sucesso/)).toBeNull();
    expect(within(within(dialog).getByRole('region', { name: 'Resumo do candidato' })).getByText('Novo')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.getByRole('dialog')).toBe(dialog);
    persisted = saved(status); // status deliberadamente independente das respostas do formulário
    await act(async () => finish(json(persisted, 201)));
    expect(within(dialog).getByRole('status').textContent).toContain('Avaliação registrada com sucesso!');
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(within(dialog).queryByRole('form')).toBeNull();
    expect(within(within(dialog).getByRole('region', { name: 'Resumo do candidato' })).getByText(status)).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Fechar' }));
    for (const action of ['Avaliar elegibilidade', 'Registrar consentimento', 'Incluir participante']) expect(within(dialog).getByRole('button', { name: action })).toBeTruthy();
    expect(posts()).toHaveLength(1);
    const row = await screen.findByRole('row', { name: new RegExp(`Ana Silva.*${status}`) });
    expect(within(row).getByText(status)).toBeTruthy();
    expect(request.mock.calls.filter(([path]) => path === '/studies/s1/candidates')).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar confirmação de avaliação' }));
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
    fireEvent.click(screen.getByRole('button', { name: 'Avaliar elegibilidade' }));
    const group = await screen.findByRole('group', { name: 'Idade mínima' });
    await waitFor(() => expect((within(group).getByRole('textbox') as HTMLTextAreaElement).value).toBe('Resposta salva'));
    expect((within(group).getByRole('radio', { name: persisted.evaluations[0].result }) as HTMLInputElement).checked).toBe(true);
    expect((within(screen.getByRole('group', { name: 'Impedimento' })).getByRole('radio', { name: persisted.evaluations[1].result }) as HTMLInputElement).checked).toBe(true);
    // StrictMode monta os efeitos duas vezes; cada abertura realiza uma nova consulta.
    expect(request.mock.calls.filter(([path, options]) => path === base && options?.method !== 'POST')).toHaveLength(4);
    expect(request.mock.calls.some(([path]) => /consents|\/include/.test(path))).toBe(false);
  });

  it('oculta a confirmação após seis segundos sem fechar os detalhes', async () => {
    const dialog = await open();
    answer();
    vi.useFakeTimers();
    await act(async () => fireEvent.submit(within(dialog).getByRole('form')));
    expect(within(dialog).getByRole('status').textContent).toContain('Avaliação registrada com sucesso!');
    act(() => { vi.advanceTimersByTime(5000); });
    expect(within(dialog).getByRole('status')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(within(dialog).queryByRole('status')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('valida respostas obrigatórias e observações antes de enviar', async () => {
    const dialog = await open();
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(within(dialog).getAllByRole('alert')).toHaveLength(2);
    answer();
    fireEvent.change(within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('textbox'), { target: { value: 'a'.repeat(2001) } });
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(within(dialog).getByText('A observação deve ter no máximo 2.000 caracteres.')).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it.each([
    [400, 'Informe exatamente uma avaliação para cada critério ativo do estudo.'],
    [400, 'O candidato já foi incluído neste estudo e não pode ser reavaliado.'],
    [400, 'Não é possível avaliar candidatos em um estudo encerrado.'],
    [401, 'Sua sessão expirou ou é inválida. Entre novamente para continuar.'],
    [403, 'Você não tem permissão para consultar ou registrar avaliações neste estudo.'],
    [404, 'Estudo ou candidato não encontrado neste estudo. Atualize a listagem.'],
    [503, 'Não foi possível concluir a avaliação. Consulte os dados e tente novamente.'],
    [0, 'Não foi possível comunicar com o servidor. Consulte a avaliação antes de tentar registrar novamente.'],
  ])('preserva preenchimento após falha %s e permite nova tentativa após corrigir a causa', async (status, message) => {
    post = async () => { if (!status) throw new Error('offline'); return json({ message }, Number(status)); };
    const dialog = await open();
    answer();
    const observation = within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(observation, { target: { value: 'Não perder' } });
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByText(String(message));
    expect(screen.getByRole('dialog', { name: 'Avaliar elegibilidade' })).toBe(dialog);
    expect(observation.value).toBe('Não perder');
    expect((within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('radio', { name: 'Atende' }) as HTMLInputElement).checked).toBe(true);
    expect((within(screen.getByRole('group', { name: 'Impedimento' })).getByRole('radio', { name: 'Não atende' }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).queryByText(/Avaliação registrada com sucesso/)).toBeNull();
    expect(within(within(dialog).getByRole('region', { name: 'Resumo do candidato' })).getByText('Novo')).toBeTruthy();
    expect(within(screen.getByRole('row', { name: /Ana Silva/ })).getByText('Novo')).toBeTruthy();
    post = async () => { persisted = saved(); return json(persisted, 201); };
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByText('Avaliação registrada com sucesso!');
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(dialog);
  });

  it('atualiza critérios após desativação sem perder respostas dos critérios ainda ativos', async () => {
    post = async () => json({ message: 'Critérios alterados.' }, 400);
    const dialog = await open();
    answer();
    const observation = within(screen.getByRole('group', { name: 'Idade mínima' })).getByRole('textbox');
    fireEvent.change(observation, { target: { value: 'Preservar' } });
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByText('Critérios alterados.');
    activeCriteria = criteria.map((item) => item.id === 'exc' ? { ...item, active: false } : item);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Atualizar critérios e avaliações' }));
    const group = await within(dialog).findByRole('group', { name: 'Idade mínima' });
    expect((within(group).getByRole('textbox') as HTMLTextAreaElement).value).toBe('Preservar');
    expect(within(dialog).queryByRole('group', { name: 'Impedimento' })).toBeNull();
    post = async (options) => { expect(JSON.parse(options.body as string).evaluations).toHaveLength(1); persisted = { ...saved(), evaluations: [saved().evaluations[0]] }; return json(persisted); };
    fireEvent.submit(within(dialog).getByRole('form'));
    await within(dialog).findByText(/Avaliação registrada com sucesso/);
  });

  it('mantém candidato incluído somente para consulta', async () => {
    persisted = saved('Incluído');
    const dialog = await open();
    expect(within(dialog).getByText(/já foi incluído/)).toBeTruthy();
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(posts()).toHaveLength(0);
    expect((within(dialog).getByRole('button', { name: 'Registrar avaliação' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it.each([401, 403, 404, 503])('trata HTTP %s na consulta de avaliações sem permitir sobrescrever respostas não carregadas', async (status) => {
    const transport = request.getMockImplementation()!;
    let failed = true;
    request.mockImplementation(async (path: string, options?: RequestInit) => path === base && failed
      ? json({ message: 'Erro de consulta' }, status) : transport(path, options));
    const dialog = await open(false);
    await within(dialog).findByRole('alert');
    expect(within(dialog).queryByRole('radio')).toBeNull();
    expect(within(dialog).queryByText('Nenhuma avaliação registrada para este candidato.')).toBeNull();
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(posts()).toHaveLength(0);
    const retry = within(dialog).queryByRole('button', { name: 'Tentar novamente' });
    if (status === 503) {
      failed = false;
      fireEvent.click(retry!);
      await within(dialog).findByRole('group', { name: 'Idade mínima' });
    } else expect(retry).toBeNull();
  });

  it.each(['sucesso', 'erro'])('ignora %s tardio das avaliações ao trocar candidato e estudo', async (outcome) => {
    let finish!: (response: Response) => void;
    let fail!: (error: Error) => void;
    request.mockImplementation(async (path: string) => {
      if (path === base) return new Promise<Response>((resolve, reject) => { finish = resolve; fail = reject; });
      if (path === '/studies/s1/criteria') return json(criteria);
      if (path.endsWith('/criteria')) return json([]);
      return json({ ...empty, studyId: 's2', candidateId: 'c2' });
    });
    const hook = renderHook(({ studyId, candidateId }) => useCandidateEligibilityCriteria(studyId, candidateId), { initialProps: { studyId: 's1', candidateId: 'c1' } });
    await waitFor(() => expect(request).toHaveBeenCalledWith(base, { signal: expect.any(AbortSignal) }));
    const signal = request.mock.calls.find(([path]) => path === base)![1].signal as AbortSignal;
    hook.rerender({ studyId: 's2', candidateId: 'c2' });
    expect(signal.aborted).toBe(true);
    await waitFor(() => expect(hook.result.current.state.status).toBe('ready'));
    await act(async () => { if (outcome === 'sucesso') finish(json(saved())); else fail(new Error('old')); });
    expect(hook.result.current.state).toMatchObject({ status: 'ready', criteria: [], assessment: { studyId: 's2', candidateId: 'c2', evaluations: [] } });
  });
});
