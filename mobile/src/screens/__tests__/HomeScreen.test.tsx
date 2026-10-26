import { render, screen } from '@testing-library/react-native';
import { describe, expect, it } from '@jest/globals';
import HomeScreen from '../HomeScreen';

describe('HomeScreen', () => {
  it('renders the home screen message', async () => {
    await render(<HomeScreen />);

    expect(screen.getByText('Aplicativo funcionando!')).toBeTruthy();
  });
});
