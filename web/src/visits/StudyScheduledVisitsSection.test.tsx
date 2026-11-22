import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { StudyScheduledVisitsSection } from './StudyScheduledVisitsSection';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({ useAuth: () => ({ request: mockRequest }) }));

const json = (status: number, body: unknown) => ({ ok: status < 300, status, json: async () => body } as Response);
const base = {
  studyId: 'study-1', participationId: 'participation-1', participantName: 'Participante Teste', plannedVisitId: 'planned-1',
  plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1, scheduledAt: '2026-11-24T12:00:00.000Z', observation: null,
  createdAt: '2026-11-16T13:20:41.512Z',
};
const agenda = [
  { ...base, id: 'scheduled-1', status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z' },
  { ...base, id: 'scheduled-2', plannedVisitId: 'planned-2', plannedVisitName: 'Retorno', plannedVisitOrder: 2, scheduledAt: '2026-12-01T12:00:00.000Z', status: 'Agendada', realizedAt: null },
];
const results = {
  scheduledVisitId: 'scheduled-1', plannedVisitId: 'planned-1', status: 'Realizada',
  activities: [{ activityId: 'activity-1', name: 'Pressão arterial', type: 'Exame', description: null, result: null }],
};

beforeEach(() => {
  mockRequest.mockReset().mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/studies/study-1/scheduled-visits') return json(200, agenda);
    if (path === '/studies/study-1/scheduled-visits/scheduled-1/results' && init?.method === 'POST') {
      const body = JSON.parse(init.body as string);
      return json(201, { id: 'result-1', scheduledVisitId: 'scheduled-1', registeredAt: '2026-11-24T13:05:00.000Z', registrarId: 'researcher-1', unit: null, observation: null, ...body });
    }
    if (path === '/studies/study-1/scheduled-visits/scheduled-1/results') return json(200, results);
    if (path === '/studies/study-1/scheduled-visits/scheduled-2/results') return json(200, { ...results, scheduledVisitId: 'scheduled-2', status: 'Agendada' });
    throw new Error(`Requisição inesperada: ${path}`);
  });
});
afterEach(cleanup);

describe('StudyScheduledVisitsSection', () => {
  it('lista as visitas agendadas do estudo e registra o resultado de uma visita realizada', async () => {
    render(<StudyScheduledVisitsSection studyId="study-1" />);
    const realized = await screen.findByRole('article', { name: /Consulta inicial/ });
    expect(within(realized).getByText('Realizada')).toBeTruthy();
    expect(within(screen.getByRole('article', { name: /Retorno/ })).getByRole('button', { name: 'Ver atividades' })).toBeTruthy();

    fireEvent.click(within(realized).getByRole('button', { name: 'Registrar resultados' }));
    const form = await screen.findByRole('form', { name: 'Resultado de Pressão arterial' });
    fireEvent.change(within(form).getByLabelText('Resultado fictício'), { target: { value: '120/80' } });
    fireEvent.change(within(form).getByLabelText('Unidade (opcional)'), { target: { value: 'mmHg' } });
    await act(async () => { fireEvent.click(within(form).getByRole('button', { name: 'Registrar resultado' })); });

    const [, init] = mockRequest.mock.calls.find(([, options]) => options?.method === 'POST') as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ activityId: 'activity-1', value: '120/80', unit: 'mmHg' });
    expect(screen.getByText('Resultado registrado com sucesso para “Pressão arterial”.')).toBeTruthy();
    expect(screen.getByText('120/80')).toBeTruthy();
  });

  it('não oferece registro em estudo encerrado', async () => {
    render(<StudyScheduledVisitsSection studyId="study-1" readOnly />);
    const realized = await screen.findByRole('article', { name: /Consulta inicial/ });
    fireEvent.click(within(realized).getByRole('button', { name: 'Ver atividades' }));
    expect(await screen.findByText('Pressão arterial')).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('mostra o carregamento e a recusa de acesso da agenda, permitindo tentar novamente', async () => {
    let denied = true;
    let release!: () => void;
    mockRequest.mockImplementation(async (path: string) => {
      if (path !== '/studies/study-1/scheduled-visits') throw new Error(`Requisição inesperada: ${path}`);
      await new Promise<void>((done) => { release = done; });
      return denied ? json(403, { statusCode: 403, message: 'Você não tem permissão para acessar este estudo.' }) : json(200, agenda);
    });
    render(<StudyScheduledVisitsSection studyId="study-1" />);
    expect(screen.getByText('Carregando visitas agendadas...')).toBeTruthy();
    await act(async () => { release(); });
    expect(await screen.findByText('Você não tem permissão para acessar este estudo.')).toBeTruthy();
    expect(screen.queryByRole('article')).toBeNull();

    denied = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await act(async () => { release(); });
    expect(await screen.findByRole('article', { name: /Consulta inicial/ })).toBeTruthy();
  });

  it('informa estudo sem visitas agendadas', async () => {
    mockRequest.mockImplementation(async () => json(200, []));
    render(<StudyScheduledVisitsSection studyId="study-1" />);
    expect(await screen.findByText('Nenhuma visita agendada para este estudo.')).toBeTruthy();
  });
});
