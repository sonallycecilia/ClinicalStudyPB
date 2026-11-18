import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { beforeEach, expect, it, jest } from '@jest/globals';
import { Pressable, Text } from 'react-native';
import { useAuth } from '../../auth/AuthContext';
import { VisitsProvider, useVisits } from '../VisitsContext';
import { type Visit, type VisitScope } from '../participantVisitsApi';
import { visits } from '../../../tests/fixtures/visits';

let mockAuth: ReturnType<typeof useAuth>;
const mockList = jest.fn<(scope: VisitScope) => Promise<Visit[]>>();
jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../participantVisitsApi', () => ({
  ...jest.requireActual<typeof import('../participantVisitsApi')>('../participantVisitsApi'),
  participantVisitsService: { listForAuthenticatedParticipant: (scope: VisitScope) => mockList(scope) },
}));
const user = { id: 'participant-1', name: 'Ana Costa', email: 'ana@example.test', role: 'Participante' as const, status: 'Ativo' as const, phone: '', createdAt: '' };
function Probe() {
  const { state, setScope } = useVisits();
  return <><Text>{state.kind}</Text>{state.kind === 'success' && state.visits.map(visit => <Text key={visit.id}>{visit.plannedVisitName}</Text>)}
    <Pressable accessibilityRole="button" onPress={() => setScope('history')}><Text>Histórico</Text></Pressable></>;
}
function deferred() {
  let resolve!: (visits: Visit[]) => void;
  const promise = new Promise<Visit[]>(done => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  mockAuth = { status: 'authenticated', user, message: null, login: async () => {}, logout: async () => {}, retry: async () => {} };
  mockList.mockReset();
});

it('descarta respostas de uma sessão anterior e oculta dados ao bloquear a sessão', async () => {
  const old = deferred();
  mockList.mockReturnValueOnce(old.promise).mockResolvedValueOnce([{ ...visits[0], plannedVisitName: 'Visita da nova conta' }]);
  const app = await render(<VisitsProvider><Probe /></VisitsProvider>);
  expect(screen.getByText('loading')).toBeTruthy();
  await act(async () => {
    mockAuth = { ...mockAuth, user: { ...user, id: 'participant-2' } };
    app.rerender(<VisitsProvider><Probe /></VisitsProvider>);
  });
  expect(await screen.findByText('Visita da nova conta')).toBeTruthy();
  await act(async () => { old.resolve([visits[0]]); });
  expect(screen.queryByText(visits[0].plannedVisitName)).toBeNull();
  await act(async () => {
    mockAuth = { ...mockAuth, status: 'verifying', user: null };
    app.rerender(<VisitsProvider><Probe /></VisitsProvider>);
  });
  expect(screen.queryByText('Visita da nova conta')).toBeNull();
  expect(mockList).toHaveBeenCalledTimes(2);
});

it('ignora a resposta antiga ao trocar o escopo', async () => {
  const upcoming = deferred();
  mockList.mockReturnValueOnce(upcoming.promise).mockResolvedValueOnce([visits[3]]);
  await render(<VisitsProvider><Probe /></VisitsProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'Histórico' }));
  expect(await screen.findByText(visits[3].plannedVisitName)).toBeTruthy();
  await act(async () => { upcoming.resolve([visits[0]]); });
  expect(screen.queryByText(visits[0].plannedVisitName)).toBeNull();
  expect(mockList.mock.calls.map(call => call[0])).toEqual(['upcoming', 'history']);
});

it('exibe erro quando o serviço está indisponível, sem substituir por dados locais', async () => {
  mockList.mockRejectedValue(new Error('Serviço indisponível'));
  await render(<VisitsProvider><Probe /></VisitsProvider>);
  expect(await screen.findByText('error')).toBeTruthy();
  expect(mockList).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(visits[0].plannedVisitName)).toBeNull();
});
