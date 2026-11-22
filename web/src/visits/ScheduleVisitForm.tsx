import { useEffect, useRef, useState, type FormEvent } from 'react';
import { CalendarDays, TriangleAlert } from 'lucide-react';
import type { CandidateStudiesState } from '../candidates/CandidateForm';
import { VisitsApiError, type PlannedVisit } from '../studies/visitsApi';
import {
  isScheduledVisit, localDateTimeToIso, saoPauloDay, ScheduledVisitsApiError,
  SCHEDULE_INVALID_RESPONSE, SCHEDULE_UNEXPECTED_ERROR,
  type CreateScheduledVisitInput, type IncludedParticipant, type ScheduleField, type ScheduledVisit,
} from './scheduledVisitsApi';

const OBSERVATION_MAX = 2000;
const STUDY_DATA_ERROR = 'Não foi possível carregar os dados do estudo. Tente novamente.';

type FieldName = 'studyId' | ScheduleField;
type FieldErrors = Partial<Record<FieldName, string>>;

interface Values {
  studyId: string;
  participationId: string;
  plannedVisitId: string;
  scheduledAt: string;
  observation: string;
}

type StudyData =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; participants: IncludedParticipant[]; plannedVisits: PlannedVisit[] };

/** `loadParticipants` e `loadPlannedVisits` devem ser estáveis (useCallback): mudar a referência recarrega os dados. */
export interface ScheduleVisitFormProps {
  studies: CandidateStudiesState;
  /** E01 — participações ativas do estudo. */
  loadParticipants: (studyId: string, signal: AbortSignal) => Promise<readonly IncludedParticipant[]>;
  /** X02 — visitas previstas do estudo. */
  loadPlannedVisits: (studyId: string, signal: AbortSignal) => Promise<readonly PlannedVisit[]>;
  /** E02 — deve resolver somente com o agendamento persistido pela API. */
  onSchedule: (studyId: string, input: CreateScheduledVisitInput, signal: AbortSignal) => Promise<ScheduledVisit>;
  onScheduled: (visit: ScheduledVisit) => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  /** Texto exibido abaixo do seletor de estudo (ex.: limitação de estudos disponíveis). */
  studyHint?: string;
}

const ids: Record<FieldName, string> = {
  studyId: 'schedule-study',
  participationId: 'schedule-participant',
  plannedVisitId: 'schedule-planned-visit',
  scheduledAt: 'schedule-date',
  observation: 'schedule-observation',
};
const FIELD_ORDER: readonly FieldName[] = ['studyId', 'participationId', 'plannedVisitId', 'scheduledAt', 'observation'];
const errorId = (field: FieldName) => `${ids[field]}-error`;
const formatDay = (day: string) => day.split('-').reverse().join('/');

function validate(values: Values, data: StudyData): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.studyId) errors.studyId = 'Selecione o estudo.';
  const participants = data.status === 'ready' ? data.participants : [];
  const participant = participants.find((item) => item.participationId === values.participationId);
  if (!values.participationId || (data.status === 'ready' && !participant)) errors.participationId = 'Selecione um participante incluído.';
  const plannedVisits = data.status === 'ready' ? data.plannedVisits : [];
  if (!values.plannedVisitId || (data.status === 'ready' && !plannedVisits.some((visit) => visit.id === values.plannedVisitId))) {
    errors.plannedVisitId = 'Selecione a visita prevista.';
  }
  if (!values.scheduledAt) errors.scheduledAt = 'Informe a data e o horário da visita.';
  else {
    const instant = localDateTimeToIso(values.scheduledAt);
    if (!instant) errors.scheduledAt = 'Informe uma data e um horário válidos.';
    else if (participant && saoPauloDay(instant) < participant.includedAt) {
      errors.scheduledAt = `A data não pode ser anterior à inclusão do participante (${formatDay(participant.includedAt)}).`;
    }
  }
  if (values.observation.trim().length > OBSERVATION_MAX) errors.observation = `A observação deve ter até ${OBSERVATION_MAX} caracteres.`;
  return errors;
}

export function ScheduleVisitForm({ studies, loadParticipants, loadPlannedVisits, onSchedule, onScheduled, onCancel, onBusyChange, studyHint }: ScheduleVisitFormProps) {
  const [values, setValues] = useState<Values>({ studyId: '', participationId: '', plannedVisitId: '', scheduledAt: '', observation: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [data, setData] = useState<StudyData>({ status: 'idle' });
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  // Participantes e visitas previstas pertencem ao estudo: recarregam a cada troca.
  useEffect(() => {
    if (!values.studyId) { setData({ status: 'idle' }); return; }
    const controller = new AbortController();
    setData({ status: 'loading' });
    Promise.all([loadParticipants(values.studyId, controller.signal), loadPlannedVisits(values.studyId, controller.signal)])
      .then(([participants, plannedVisits]) => {
        if (controller.signal.aborted) return;
        setData({
          status: 'ready',
          participants: [...participants],
          plannedVisits: [...plannedVisits].sort((a, b) => a.order - b.order),
        });
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        const message = reason instanceof ScheduledVisitsApiError || reason instanceof VisitsApiError ? reason.message : STUDY_DATA_ERROR;
        setData({ status: 'error', message });
      });
    return () => controller.abort();
  }, [values.studyId, reloadKey, loadParticipants, loadPlannedVisits]);

  function update(field: FieldName, value: string) {
    setValues((current) => field === 'studyId'
      // Os ids de participação e de visita prevista não valem em outro estudo.
      ? { ...current, studyId: value, participationId: '', plannedVisitId: '' }
      : { ...current, [field]: value });
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === 'studyId') { delete next.participationId; delete next.plannedVisitId; }
      if (field === 'participationId') delete next.scheduledAt;
      return next;
    });
  }

  function focusFirstInvalid(fieldErrors: FieldErrors) {
    const first = FIELD_ORDER.find((field) => fieldErrors[field]);
    if (first) window.setTimeout(() => formRef.current?.querySelector<HTMLElement>(`#${ids[first]}`)?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const fieldErrors = validate(values, data);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setFormError(null);
      focusFirstInvalid(fieldErrors);
      return;
    }
    const input: CreateScheduledVisitInput = {
      participationId: values.participationId,
      plannedVisitId: values.plannedVisitId,
      scheduledAt: localDateTimeToIso(values.scheduledAt)!,
      observation: values.observation.trim() || null,
    };
    const studyId = values.studyId;
    const signal = lifecycle.current!.signal;
    submitting.current = true;
    setSaving(true);
    setFormError(null);
    onBusyChange?.(true);
    let scheduled: ScheduledVisit | undefined;
    try {
      const response = await onSchedule(studyId, input, signal);
      if (signal.aborted) return;
      if (!isScheduledVisit(response, studyId, input)) throw new ScheduledVisitsApiError(SCHEDULE_INVALID_RESPONSE);
      scheduled = response;
    } catch (reason: unknown) {
      if (signal.aborted) return;
      // Os valores preenchidos são mantidos para que o usuário corrija e envie de novo.
      const error = reason instanceof ScheduledVisitsApiError ? reason : new ScheduledVisitsApiError(SCHEDULE_UNEXPECTED_ERROR);
      setFormError(error.message);
      setErrors(error.fieldErrors);
    } finally {
      submitting.current = false;
      if (!signal.aborted) {
        setSaving(false);
        onBusyChange?.(false);
      }
    }
    if (scheduled) onScheduled(scheduled);
  }

  const describedBy = (field: FieldName, ...extra: (string | false | null | undefined)[]) =>
    [...extra, errors[field] && errorId(field)].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: FieldName) => errors[field]
    ? <small id={errorId(field)} className="study-field-error">{errors[field]}</small> : null;

  const studyOptions = studies.status === 'ready' ? studies.options : [];
  const studyPlaceholder = studies.status === 'loading' ? 'Carregando estudos…'
    : studies.status === 'error' ? 'Falha ao carregar estudos'
      : studies.status === 'unavailable' || studyOptions.length === 0 ? 'Nenhum estudo disponível' : 'Selecione o estudo';
  const studyFeedback = studies.status === 'error' ? 'Não foi possível carregar os estudos. Feche e abra o formulário para tentar novamente.'
    : studies.status === 'unavailable' ? studies.message
      : studies.status === 'ready' && studyOptions.length === 0 ? 'Nenhum estudo disponível para agendamento.' : null;

  const ready = data.status === 'ready' ? data : null;
  const participant = ready?.participants.find((item) => item.participationId === values.participationId);
  const dependentPlaceholder = (empty: string, choose: string) => !values.studyId ? 'Selecione primeiro o estudo'
    : data.status === 'loading' ? 'Carregando…' : data.status === 'error' ? 'Indisponível' : ready && empty ? empty : choose;
  const noParticipants = ready && ready.participants.length === 0 ? 'Nenhum participante ativo' : '';
  const noPlannedVisits = ready && ready.plannedVisits.length === 0 ? 'Nenhuma visita prevista' : '';

  return <form ref={formRef} className="coord-form schedule-visit-form" aria-label="Agendamento de visita" aria-busy={saving} noValidate onSubmit={submit}>
    <div className="study-field coord-field coord-field-wide">
      <label htmlFor={ids.studyId}>Estudo</label>
      <select id={ids.studyId} value={values.studyId} disabled={saving || studyOptions.length === 0} aria-busy={studies.status === 'loading'}
        aria-invalid={Boolean(errors.studyId)} aria-describedby={describedBy('studyId', studyHint && 'schedule-study-hint', studyFeedback && 'schedule-study-feedback')}
        onChange={(event) => update('studyId', event.target.value)}>
        <option value="">{studyPlaceholder}</option>
        {studyOptions.map((study) => <option key={study.id} value={study.id}>{studyOptions.some((other) => other.id !== study.id && other.title === study.title) ? `${study.title} (${study.id})` : study.title}</option>)}
      </select>
      {studyHint && <small id="schedule-study-hint" className="study-field-hint">{studyHint}</small>}
      {studyFeedback && <small id="schedule-study-feedback" className="study-field-hint" role={studies.status === 'error' ? 'alert' : 'status'}>{studyFeedback}</small>}
      {fieldError('studyId')}
    </div>

    {data.status === 'loading' && <p className="coord-help-copy coord-field-wide" role="status">Carregando participantes e visitas previstas…</p>}
    {data.status === 'error' && <div className="form-error form-error-wide" role="alert">
      <p>{data.message}</p>
      <button type="button" className="button button-outline coord-secondary-button" onClick={() => setReloadKey((key) => key + 1)}>Tentar novamente</button>
    </div>}

    <div className="study-field coord-field">
      <label htmlFor={ids.participationId}>Participante</label>
      <select id={ids.participationId} value={values.participationId} disabled={saving || !ready || ready.participants.length === 0}
        aria-invalid={Boolean(errors.participationId)} aria-describedby={describedBy('participationId', noParticipants && 'schedule-participant-empty')}
        onChange={(event) => update('participationId', event.target.value)}>
        <option value="">{dependentPlaceholder(noParticipants, 'Selecione o participante')}</option>
        {ready?.participants.map((item) => <option key={item.participationId} value={item.participationId}>{item.name}</option>)}
      </select>
      {noParticipants && <small id="schedule-participant-empty" className="study-field-hint" role="status">Este estudo não possui participantes ativos para agendamento.</small>}
      {fieldError('participationId')}
    </div>

    <div className="study-field coord-field">
      <label htmlFor={ids.plannedVisitId}>Visita prevista</label>
      <select id={ids.plannedVisitId} value={values.plannedVisitId} disabled={saving || !ready || ready.plannedVisits.length === 0}
        aria-invalid={Boolean(errors.plannedVisitId)} aria-describedby={describedBy('plannedVisitId', noPlannedVisits && 'schedule-planned-empty')}
        onChange={(event) => update('plannedVisitId', event.target.value)}>
        <option value="">{dependentPlaceholder(noPlannedVisits, 'Selecione a visita')}</option>
        {ready?.plannedVisits.map((visit) => <option key={visit.id} value={visit.id}>{`${visit.order}. ${visit.name}`}</option>)}
      </select>
      {noPlannedVisits && <small id="schedule-planned-empty" className="study-field-hint" role="status">Este estudo não possui visitas previstas cadastradas.</small>}
      {fieldError('plannedVisitId')}
    </div>

    <div className="study-field coord-field coord-field-wide">
      <label htmlFor={ids.scheduledAt}>Data e horário</label>
      <input id={ids.scheduledAt} type="datetime-local" value={values.scheduledAt} disabled={saving}
        min={participant ? `${participant.includedAt}T00:00` : undefined}
        aria-invalid={Boolean(errors.scheduledAt)} aria-describedby={describedBy('scheduledAt', participant && 'schedule-date-hint')}
        onChange={(event) => update('scheduledAt', event.target.value)} />
      {participant && <small id="schedule-date-hint" className="study-field-hint">Participante incluído em {formatDay(participant.includedAt)}.</small>}
      {fieldError('scheduledAt')}
    </div>

    <div className="study-field coord-field coord-field-wide">
      <label htmlFor={ids.observation}>Observação (opcional)</label>
      <textarea id={ids.observation} rows={3} maxLength={OBSERVATION_MAX} value={values.observation} disabled={saving}
        aria-invalid={Boolean(errors.observation)} aria-describedby={describedBy('observation')}
        onChange={(event) => update('observation', event.target.value)} placeholder="Ex.: trazer exames anteriores" />
      {fieldError('observation')}
    </div>

    {saving && <p className="coord-help-copy coord-field-wide" role="status">Agendando visita…</p>}
    {formError && <div role="alert" className="candidate-inclusion-error coord-field-wide">
      <TriangleAlert size={18} aria-hidden="true" />
      <div><h3>Não foi possível agendar a visita</h3><p>{formError}</p></div>
    </div>}

    <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-outline coord-secondary-button" disabled={saving} onClick={onCancel}>Cancelar</button>
      <button type="submit" className="button button-primary coord-primary-button" disabled={saving}><CalendarDays size={13} aria-hidden="true" /> Agendar visita</button>
    </div>
  </form>;
}
