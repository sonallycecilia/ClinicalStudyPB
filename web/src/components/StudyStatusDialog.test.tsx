import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StudyStatusBadge, StudyStatusDialog } from './StudyStatusDialog';
import type { Study } from '../studies/studiesApi';

const { mockRequest } = vi.hoisted(() => ({ mockRequest: vi.fn() }));
vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ request: mockRequest }),
}));

const study: Study = {
  id: 'study-1',
  code: 'EST-001',
  title: 'Qualidade do sono',
  objective: 'Avaliar padrões de sono.',
  researcherId: 'researcher-1',
  researcher: 'Marina Costa',
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  participantLimit: 20,
  participantsLinked: 5,
  status: 'planejamento',
  kind: 'Estudo observacional',
  symbol: 'moon',
};

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

beforeEach(() => mockRequest.mockReset());
afterEach(cleanup);

describe('StudyStatusBadge', () => {
  it('apresenta o estado oficial ou sinaliza valores desconhecidos', () => {
    const { rerender } = render(<StudyStatusBadge status="recrutamento" />);
    expect(screen.getByText('Recrutamento').classList.contains('status-recrutamento')).toBe(true);

    rerender(<StudyStatusBadge status={null} />);
    expect(screen.getByText('Estado desconhecido').classList.contains('status-desconhecido')).toBe(true);
  });
});

describe('StudyStatusDialog', () => {
  it('submete a transição válida e só comunica o estudo retornado pela API', async () => {
    const changedStudy = { ...study, status: 'recrutamento' as const };
    const onCancel = vi.fn();
    const onChanged = vi.fn();
    mockRequest.mockResolvedValue(response(changedStudy));
    render(<StudyStatusDialog study={study} onCancel={onCancel} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(changedStudy));
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-1/status', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'recrutamento' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('mostra erros da API sem confirmar a transição e permite cancelar', async () => {
    const onCancel = vi.fn();
    const onChanged = vi.fn();
    mockRequest.mockResolvedValue(response({ message: 'Você não tem permissão para alterar este estudo.' }, 403));
    render(<StudyStatusDialog study={study} onCancel={onCancel} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Você não tem permissão para alterar este estudo.');
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirmar alteração' })).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('rejeita estado de destino vazio sem chamar a API', () => {
    render(<StudyStatusDialog study={study} onCancel={vi.fn()} onChanged={vi.fn()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Novo estado' }), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));

    expect(screen.getByRole('alert').textContent).toBe('Selecione um novo estado válido para o estudo.');
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('impede cancelar durante envio pendente e não permite confirmar duas vezes', async () => {
    let resolve!: (value: Response) => void;
    mockRequest.mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; }));
    const onCancel = vi.fn();
    const onChanged = vi.fn();
    render(<StudyStatusDialog study={study} onCancel={onCancel} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar alteração' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect((screen.getByRole('button', { name: 'Alterando...' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
    expect(mockRequest).toHaveBeenCalledTimes(1);

    resolve(response({ ...study, status: 'recrutamento' }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['encerrado', 'Este estudo está encerrado e não pode mudar de estado.'],
    ['arquivado', 'O estado atual deste estudo não é reconhecido. Atualize a página ou contate o responsável pelo sistema.'],
  ] as const)('não oferece transições quando o estado é %s', (status, message) => {
    const currentStudy = { ...study, status: status as Study['status'] };
    render(<StudyStatusDialog study={currentStudy} onCancel={vi.fn()} onChanged={vi.fn()} />);

    expect(screen.getByRole('alert').textContent).toBe(message);
    expect(screen.queryByRole('button', { name: 'Confirmar alteração' })).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('cancela pelo fundo do diálogo, mas não ao clicar no conteúdo', () => {
    const onCancel = vi.fn();
    render(<StudyStatusDialog study={study} onCancel={onCancel} onChanged={vi.fn()} />);
    const backdrop = screen.getByRole('presentation');

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.mouseDown(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
