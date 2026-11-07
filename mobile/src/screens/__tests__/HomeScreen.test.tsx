import { render, screen } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import HomeScreen from '../HomeScreen';

jest.mock('../../auth/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Bianca Oliveira', email: 'bianca.oliveira@clinicalstudypb.test', role: 'Participante' }, logout: jest.fn() }),
}));
describe('HomeScreen', () => {
  it('identifica a conta autenticada e oferece logout', async () => {
    await render(<HomeScreen />);
    expect(screen.getByText('Olá, Bianca Oliveira!')).toBeTruthy();
    expect(screen.getByText('Participante')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sair da conta' })).toBeTruthy();
  });
});
