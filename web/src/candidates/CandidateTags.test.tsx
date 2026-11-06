import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CandidateTags } from './CandidateTags';

afterEach(cleanup);
describe('etiquetas de candidatos por estudo', () => {
  it('mostra até nove nomes únicos e +N, sem oferecer remoção sem autorização', () => {
    const candidates = Array.from({ length: 12 }, (_, id) => ({ id: String(id), name: `Pessoa ${id}` }));
    render(<CandidateTags candidates={[...candidates, candidates[0]]} />);
    expect(screen.getAllByRole('listitem')).toHaveLength(10);
    expect(screen.getByText('Pessoa 8')).toBeTruthy();
    expect(screen.queryByText('Pessoa 9')).toBeNull();
    expect(screen.getByLabelText('3 outros candidatos').textContent).toBe('+3');
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('solicita remoção apenas quando uma ação autorizada é fornecida', () => {
    const onRemove = vi.fn();
    const candidate = { id: 'candidate-1', name: 'Ana Silva' };
    render(<CandidateTags candidates={[candidate]} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover vínculo de Ana Silva' }));
    expect(onRemove).toHaveBeenCalledWith(candidate);
    expect(screen.getByText('Ana Silva')).toBeTruthy();
  });
});
