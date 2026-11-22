import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { CandidateStudiesState } from '../candidates/CandidateForm';
import type { PlannedVisit } from '../studies/visitsApi';
import { ScheduleVisitForm, type ScheduleVisitFormProps } from './ScheduleVisitForm';
import { ScheduledVisitsApiError, SCHEDULE_DOMAIN_ERRORS, type IncludedParticipant, type ScheduledVisit } from './scheduledVisitsApi';

const studies: CandidateStudiesState = { status: 'ready', options: [{ id: 'study-1', title: 'Qualidade do sono' }, { id: 'study-2', title: 'Pressão arterial' }] };
const participants: Record<string, IncludedParticipant[]> = {
  'study-1': [{ participationId: 'participation-1', candidateId: 'candidate-1', studyId: 'study-1', name: 'Bianca Oliveira', participationStatus: 'Ativo', includedAt: '2026-11-06', withdrawnAt: null, withdrawalReason: null }],
  'study-2': [{ participationId: 'participation-2', candidateId: 'candidate-2', studyId: 'study-2', name: 'Rafael Lima', participationStatus: 'Ativo', includedAt: '2026-11-01', withdrawnAt: null, withdrawalReason: null }],
};
const plannedVisits: Record<string, PlannedVisit[]> = {
  'study-1': [
    { id: 'planned-2', studyId: 'study-1', name: 'Retorno', order: 2, intervalDays: 30, description: null },
    { id: 'planned-1', studyId: 'study-1', name: 'Consulta inicial', order: 1, intervalDays: null, description: null },
  ],
  'study-2': [{ id: 'planned-3', studyId: 'study-2', name: 'Avaliação inicial', order: 1, intervalDays: null, description: null }],
};
const scheduled: ScheduledVisit = {
  id: 'scheduled-1', studyId: 'study-1', participationId: 'participation-1', participantName: 'Bianca Oliveira',
  plannedVisitId: 'planned-1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1,
  scheduledAt: new Date('2026-11-24T09:00').toISOString(), status: 'Agendada', realizedAt: null, observation: 'Trazer exames.',
  createdAt: '2026-11-16T13:20:41.512Z',
};

function setup(overrides: Partial<ScheduleVisitFormProps> = {}) {
  const props: ScheduleVisitFormProps = {
    studies,
    loadParticipants: vi.fn(async (studyId: string) => participants[studyId] ?? []),
    loadPlannedVisits: vi.fn(async (studyId: string) => plannedVisits[studyId] ?? []),
    onSchedule: vi.fn(async () => scheduled),
    onScheduled: vi.fn(),
    onCancel: vi.fn(),
    onBusyChange: vi.fn(),
    ...overrides,
  };
  render(<ScheduleVisitForm {...props} />);
  return props;
}

const field = (name: string) => screen.getByLabelText(name) as HTMLSelectElement | HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: 'Agendar visita' }) as HTMLButtonElement;

async function chooseStudy(id = 'study-1') {
  fireEvent.change(field('Estudo'), { target: { value: id } });
  await waitFor(() => expect((field('Participante') as HTMLSelectElement).disabled).toBe(false));
}

async function fillValid() {
  await chooseStudy();
  fireEvent.change(field('Participante'), { target: { value: 'participation-1' } });
  fireEvent.change(field('Visita prevista'), { target: { value: 'planned-1' } });
  fireEvent.change(field('Data e horário'), { target: { value: '2026-11-24T09:00' } });
  fireEvent.change(field('Observação (opcional)'), { target: { value: '  Trazer exames.  ' } });
}

afterEach(cleanup);

describe('ScheduleVisitForm — autorização', () => {
  it('mostra a recusa de permissão da API, mantém os dados e libera o formulário', async () => {
    const onSchedule = vi.fn().mockRejectedValue(new ScheduledVisitsApiError('Você não tem permissão para agendar visitas neste estudo.', 403));
    const props = setup({ onSchedule });
    await fillValid();
    await act(async () => { fireEvent.click(submitButton()); });
    expect(screen.getByRole('alert').textContent).toContain('Você não tem permissão para agendar visitas neste estudo.');
    expect(field('Participante').value).toBe('participation-1');
    expect(field('Visita prevista').value).toBe('planned-1');
    expect(submitButton().disabled).toBe(false);
    expect(props.onScheduled).not.toHaveBeenCalled();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('mostra a recusa de acesso ao carregar os dados do estudo', async () => {
    setup({ loadParticipants: vi.fn().mockRejectedValue(new ScheduledVisitsApiError('Você não tem permissão para consultar os participantes deste estudo.', 403)) });
    fireEvent.change(field('Estudo'), { target: { value: 'study-1' } });
    expect(await screen.findByText('Você não tem permissão para consultar os participantes deste estudo.')).toBeTruthy();
    expect((field('Participante') as HTMLSelectElement).disabled).toBe(true);
  });
});

describe('ScheduleVisitForm', () => {
  it('valida os campos obrigatórios sem chamar a API e foca o primeiro campo inválido', async () => {
    const props = setup();
    await act(async () => { fireEvent.click(submitButton()); });
    expect(screen.getByText('Selecione o estudo.')).toBeTruthy();
    expect(screen.getByText('Selecione um participante incluído.')).toBeTruthy();
    expect(screen.getByText('Selecione a visita prevista.')).toBeTruthy();
    expect(screen.getByText('Informe a data e o horário da visita.')).toBeTruthy();
    expect(field('Estudo').getAttribute('aria-invalid')).toBe('true');
    expect(field('Estudo').getAttribute('aria-describedby')).toContain('schedule-study-error');
    await waitFor(() => expect(document.activeElement).toBe(field('Estudo')));
    expect(props.onSchedule).not.toHaveBeenCalled();
  });

  it('carrega participantes ativos e visitas previstas ordenadas do estudo escolhido', async () => {
    const props = setup();
    expect((field('Participante') as HTMLSelectElement).disabled).toBe(true);
    await chooseStudy();
    expect(props.loadParticipants).toHaveBeenCalledWith('study-1', expect.any(AbortSignal));
    expect(props.loadPlannedVisits).toHaveBeenCalledWith('study-1', expect.any(AbortSignal));
    const visitOptions = within(field('Visita prevista')).getAllByRole('option').map((option) => option.textContent);
    expect(visitOptions).toEqual(['Selecione a visita', '1. Consulta inicial', '2. Retorno']);
    expect(within(field('Participante')).getByRole('option', { name: 'Bianca Oliveira' })).toBeTruthy();
  });

  it('envia o agendamento com data em ISO UTC e observação aparada, e confirma com o retorno da API', async () => {
    const props = setup();
    await fillValid();
    expect(screen.getByText('Participante incluído em 06/11/2026.')).toBeTruthy();
    await act(async () => { fireEvent.click(submitButton()); });
    expect(props.onSchedule).toHaveBeenCalledExactlyOnceWith('study-1', {
      participationId: 'participation-1', plannedVisitId: 'planned-1',
      scheduledAt: new Date('2026-11-24T09:00').toISOString(), observation: 'Trazer exames.',
    }, expect.any(AbortSignal));
    expect(props.onScheduled).toHaveBeenCalledExactlyOnceWith(scheduled);
    expect(props.onBusyChange).toHaveBeenNthCalledWith(1, true);
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('preserva os dados preenchidos e aponta o campo quando a API recusa o agendamento', async () => {
    const { message } = SCHEDULE_DOMAIN_ERRORS.VISIT_ALREADY_SCHEDULED;
    const onSchedule = vi.fn()
      .mockRejectedValueOnce(new ScheduledVisitsApiError(message, 409, 'VISIT_ALREADY_SCHEDULED', { plannedVisitId: message }))
      .mockResolvedValueOnce(scheduled);
    const props = setup({ onSchedule });
    await fillValid();
    await act(async () => { fireEvent.click(submitButton()); });

    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('Não foi possível agendar a visita')).toBeTruthy();
    expect(within(alert).getByText(message)).toBeTruthy();
    expect(field('Visita prevista').getAttribute('aria-invalid')).toBe('true');
    expect(field('Estudo').value).toBe('study-1');
    expect(field('Participante').value).toBe('participation-1');
    expect(field('Visita prevista').value).toBe('planned-1');
    expect(field('Data e horário').value).toBe('2026-11-24T09:00');
    expect(field('Observação (opcional)').value).toBe('  Trazer exames.  ');
    expect(props.onScheduled).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);

    await act(async () => { fireEvent.click(submitButton()); });
    expect(onSchedule).toHaveBeenCalledTimes(2);
    expect(props.onScheduled).toHaveBeenCalledExactlyOnceWith(scheduled);
  });

  it('mostra mensagem genérica para falhas inesperadas, mantendo os dados', async () => {
    setup({ onSchedule: vi.fn().mockRejectedValue(new Error('boom')) });
    await fillValid();
    await act(async () => { fireEvent.click(submitButton()); });
    expect(screen.getByText('Não foi possível concluir o agendamento. Tente novamente em alguns instantes.')).toBeTruthy();
    expect(field('Participante').value).toBe('participation-1');
  });

  it('bloqueia envio duplicado e os campos enquanto aguarda a API', async () => {
    let resolve!: (visit: ScheduledVisit) => void;
    const onSchedule = vi.fn(() => new Promise<ScheduledVisit>((done) => { resolve = done; }));
    const props = setup({ onSchedule });
    await fillValid();
    await act(async () => { fireEvent.click(submitButton()); });
    fireEvent.submit(screen.getByRole('form', { name: 'Agendamento de visita' }));
    expect(onSchedule).toHaveBeenCalledOnce();
    expect(screen.getByText('Agendando visita…')).toBeTruthy();
    expect(submitButton().disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(field('Data e horário').disabled).toBe(true);
    await act(async () => { resolve(scheduled); });
    expect(props.onScheduled).toHaveBeenCalledOnce();
  });

  it('recusa data anterior à inclusão do participante', async () => {
    const props = setup();
    await fillValid();
    fireEvent.change(field('Data e horário'), { target: { value: '2026-11-05T10:00' } });
    await act(async () => { fireEvent.click(submitButton()); });
    expect(screen.getByText('A data não pode ser anterior à inclusão do participante (06/11/2026).')).toBeTruthy();
    expect(props.onSchedule).not.toHaveBeenCalled();
  });

  it('limpa participante e visita prevista ao trocar de estudo', async () => {
    setup();
    await fillValid();
    await chooseStudy('study-2');
    expect(field('Participante').value).toBe('');
    expect(field('Visita prevista').value).toBe('');
    expect(within(field('Participante')).getByRole('option', { name: 'Rafael Lima' })).toBeTruthy();
    expect(field('Data e horário').value).toBe('2026-11-24T09:00');
  });

  it('informa estudo sem participantes ativos ou sem visitas previstas', async () => {
    setup({ loadParticipants: vi.fn(async () => []), loadPlannedVisits: vi.fn(async () => []) });
    fireEvent.change(field('Estudo'), { target: { value: 'study-1' } });
    expect(await screen.findByText('Este estudo não possui participantes ativos para agendamento.')).toBeTruthy();
    expect(screen.getByText('Este estudo não possui visitas previstas cadastradas.')).toBeTruthy();
    expect((field('Participante') as HTMLSelectElement).disabled).toBe(true);
  });

  it('permite tentar novamente quando a consulta dos dados do estudo falha', async () => {
    const loadParticipants = vi.fn()
      .mockRejectedValueOnce(new ScheduledVisitsApiError('Você não tem permissão para consultar os participantes deste estudo.', 403))
      .mockResolvedValueOnce(participants['study-1']);
    setup({ loadParticipants });
    fireEvent.change(field('Estudo'), { target: { value: 'study-1' } });
    expect(await screen.findByText('Você não tem permissão para consultar os participantes deste estudo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    await waitFor(() => expect((field('Participante') as HTMLSelectElement).disabled).toBe(false));
    expect(loadParticipants).toHaveBeenCalledTimes(2);
  });

  it('indica quando não há estudos disponíveis e permite cancelar', () => {
    const props = setup({ studies: { status: 'ready', options: [] }, studyHint: 'São exibidos apenas estudos em recrutamento.' });
    expect(field('Estudo').disabled).toBe(true);
    expect(screen.getByText('Nenhum estudo disponível para agendamento.')).toBeTruthy();
    expect(screen.getByText('São exibidos apenas estudos em recrutamento.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(props.onCancel).toHaveBeenCalledOnce();
  });
});
