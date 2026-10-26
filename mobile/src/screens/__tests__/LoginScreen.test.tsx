import { render, screen } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';
import LoginScreen from '../LoginScreen';

describe('LoginScreen', () => {
  it('renders the login title and authentication message', async () => {
    await render(<LoginScreen />);

    expect(screen.getByText('Login')).toBeTruthy();
    expect(screen.getByText('Tela de autenticação')).toBeTruthy();
  });
});
