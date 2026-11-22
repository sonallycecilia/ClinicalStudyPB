import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { VisitResultsPanel, type VisitResultsPanelProps } from './VisitResultsPanel';
import { ScheduledVisitsApiError, type AssessmentResult, type ScheduledVisit, type ScheduledVisitResults } from './scheduledVisitsApi';

const visit: ScheduledVisit = {
  id: 'scheduled-1', studyId: 'study-1', participationId: 'participation-1', participantName: 'Participante Teste',
  plannedVisitId: 'planned-1', plannedVisitName: 'Consulta inicial', plannedVisitOrder: 1,
  scheduledAt: '2026-11-24T12:00:00.000Z', status: 'Realizada', realizedAt: '2026-11-24T12:40:00.000Z', observation: null,
  createdAt: '2026-11-16T13:20:41.512Z',
};
const registered: AssessmentResult = {
  id: 'result-1', scheduledVisitId: 'scheduled-1', activityId: 'activity-1', value: '72', unit: 'bpm',
  observation: 'Repouso', registeredAt: '2026-11-24T13:05:00.000Z', registrarId: 'researcher-1',
};
const results: ScheduledVisitResults = {
  scheduledVisitId: 'scheduled-1', plannedVisitId: 'planned-1', status: 'Realizada',
  activities: [
    { activityId: 'activity-1', name: 'Frequência cardíaca', type: 'Exame', description: null, result: registered },
    { activityId: 'activity-2', name: 'Pressão arterial', type: 'Exame', description: 'Aferir sentado.', result: null },
  ],
};
const newResult: AssessmentResult = { ...registered, id: 'result-2', activityId: 'activity-2', value: '120/80', unit: 'mmHg', observation: null };

function setup(overrides: Partial<VisitResultsPanelProps> = {}) {
  const props: VisitResultsPanelProps = {
    visit,
    loadResults: vi.fn(async () => results),
    onRegister: vi.fn(async () => newResult),
    onBusyChange: vi.fn(),
    ...overrides,
  };
  render(<VisitResultsPanel {...props} />);
  return props;
}

const pressureForm = () => screen.getByRole('form', { name: 'Resultado de Pressão arterial' });

afterEach(cleanup);

describe('VisitResultsPanel — autorização e carregamento', () => {
  it('mostra o carregamento das atividades e a recusa de acesso na consulta', async () => {
    const loadResults = vi.fn()
      .mockImplementationOnce(() => new Promise(() => {}));
    const { unmount } = render(<VisitResultsPanel visit={visit} loadResults={loadResults} />);
    expect(screen.getByText('Carregando atividades da visita…')).toBeTruthy();
    unmount();
    setup({ loadResults: vi.fn().mockRejectedValue(new ScheduledVisitsApiError('Você não tem permissão para consultar os resultados das visitas deste estudo.', 403)) });
    expect(await screen.findByText('Você não tem permissão para consultar os resultados das visitas deste estudo.')).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('mostra a recusa de permissão no registro e mantém o resultado preenchido', async () => {
    const props = setup({ onRegister: vi.fn().mockRejectedValue(new ScheduledVisitsApiError('Você não tem permissão para registrar resultados neste estudo.', 403)) });
    await screen.findByText('Pressão arterial');
    fireEvent.change(within(pressureForm()).getByLabelText('Resultado fictício'), { target: { value: '120/80' } });
    await act(async () => { fireEvent.click(within(pressureForm()).getByRole('button', { name: 'Registrar resultado' })); });
    expect(within(pressureForm()).getByRole('alert').textContent).toContain('Você não tem permissão para registrar resultados neste estudo.');
    expect((within(pressureForm()).getByLabelText('Resultado fictício') as HTMLInputElement).value).toBe('120/80');
    expect(screen.getByText('1 de 2 com resultado')).toBeTruthy();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });
});

describe('VisitResultsPanel', () => {
  it('exibe as atividades previstas com o resultado já registrado e formulário só nas pendentes', async () => {
    setup();
    expect(await screen.findByText('Frequência cardíaca')).toBeTruthy();
    expect(screen.getByText('1 de 2 com resultado')).toBeTruthy();
    expect(screen.getByText('72')).toBeTruthy();
    expect(screen.getByText('Repouso')).toBeTruthy();
    expect(screen.getByText('Aferir sentado.')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Resultado de Frequência cardíaca' })).toBeNull();
    expect(pressureForm()).toBeTruthy();
  });

  it('valida o resultado obrigatório sem chamar a API', async () => {
    const props = setup();
    await screen.findByText('Pressão arterial');
    await act(async () => { fireEvent.click(within(pressureForm()).getByRole('button', { name: 'Registrar resultado' })); });
    expect(within(pressureForm()).getByText('Informe o resultado fictício.')).toBeTruthy();
    expect(within(pressureForm()).getByLabelText('Resultado fictício').getAttribute('aria-invalid')).toBe('true');
    expect(props.onRegister).not.toHaveBeenCalled();
  });

  it('registra resultado, unidade e observação e mostra o retorno da API', async () => {
    const props = setup();
    await screen.findByText('Pressão arterial');
    const form = pressureForm();
    fireEvent.change(within(form).getByLabelText('Resultado fictício'), { target: { value: ' 120/80 ' } });
    fireEvent.change(within(form).getByLabelText('Unidade (opcional)'), { target: { value: 'mmHg' } });
    await act(async () => { fireEvent.click(within(form).getByRole('button', { name: 'Registrar resultado' })); });
    expect(props.onRegister).toHaveBeenCalledExactlyOnceWith(visit, { activityId: 'activity-2', value: '120/80', unit: 'mmHg', observation: null }, expect.any(AbortSignal));
    expect(screen.getByText('Resultado registrado com sucesso para “Pressão arterial”.')).toBeTruthy();
    expect(screen.queryByRole('form', { name: 'Resultado de Pressão arterial' })).toBeNull();
    expect(screen.getByText('120/80')).toBeTruthy();
    expect(screen.getByText('2 de 2 com resultado')).toBeTruthy();
  });

  it('evita envio duplicado enquanto aguarda a API', async () => {
    let resolve!: (value: AssessmentResult) => void;
    const onRegister = vi.fn(() => new Promise<AssessmentResult>((done) => { resolve = done; }));
    const props = setup({ onRegister });
    await screen.findByText('Pressão arterial');
    const form = pressureForm();
    fireEvent.change(within(form).getByLabelText('Resultado fictício'), { target: { value: '120/80' } });
    await act(async () => { fireEvent.click(within(form).getByRole('button', { name: 'Registrar resultado' })); });
    fireEvent.submit(form);
    fireEvent.click(within(form).getByRole('button', { name: 'Registrar resultado' }));
    expect(onRegister).toHaveBeenCalledOnce();
    expect((within(form).getByRole('button', { name: 'Registrar resultado' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(form).getByText('Registrando resultado…')).toBeTruthy();
    expect(props.onBusyChange).toHaveBeenLastCalledWith(true);
    await act(async () => { resolve(newResult); });
    expect(props.onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('mantém os dados e mostra o erro quando a API recusa', async () => {
    const onRegister = vi.fn().mockRejectedValue(new ScheduledVisitsApiError('Registre resultados somente em visitas realizadas.', 400, 'VISIT_NOT_REALIZED'));
    setup({ onRegister });
    await screen.findByText('Pressão arterial');
    const form = pressureForm();
    fireEvent.change(within(form).getByLabelText('Resultado fictício'), { target: { value: '120/80' } });
    fireEvent.change(within(form).getByLabelText('Observação (opcional)'), { target: { value: 'Medida fictícia' } });
    await act(async () => { fireEvent.click(within(form).getByRole('button', { name: 'Registrar resultado' })); });
    expect(within(within(form).getByRole('alert')).getByText('Registre resultados somente em visitas realizadas.')).toBeTruthy();
    expect((within(form).getByLabelText('Resultado fictício') as HTMLInputElement).value).toBe('120/80');
    expect((within(form).getByLabelText('Observação (opcional)') as HTMLTextAreaElement).value).toBe('Medida fictícia');
  });

  it('recarrega as atividades quando o resultado já foi registrado por outra pessoa', async () => {
    const loadResults = vi.fn()
      .mockResolvedValueOnce(results)
      .mockResolvedValueOnce({ ...results, activities: results.activities.map((item) => ({ ...item, result: item.result ?? newResult })) });
    const onRegister = vi.fn().mockRejectedValue(new ScheduledVisitsApiError('Já existe resultado registrado para esta atividade nesta visita.', 409, 'RESULT_ALREADY_REGISTERED'));
    setup({ loadResults, onRegister });
    await screen.findByText('Pressão arterial');
    fireEvent.change(within(pressureForm()).getByLabelText('Resultado fictício'), { target: { value: '1' } });
    await act(async () => { fireEvent.click(within(pressureForm()).getByRole('button', { name: 'Registrar resultado' })); });
    await waitFor(() => expect(loadResults).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('120/80')).toBeTruthy();
  });

  it('valida o limite da unidade', async () => {
    const props = setup();
    await screen.findByText('Pressão arterial');
    const form = pressureForm();
    fireEvent.change(within(form).getByLabelText('Resultado fictício'), { target: { value: '1' } });
    fireEvent.change(within(form).getByLabelText('Unidade (opcional)'), { target: { value: 'x'.repeat(51) } });
    await act(async () => { fireEvent.click(within(form).getByRole('button', { name: 'Registrar resultado' })); });
    expect(within(form).getByText('A unidade deve ter até 50 caracteres.')).toBeTruthy();
    expect(props.onRegister).not.toHaveBeenCalled();
  });

  it('não oferece registro em visita que não foi realizada', async () => {
    setup({ visit: { ...visit, status: 'Agendada', realizedAt: null }, loadResults: vi.fn(async () => ({ ...results, status: 'Agendada' as const })) });
    expect(await screen.findByText('Os resultados só podem ser registrados depois que a visita for marcada como Realizada.')).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('é somente leitura sem a operação de registro', async () => {
    setup({ onRegister: undefined, readOnlyNotice: 'O registro dos resultados é feito pelo Pesquisador responsável pelo estudo.' });
    expect(await screen.findByText('O registro dos resultados é feito pelo Pesquisador responsável pelo estudo.')).toBeTruthy();
    expect(screen.getByText('Sem resultado')).toBeTruthy();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('informa visita sem atividades e falha de carregamento com nova tentativa', async () => {
    const loadResults = vi.fn()
      .mockRejectedValueOnce(new ScheduledVisitsApiError('Visita agendada não encontrada neste estudo.', 404))
      .mockResolvedValueOnce({ ...results, activities: [] });
    setup({ loadResults });
    expect(await screen.findByText('Visita agendada não encontrada neste estudo.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(await screen.findByText('Esta visita prevista não possui atividades cadastradas.')).toBeTruthy();
  });
});
