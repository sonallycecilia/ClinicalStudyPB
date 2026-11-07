import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { AuthPreviewProvider, AuthProvider, useAuth } from '../../auth/AuthContext';
import LoginScreen from '../LoginScreen';
import HomeScreen from '../HomeScreen';

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { hostUri: 'localhost:8081' } } }));
const fetchMock = jest.fn<typeof fetch>();
Object.defineProperty(globalThis, 'fetch', { configurable: true, writable: true, value: fetchMock });
function App() {
  const { user } = useAuth();
  return user ? <HomeScreen /> : <LoginScreen />;
}
async function setup() { await render(<AuthProvider><App /></AuthProvider>); }
async function enterCredentials() {
  await fireEvent.changeText(screen.getByLabelText('E-mail'), ' bianca.oliveira@clinicalstudypb.test ');
  await fireEvent.changeText(screen.getByLabelText('Senha'), 'Demo123!');
  await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
}
function response(status: number, data = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => data } as Response;
}
const session = { accessToken: 'test-token', user: { id: 'participant', name: 'Bianca Oliveira', email: 'bianca.oliveira@clinicalstudypb.test', role: 'Participante' } };

beforeEach(() => { fetchMock.mockReset(); });
describe('Login mobile integrado à API', () => {
  it('permite testar o login na prévia sem chamar a API', async () => {
    const onLogin = jest.fn();
    await render(<AuthPreviewProvider onLogin={onLogin} onLogout={() => {}}><LoginScreen /></AuthPreviewProvider>);
    await enterCredentials();
    await waitFor(() => expect(onLogin).toHaveBeenCalledTimes(1));
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('valida campos obrigatórios e e-mail sem chamar a API', async () => {
    await setup();
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('Preencha o e-mail e a senha.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'invalido');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'senha');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('Informe um e-mail válido.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('mostra credenciais inválidas e permite tentar novamente', async () => {
    fetchMock.mockResolvedValue(response(401));
    await setup(); await enterCredentials();
    await waitFor(() => expect(screen.getByText('E-mail ou senha inválidos.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });
  it('trata falha de rede', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await setup(); await enterCredentials();
    await waitFor(() => expect(screen.getByText(/Não foi possível conectar ao servidor/)).toBeTruthy());
  });
  it('autentica, mostra a conta e revoga a sessão ao sair', async () => {
    fetchMock.mockResolvedValueOnce(response(201, session)).mockResolvedValueOnce(response(201));
    await setup(); await enterCredentials();
    await waitFor(() => expect(screen.getByText('Olá, Bianca Oliveira!')).toBeTruthy());
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://localhost:3000/auth/login', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: session.user.email, password: 'Demo123!' }),
    }));
    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(screen.getByText('Acesse sua conta')).toBeTruthy());
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'http://localhost:3000/auth/logout', expect.objectContaining({
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
  });
  it('mantém a sessão se o logout falhar e permite tentar novamente', async () => {
    fetchMock.mockResolvedValueOnce(response(201, session)).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValueOnce(response(401));
    await setup(); await enterCredentials();
    await waitFor(() => expect(screen.getByText('Olá, Bianca Oliveira!')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(screen.getByText(/Não foi possível conectar ao servidor/)).toBeTruthy());
    expect(screen.getByText('Olá, Bianca Oliveira!')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Sair da conta' }));
    await waitFor(() => expect(screen.getByText('Acesse sua conta')).toBeTruthy());
  });
});
