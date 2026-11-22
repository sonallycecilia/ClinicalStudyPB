import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ParticipantsPage } from './ParticipantsPage';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request }) }));

const studies = [{ id: 's1', title: 'Sono', status: 'execução' }, { id: 's2', title: 'Atividade', status: 'recrutamento' }, { id: 's3', title: 'Pressão', status: 'encerrado' }];
const ana = { participationId: 'p1', candidateId: 'c1', studyId: 's1', name: 'Ana Silva', participationStatus: 'Ativo', includedAt: '2026-11-08', withdrawnAt: null, withdrawalReason: null };
const bruno = { participationId: 'p2', candidateId: 'c2', studyId: 's2', name: 'Bruno Lima', participationStatus: 'Concluído', includedAt: '2026-11-09', withdrawnAt: null, withdrawalReason: null };
const carla = { participationId: 'p3', candidateId: 'c3', studyId: 's3', name: 'Carla Dias', participationStatus: 'Ativo', includedAt: '2026-10-01', withdrawnAt: null, withdrawalReason: null };
const planned = [{ id: 'pv1', studyId: 's1', name: 'Consulta inicial', order: 1, intervalDays: null, description: null }];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let participants: Record<string, unknown[] | number>;
let history: unknown;
let scheduled: unknown[];

beforeEach(() => {
  participants = { s1: [ana], s2: [bruno], s3: [carla] };
  history = { participant: ana, visits: [] };
  scheduled = [];
  request.mockReset().mockImplementation(async (path: string, options?: RequestInit) => {
    if (path === '/studies/acompanhamento') return json(studies);
    let match = /^\/studies\/([^/]+)\/participants$/.exec(path);
    if (match) { const value = participants[match[1]]; return typeof value === 'number' ? json({}, value) : json(value ?? []); }
    if (/\/participants\/[^/]+\/history$/.test(path)) return json(history);
    match = /^\/studies\/([^/]+)\/participants\/([^/]+)\/withdrawal$/.exec(path);
    if (match && options?.method === 'POST') {
      const body = JSON.parse(options.body as string);
      return json({ ...ana, participationStatus: 'Retirado', withdrawnAt: body.withdrawalDate, withdrawalReason: body.reason }, 201);
    }
    if (/^\/studies\/[^/]+\/visits$/.test(path)) return json(planned);
    if (/^\/studies\/[^/]+\/scheduled-visits/.test(path)) {
      if (options?.method === 'POST') {
        const body = JSON.parse(options.body as string);
        const created = { id: 'v1', studyId: 's1', participationId: body.participationId, participantName: 'Ana Silva', plannedVisitId: body.plannedVisitId, plannedVisitName: 'Consulta inicial',
          plannedVisitOrder: 1, scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Agendada', realizedAt: null, observation: null, createdAt: '2026-11-16T13:20:41.512Z' };
        scheduled = [created];
        return json(created, 201);
      }
      return json(scheduled);
    }
    return json({}, 404);
  });
});
afterEach(cleanup);

function Location() { const l = useLocation(); return <output aria-label="URL atual">{l.pathname}{l.search}</output>; }
const studyFilter = () => screen.getByRole('combobox', { name: 'Filtrar por estudo' }) as HTMLSelectElement;
const url = () => screen.getByLabelText('URL atual').textContent!;
const participantGets = () => request.mock.calls.map(([path]) => path as string).filter((path) => /\/participants$/.test(path));
const list = () => screen.getByRole('list', { name: 'Participantes incluídos' });
const onlyParticipants = (path = '/coordenador/participantes') => render(<MemoryRouter initialEntries={[path]}><ParticipantsPage /><Location /></MemoryRouter>);

describe('ParticipantsPage — participantes incluídos', () => {
  it('lista estudos em execução e encerrados, não apenas em recrutamento', async () => {
    onlyParticipants();
    await waitFor(() => expect(studyFilter().disabled).toBe(false));
    expect(screen.getByRole('option', { name: 'Sono' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Pressão (encerrado)' })).toBeTruthy();
    expect(request).toHaveBeenCalledWith('/studies/acompanhamento', expect.anything());
    expect(request.mock.calls.some(([path]) => path === '/studies/disponiveis-recrutamento')).toBe(false);
  });

  it('não consulta participantes sem estudo e mostra a orientação', async () => {
    onlyParticipants();
    await waitFor(() => expect(studyFilter().disabled).toBe(false));
    expect(screen.getByText('Selecione um estudo para ver os participantes incluídos.')).toBeTruthy();
    expect(participantGets()).toHaveLength(0);
  });

  it('exibe carregamento e depois os participantes do estudo, sem dados de candidato', async () => {
    const original = request.getMockImplementation()!;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (/\/participants$/.test(path)) await gate;
      return original(path, options);
    });
    onlyParticipants('/coordenador/participantes?studyId=s1');
    expect(await screen.findByText('Consultando participantes…')).toBeTruthy();
    release();
    await within(await screen.findByRole('list', { name: 'Participantes incluídos' })).findByText('Ana Silva');
    expect(list().textContent).toContain('08/11/2026');
    expect(list().textContent).not.toContain('Bruno Lima');
    expect(participantGets()).toEqual(['/studies/s1/participants']);
    expect(request.mock.calls.some(([path]) => String(path).endsWith('/candidates'))).toBe(false);
  });

  it('indica lista vazia', async () => {
    participants.s1 = [];
    onlyParticipants('/coordenador/participantes?studyId=s1');
    expect(await screen.findByText('Nenhum participante incluído neste estudo.')).toBeTruthy();
  });

  it('mostra falha da API e permite tentar novamente', async () => {
    participants.s1 = 500;
    onlyParticipants('/coordenador/participantes?studyId=s1');
    expect((await screen.findByRole('alert')).textContent).toMatch(/Não foi possível consultar/);
    participants.s1 = [ana];
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await within(await screen.findByRole('list', { name: 'Participantes incluídos' })).findByText('Ana Silva');
    expect(participantGets()).toHaveLength(2);
  });

  it('mostra mensagem clara para 403', async () => {
    participants.s1 = 403;
    onlyParticipants('/coordenador/participantes?studyId=s1');
    expect((await screen.findByRole('alert')).textContent).toMatch(/não tem permissão/);
  });

  it('troca de estudo sem exibir a lista anterior e limpa a participação selecionada', async () => {
    onlyParticipants('/coordenador/participantes?studyId=s1&participationId=p1');
    await within(await screen.findByRole('list', { name: 'Participantes incluídos' })).findByText('Ana Silva');
    expect(screen.getByRole('button', { name: 'Participante selecionado: Ana Silva' })).toBeTruthy();
    fireEvent.change(studyFilter(), { target: { value: 's2' } });
    expect(screen.queryByText('Ana Silva')).toBeNull();
    await within(await screen.findByRole('list', { name: 'Participantes incluídos' })).findByText('Bruno Lima');
    expect(url()).toContain('studyId=s2');
    expect(url()).not.toContain('participationId');
  });

  it('ignora participationId que não pertence ao estudo carregado', async () => {
    onlyParticipants('/coordenador/participantes?studyId=s1&participationId=p2');
    await within(await screen.findByRole('list', { name: 'Participantes incluídos' })).findByText('Ana Silva');
    expect(screen.queryByRole('navigation', { name: /Fluxos de acompanhamento/ })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Retirada do participante' })).toBeNull();
  });

  it('seleciona o participante, grava na URL e oferece os fluxos com o mesmo contexto', async () => {
    onlyParticipants('/coordenador/participantes?studyId=s1');
    await screen.findByRole('list', { name: 'Participantes incluídos' });
    fireEvent.click(screen.getByRole('button', { name: 'Selecionar participante: Ana Silva' }));
    expect(url()).toContain('participationId=p1');
    const nav = await screen.findByRole('navigation', { name: /Fluxos de acompanhamento/ });
    expect(within(nav).getByRole('link', { name: 'Agendar visita' }).getAttribute('href')).toBe('/coordenador/visitas?studyId=s1&participationId=p1');
    expect(within(nav).getByRole('link', { name: 'Reagendamentos' }).getAttribute('href')).toBe('/coordenador/reagendamentos?studyId=s1&participationId=p1');
  });
});

describe('Histórico do participante selecionado', () => {
  it('consulta o histórico da participação e mostra visitas e resultados', async () => {
    history = { participant: ana, visits: [{ id: 'v1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1, scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z', observation: null,
      results: [{ id: 'r1', scheduledVisitId: 'v1', activityId: 'a1', activityName: 'Sinais vitais', activityType: 'Exame', value: '120/80', unit: 'mmHg', observation: null, registeredAt: '2026-11-24T13:00:00.000Z' }] }] };
    onlyParticipants('/coordenador/participantes?studyId=s1&participationId=p1');
    const panel = await screen.findByRole('region', { name: 'Histórico de visitas' });
    await within(panel).findByText('Consulta inicial');
    expect(panel.textContent).toContain('Sinais vitais: 120/80 mmHg');
    expect(request).toHaveBeenCalledWith('/studies/s1/participants/p1/history', expect.anything());
  });

  it('mostra falha do histórico e permite tentar novamente', async () => {
    const original = request.getMockImplementation()!;
    let fail = true;
    request.mockImplementation(async (path: string, options?: RequestInit) => {
      if (String(path).endsWith('/history') && fail) { fail = false; return json({}, 500); }
      return original(path, options);
    });
    onlyParticipants('/coordenador/participantes?studyId=s1&participationId=p1');
    const panel = await screen.findByRole('region', { name: 'Histórico de visitas' });
    expect(await within(panel).findByRole('alert')).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Tentar novamente' }));
    expect(await within(panel).findByText('Nenhuma visita registrada para este participante.')).toBeTruthy();
    expect(request.mock.calls.filter(([path]) => String(path).endsWith('/history'))).toHaveLength(2);
  });

  it('mostra falha do histórico', async () => {
    history = { participant: { ...ana, participationId: 'outro' }, visits: [] };
    onlyParticipants('/coordenador/participantes?studyId=s1&participationId=p1');
    const panel = await screen.findByRole('region', { name: 'Histórico de visitas' });
    expect((await within(panel).findByRole('alert')).textContent).toMatch(/histórico inválido/);
  });
});

describe('Retirada do participante', () => {
  async function openForm() {
    onlyParticipants('/coordenador/participantes?studyId=s1&participationId=p1');
    fireEvent.click(await screen.findByRole('button', { name: 'Registrar retirada' }));
    return screen.getByRole('form', { name: 'Registrar retirada' });
  }

  it('envia a retirada da participação selecionada e atualiza a lista', async () => {
    const form = await openForm();
    fireEvent.change(within(form).getByLabelText('Data da retirada'), { target: { value: '2026-11-10' } });
    fireEvent.change(within(form).getByLabelText('Motivo da retirada'), { target: { value: '  Motivo pessoal  ' } });
    participants.s1 = [{ ...ana, participationStatus: 'Retirado', withdrawnAt: '2026-11-10', withdrawalReason: 'Motivo pessoal' }];
    fireEvent.submit(form);
    await screen.findByText('Retirada de Ana Silva registrada com sucesso.');
    const call = request.mock.calls.find(([path]) => String(path).endsWith('/withdrawal'))!;
    expect(call[0]).toBe('/studies/s1/participants/p1/withdrawal');
    expect(JSON.parse(call[1].body)).toEqual({ withdrawalDate: '2026-11-10', reason: 'Motivo pessoal' });
    await screen.findByText(/Participação retirada em 10\/11\/2026/);
  });

  it('exige motivo e não chama a API sem ele', async () => {
    const form = await openForm();
    fireEvent.change(within(form).getByLabelText('Data da retirada'), { target: { value: '2026-11-10' } });
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toBe('Informe o motivo da retirada.');
    expect(request.mock.calls.some(([path]) => String(path).endsWith('/withdrawal'))).toBe(false);
  });

  it('recusa data anterior à inclusão', async () => {
    const form = await openForm();
    fireEvent.change(within(form).getByLabelText('Data da retirada'), { target: { value: '2026-11-01' } });
    fireEvent.change(within(form).getByLabelText('Motivo da retirada'), { target: { value: 'x' } });
    fireEvent.submit(form);
    expect((await screen.findByRole('alert')).textContent).toMatch(/entre a data de inclusão e hoje/);
  });

  it('mostra a recusa do servidor e mantém o formulário aberto', async () => {
    const original = request.getMockImplementation()!;
    request.mockImplementation(async (path: string, options?: RequestInit) => String(path).endsWith('/withdrawal')
      ? json({ message: 'Somente participações ativas podem ser retiradas.', code: 'PARTICIPATION_NOT_ACTIVE' }, 400) : original(path, options));
    const form = await openForm();
    fireEvent.change(within(form).getByLabelText('Data da retirada'), { target: { value: '2026-11-10' } });
    fireEvent.change(within(form).getByLabelText('Motivo da retirada'), { target: { value: 'x' } });
    fireEvent.submit(form);
    expect((await within(form).findByRole('alert')).textContent).toBe('Somente participações ativas podem ser retiradas.');
    expect(screen.getByRole('form', { name: 'Registrar retirada' })).toBeTruthy();
  });

  it('não oferece retirada em estudo encerrado nem para participante concluído', async () => {
    onlyParticipants('/coordenador/participantes?studyId=s3&participationId=p3');
    expect(await screen.findByText('Estudo encerrado: a retirada não está disponível.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registrar retirada' })).toBeNull();
    cleanup();
    onlyParticipants('/coordenador/participantes?studyId=s2&participationId=p2');
    await screen.findByRole('button', { name: 'Participante selecionado: Bruno Lima' });
    expect(screen.queryByRole('button', { name: 'Registrar retirada' })).toBeNull();
  });
});