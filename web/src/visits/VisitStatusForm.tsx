import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import {
  FINAL_VISIT_STATUSES, formatScheduledAt, isUpdatedVisit, localDateTimeToIso, ScheduledVisitsApiError,
  STATUS_UPDATE_INVALID_RESPONSE, STATUS_UPDATE_UNEXPECTED_ERROR,
  type FinalVisitStatus, type ScheduledVisit, type ScheduledVisitStatus, type StatusField, type UpdateVisitStatusInput,
} from './scheduledVisitsApi';

const OBSERVATION_MAX = 2000;

const STATUS_HELP: Record<FinalVisitStatus, string> = {
  Realizada: 'O participante compareceu. Informe quando a visita foi realizada.',
  Ausente: 'O participante não compareceu à visita agendada.',
  Cancelada: 'A visita não será realizada. Para remarcar, crie um novo agendamento.',
};

const ids: Record<StatusField, string> = {
  status: 'visit-status-option',
  realizedAt: 'visit-status-realized-at',
  observation: 'visit-status-observation',
};
const errorId = (field: StatusField) => `${ids[field]}-error`;

export interface VisitStatusFormProps {
  visit: ScheduledVisit;
  /** E04 — deve resolver somente com a visita atualizada pela API. */
  onUpdate: (visit: ScheduledVisit, input: UpdateVisitStatusInput, signal: AbortSignal) => Promise<ScheduledVisit>;
  onUpdated: (visit: ScheduledVisit) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  /** Chamado quando a API informa que a situação já mudou, para a agenda ser recarregada. */
  onStale?: () => void;
  renderStatus?: (status: ScheduledVisitStatus) => ReactNode;
  /** Relógio injetável para os testes. */
  now?: () => Date;
}

/** Valor de `datetime-local` no horário do navegador, sem segundos. */
function toLocalInput(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function VisitStatusForm({ visit, onUpdate, onUpdated, onCancel, onBusyChange, onStale, renderStatus = (status) => status, now = () => new Date() }: VisitStatusFormProps) {
  const [status, setStatus] = useState<FinalVisitStatus | ''>('');
  // A realização costuma ser registrada logo depois da visita: o horário agendado é a sugestão inicial, se já passou.
  const [realizedAt, setRealizedAt] = useState(() => {
    const scheduled = new Date(visit.scheduledAt);
    return scheduled.getTime() <= now().getTime() ? toLocalInput(scheduled) : '';
  });
  const [observation, setObservation] = useState(visit.observation ?? '');
  const [errors, setErrors] = useState<Partial<Record<StatusField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  const editable = visit.status === 'Agendada';

  function validate(): Partial<Record<StatusField, string>> {
    const next: Partial<Record<StatusField, string>> = {};
    if (!status) next.status = 'Selecione a nova situação da visita.';
    if (status === 'Realizada') {
      const instant = localDateTimeToIso(realizedAt);
      if (!realizedAt) next.realizedAt = 'Informe a data e o horário da realização.';
      else if (!instant) next.realizedAt = 'Informe uma data e um horário válidos.';
      else if (new Date(instant).getTime() > now().getTime()) next.realizedAt = 'A data de realização não pode ser futura.';
    }
    if (observation.trim().length > OBSERVATION_MAX) next.observation = `A observação deve ter até ${OBSERVATION_MAX} caracteres.`;
    return next;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !editable) return;
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length || !status) {
      setFormError(null);
      const first = (['status', 'realizedAt', 'observation'] as const).find((field) => fieldErrors[field]);
      if (first) window.setTimeout(() => formRef.current?.querySelector<HTMLElement>(`#${ids[first]}`)?.focus());
      return;
    }
    const trimmed = observation.trim();
    const input: UpdateVisitStatusInput = {
      status,
      ...(status === 'Realizada' ? { realizedAt: localDateTimeToIso(realizedAt)! } : {}),
      // Observação inalterada é omitida para não sobrescrever o valor atual.
      ...(trimmed !== (visit.observation ?? '').trim() ? { observation: trimmed || null } : {}),
    };
    const signal = lifecycle.current!.signal;
    submitting.current = true;
    setSaving(true);
    setFormError(null);
    onBusyChange?.(true);
    let updated: ScheduledVisit | undefined;
    try {
      const response = await onUpdate(visit, input, signal);
      if (signal.aborted) return;
      if (!isUpdatedVisit(response, visit, status)) throw new ScheduledVisitsApiError(STATUS_UPDATE_INVALID_RESPONSE);
      updated = response;
    } catch (reason: unknown) {
      if (signal.aborted) return;
      const error = reason instanceof ScheduledVisitsApiError ? reason : new ScheduledVisitsApiError(STATUS_UPDATE_UNEXPECTED_ERROR);
      setFormError(error.message);
      setErrors(error.fieldErrors);
      if (error.code === 'VISIT_STATUS_FINAL' || error.status === 404) onStale?.();
    } finally {
      submitting.current = false;
      if (!signal.aborted) {
        setSaving(false);
        onBusyChange?.(false);
      }
    }
    // A tela só reflete a nova situação depois da confirmação da API.
    if (updated) onUpdated(updated);
  }

  const describedBy = (field: StatusField, ...extra: (string | false | undefined)[]) =>
    [...extra, errors[field] && errorId(field)].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: StatusField) => errors[field]
    ? <small id={errorId(field)} className="study-field-error">{errors[field]}</small> : null;

  return <form ref={formRef} className="coord-form visit-status-form" aria-label="Situação da visita" aria-busy={saving} noValidate onSubmit={submit}>
    <div className="coord-detail-list coord-field-wide">
      <div><span>Participante</span><strong>{visit.participantName}</strong></div>
      <div><span>Visita prevista</span><strong>{`${visit.plannedVisitOrder}. ${visit.plannedVisitName}`}</strong></div>
      <div><span>Data agendada</span><strong><time dateTime={visit.scheduledAt}>{formatScheduledAt(visit.scheduledAt)}</time></strong></div>
      <div><span>Situação atual</span>{renderStatus(visit.status)}</div>
      {visit.realizedAt && <div><span>Realizada em</span><strong><time dateTime={visit.realizedAt}>{formatScheduledAt(visit.realizedAt)}</time></strong></div>}
      {!editable && <div><span>Observação</span><strong>{visit.observation || '—'}</strong></div>}
    </div>

    {!editable ? <p className="coord-help-copy coord-field-wide" role="status">
      A situação “{visit.status}” é final e não pode ser alterada. Para remarcar, crie um novo agendamento.
    </p> : <>
      <fieldset className="visit-status-options coord-field-wide" aria-invalid={Boolean(errors.status)} aria-describedby={describedBy('status')} disabled={saving}>
        <legend>Nova situação</legend>
        {FINAL_VISIT_STATUSES.map((option, index) => <label key={option} className="visit-status-option">
          <input type="radio" name="visit-status" value={option} id={index === 0 ? ids.status : undefined} checked={status === option}
            onChange={() => { setStatus(option); setErrors(({ status: _status, realizedAt: _realizedAt, ...rest }) => rest); }} />
          <span><strong>{option}</strong><small>{STATUS_HELP[option]}</small></span>
        </label>)}
        {fieldError('status')}
      </fieldset>

      {status === 'Realizada' && <div className="study-field coord-field coord-field-wide">
        <label htmlFor={ids.realizedAt}>Data e horário da realização</label>
        <input id={ids.realizedAt} type="datetime-local" value={realizedAt} disabled={saving} max={toLocalInput(now())}
          aria-invalid={Boolean(errors.realizedAt)} aria-describedby={describedBy('realizedAt', 'visit-status-realized-hint')}
          onChange={(event) => { setRealizedAt(event.target.value); setErrors(({ realizedAt: _realizedAt, ...rest }) => rest); }} />
        <small id="visit-status-realized-hint" className="study-field-hint">Não pode ser futura nem anterior à inclusão do participante.</small>
        {fieldError('realizedAt')}
      </div>}

      <div className="study-field coord-field coord-field-wide">
        <label htmlFor={ids.observation}>Observação (opcional)</label>
        <textarea id={ids.observation} rows={3} maxLength={OBSERVATION_MAX} value={observation} disabled={saving}
          aria-invalid={Boolean(errors.observation)} aria-describedby={describedBy('observation')}
          onChange={(event) => { setObservation(event.target.value); setErrors(({ observation: _observation, ...rest }) => rest); }} />
        {fieldError('observation')}
      </div>

      {status && <p className="coord-help-copy coord-field-wide">A situação “{status}” é final: depois de confirmada, não poderá ser alterada.</p>}
    </>}

    {saving && <p className="coord-help-copy coord-field-wide" role="status">Atualizando situação…</p>}
    {formError && <div role="alert" className="candidate-inclusion-error coord-field-wide">
      <TriangleAlert size={18} aria-hidden="true" />
      <div><h3>Não foi possível atualizar a situação</h3><p>{formError}</p></div>
    </div>}

    <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-outline coord-secondary-button" disabled={saving} onClick={onCancel}>{editable ? 'Cancelar' : 'Fechar'}</button>
      {editable && <button type="submit" className="button button-primary coord-primary-button" disabled={saving}><Check size={13} aria-hidden="true" /> Confirmar situação</button>}
    </div>
  </form>;
}
