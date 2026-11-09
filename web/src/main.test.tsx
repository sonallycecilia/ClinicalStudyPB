import { act, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

describe('aplicação Web — inicialização', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('monta a aplicação no elemento root e encaminha a sessão ausente ao login', async () => {
    await act(async () => {
      await import('./main');
    });

    expect(await screen.findByRole('heading', { name: 'Acesse sua conta' })).toBeTruthy();
    expect(document.querySelector('#root form')).toBeTruthy();
  });
});
