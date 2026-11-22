import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { VisitStatusForm, type VisitStatusFormProps } from './VisitStatusForm';
import { ScheduledVisitsApiError, STATUS_DOMAIN_ERRORS, type ScheduledVisit } from './scheduledVisitsApi';

const now = new Date('2026-11-25T15:00:00.000Z');
const visit: ScheduledVisit = {
  id: 'scheduled-1', studyId: 'study-1', participationId: 'participation-1', participantName: 'Bianca Oliveira',
  plannedVisitId: 'planned-1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1,
  scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Agendada', realizedAt: null, observation: 'Trazer exames.',
  createdAt: '2026-11-16T13:20:41.512Z',
};
const toLocal = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

function setup(overrides: Partial<VisitStatusFormProps> = {}) {
  const props: VisitStatusFormProps = {
    visit,
    onUpdate: vi.fn(async (current, input) => ({ ...current, status: input.status, realizedAt: input.realizedAt ?? null, observation: input.observation === undefined ? current.observation : input.observation })),
    onUpdated: vi.fn(),
    onCancel: vi.fn(),
    onBusyChange: vi.fn(),
    onStale: vi.fn(),
    now: () => now,
    ...overrides,
  };
  render(<VisitStatusForm {...props} />);
  return props;
}

const confirmButton = () => screen.getByRole('button', { name: 'Confirmar situação' }) as HTMLButtonElement;
const choose = (status: string) => fireEvent.click(screen.getByRole('radio', { name: new RegExp(`^${status}`) }));

afterEach(cleanup);

describe('VisitStatusForm — autorização e carregamento', () => {
  it('mostra o envio em andamento e a recusa de permissão, sem alterar a visita nem recarregar a agenda', async () => {
    let reject!: (reason: unknown) => void;
    const onUpdate = vi.fn(() => new Promise<ScheduledVisit>((_resolve, fail) => { reject = fail; }));
    const props = setup({ onUpdate });
    choose('Ausente');
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(screen.getByText('Atualizando situação…')).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
    await act(async () => { reject(new ScheduledVisitsApiError('Você não tem permissão para atualizar visitas neste estudo.', 403)); });
    expect(screen.getByRole('alert').textContent).toContain('Você não tem permissão para atualizar visitas neste estudo.');
    expect((screen.getByRole('radio', { name: /^Ausente/ }) as HTMLInputElement).checked).toBe(true);
    expect(confirmButton().disabled).toBe(false);
    expect(props.onUpdated).not.toHaveBeenCalled();
    expect(props.onStale).not.toHaveBeenCalled();
  });
});

describe('VisitStatusForm', () => {
  it('exibe a situação atual e exige a escolha da nova situação', async () => {
    const props = setup();
    expect(screen.getByText('Bianca Oliveira')).toBeTruthy();
    expect(screen.getByText('1. Consulta inicial')).toBeTruthy();
    expect(screen.getByText('24/11/2026 · 09:00')).toBeTruthy();
    expect(screen.getByText('Agendada')).toBeTruthy();
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(screen.getByText('Selecione a nova situação da visita.')).toBeTruthy();
    expect(props.onUpdate).not.toHaveBeenCalled();
  });

  it('solicita a data de realização só para Realizada, sugerindo o horário agendado', () => {
    setup();
    expect(screen.queryByLabelText('Data e horário da realização')).toBeNull();
    choose('Realizada');
    const input = screen.getByLabelText('Data e horário da realização') as HTMLInputElement;
    expect(input.value).toBe(toLocal(visit.scheduledAt));
    choose('Ausente');
    expect(screen.queryByLabelText('Data e horário da realização')).toBeNull();
  });

  it('recusa data de realização futura ou vazia', async () => {
    const props = setup();
    choose('Realizada');
    const input = screen.getByLabelText('Data e horário da realização');
    fireEvent.change(input, { target: { value: toLocal('2026-11-26T15:00:00.000Z') } });
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(screen.getByText('A data de realização não pode ser futura.')).toBeTruthy();
    fireEvent.change(input, { target: { value: '' } });
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(screen.getByText('Informe a data e o horário da realização.')).toBeTruthy();
    expect(props.onUpdate).not.toHaveBeenCalled();
  });

  it('registra Realizada com realizedAt em ISO e observação alterada, e só então confirma', async () => {
    const props = setup();
    choose('Realizada');
    fireEvent.change(screen.getByLabelText('Data e horário da realização'), { target: { value: toLocal('2026-11-24T12:40:00.000Z') } });
    fireEvent.change(screen.getByLabelText('Observação (opcional)'), { target: { value: ' Compareceu no horário. ' } });
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(props.onUpdate).toHaveBeenCalledExactlyOnceWith(visit, {
      status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z', observation: 'Compareceu no horário.',
    }, expect.any(AbortSignal));
    expect(props.onUpdated).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: visit.id, status: 'Realizada' }));
  });

  it('omite a observação inalterada e não envia data para Cancelada', async () => {
    const props = setup();
    choose('Cancelada');
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(props.onUpdate).toHaveBeenCalledWith(visit, { status: 'Cancelada' }, expect.any(AbortSignal));
  });

  it('não confirma quando a API devolve outra situação', async () => {
    const props = setup({ onUpdate: vi.fn(async () => visit) });
    choose('Ausente');
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(screen.getByRole('alert').textContent).toContain('O servidor retornou uma visita inválida.');
    expect(props.onUpdated).not.toHaveBeenCalled();
  });

  it('preserva os dados e pede recarga da agenda quando a situação já mudou', async () => {
    const message = 'Transição de "Cancelada" para "Realizada" não permitida.';
    const props = setup({ onUpdate: vi.fn().mockRejectedValue(new ScheduledVisitsApiError(message, 400, 'VISIT_STATUS_FINAL', { status: message })) });
    choose('Realizada');
    fireEvent.change(screen.getByLabelText('Observação (opcional)'), { target: { value: 'Nova observação' } });
    await act(async () => { fireEvent.click(confirmButton()); });
    expect(within(screen.getByRole('alert')).getByText(message)).toBeTruthy();
    expect((screen.getByRole('radio', { name: /^Realizada/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Observação (opcional)') as HTMLTextAreaElement).value).toBe('Nova observação');
    expect(props.onStale).toHaveBeenCalledOnce();
    expect(props.onUpdated).not.toHaveBeenCalled();
  });

  it('aponta a data de realização recusada pelo servidor', async () => {
    const { message } = STATUS_DOMAIN_ERRORS.REALIZED_AT_INVALID;
    setup({ onUpdate: vi.fn().mockRejectedValue(new ScheduledVisitsApiError(message, 400, 'REALIZED_AT_INVALID', { realizedAt: message })) });
    choose('Realizada');
    await act(async () => { fireEvent.click(confirmButton()); });
    const input = screen.getByLabelText('Data e horário da realização');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(screen.getAllByText(message)).toHaveLength(2);
  });

  it('bloqueia envio duplicado enquanto aguarda a API', async () => {
    let resolve!: (value: ScheduledVisit) => void;
    const onUpdate = vi.fn(() => new Promise<ScheduledVisit>((done) => { resolve = done; }));
    const props = setup({ onUpdate });
    choose('Ausente');
    await act(async () => { fireEvent.click(confirmButton()); });
    fireEvent.submit(screen.getByRole('form', { name: 'Situação da visita' }));
    expect(onUpdate).toHaveBeenCalledOnce();
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText('Atualizando situação…')).toBeTruthy();
    expect(props.onUpdated).not.toHaveBeenCalled();
    await act(async () => { resolve({ ...visit, status: 'Ausente' }); });
    await waitFor(() => expect(props.onUpdated).toHaveBeenCalledOnce());
  });

  it('mostra visitas em situação final apenas para consulta', () => {
    const props = setup({ visit: { ...visit, status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z' } });
    expect(screen.getByText('A situação “Realizada” é final e não pode ser alterada. Para remarcar, crie um novo agendamento.')).toBeTruthy();
    expect(screen.getByText('24/11/2026 · 09:40')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Confirmar situação' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(props.onCancel).toHaveBeenCalledOnce();
  });
});
