import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ParticipantHistoryPanel, type ParticipantHistoryPanelProps } from './ParticipantHistoryPanel';
import { ScheduledVisitsApiError, type HistoricalVisit, type IncludedParticipant, type ParticipantHistory } from './scheduledVisitsApi';

const active: IncludedParticipant = {
  participationId: 'participation-1', candidateId: 'candidate-1', studyId: 'study-1', name: 'Participante Teste',
  participationStatus: 'Ativo', includedAt: '2026-11-21', withdrawnAt: null, withdrawalReason: null,
};
const withdrawn: IncludedParticipant = {
  ...active, participationId: 'participation-2', candidateId: 'candidate-2', name: 'Bianca Oliveira',
  participationStatus: 'Retirado', withdrawnAt: '2026-11-25', withdrawalReason: 'Mudança de cidade',
};
const visitBase = {
  studyId: 'study-1', participationId: 'participation-1', participantName: 'Participante Teste', plannedVisitId: 'planned-1',
  observation: null, createdAt: '2026-11-21T03:00:00.000Z',
};
const realized: HistoricalVisit = {
  ...visitBase, id: 'v1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1, scheduledAt: '2026-11-21T03:26:00.000Z',
  status: 'Realizada', realizedAt: '2026-11-21T03:40:00.000Z', observation: 'Compareceu.',
  results: [{ id: 'r1', scheduledVisitId: 'v1', activityId: 'a1', activityName: 'Pressão arterial', activityType: 'Exame',
    value: '120/80', unit: 'mmHg', observation: null, registeredAt: '2026-11-21T04:00:00.000Z', registrarId: 'researcher-1' }],
};
const realizedWithout: HistoricalVisit = { ...realized, id: 'v2', plannedVisitName: 'Avaliação física', plannedVisitOrder: 3, scheduledAt: '2026-11-24T03:50:00.000Z', observation: null, results: [] };
const canceled: HistoricalVisit = { ...realized, id: 'v3', plannedVisitName: 'Retorno', plannedVisitOrder: 2, scheduledAt: '2026-11-28T03:36:00.000Z', status: 'Cancelada', realizedAt: null, observation: null, results: [] };
const scheduled: HistoricalVisit = { ...canceled, id: 'v4', plannedVisitName: 'Encerramento', plannedVisitOrder: 4, scheduledAt: '2026-12-05T12:00:00.000Z', status: 'Agendada' };
const history: ParticipantHistory = { participant: active, visits: [realized, realizedWithout, canceled, scheduled] };

function setup(overrides: Partial<ParticipantHistoryPanelProps> = {}) {
  const props: ParticipantHistoryPanelProps = {
    studyId: 'study-1',
    loadParticipants: vi.fn(async () => [active, withdrawn]),
    loadHistory: vi.fn(async () => history),
    ...overrides,
  };
  const view = render(<ParticipantHistoryPanel {...props} />);
  return { props, view };
}

const select = () => screen.getByLabelText('Participante') as HTMLSelectElement;
async function choose(id = 'participation-1') {
  await waitFor(() => expect(select().disabled).toBe(false));
  fireEvent.change(select(), { target: { value: id } });
}

afterEach(cleanup);

describe('ParticipantHistoryPanel', () => {
  it('lista os participantes, identificando os retirados, e pede a seleção', async () => {
    const { props } = setup();
    await waitFor(() => expect(select().disabled).toBe(false));
    expect(within(select()).getAllByRole('option').map((option) => option.textContent)).toEqual(['Selecione o participante', 'Participante Teste', 'Bianca Oliveira (retirado)']);
    expect(screen.getByText(/Selecione um participante para ver as visitas/)).toBeTruthy();
    expect(props.loadHistory).not.toHaveBeenCalled();
  });

  it('mostra o histórico em ordem cronológica com datas, situações e resultados', async () => {
    const { props } = setup();
    await choose();
    const timeline = await screen.findByRole('list', { name: 'Histórico de visitas de Participante Teste' });
    expect(props.loadHistory).toHaveBeenCalledWith('study-1', 'participation-1', expect.any(AbortSignal));
    const entries = within(timeline).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent);
    expect(entries).toEqual(['Visita 1 — Consulta inicial', 'Visita 3 — Avaliação física', 'Visita 2 — Retorno', 'Visita 4 — Encerramento']);
    expect(screen.getByText('21/11/2026')).toBeTruthy();
    const first = within(timeline).getAllByRole('listitem')[0];
    expect(within(first).getByText('21/11/2026 · 00:26')).toBeTruthy();
    expect(within(first).getByText('21/11/2026 · 00:40')).toBeTruthy();
    expect(within(first).getByText('Realizada')).toBeTruthy();
    expect(within(first).getByText('Pressão arterial')).toBeTruthy();
    expect(within(first).getByText('120/80 mmHg')).toBeTruthy();
    expect(within(first).getByText('Compareceu.')).toBeTruthy();
  });

  it('identifica dados indisponíveis com o motivo', async () => {
    setup();
    await choose();
    const items = within(await screen.findByRole('list', { name: /Histórico de visitas/ })).getAllByRole('listitem');
    expect(within(items[0]).getByText('Não disponível')).toBeTruthy();
    expect(within(items[1]).getByText('Nenhum resultado registrado para esta visita.')).toBeTruthy();
    expect(within(items[2]).getByText('Não se aplica (cancelada)')).toBeTruthy();
    expect(within(items[2]).getByText('Sem resultados: a visita foi registrada como cancelada.')).toBeTruthy();
    expect(within(items[3]).getByText('Ainda não realizada')).toBeTruthy();
    expect(within(items[3]).getByText('Os resultados ficam disponíveis depois que a visita for realizada.')).toBeTruthy();
    expect(screen.getByText('Sem retirada registrada')).toBeTruthy();
  });

  it('mostra a retirada do participante e o histórico vazio', async () => {
    setup({ loadHistory: vi.fn(async () => ({ participant: withdrawn, visits: [] })) });
    await choose('participation-2');
    expect(await screen.findByText('Nenhuma visita registrada para este participante.')).toBeTruthy();
    expect(screen.getByText('25/11/2026')).toBeTruthy();
    expect(screen.getByText(/Mudança de cidade/)).toBeTruthy();
  });

  it('trata falha do histórico com nova tentativa e permite atualizar', async () => {
    const loadHistory = vi.fn()
      .mockRejectedValueOnce(new ScheduledVisitsApiError('Participante não encontrado neste estudo.', 404))
      .mockResolvedValue(history);
    setup({ loadHistory });
    await choose();
    expect(await screen.findByText('Participante não encontrado neste estudo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await screen.findByRole('list', { name: /Histórico de visitas/ });
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar histórico' }));
    await waitFor(() => expect(loadHistory).toHaveBeenCalledTimes(3));
  });

  it('trata falha e ausência de participantes', async () => {
    const loadParticipants = vi.fn()
      .mockRejectedValueOnce(new Error('rede'))
      .mockResolvedValueOnce([]);
    setup({ loadParticipants });
    expect(await screen.findByText('Não foi possível carregar os participantes do estudo. Tente novamente.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Nenhum participante incluído neste estudo.')).toBeTruthy();
    expect(select().disabled).toBe(true);
  });

  it('mostra o carregamento e não consulta sem estudo selecionado', async () => {
    const { props, view } = setup({ studyId: '' });
    expect(screen.getByText('Selecione um estudo para consultar o histórico.')).toBeTruthy();
    expect(props.loadParticipants).not.toHaveBeenCalled();
    view.unmount();
    setup({ loadParticipants: vi.fn(() => new Promise<IncludedParticipant[]>(() => {})) });
    expect(screen.getAllByText('Carregando participantes…').length).toBeGreaterThan(0);
  });
});
