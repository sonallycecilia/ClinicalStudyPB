import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import { visitsApi, type PlannedVisit } from '../studies/visitsApi';
import { scheduledVisitsApi, ScheduledVisitsApiError, type ScheduledVisit, type UpdateScheduledVisitStatusInput } from './scheduledVisitsApi';
import { formatDateTime, toSaoPauloOffset } from './apiErrors';
import type { Participant } from './participantsApi';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; planned: PlannedVisit[]; visits: ScheduledVisit[] };

/**
 * Agendamento real da participação selecionada: visitas previstas do estudo (GET /studies/:id/visits)
 * e visitas agendadas (GET/POST/PATCH …/scheduled-visits). O participationId enviado é sempre o selecionado.
 */
export function ParticipantSchedulePanel({ participant, writable, formOpen, onFormClose }: {
  participant: Participant; writable: boolean; formOpen: boolean; onFormClose: () => void;
}) {
  const { request } = useAuth();
  const { studyId, participationId } = participant;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [plannedVisitId, setPlannedVisitId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [observation, setObservation] = useState('');
  const [formError, setFormError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const canSchedule = writable && participant.status === 'Ativo';

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    Promise.all([visitsApi.list(request, studyId, controller.signal), scheduledVisitsApi.list(request, studyId, participationId, controller.signal)])
      .then(([planned, visits]) => { if (!controller.signal.aborted) setState({ status: 'ready', planned: [...planned].sort((a, b) => a.order - b.order), visits }); })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: error instanceof Error && error.message ? error.message : 'Não foi possível consultar as visitas. Tente novamente.' });
      });
    return () => controller.abort();
  }, [request, studyId, participationId, attempt]);

  async function run(action: () => Promise<unknown>, fail: (message: string) => void, onDone?: () => void) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    fail('');
    try {
      await action();
      onDone?.();
      setAttempt((value) => value + 1);
    } catch (error) {
      fail(error instanceof ScheduledVisitsApiError ? error.message : 'Não foi possível concluir a operação. Consulte as visitas antes de tentar novamente.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!plannedVisitId) return setFormError('Selecione a visita prevista.');
    if (!scheduledAt) return setFormError('Informe a data e o horário.');
    void run(() => scheduledVisitsApi.create(request, studyId, {
      participationId, plannedVisitId, scheduledAt: toSaoPauloOffset(scheduledAt), observation,
    }), setFormError, () => { setPlannedVisitId(''); setScheduledAt(''); setObservation(''); onFormClose(); });
  }

  function update(visit: ScheduledVisit, input: UpdateScheduledVisitStatusInput) {
    void run(() => scheduledVisitsApi.updateStatus(request, studyId, visit.id, input), setActionError);
  }

  const planned = state.status === 'ready' ? state.planned : [];
  return <section className="participant-schedule" aria-labelledby="participant-schedule-title">
    <h3 id="participant-schedule-title">Visitas agendadas de {participant.name}</h3>
    {!canSchedule && <p role="status" className="coord-help-copy">{participant.status !== 'Ativo' ? 'Somente participantes ativos podem ter visitas agendadas.' : 'Estudo encerrado: agendamentos e atualizações estão indisponíveis.'}</p>}
    {formOpen && canSchedule && <form className="coord-form" aria-label="Agendar visita do participante" aria-busy={busy} onSubmit={submit}>
      <label className="study-field coord-field"><span>Visita prevista</span>
        <select required value={plannedVisitId} onChange={(event) => setPlannedVisitId(event.target.value)}>
          <option value="">{state.status === 'loading' ? 'Carregando visitas…' : planned.length === 0 ? 'Nenhuma visita prevista no estudo' : 'Selecione a visita'}</option>
          {planned.map((visit) => <option key={visit.id} value={visit.id}>{visit.order}. {visit.name}</option>)}
        </select></label>
      <label className="study-field coord-field"><span>Data e horário</span>
        <input type="datetime-local" required value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} /></label>
      <label className="study-field coord-field coord-field-wide"><span>Observação</span>
        <textarea maxLength={2000} rows={2} value={observation} onChange={(event) => setObservation(event.target.value)} /></label>
      {formError && <p role="alert" className="form-error">{formError}</p>}
      <div className="modal-actions coord-modal-actions">
        <button type="button" className="button button-outline" disabled={busy} onClick={() => { setFormError(''); onFormClose(); }}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={busy}>{busy ? 'Agendando…' : 'Confirmar agendamento'}</button>
      </div>
    </form>}
    {actionError && <p role="alert" className="form-error">{actionError}</p>}
    {state.status === 'loading' && <p role="status" aria-busy="true" className="coord-help-copy">Consultando visitas…</p>}
    {state.status === 'error' && <div role="alert" className="form-error"><p>{state.message}</p>
      <button type="button" className="button button-outline" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></div>}
    {state.status === 'ready' && (state.visits.length === 0
      ? <p role="status" className="coord-help-copy">Nenhuma visita agendada para este participante.</p>
      : <div className="table-scroll coord-table-scroll"><table className="users-table coord-table" aria-label="Visitas agendadas do participante">
        <thead><tr><th>Visita</th><th>Data / horário</th><th>Situação</th><th>Observação</th><th className="coord-th-actions">Ações</th></tr></thead>
        <tbody>{state.visits.map((visit) => <tr key={visit.id}>
          <td>{visit.plannedVisitName}</td><td>{formatDateTime(visit.scheduledAt)}</td><td>{visit.status}</td><td>{visit.observation ?? '—'}</td>
          <td>{visit.status === 'Agendada' && canSchedule && <div className="coord-row-actions">
            <button type="button" className="coord-text-action" disabled={busy} onClick={() => update(visit, { status: 'Realizada', realizedAt: new Date(Date.now() - 60_000).toISOString() })}>Concluir</button>
            <button type="button" className="coord-text-action" disabled={busy} onClick={() => update(visit, { status: 'Ausente' })}>Ausente</button>
            <button type="button" className="coord-text-action" disabled={busy} onClick={() => update(visit, { status: 'Cancelada' })}>Cancelar</button>
          </div>}</td>
        </tr>)}</tbody></table></div>)}
  </section>;
}
