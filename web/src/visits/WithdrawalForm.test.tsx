import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { WithdrawalForm, type WithdrawalFormProps } from './WithdrawalForm';
import { ScheduledVisitsApiError, type IncludedParticipant } from './scheduledVisitsApi';

const participant: IncludedParticipant = {
  participationId: 'participation-1', candidateId: 'candidate-1', studyId: 'study-1', name: 'Participante Teste',
  participationStatus: 'Ativo', includedAt: '2026-11-10', withdrawnAt: null, withdrawalReason: null,
};
const withdrawn = (withdrawalDate: string, reason: string): IncludedParticipant => ({
  ...participant, participationStatus: 'Retirado', withdrawnAt: withdrawalDate, withdrawalReason: reason,
});
// 22/11/2026 às 14h em São Paulo.
const now = () => new Date('2026-11-22T17:00:00.000Z');

function setup(overrides: Partial<WithdrawalFormProps> = {}) {
  const props: WithdrawalFormProps = {
    participant,
    onWithdraw: vi.fn(async (_participant, input) => withdrawn(input.withdrawalDate, input.reason)),
    onWithdrawn: vi.fn(),
    onCancel: vi.fn(),
    onStale: vi.fn(),
    onBusyChange: vi.fn(),
    now,
    ...overrides,
  };
  render(<WithdrawalForm {...props} />);
  return props;
}

const date = () => screen.getByLabelText('Data da retirada') as HTMLInputElement;
const reason = () => screen.getByLabelText('Motivo da retirada') as HTMLTextAreaElement;
const review = () => fireEvent.click(screen.getByRole('button', { name: 'Registrar retirada' }));
const confirm = () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada' }));

afterEach(cleanup);

describe('WithdrawalForm', () => {
  it('sugere a data de hoje e limita a data entre a inclusão e hoje', () => {
    setup();
    expect(date().value).toBe('2026-11-22');
    expect(date().min).toBe('2026-11-10');
    expect(date().max).toBe('2026-11-22');
    expect(screen.getByText('Entre a inclusão (10/11/2026) e hoje.')).toBeTruthy();
  });

  it('valida motivo obrigatório e data fora do período antes de pedir confirmação', () => {
    const props = setup();
    fireEvent.change(date(), { target: { value: '' } });
    fireEvent.change(reason(), { target: { value: '   ' } });
    review();
    expect(screen.getByText('Informe a data da retirada.')).toBeTruthy();
    expect(screen.getByText('Informe o motivo da retirada.')).toBeTruthy();
    expect(reason().getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(date(), { target: { value: '2026-11-09' } });
    fireEvent.change(reason(), { target: { value: 'Mudança de cidade' } });
    review();
    expect(screen.getByText('A data não pode ser anterior à inclusão do participante (10/11/2026).')).toBeTruthy();

    fireEvent.change(date(), { target: { value: '2026-11-23' } });
    review();
    expect(screen.getByText('A data da retirada não pode ser futura.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirmar retirada' })).toBeNull();
    expect(props.onWithdraw).not.toHaveBeenCalled();
  });

  it('pede confirmação e permite voltar sem enviar', () => {
    const props = setup();
    fireEvent.change(reason(), { target: { value: 'Mudança de cidade' } });
    review();
    expect(screen.getByText(/Confirma a retirada de Participante Teste em 22\/11\/2026\?/)).toBeTruthy();
    expect(reason().disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(reason().disabled).toBe(false);
    expect(reason().value).toBe('Mudança de cidade');
    expect(props.onWithdraw).not.toHaveBeenCalled();
  });

  it('envia data e motivo e só avisa a tela após a confirmação da API', async () => {
    let resolve!: (value: IncludedParticipant) => void;
    const onWithdraw = vi.fn(() => new Promise<IncludedParticipant>((done) => { resolve = done; }));
    const props = setup({ onWithdraw });
    fireEvent.change(date(), { target: { value: '2026-11-20' } });
    fireEvent.change(reason(), { target: { value: '  Mudança de cidade  ' } });
    review();
    confirm();
    confirm();
    expect(onWithdraw).toHaveBeenCalledTimes(1);
    expect(onWithdraw).toHaveBeenCalledWith(participant, { withdrawalDate: '2026-11-20', reason: 'Mudança de cidade' }, expect.any(AbortSignal));
    expect(screen.getByText('Registrando retirada…')).toBeTruthy();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
    expect(props.onWithdrawn).not.toHaveBeenCalled();
    resolve(withdrawn('2026-11-20', 'Mudança de cidade'));
    await waitFor(() => expect(props.onWithdrawn).toHaveBeenCalledWith(withdrawn('2026-11-20', 'Mudança de cidade')));
  });

  it('mostra a recusa do backend, mantém os dados e recarrega quando a participação já não está ativa', async () => {
    const onWithdraw = vi.fn()
      .mockRejectedValueOnce(new ScheduledVisitsApiError('A data de retirada deve estar entre a inclusão e a data atual.', 400, 'WITHDRAWAL_DATE_INVALID', { withdrawalDate: 'A data de retirada deve estar entre a inclusão e a data atual.' }))
      .mockRejectedValueOnce(new ScheduledVisitsApiError('Somente participantes ativos podem ser retirados do estudo.', 400, 'PARTICIPATION_NOT_ACTIVE'));
    const props = setup({ onWithdraw });
    fireEvent.change(reason(), { target: { value: 'Mudança de cidade' } });
    review();
    confirm();
    expect((await screen.findAllByText('A data de retirada deve estar entre a inclusão e a data atual.')).length).toBe(2);
    expect(reason().value).toBe('Mudança de cidade');
    expect(date().getAttribute('aria-invalid')).toBe('true');
    expect(props.onStale).not.toHaveBeenCalled();

    review();
    confirm();
    expect(await screen.findByText('Somente participantes ativos podem ser retirados do estudo.')).toBeTruthy();
    expect(props.onStale).toHaveBeenCalledTimes(1);
    expect(props.onWithdrawn).not.toHaveBeenCalled();
  });

  it('recusa resposta que não confirma a retirada e trata falha inesperada', async () => {
    const onWithdraw = vi.fn()
      .mockResolvedValueOnce(participant)
      .mockRejectedValueOnce(new Error('rede'));
    const props = setup({ onWithdraw });
    fireEvent.change(reason(), { target: { value: 'Mudança de cidade' } });
    review();
    confirm();
    expect(await screen.findByText(/participação inválida/)).toBeTruthy();
    review();
    confirm();
    expect(await screen.findByText('Não foi possível registrar a retirada. Tente novamente em alguns instantes.')).toBeTruthy();
    expect(props.onWithdrawn).not.toHaveBeenCalled();
  });

  it('mostra a recusa de permissão sem recarregar o histórico e permite tentar de novo', async () => {
    const onWithdraw = vi.fn()
      .mockRejectedValueOnce(new ScheduledVisitsApiError('Você não tem permissão para registrar a retirada neste estudo.', 403))
      .mockImplementationOnce(async (_participant, input) => withdrawn(input.withdrawalDate, input.reason));
    const props = setup({ onWithdraw });
    fireEvent.change(reason(), { target: { value: 'Mudança de cidade' } });
    review();
    confirm();
    expect(await screen.findByText('Você não tem permissão para registrar a retirada neste estudo.')).toBeTruthy();
    expect(props.onStale).not.toHaveBeenCalled();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
    review();
    confirm();
    await waitFor(() => expect(props.onWithdrawn).toHaveBeenCalledTimes(1));
  });

  it('cancela sem enviar', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onWithdraw).not.toHaveBeenCalled();
  });
});
