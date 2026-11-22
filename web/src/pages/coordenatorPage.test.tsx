import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { candidatesApi, type Candidate } from '../candidates/candidatesApi';
import { CriteriaApiError, type EligibilityCriterion } from '../studies/criteriaApi';
import {
  CoordinatorCandidatesPage,
  CoordinatorDashboardPage,
  CoordinatorReportsPage,
  CoordinatorReschedulesPage,
  CoordinatorVisitsPage,
} from './coordenatorPage';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request: mockRequest }) }));

const studyOptions = [{ id: 'study-1', title: 'Estudo em recrutamento' }];
beforeEach(() => {
  vi.restoreAllMocks();
  mockRequest.mockReset().mockResolvedValue({ ok: true, status: 200, json: async () => studyOptions } as Response);
});

const candidateRows: Candidate[] = [
  { id: 'candidate-1', name: 'Lucas Martins', studyId: 'study-1', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-16', status: 'Elegível' },
  { id: 'candidate-2', name: 'Mariana Alves', studyId: 'study-1', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-20', status: 'Em avaliação' },
  { id: 'candidate-3', name: 'Lucas Santos', studyId: 'study-2', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-19', status: 'Elegível' },
  { id: 'candidate-4', name: 'Lucas Lima', studyId: 'study-1', studyTitle: 'Estudo em recrutamento', enrollmentDate: '2026-10-18', status: 'Em avaliação' },
];

const eligibilityCriteria: EligibilityCriterion[] = [
  { id: 'inclusion-1', studyId: 'study-1', type: 'Inclusão', description: 'Possuir idade mínima de 18 anos', active: true },
  { id: 'exclusion-1', studyId: 'study-1', type: 'Exclusão', description: 'Apresentar condição impeditiva', active: true },
  { id: 'inactive', studyId: 'study-1', type: 'Inclusão', description: 'Critério desativado', active: false },
  { id: 'other-study', studyId: 'study-2', type: 'Inclusão', description: 'Critério de outro estudo', active: true },
];

async function openEligibility() {
  vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
  renderCoordinator(<CoordinatorCandidatesPage />);
  await selectStudy();
  const row = await screen.findByRole('row', { name: /Lucas Martins/ });
  const trigger = within(row).getByRole('button', { name: 'Detalhes' });
  trigger.focus();
  fireEvent.click(trigger);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Avaliar elegibilidade' })); });
  return { trigger, dialog: screen.getByRole('dialog', { name: 'Avaliar elegibilidade' }) };
}

async function selectStudy(id = 'study-1') {
  const select = screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement;
  await waitFor(() => expect(Array.from(select.options).some((option) => option.value === id)).toBe(true));
  await act(async () => { fireEvent.change(select, { target: { value: id } }); });
}

function renderCoordinator(element: ReactNode) {
  return render(<MemoryRouter initialEntries={['/?studyId=study-1']}>{element}</MemoryRouter>);
}

afterEach(() => cleanup());

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body } as Response);
const scheduledResponse = {
  id: 'scheduled-1', studyId: 'study-1', participationId: 'participation-1', participantName: 'Bianca Oliveira',
  plannedVisitId: 'planned-1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1,
  scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Agendada', realizedAt: null, observation: null, createdAt: '2026-11-16T13:20:41.512Z',
};

function mockScheduleApi(postResponse: () => Response, agenda: () => unknown[] = () => [], patchResponse?: (body: { status: string }) => Response) {
  mockRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/studies/study-1/scheduled-visits' && !init?.method) return json(200, agenda());
    // Próximas visitas do Painel do coordenador (E03 com filtros).
    if (path.startsWith('/studies/study-1/scheduled-visits?') && !init?.method) return json(200, agenda());
    if (path === '/studies/study-1/participants') return json(200, []);
    if (path.startsWith('/studies/study-1/scheduled-visits/') && init?.method === 'PATCH' && patchResponse) return patchResponse(JSON.parse(init.body as string));
    if (path === '/studies/study-1/participants?status=Ativo') return json(200, [{
      participationId: 'participation-1', candidateId: 'candidate-1', studyId: 'study-1', name: 'Bianca Oliveira',
      participationStatus: 'Ativo', includedAt: '2026-11-06', withdrawnAt: null, withdrawalReason: null,
    }]);
    if (path === '/studies/study-1/visits') return json(200, [{ id: 'planned-1', studyId: 'study-1', name: 'Consulta inicial', order: 1, intervalDays: null, description: null }]);
    if (path === '/studies/study-1/scheduled-visits' && init?.method === 'POST') return postResponse();
    return json(200, studyOptions);
  });
}

/** Abre o agendamento pelo botão indicado e preenche um agendamento válido. */
async function fillSchedule(trigger = 'Agendar visita') {
  fireEvent.click(screen.getByRole('button', { name: trigger }));
  const dialog = screen.getByRole('dialog', { name: 'Agendar visita' });
  const study = within(dialog).getByLabelText('Estudo') as HTMLSelectElement;
  await waitFor(() => expect(study.disabled).toBe(false));
  fireEvent.change(study, { target: { value: 'study-1' } });
  const participant = within(dialog).getByLabelText('Participante') as HTMLSelectElement;
  await waitFor(() => expect(participant.disabled).toBe(false));
  fireEvent.change(participant, { target: { value: 'participation-1' } });
  fireEvent.change(within(dialog).getByLabelText('Visita prevista'), { target: { value: 'planned-1' } });
  fireEvent.change(within(dialog).getByLabelText('Data e horário'), { target: { value: '2026-11-24T09:00' } });
  return dialog;
}

describe('CoordinatorDashboardPage', () => {
  const inHours = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString();
  const dashboardStudies = [{ id: 'study-1', title: 'Estudo em recrutamento' }, { id: 'study-2', title: 'Outro estudo' }];
  const activeParticipant = (id: string, studyId: string) => ({
    participationId: id, candidateId: `candidate-${id}`, studyId, name: 'Pessoa', participationStatus: 'Ativo', includedAt: '2026-11-01', withdrawnAt: null, withdrawalReason: null,
  });
  const upcomingVisit = (id: string, studyId: string, participantName: string, scheduledAt: string) => ({ ...scheduledResponse, id, studyId, participantName, scheduledAt });
  const agendas: Record<string, unknown[]> = {
    'study-1': [
      upcomingVisit('past', 'study-1', 'Visita de hoje já passada', inHours(-1)),
      upcomingVisit('later', 'study-1', 'Bianca Oliveira', inHours(24 * 10)),
      upcomingVisit('soon', 'study-1', 'Lucas Martins', inHours(24)),
    ],
    'study-2': [upcomingVisit('other', 'study-2', 'Mariana Alves', inHours(48))],
  };

  function mockDashboardApi(overrides: (path: string, init?: RequestInit) => Response | undefined = () => undefined) {
    mockRequest.mockImplementation(async (path: string, init?: RequestInit) => {
      const custom = overrides(path, init);
      if (custom) return custom;
      const agenda = /^\/studies\/(study-\d)\/scheduled-visits\?/.exec(path);
      if (agenda) return json(200, agendas[agenda[1]]);
      if (path === '/studies/study-1/participants?status=Ativo') return json(200, [activeParticipant('p1', 'study-1'), activeParticipant('p2', 'study-1')]);
      if (path === '/studies/study-2/participants?status=Ativo') return json(200, [activeParticipant('p3', 'study-2')]);
      if (path === '/studies/disponiveis-recrutamento') return json(200, dashboardStudies);
      throw new Error(`Requisição inesperada: ${path}`);
    });
  }

  const upcomingTable = () => screen.getByRole('table', { name: 'Próximas visitas' });
  const indicator = (title: string) => (screen.getByText(title).closest('article') as HTMLElement).querySelector('strong')!.textContent;

  it('consulta as próximas visitas e os participantes ativos na API, sem dados fixos', async () => {
    mockDashboardApi();
    renderCoordinator(<CoordinatorDashboardPage />);
    expect(screen.getByText('Consultando próximas visitas…')).toBeTruthy();
    await screen.findByText('Lucas Martins');

    const today = mockRequest.mock.calls.map(([path]) => path as string).find((path) => path.startsWith('/studies/study-1/scheduled-visits?'))!;
    expect(new URLSearchParams(today.split('?')[1]).get('status')).toBe('Agendada');
    expect(new URLSearchParams(today.split('?')[1]).get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const names = within(upcomingTable()).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0].textContent);
    expect(names).toEqual(['LMLucas Martins', 'MAMariana Alves', 'BOBianca Oliveira']);
    expect(screen.queryByText('Visita de hoje já passada')).toBeNull();
    expect(within(upcomingTable()).getByText('Outro estudo')).toBeTruthy();
    expect(indicator('Participantes ativos')).toBe('03');
    expect(indicator('Visitas nos próximos 7 dias')).toBe('02');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por estudo' }), { target: { value: 'study-2' } });
    expect(within(upcomingTable()).getAllByRole('row')).toHaveLength(2);
    fireEvent.change(screen.getByPlaceholderText('Buscar participante...'), { target: { value: 'nome inexistente' } });
    expect(screen.getByText('Nenhuma visita encontrada para os filtros selecionados.')).toBeTruthy();
  });

  it('atualiza a situação pela API a partir do painel e consulta as próximas visitas de novo', async () => {
    mockDashboardApi((path, init) => path === '/studies/study-1/scheduled-visits/soon/status' && init?.method === 'PATCH'
      ? json(200, { ...agendas['study-1'][2] as object, status: 'Cancelada' }) : undefined);
    renderCoordinator(<CoordinatorDashboardPage />);
    const row = (await screen.findByText('Lucas Martins')).closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'Atualizar situação' }));
    const dialog = screen.getByRole('dialog', { name: 'Atualizar situação da visita' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Cancelada/ }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar situação' })); });

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByText('Situação atualizada para “Cancelada”: Lucas Martins · Consulta inicial.')).toBeTruthy();
    await waitFor(() => expect(mockRequest.mock.calls.filter(([path]) => (path as string).startsWith('/studies/study-1/scheduled-visits?'))).toHaveLength(2));
  });

  it('agenda visita pela API a partir de "Novo registro", confirma e recarrega o painel', async () => {
    mockScheduleApi(() => json(201, scheduledResponse));
    renderCoordinator(<CoordinatorDashboardPage />);
    const dialog = await fillSchedule('Novo registro');
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar visita' })); });
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-1/scheduled-visits', expect.objectContaining({ method: 'POST' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getAllByRole('status').some((item) => item.textContent?.includes('Visita agendada com sucesso! Bianca Oliveira · Consulta inicial · 24/11/2026 · 09:00'))).toBe(true);
    await waitFor(() => expect(mockRequest.mock.calls.filter(([path]) => (path as string).startsWith('/studies/study-1/scheduled-visits?'))).toHaveLength(2));
  });

  it('mostra a recusa de acesso e a falha da consulta sem dados fictícios, permitindo tentar novamente', async () => {
    let denied = true;
    mockDashboardApi((path) => path.startsWith('/studies/study-2/scheduled-visits?') && denied
      ? json(403, { statusCode: 403, message: 'Você não tem permissão para acessar este estudo.' }) : undefined);
    renderCoordinator(<CoordinatorDashboardPage />);
    expect(await screen.findByText('Você não tem permissão para acessar este estudo.')).toBeTruthy();
    expect(screen.queryByText('Lucas Martins')).toBeNull();
    expect(indicator('Participantes ativos')).toBe('—');
    expect(indicator('Visitas nos próximos 7 dias')).toBe('—');

    denied = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Lucas Martins')).toBeTruthy();
  });

  it('informa quando não há estudos em recrutamento nem visitas futuras', async () => {
    mockRequest.mockImplementation(async (path: string) => path === '/studies/disponiveis-recrutamento' ? json(200, []) : json(200, []));
    const { unmount } = renderCoordinator(<CoordinatorDashboardPage />);
    expect(await screen.findByText('Nenhum estudo em recrutamento disponível para consultar visitas.')).toBeTruthy();
    unmount();
    mockRequest.mockImplementation(async (path: string) => path === '/studies/disponiveis-recrutamento' ? json(200, studyOptions) : json(200, []));
    renderCoordinator(<CoordinatorDashboardPage />);
    expect(await screen.findByText('Nenhuma visita agendada a partir de agora.')).toBeTruthy();
    expect(indicator('Participantes ativos')).toBe('00');
  });
});

describe('CoordinatorCandidatesPage', () => {
  it('consulta por ID, exibe apenas candidatos do estudo e abre detalhes sem ações de alteração de status', async () => {
    const query = vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    expect(query).not.toHaveBeenCalled();
    expect(screen.queryByText('Mariana Alves')).toBeNull();
    await selectStudy();
    await screen.findByText('Lucas Martins');
    expect(screen.getByText('Mariana Alves')).toBeTruthy();
    expect(screen.queryByText('Lucas Santos')).toBeNull();
    expect(query).toHaveBeenCalledWith(mockRequest, 'study-1', expect.any(AbortSignal));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), {
      target: { value: 'Lucas Martins' },
    });
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(screen.queryByText('Mariana Alves')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Detalhes' }));
    const dialog = screen.getByRole('dialog', { name: 'Detalhes do candidato' });
    const summary = within(dialog).getByRole('region', { name: 'Resumo do candidato' });
    expect(within(summary).getByText('Lucas Martins')).toBeTruthy();
    expect(within(summary).getByText('Estudo em recrutamento')).toBeTruthy();
    expect(within(summary).getByText('16/10/2026')).toBeTruthy();
    expect(within(summary).getByText('Elegível')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Avaliar elegibilidade' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Registrar consentimento' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Incluir participante' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tornar ativo' })).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    const candidateRow = screen.getByRole('row', { name: /Lucas Martins/ });
    expect(within(candidateRow).getByText('Elegível')).toBeTruthy();
  });

  it('combina estudo, nome e status, distinguindo estudos com o mesmo título', async () => {
    mockRequest.mockResolvedValue({ ok: true, json: async () => [...studyOptions, { id: 'study-2', title: studyOptions[0].title }] } as Response);
    const query = vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('Mariana Alves');
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: ' LUCAS ' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'Elegível' } });
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(screen.queryByText('Mariana Alves')).toBeNull();
    expect(screen.queryByText('Lucas Lima')).toBeNull();
    expect(screen.queryByText('Lucas Santos')).toBeNull();
    await selectStudy('study-2');
    await screen.findByText('Lucas Santos');
    expect(screen.queryByText('Lucas Martins')).toBeNull();
    expect(query).toHaveBeenLastCalledWith(mockRequest, 'study-2', expect.any(AbortSignal));
    expect(query).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('option', { name: 'Estudo em recrutamento (study-2)' })).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'inexistente' } });
    expect(screen.getByText('Nenhum candidato encontrado para os filtros selecionados.')).toBeTruthy();
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por estudo' }), { target: { value: '' } });
    await waitFor(() => expect(query).toHaveBeenCalledTimes(4));
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'Lucas' } });
    await screen.findByText('Lucas Santos');
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
  });

  it('exibe lista vazia somente após uma consulta bem-sucedida sem candidatos', async () => {
    vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue([]);
    renderCoordinator(<CoordinatorCandidatesPage />);
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    await selectStudy();
    await screen.findByText('O estudo selecionado não possui candidatos cadastrados.');
    expect(screen.getAllByRole('row')).toHaveLength(2);
  });

  it('mostra carregamento e apresenta o resultado ao concluir a consulta', async () => {
    let resolve!: (rows: readonly Candidate[]) => void;
    vi.spyOn(candidatesApi, 'listByStudy').mockReturnValue(new Promise((done) => { resolve = done; }));
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    expect(screen.getByText('Consultando candidatos…')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Candidatos do estudo' }).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    await act(async () => resolve(candidateRows));
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(screen.queryByText('Consultando candidatos…')).toBeNull();
  });

  it('mostra erro sem lista vazia e permite tentar novamente no mesmo estudo', async () => {
    const query = vi.spyOn(candidatesApi, 'listByStudy')
      .mockRejectedValueOnce(new Error('Falha de conexão'))
      .mockResolvedValueOnce(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('Não foi possível consultar os candidatos deste estudo. Tente novamente.');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByText('Lucas Martins');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenLastCalledWith(mockRequest, 'study-1', expect.any(AbortSignal));
  });

  it('informa acesso negado pela API sem dados fictícios, contagens ou mensagem de lista vazia', async () => {
    mockRequest.mockImplementation(async (path: string) => path.includes('/candidates')
      ? new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 })
      : new Response(JSON.stringify(studyOptions)));
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('Você não tem permissão para cadastrar ou consultar candidatos neste estudo.');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
    expect(screen.queryByText('Mariana Alves')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Indicadores' })).toBeNull();
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenCalledWith('/studies/disponiveis-recrutamento', { signal: expect.any(AbortSignal) });
    expect(screen.getByText(/A seleção exibe apenas estudos em recrutamento/)).toBeTruthy();
  });

  it.each(['sucesso', 'erro'])('ignora %s tardio da consulta anterior ao trocar estudo', async (outcome) => {
    mockRequest.mockResolvedValue({ ok: true, json: async () => [...studyOptions, { id: 'study-2', title: 'Outro estudo' }] } as Response);
    let resolve!: (rows: readonly Candidate[]) => void;
    let reject!: (error: Error) => void;
    const query = vi.spyOn(candidatesApi, 'listByStudy')
      .mockReturnValueOnce(new Promise((done, fail) => { resolve = done; reject = fail; }))
      .mockResolvedValueOnce(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    const signal = query.mock.calls[0][2]!;
    await selectStudy('study-2');
    await screen.findByText('Lucas Santos');
    expect(signal.aborted).toBe(true);
    await act(async () => {
      if (outcome === 'sucesso') resolve(candidateRows);
      else reject(new Error('Resposta antiga'));
    });
    expect(screen.getByText('Lucas Santos')).toBeTruthy();
    expect(screen.queryByText('Lucas Martins')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('permite recarregar os estudos após falha e consulta candidatos quando os estudos ficam disponíveis', async () => {
    const query = vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    mockRequest.mockRejectedValueOnce(new Error('Falha'));
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByText('Não foi possível carregar os estudos. Use o ícone de atualização para tentar novamente.');
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar estudos' }));
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    await waitFor(() => expect(query).toHaveBeenCalledWith(mockRequest, 'study-1', expect.any(AbortSignal)));
  });

  it('não confunde ausência de estudos em recrutamento com ausência de candidatos', async () => {
    mockRequest.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByText('Nenhum estudo em recrutamento disponível para seleção. Não foi possível consultar candidatos.');
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).disabled).toBe(true);
    expect(screen.getByRole('option', { name: 'Nenhum estudo disponível' })).toBeTruthy();
    const refresh = screen.getByRole('button', { name: 'Atualizar estudos' });
    expect(refresh.textContent).toBe('');
    expect(refresh.getAttribute('title')).toBe('Atualizar estudos');
    expect(refresh.closest('.coord-table-tools')).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Filtrar por estudo' }).getAttribute('aria-describedby')).toContain('candidate-list-study-feedback');
    expect(screen.queryByText('O estudo selecionado não possui candidatos cadastrados.')).toBeNull();
  });

  it('atualiza os estudos após uma lista vazia e habilita a seleção quando há opções', async () => {
    let resolveStudies!: (response: Response) => void;
    mockRequest
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockReturnValueOnce(new Promise<Response>((resolve) => { resolveStudies = resolve; }));
    const query = vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Nenhum estudo disponível' });
    const refresh = screen.getByRole('button', { name: 'Atualizar estudos' }) as HTMLButtonElement;
    fireEvent.click(refresh);

    const studySelect = screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement;
    expect(studySelect.disabled).toBe(true);
    expect(screen.getByRole('option', { name: 'Carregando estudos…' })).toBeTruthy();
    expect(refresh.disabled).toBe(true);
    expect(refresh.getAttribute('aria-busy')).toBe('true');
    fireEvent.click(refresh);
    fireEvent.click(refresh);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenLastCalledWith('/studies/disponiveis-recrutamento', { signal: expect.any(AbortSignal) });

    await act(async () => resolveStudies({ ok: true, json: async () => studyOptions } as Response));
    expect(studySelect.disabled).toBe(false);
    expect(screen.getByRole('option', { name: 'Todos os estudos' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Estudo em recrutamento' })).toBeTruthy();
    expect(refresh.disabled).toBe(false);
    expect(refresh.getAttribute('aria-busy')).toBe('false');
    expect(screen.queryByText('Nenhum estudo em recrutamento disponível para seleção. Não foi possível consultar candidatos.')).toBeNull();
    await waitFor(() => expect(query).toHaveBeenCalledWith(mockRequest, 'study-1', expect.any(AbortSignal)));
  });

  it.each(['vazio', 'erro'])('encerra o carregamento da atualização com resultado %s e permite tentar novamente', async (outcome) => {
    let resolve!: (response: Response) => void;
    let reject!: (error: Error) => void;
    mockRequest
      .mockResolvedValueOnce({ ok: true, json: async () => [] } as Response)
      .mockReturnValueOnce(new Promise<Response>((done, fail) => { resolve = done; reject = fail; }));
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Nenhum estudo disponível' });
    const refresh = screen.getByRole('button', { name: 'Atualizar estudos' }) as HTMLButtonElement;
    fireEvent.click(refresh);
    expect(refresh.disabled).toBe(true);
    expect(refresh.getAttribute('aria-busy')).toBe('true');

    await act(async () => {
      if (outcome === 'vazio') resolve({ ok: true, json: async () => [] } as Response);
      else reject(new Error('Falha de conexão'));
    });
    expect(refresh.disabled).toBe(false);
    expect(refresh.getAttribute('aria-busy')).toBe('false');
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).disabled).toBe(true);
    if (outcome === 'vazio') expect(screen.getByRole('option', { name: 'Nenhum estudo disponível' })).toBeTruthy();
    else expect(screen.getByRole('alert').textContent).toContain('Não foi possível carregar os estudos.');

    fireEvent.click(refresh);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).disabled).toBe(false);
    expect(mockRequest.mock.calls.filter(([path]) => path === '/studies/disponiveis-recrutamento')).toHaveLength(3);
    await waitFor(() => expect(mockRequest).toHaveBeenCalledWith('/studies/study-1/candidates', { signal: expect.any(AbortSignal) }));
  });

  it('abre o formulário compartilhado e consulta os estudos do cadastro somente ao abrir o modal', async () => {
    vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    expect(mockRequest).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
    expect(within(dialog).getByRole('form', { name: 'Cadastro de candidato' })).toBeTruthy();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Fechar' }));
    await within(dialog).findByRole('option', { name: 'Estudo em recrutamento' });
    const study = within(dialog).getByLabelText(/^Estudo/) as HTMLSelectElement;
    fireEvent.change(study, { target: { value: 'study-1' } });
    expect(study.value).toBe('study-1');
    expect(study.required).toBe(true);
    expect((within(dialog).getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement).disabled).toBe(false);
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(mockRequest).toHaveBeenCalledWith('/studies/disponiveis-recrutamento', { signal: expect.any(AbortSignal) });
  });

  it('preserva as validações de nome e e-mail dentro do modal', async () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
    await within(dialog).findByRole('option', { name: 'Estudo em recrutamento' });
    const name = within(dialog).getByLabelText(/Nome completo/) as HTMLInputElement;
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.blur(name);
    expect(within(dialog).getByText('Informe o nome completo do candidato.')).toBeTruthy();
    const email = within(dialog).getByLabelText('E-mail (opcional)') as HTMLInputElement;
    fireEvent.change(email, { target: { value: 'invalido' } });
    fireEvent.blur(email);
    expect(within(dialog).getByText('Informe um e-mail válido com até 254 caracteres.')).toBeTruthy();
    expect(name.value).toBe('   ');
    expect(email.value).toBe('invalido');
  });

  it('abre e reabre o modal sem erros em campos intocados no modo de desenvolvimento', async () => {
    mockRequest.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    render(<StrictMode><MemoryRouter><CoordinatorCandidatesPage /></MemoryRouter></StrictMode>);
    const trigger = screen.getByRole('button', { name: 'Novo candidato' });
    trigger.focus();
    for (let attempt = 0; attempt < 2; attempt++) {
      fireEvent.click(trigger);
      const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
      expect(within(dialog).queryByRole('alert')).toBeNull();
      await within(dialog).findByText('Nenhum estudo disponível para associação.');
      expect(within(dialog).queryByRole('alert')).toBeNull();
      expect(within(dialog).getByLabelText(/Nome completo/).getAttribute('aria-invalid')).toBe('false');
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
      expect(document.activeElement).toBe(trigger);
    }
  });

  it('cancela sem adicionar candidato e preserva os filtros da listagem', async () => {
    vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    await screen.findByText('Lucas Martins');
    fireEvent.change(screen.getByPlaceholderText('Buscar por nome...'), { target: { value: 'Lucas Martins' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por status' }), { target: { value: 'Elegível' } });
    const trigger = screen.getByRole('button', { name: 'Novo candidato' });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Pessoa não salva' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('Pessoa não salva')).toBeNull();
    expect((screen.getByPlaceholderText('Buscar por nome...') as HTMLInputElement).value).toBe('Lucas Martins');
    expect((screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement).value).toBe('study-1');
    expect((screen.getByRole('combobox', { name: 'Filtrar por status' }) as HTMLSelectElement).value).toBe('Elegível');
    expect(screen.getByText('Lucas Martins')).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    expect((mockRequest.mock.calls[1][1] as RequestInit).signal?.aborted).toBe(true);
    fireEvent.click(trigger);
    expect((screen.getByLabelText(/Nome completo/) as HTMLInputElement).value).toBe('');
    expect(mockRequest).toHaveBeenCalledTimes(3);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  });

  it('mantém Tab dentro do modal e fecha com Escape, devolvendo o foco', async () => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    const trigger = screen.getByRole('button', { name: 'Novo candidato' });
    trigger.focus();
    fireEvent.click(trigger);
    const close = screen.getByRole('button', { name: 'Fechar' });
    await within(screen.getByRole('dialog')).findByRole('option', { name: 'Estudo em recrutamento' });
    const submit = screen.getByRole('button', { name: 'Cadastrar candidato' });
    act(() => submit.focus());
    fireEvent.keyDown(submit, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(submit);
    fireEvent.keyDown(submit, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(['botão', 'fundo'])('fecha o modal pelo %s sem salvar', async (method) => {
    renderCoordinator(<CoordinatorCandidatesPage />);
    await screen.findByRole('option', { name: 'Estudo em recrutamento' });
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    const dialog = screen.getByRole('dialog', { name: 'Cadastrar candidato' });
    if (method === 'botão') fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    else fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['vazio', 'erro'])('reutiliza o estado de consulta de estudos no modal: %s', async (state) => {
    if (state === 'vazio') mockRequest.mockResolvedValue({ ok: true, status: 200, json: async () => [] } as Response);
    else mockRequest.mockRejectedValue(new Error('Falha de conexão'));
    renderCoordinator(<CoordinatorCandidatesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo candidato' }));
    await screen.findByText(state === 'vazio'
      ? 'Nenhum estudo disponível para associação.'
      : 'Não foi possível carregar os estudos. Tente novamente mais tarde.');
    expect((screen.getByLabelText(/^Estudo/) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cadastrar candidato' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Avaliação de elegibilidade do candidato', () => {
  beforeEach(() => {
    vi.spyOn(candidatesApi, 'getEligibilityAssessment').mockImplementation(async (_request, studyId, candidateId) => ({
      studyId, candidateId, status: candidateRows.find((candidate) => candidate.id === candidateId)!.status, evaluations: [],
    }));
  });
  it('consulta critérios pela ação nos detalhes e respeita o acesso negado da API', async () => {
    mockRequest.mockImplementation(async (path: string) => path.endsWith('/criteria')
      ? new Response(JSON.stringify({ message: 'Você não tem permissão para acessar os critérios deste estudo.' }), { status: 403 })
      : new Response(JSON.stringify(studyOptions)));
    const load = vi.spyOn(candidatesApi, 'listEligibilityCriteria');
    const save = vi.spyOn(candidatesApi, 'registerEligibilityAssessment');
    const { dialog } = await openEligibility();
    await within(dialog).findByRole('alert');
    expect(within(dialog).getByText('Lucas Martins')).toBeTruthy();
    expect(within(dialog).getByText('Estudo em recrutamento')).toBeTruthy();
    expect(within(dialog).getByText('Você não tem permissão para acessar os critérios deste estudo.')).toBeTruthy();
    expect(load).toHaveBeenCalledOnce();
    expect(load).toHaveBeenCalledWith(mockRequest, 'study-1', expect.any(AbortSignal));
    const register = within(dialog).getByRole('button', { name: 'Registrar avaliação' }) as HTMLButtonElement;
    expect(register.disabled).toBe(true);
    fireEvent.click(register);
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(save).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledTimes(2);
    expect(within(dialog).queryByRole('radio')).toBeNull();
    expect(within(dialog).queryByText('Este estudo não possui critérios ativos para avaliação.')).toBeNull();
  });

  it('não consulta critérios ao abrir apenas os detalhes', async () => {
    const load = vi.spyOn(candidatesApi, 'listEligibilityCriteria');
    vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    const row = await screen.findByRole('row', { name: /Lucas Martins/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Detalhes' }));
    expect(load).not.toHaveBeenCalled();
  });

  it('mostra carregamento e agrupa somente os critérios ativos do estudo sem frases explicativas', async () => {
    let resolve!: (criteria: EligibilityCriterion[]) => void;
    vi.spyOn(candidatesApi, 'listEligibilityCriteria').mockReturnValue(new Promise((done) => { resolve = done; }));
    const { dialog } = await openEligibility();
    expect(within(dialog).getByText('Carregando critérios…')).toBeTruthy();
    expect(within(dialog).getByRole('form').getAttribute('aria-busy')).toBe('true');
    expect(within(dialog).queryByRole('radio')).toBeNull();
    await act(async () => resolve(eligibilityCriteria));
    expect(within(dialog).getByRole('form').getAttribute('aria-busy')).toBe('false');
    expect(within(dialog).getByRole('region', { name: 'Critérios de inclusão' })).toBeTruthy();
    expect(within(dialog).getByRole('region', { name: 'Critérios de exclusão' })).toBeTruthy();
    expect(within(dialog).queryByText('Atende é favorável à elegibilidade; Não atende é desfavorável.')).toBeNull();
    expect(within(dialog).queryByText('Atende indica um impedimento à participação; Não atende é favorável à elegibilidade.')).toBeNull();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(6);
    expect(within(dialog).queryByText('Critério desativado')).toBeNull();
    expect(within(dialog).queryByText('Critério de outro estudo')).toBeNull();
  });

  it('valida todos os resultados no registro e permite editar Pendente sem salvar nem mudar o status', async () => {
    vi.spyOn(candidatesApi, 'listEligibilityCriteria').mockResolvedValue(eligibilityCriteria);
    const save = vi.spyOn(candidatesApi, 'registerEligibilityAssessment');
    const { dialog } = await openEligibility();
    await within(dialog).findByRole('group', { name: 'Possuir idade mínima de 18 anos' });
    fireEvent.submit(within(dialog).getByRole('form'));
    expect(within(dialog).getAllByText('Selecione um resultado para este critério.')).toHaveLength(2);
    const inclusion = within(dialog).getByRole('group', { name: 'Possuir idade mínima de 18 anos' });
    const exclusion = within(dialog).getByRole('group', { name: 'Apresentar condição impeditiva' });
    expect(document.activeElement).toBe(within(inclusion).getByRole('radio', { name: 'Atende' }));
    fireEvent.click(within(inclusion).getByRole('radio', { name: 'Atende' }));
    fireEvent.click(within(exclusion).getByRole('radio', { name: 'Pendente' }));
    const observation = within(exclusion).getByRole('textbox', { name: 'Observações (opcional)' }) as HTMLTextAreaElement;
    fireEvent.change(observation, { target: { value: 'Aguardar informação complementar.' } });
    expect(within(exclusion).getByText(`${observation.value.length}/2.000 caracteres`)).toBeTruthy();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(within(dialog).queryByText(/Elegibilidade atual:/)).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Conferir preenchimento' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Limpar preenchimento' })).toBeNull();
    expect((within(dialog).getByRole('button', { name: 'Registrar avaliação' }) as HTMLButtonElement).disabled).toBe(false);
    expect(save).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledOnce();
    fireEvent.change(observation, { target: { value: '' } });
    expect((within(exclusion).getByRole('radio', { name: 'Pendente' }) as HTMLInputElement).checked).toBe(true);
    expect(observation.value).toBe('');
    expect(within(dialog).queryByText('Preenchimento conferido. A avaliação ainda não foi salva.')).toBeNull();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('limita observações a 2.000 caracteres e também valida valores excessivos recebidos pelo formulário', async () => {
    vi.spyOn(candidatesApi, 'listEligibilityCriteria').mockResolvedValue(eligibilityCriteria);
    const { dialog } = await openEligibility();
    const group = await within(dialog).findByRole('group', { name: 'Possuir idade mínima de 18 anos' });
    const observation = within(group).getByRole('textbox', { name: 'Observações (opcional)' }) as HTMLTextAreaElement;
    expect(observation.maxLength).toBe(2000);
    fireEvent.change(observation, { target: { value: 'a'.repeat(2001) } });
    fireEvent.blur(observation);
    expect(within(group).getByRole('alert').textContent).toBe('A observação deve ter no máximo 2.000 caracteres.');
    expect(observation.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(observation, { target: { value: 'a'.repeat(2000) } });
    fireEvent.blur(observation);
    expect(within(group).queryByText('A observação deve ter no máximo 2.000 caracteres.')).toBeNull();
    expect(observation.getAttribute('aria-invalid')).toBe('false');
  });

  it.each([{ criteria: [] }, { criteria: eligibilityCriteria.filter((criterion) => !criterion.active) }])('exibe ausência de critérios somente após consulta bem-sucedida', async ({ criteria }) => {
    vi.spyOn(candidatesApi, 'listEligibilityCriteria').mockResolvedValue(criteria);
    const { dialog } = await openEligibility();
    await within(dialog).findByText('Este estudo não possui critérios ativos para avaliação.');
    expect(within(dialog).queryByRole('radio')).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Conferir preenchimento' })).toBeNull();
    expect((within(dialog).getByRole('button', { name: 'Registrar avaliação' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('permite repetir a consulta após falha sem confundir erro com ausência de critérios', async () => {
    const load = vi.spyOn(candidatesApi, 'listEligibilityCriteria')
      .mockRejectedValueOnce(new Error('Falha'))
      .mockResolvedValueOnce(eligibilityCriteria);
    const { dialog } = await openEligibility();
    await within(dialog).findByText('Não foi possível carregar os critérios e a avaliação. Tente novamente.');
    expect(within(dialog).queryByText('Este estudo não possui critérios ativos para avaliação.')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tentar novamente' }));
    await within(dialog).findByRole('group', { name: 'Possuir idade mínima de 18 anos' });
    expect(within(dialog).getAllByRole('radio')).toHaveLength(6);
    expect(load).toHaveBeenCalledTimes(2);
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('apresenta a restrição de acesso sem repetir uma consulta não autorizada', async () => {
    vi.spyOn(candidatesApi, 'listEligibilityCriteria').mockRejectedValue(new CriteriaApiError('Você não tem permissão para acessar os critérios deste estudo.', false));
    const { dialog } = await openEligibility();
    expect((await within(dialog).findByRole('alert')).textContent).toBe('Você não tem permissão para acessar os critérios deste estudo.');
    expect(within(dialog).queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
  });

  it('mantém o foco no modal, fecha com Escape e devolve o foco ao candidato', async () => {
    vi.spyOn(candidatesApi, 'listEligibilityCriteria').mockResolvedValue(eligibilityCriteria);
    const { trigger, dialog } = await openEligibility();
    await within(dialog).findByRole('group', { name: 'Possuir idade mínima de 18 anos' });
    const close = within(dialog).getByRole('button', { name: 'Fechar' });
    const last = within(dialog).getByRole('button', { name: 'Registrar avaliação' });
    expect(document.activeElement).toBe(close);
    act(() => last.focus());
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(last, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it.each(['botão', 'fundo'])('fecha a avaliação pelo %s sem registrar', async (method) => {
    const save = vi.spyOn(candidatesApi, 'registerEligibilityAssessment');
    const { dialog } = await openEligibility();
    if (method === 'botão') fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    else fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('volta aos detalhes e descarta o preenchimento ao reabrir a avaliação', async () => {
    vi.spyOn(candidatesApi, 'listEligibilityCriteria').mockResolvedValue(eligibilityCriteria);
    const { dialog } = await openEligibility();
    const group = await within(dialog).findByRole('group', { name: 'Possuir idade mínima de 18 anos' });
    fireEvent.click(within(group).getByRole('radio', { name: 'Não atende' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Voltar aos detalhes' }));
    expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBeTruthy();
    expect(within(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).getByText('Elegível')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Avaliar elegibilidade' }));
    const newGroup = await screen.findByRole('group', { name: 'Possuir idade mínima de 18 anos' });
    expect((within(newGroup).getByRole('radio', { name: 'Não atende' }) as HTMLInputElement).checked).toBe(false);
  });

  it.each(['sucesso', 'erro'])('cancela a consulta ao fechar e ignora %s tardio ao abrir outro candidato', async (outcome) => {
    let resolve!: (criteria: EligibilityCriterion[]) => void;
    let reject!: (reason: Error) => void;
    const load = vi.spyOn(candidatesApi, 'listEligibilityCriteria')
      .mockReturnValueOnce(new Promise((done, fail) => { resolve = done; reject = fail; }))
      .mockResolvedValueOnce([]);
    const { dialog } = await openEligibility();
    const signal = load.mock.calls[0][2]!;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));
    expect(signal.aborted).toBe(true);
    fireEvent.click(within(screen.getByRole('row', { name: /Mariana Alves/ })).getByRole('button', { name: 'Detalhes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Avaliar elegibilidade' }));
    await screen.findByText('Este estudo não possui critérios ativos para avaliação.');
    await act(async () => {
      if (outcome === 'sucesso') resolve(eligibilityCriteria);
      else reject(new Error('Resposta antiga'));
    });
    const currentDialog = screen.getByRole('dialog', { name: 'Avaliar elegibilidade' });
    expect(within(currentDialog).getByText('Mariana Alves')).toBeTruthy();
    expect(within(currentDialog).queryByRole('radio')).toBeNull();
    expect(within(currentDialog).queryByRole('alert')).toBeNull();
  });
});

describe('Inclusão de participante no Coordenador', () => {
  it('reutiliza o modal para o candidato correto, cancela sem enviar e preserva o status da listagem', async () => {
    vi.spyOn(candidatesApi, 'listByStudy').mockResolvedValue(candidateRows);
    const include = vi.spyOn(candidatesApi, 'include');
    renderCoordinator(<CoordinatorCandidatesPage />);
    await selectStudy();
    for (const name of ['Lucas Martins', 'Mariana Alves']) {
      const row = await screen.findByRole('row', { name: new RegExp(name) });
      fireEvent.click(within(row).getByRole('button', { name: 'Detalhes' }));
      const details = screen.getByRole('dialog', { name: 'Detalhes do candidato' });
      expect(within(details).getByRole('button', { name: 'Avaliar elegibilidade' })).toBeTruthy();
      expect(within(details).getByRole('button', { name: 'Registrar consentimento' })).toBeTruthy();
      fireEvent.click(within(details).getByRole('button', { name: 'Incluir participante' }));
      const dialog = screen.getByRole('dialog', { name: 'Incluir participante' });
      expect(dialog).toBe(details);
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
      const form = within(dialog).getByRole('form', { name: 'Inclusão de participante' });
      expect(within(form).getByText(name)).toBeTruthy();
      expect(within(form).getByText('Estudo em recrutamento')).toBeTruthy();
      const confirm = within(form).getByRole('button', { name: 'Confirmar inclusão' }) as HTMLButtonElement;
      expect(confirm.disabled).toBe(false);
      expect(within(dialog).queryByText('Participante incluído com sucesso!')).toBeNull();
      fireEvent.click(within(form).getByRole('button', { name: 'Cancelar' }));
      expect(screen.getByRole('dialog', { name: 'Detalhes do candidato' })).toBe(details);
      const original = candidateRows.find((candidate) => candidate.name === name)!;
      expect(within(details).getByText(original.status)).toBeTruthy();
      expect(within(row).getByText(original.status)).toBeTruthy();
      fireEvent.click(within(details).getByRole('button', { name: 'Fechar' }));
    }
    expect(include).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledOnce();
  });
});

describe('CoordinatorVisitsPage', () => {
  it('agenda a visita pela API e exibe a confirmação com os dados persistidos', async () => {
    mockScheduleApi(() => json(201, scheduledResponse));
    renderCoordinator(<CoordinatorVisitsPage />);
    const dialog = await fillSchedule();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar visita' })); });

    const [, init] = mockRequest.mock.calls.find(([path, options]) => path === '/studies/study-1/scheduled-visits' && options?.method === 'POST') as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      participationId: 'participation-1', plannedVisitId: 'planned-1', scheduledAt: new Date('2026-11-24T09:00').toISOString(),
    });
    expect(screen.queryByRole('dialog', { name: 'Agendar visita' })).toBeNull();
    expect(screen.getByText(/Visita agendada com sucesso!/).textContent).toContain('Visita agendada com sucesso! Bianca Oliveira · Consulta inicial · 24/11/2026 · 09:00');
    // A agenda é consultada de novo na API depois do agendamento.
    await waitFor(() => expect(mockRequest.mock.calls.filter(([path, options]) => path === '/studies/study-1/scheduled-visits' && !options?.method)).toHaveLength(2));
    fireEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }));
    expect(screen.queryByText(/Visita agendada com sucesso!/)).toBeNull();
  });

  it('mantém o formulário aberto e preenchido quando o agendamento é recusado', async () => {
    mockScheduleApi(() => json(409, { statusCode: 409, message: 'Esta visita prevista já está agendada ou realizada para o participante.', error: 'Conflict', code: 'VISIT_ALREADY_SCHEDULED' }));
    renderCoordinator(<CoordinatorVisitsPage />);
    const dialog = await fillSchedule();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar visita' })); });

    expect(within(dialog).getByRole('alert').textContent).toContain('Esta visita prevista já está agendada ou realizada para o participante.');
    expect((within(dialog).getByLabelText('Participante') as HTMLSelectElement).value).toBe('participation-1');
    expect((within(dialog).getByLabelText('Data e horário') as HTMLInputElement).value).toBe('2026-11-24T09:00');
    expect(screen.queryByText(/Visita agendada com sucesso!/)).toBeNull();
  });

  const agendaRows = [
    { ...scheduledResponse, id: 'scheduled-1', participantName: 'Bianca Oliveira', status: 'Agendada' },
    { ...scheduledResponse, id: 'scheduled-2', participantName: 'Lucas Martins', participationId: 'participation-2', status: 'Realizada', realizedAt: '2026-11-24T12:30:00.000Z' },
    { ...scheduledResponse, id: 'scheduled-3', participantName: 'Mariana Alves', participationId: 'participation-3', status: 'Cancelada' },
  ];

  it('consulta a agenda do estudo na API, com indicadores e filtro por situação', async () => {
    mockScheduleApi(() => json(500, null), () => agendaRows);
    renderCoordinator(<CoordinatorVisitsPage />);
    const table = screen.getByRole('table', { name: 'Agenda de visitas' });
    expect(await within(table).findByText('Bianca Oliveira')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-1/scheduled-visits', expect.objectContaining({ signal: expect.any(AbortSignal) }));
    const bianca = within(table).getByRole('row', { name: /Bianca Oliveira/ });
    expect(within(bianca).getByText('24/11/2026 · 09:00')).toBeTruthy();
    expect(within(bianca).getByText('Agendada')).toBeTruthy();
    expect(within(bianca).getByRole('button', { name: 'Atualizar situação' })).toBeTruthy();
    expect(within(within(table).getByRole('row', { name: /Lucas Martins/ })).getByRole('button', { name: 'Detalhes' })).toBeTruthy();
    const stats = screen.getByRole('region', { name: 'Indicadores' });
    expect(within(stats).getByText('Visitas agendadas').parentElement?.textContent).toContain('01');
    expect(within(stats).getByText('Ausências e cancelamentos').parentElement?.textContent).toContain('01');

    fireEvent.change(screen.getByRole('combobox', { name: 'Filtrar por situação' }), { target: { value: 'Cancelada' } });
    expect(within(table).queryByText('Bianca Oliveira')).toBeNull();
    expect(within(table).getByText('Mariana Alves')).toBeTruthy();
  });

  it('atualiza a situação pela API e só altera a linha após a confirmação', async () => {
    let resolvePatch!: (response: Response) => void;
    mockRequest.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return new Promise<Response>((done) => { resolvePatch = done; });
      if (path === '/studies/study-1/scheduled-visits') return json(200, agendaRows);
      return json(200, studyOptions);
    });
    renderCoordinator(<CoordinatorVisitsPage />);
    const row = await screen.findByRole('row', { name: /Bianca Oliveira/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Atualizar situação' }));
    const dialog = screen.getByRole('dialog', { name: 'Atualizar situação da visita' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Ausente/ }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar situação' })); });

    const [path, init] = mockRequest.mock.calls.find(([, options]) => options?.method === 'PATCH') as [string, RequestInit];
    expect(path).toBe('/studies/study-1/scheduled-visits/scheduled-1/status');
    expect(JSON.parse(init.body as string)).toEqual({ status: 'Ausente' });
    expect(within(row).getByText('Agendada')).toBeTruthy();

    await act(async () => { resolvePatch(json(200, { ...agendaRows[0], status: 'Ausente' })); });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(screen.getByRole('row', { name: /Bianca Oliveira/ })).getByText('Ausente')).toBeTruthy();
    expect(screen.getByText('Situação atualizada para “Ausente”: Bianca Oliveira · Consulta inicial.')).toBeTruthy();
  });

  it('mantém a situação e o formulário quando a API recusa a atualização', async () => {
    const message = 'Transição de "Cancelada" para "Ausente" não permitida.';
    mockScheduleApi(() => json(500, null), () => agendaRows, () => json(400, { statusCode: 400, message, code: 'VISIT_STATUS_FINAL' }));
    renderCoordinator(<CoordinatorVisitsPage />);
    const row = await screen.findByRole('row', { name: /Bianca Oliveira/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Atualizar situação' }));
    const dialog = screen.getByRole('dialog', { name: 'Atualizar situação da visita' });
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Ausente/ }));
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar situação' })); });

    expect(within(dialog).getByRole('alert').textContent).toContain(message);
    expect((within(dialog).getByRole('radio', { name: /^Ausente/ }) as HTMLInputElement).checked).toBe(true);
    // A agenda é recarregada para mostrar a situação atual, sem fechar o formulário.
    await waitFor(() => expect(mockRequest.mock.calls.filter(([path, options]) => path === '/studies/study-1/scheduled-visits' && !options?.method)).toHaveLength(2));
    expect(screen.getByRole('dialog', { name: 'Atualizar situação da visita' })).toBeTruthy();
  });

  it('mostra as atividades e resultados de uma visita realizada somente para consulta', async () => {
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/studies/study-1/scheduled-visits') return json(200, agendaRows);
      if (path === '/studies/study-1/scheduled-visits/scheduled-2/results') return json(200, {
        scheduledVisitId: 'scheduled-2', plannedVisitId: 'planned-1', status: 'Realizada',
        activities: [{ activityId: 'activity-1', name: 'Pressão arterial', type: 'Exame', description: null, result: {
          id: 'result-1', scheduledVisitId: 'scheduled-2', activityId: 'activity-1', value: '120/80', unit: 'mmHg', observation: null,
          registeredAt: '2026-11-24T13:05:00.000Z', registrarId: 'researcher-1',
        } }],
      });
      return json(200, studyOptions);
    });
    renderCoordinator(<CoordinatorVisitsPage />);
    const row = await screen.findByRole('row', { name: /Lucas Martins/ });
    fireEvent.click(within(row).getByRole('button', { name: 'Detalhes' }));
    const dialog = screen.getByRole('dialog', { name: 'Detalhes da visita' });
    expect(await within(dialog).findByText('120/80')).toBeTruthy();
    expect(within(dialog).getByText('O registro dos resultados é feito pelo Pesquisador responsável pelo estudo.')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: 'Registrar resultado' })).toBeNull();
  });

  it('consulta o histórico de um participante do estudo selecionado', async () => {
    const participantRow = { participationId: 'participation-1', candidateId: 'candidate-1', studyId: 'study-1', name: 'Bianca Oliveira', participationStatus: 'Ativo', includedAt: '2026-11-06', withdrawnAt: null, withdrawalReason: null };
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/studies/study-1/scheduled-visits') return json(200, agendaRows);
      if (path === '/studies/study-1/participants') return json(200, [participantRow]);
      if (path === '/studies/study-1/participants/participation-1/history') return json(200, { participant: participantRow, visits: [{ ...agendaRows[0], results: [] }] });
      return json(200, studyOptions);
    });
    renderCoordinator(<CoordinatorVisitsPage />);
    const panel = screen.getByRole('region', { name: 'Histórico por participante' });
    const select = within(panel).getByLabelText('Participante') as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false));
    fireEvent.change(select, { target: { value: 'participation-1' } });
    const timeline = await within(panel).findByRole('list', { name: 'Histórico de visitas de Bianca Oliveira' });
    expect(within(timeline).getByText('Visita 1 — Consulta inicial')).toBeTruthy();
    expect(within(timeline).getByText('Ainda não realizada')).toBeTruthy();
  });

  it('registra a retirada pela API e mantém os registros existentes no histórico', async () => {
    const participantRow = { participationId: 'participation-1', candidateId: 'candidate-1', studyId: 'study-1', name: 'Bianca Oliveira', participationStatus: 'Ativo', includedAt: '2026-11-06', withdrawnAt: null, withdrawalReason: null };
    const historicalVisit = { ...agendaRows[0], status: 'Realizada', realizedAt: '2026-11-24T12:30:00.000Z', results: [] };
    mockRequest.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/studies/study-1/scheduled-visits') return json(200, agendaRows);
      if (path === '/studies/study-1/participants') return json(200, [participantRow]);
      if (path === '/studies/study-1/participants/participation-1/history') return json(200, { participant: participantRow, visits: [historicalVisit] });
      if (path === '/studies/study-1/participants/participation-1/withdrawal' && init?.method === 'POST') {
        const body = JSON.parse(init.body as string) as { withdrawalDate: string; reason: string };
        return json(201, { ...participantRow, participationStatus: 'Retirado', withdrawnAt: body.withdrawalDate, withdrawalReason: body.reason });
      }
      return json(200, studyOptions);
    });
    renderCoordinator(<CoordinatorVisitsPage />);
    const panel = screen.getByRole('region', { name: 'Histórico por participante' });
    const select = within(panel).getByLabelText('Participante') as HTMLSelectElement;
    await waitFor(() => expect(select.disabled).toBe(false));
    fireEvent.change(select, { target: { value: 'participation-1' } });
    const timeline = await within(panel).findByRole('list', { name: 'Histórico de visitas de Bianca Oliveira' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Registrar retirada' }));

    const form = within(panel).getByRole('form', { name: 'Retirada de Bianca Oliveira' });
    const date = within(form).getByLabelText('Data da retirada') as HTMLInputElement;
    fireEvent.change(date, { target: { value: date.max } });
    fireEvent.change(within(form).getByLabelText('Motivo da retirada'), { target: { value: '  Solicitou desligamento  ' } });
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar retirada' }));
    fireEvent.click(within(form).getByRole('button', { name: 'Confirmar retirada' }));

    expect(await within(panel).findByText('Retirada de Bianca Oliveira registrada com sucesso. A participação agora está como Retirado.')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-1/participants/participation-1/withdrawal', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ withdrawalDate: date.max, reason: 'Solicitou desligamento' }),
    }));
    expect(within(panel).getByText('Retirado')).toBeTruthy();
    expect(within(timeline).getByText('Visita 1 — Consulta inicial')).toBeTruthy();
    expect(within(panel).getByText('Participante retirado do estudo. As visitas e os resultados abaixo foram preservados.')).toBeTruthy();
  });

  it('informa quando a consulta da agenda falha e permite tentar novamente', async () => {
    let calls = 0;
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/studies/study-1/scheduled-visits') return ++calls === 1 ? json(503, null) : json(200, agendaRows);
      if (path === '/studies/study-1/participants') return json(200, []);
      return json(200, studyOptions);
    });
    renderCoordinator(<CoordinatorVisitsPage />);
    expect(await screen.findByText('Não foi possível carregar as visitas agendadas. Tente novamente.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Bianca Oliveira')).toBeTruthy();
  });
});

describe('CoordinatorReschedulesPage', () => {
  it('filtra solicitações e aprova uma após abrir análise', () => {
    renderCoordinator(<CoordinatorReschedulesPage />);
    fireEvent.change(screen.getByPlaceholderText('Buscar participante...'), {
      target: { value: 'Bianca Oliveira' },
    });
    expect(screen.getByText('Bianca Oliveira')).toBeTruthy();
    expect(screen.queryByText('João Pedro')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Analisar' }));
    expect(screen.getByRole('dialog', { name: 'Analisar reagendamento' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar solicitação' }));
    const approvedRow = screen.getByRole('row', { name: /Bianca Oliveira/ });
    expect(within(approvedRow).getByText('Aprovada')).toBeTruthy();
  });

  it('registra solicitação de reagendamento em estado pendente', () => {
    renderCoordinator(<CoordinatorReschedulesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Registrar solicitação' }));
    const dialog = screen.getByRole('dialog', { name: 'Registrar solicitação' });
    fireEvent.change(screen.getByPlaceholderText('Nome do participante'), {
      target: { value: 'Nova Solicitação' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar solicitação' }));

    const newRow = screen.getByRole('row', { name: /Nova Solicitação/ });
    expect(within(newRow).getByText('Pendente')).toBeTruthy();
  });
});

describe('CoordinatorReportsPage', () => {
  it('apresenta os relatórios disponíveis e dispara a exportação CSV', () => {
    const createObjectURL = vi.fn(() => 'blob:test');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    renderCoordinator(<CoordinatorReportsPage />);

    expect(screen.getByRole('heading', { name: 'Relatórios' })).toBeTruthy();
    expect(screen.getByText('Resumo dos estudos')).toBeTruthy();
    expect(screen.getByText('Histórico de visitas')).toBeTruthy();
    expect(screen.getByText('Participantes e elegibilidade')).toBeTruthy();
    const candidateReport = screen.getByText('Participantes e elegibilidade').closest('.coord-report-row') as HTMLElement;
    expect((within(candidateReport).getByRole('button', { name: 'Gerar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(candidateReport).getByText('Relatório indisponível enquanto a consulta de candidatos não estiver integrada.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Exportar relatório' }));
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test');
    click.mockRestore();
    vi.unstubAllGlobals();
  });
});
