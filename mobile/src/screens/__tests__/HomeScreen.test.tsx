import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { useAuth } from '../../auth/AuthContext';
import { type ParticipantStudy } from '../../studies/participantStudiesApi';
import HomeScreen from '../HomeScreen';
import { studies } from '../../../tests/fixtures/studies';

const mockListForAuthenticatedParticipant = jest.fn<() => Promise<ParticipantStudy[]>>();
let mockAuth: ReturnType<typeof useAuth>;

jest.mock('../../auth/AuthContext', () => ({ useAuth: () => mockAuth }));
jest.mock('../../studies/participantStudiesApi', () => ({
  ...jest.requireActual<typeof import('../../studies/participantStudiesApi')>('../../studies/participantStudiesApi'),
  participantStudiesService: { listForAuthenticatedParticipant: () => mockListForAuthenticatedParticipant() },
}));

const participant = {
  id: 'participant-1',
  name: 'Bianca Oliveira',
  email: 'bianca.oliveira@clinicalstudypb.test',
  phone: '',
  role: 'Participante' as const,
  status: 'Ativo' as const,
  createdAt: '2026-11-01T00:00:00.000Z',
};
function authenticatedUser(user = participant): ReturnType<typeof useAuth> {
  return { status: 'authenticated', user, client: { get: async () => [] }, message: null, login: async () => {}, logout: async () => {}, retry: async () => {} };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  mockAuth = authenticatedUser();
  mockListForAuthenticatedParticipant.mockReset().mockResolvedValue(studies);
});

describe('HomeScreen — estudos do participante', () => {
  it('exibe os estudos recebidos com nome, objetivo e situação', async () => {
    await render(<HomeScreen />);

    expect(await screen.findByText('Qualidade do sono')).toBeTruthy();
    expect(screen.getByText('Investigar padrões de sono dos participantes.')).toBeTruthy();
    expect(screen.getByText('Em execução')).toBeTruthy();
    expect(screen.getByText('Participação: Ativo')).toBeTruthy();
    expect(screen.getByText('01 Abr 2026')).toBeTruthy();
    expect(screen.getByText('28 Nov 2026')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ver detalhes de Qualidade do sono' })).toBeTruthy();
    expect(screen.getByLabelText('1 estudo')).toBeTruthy();
    expect(screen.getByText('Meus Estudos Clínicos')).toBeTruthy();
    expect(mockListForAuthenticatedParticipant).toHaveBeenCalledTimes(1);
  });

  it('apresenta carregamento enquanto a consulta não termina', async () => {
    const pending = deferred<ParticipantStudy[]>();
    mockListForAuthenticatedParticipant.mockReturnValueOnce(pending.promise);
    await render(<HomeScreen />);

    expect(screen.getByLabelText('Carregando estudos')).toBeTruthy();
    await act(async () => { pending.resolve(studies); });
    expect(await screen.findByText('Qualidade do sono')).toBeTruthy();
  });

  it('apresenta estado vazio quando o serviço retorna [] (inclui E09 sem vínculo P-01)', async () => {
    mockListForAuthenticatedParticipant.mockResolvedValueOnce([]);
    await render(<HomeScreen />);

    expect(await screen.findByText('Você ainda não participa de nenhum estudo.')).toBeTruthy();
  });

  it('distingue a situação do estudo da participação retirada', async () => {
    mockListForAuthenticatedParticipant.mockResolvedValueOnce([{ ...studies[0], participationStatus: 'Retirado', withdrawnAt: '2026-11-18' }]);
    await render(<HomeScreen />);
    expect(await screen.findByText('Participação: Retirado')).toBeTruthy();
    expect(screen.getByText('Em execução')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Solicitar retirada do estudo' })).toBeNull();
  });

  it('ignora dados antigos mesmo quando a nova sessão reutiliza o mesmo objeto de usuário', async () => {
    const pending = deferred<ParticipantStudy[]>();
    mockListForAuthenticatedParticipant.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([]);
    const app = await render(<HomeScreen />);
    await act(async () => {
      mockAuth = { ...mockAuth, client: { get: async () => [] } };
      app.rerender(<HomeScreen />);
    });
    expect(await screen.findByText('Você ainda não participa de nenhum estudo.')).toBeTruthy();
    await act(async () => { pending.resolve(studies); });
    expect(screen.queryByText('Qualidade do sono')).toBeNull();
  });

  it('mostra erro e permite tentar novamente', async () => {
    mockListForAuthenticatedParticipant.mockRejectedValueOnce(new Error('Falha ao consultar estudos.'))
      .mockResolvedValueOnce(studies);
    await render(<HomeScreen />);

    expect(await screen.findByText('Falha ao consultar estudos.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Qualidade do sono')).toBeTruthy();
    expect(mockListForAuthenticatedParticipant).toHaveBeenCalledTimes(2);
  });

  it('não solicita nem exibe dados protegidos sem sessão válida', async () => {
    mockAuth = { ...authenticatedUser(), status: 'unauthenticated', user: null };
    await render(<HomeScreen />);

    expect(screen.queryByText('Meus Estudos Clínicos')).toBeNull();
    expect(screen.queryByText('Qualidade do sono')).toBeNull();
    expect(mockListForAuthenticatedParticipant).not.toHaveBeenCalled();
  });

  it('oculta os estudos imediatamente quando a sessão termina', async () => {
    const app = await render(<HomeScreen />);
    expect(await screen.findByText('Qualidade do sono')).toBeTruthy();

    await act(async () => {
      mockAuth = { ...authenticatedUser(), status: 'verifying', user: null };
      app.rerender(<HomeScreen />);
    });

    expect(screen.queryByText('Qualidade do sono')).toBeNull();
    expect(screen.queryByText('Olá, Bianca')).toBeNull();
  });

  it('ignora respostas de uma sessão anterior após a troca de participante', async () => {
    const pending = deferred<ParticipantStudy[]>();
    const otherStudy: ParticipantStudy = { ...studies[0], participationId: 'participation-2', study: { ...studies[0].study, id: 'study-2', title: 'Outro estudo' } };
    mockListForAuthenticatedParticipant.mockReturnValueOnce(pending.promise).mockResolvedValueOnce([otherStudy]);
    const app = await render(<HomeScreen />);

    const nextParticipant = { ...participant, id: 'participant-2', name: 'Ana Costa' };
    await act(async () => {
      mockAuth = authenticatedUser(nextParticipant);
      app.rerender(<HomeScreen />);
    });

    expect(await screen.findByText('Outro estudo')).toBeTruthy();
    await act(async () => { pending.resolve(studies); });
    await waitFor(() => expect(screen.queryByText('Qualidade do sono')).toBeNull());
    expect(screen.getByText('Outro estudo')).toBeTruthy();
  });
});
