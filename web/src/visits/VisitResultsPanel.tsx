import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import {
  formatScheduledAt, isAssessmentResult, RESULT_INVALID_RESPONSE, RESULT_OBSERVATION_MAX, RESULT_UNEXPECTED_ERROR, RESULT_UNIT_MAX,
  RESULTS_LOAD_ERROR, ScheduledVisitsApiError,
  type AssessmentResult, type RegisterResultInput, type ResultField, type ScheduledVisit, type ScheduledVisitResults, type VisitActivityResult,
} from './scheduledVisitsApi';

type ResultsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ScheduledVisitResults };

export interface VisitResultsPanelProps {
  visit: ScheduledVisit;
  /** E05 — atividades previstas da visita com os resultados registrados. */
  loadResults: (visit: ScheduledVisit, signal: AbortSignal) => Promise<ScheduledVisitResults>;
  /** E06 — sem esta operação o painel é somente leitura (ex.: Coordenador, conforme D-04). */
  onRegister?: (visit: ScheduledVisit, input: RegisterResultInput, signal: AbortSignal) => Promise<AssessmentResult>;
  /** Texto exibido quando o painel é somente leitura. */
  readOnlyNotice?: string;
  onBusyChange?: (busy: boolean) => void;
}

type Values = { value: string; unit: string; observation: string };
type FieldErrors = Partial<Record<ResultField, string>>;

function validate(values: Values): FieldErrors {
  const errors: FieldErrors = {};
  if (!values.value.trim()) errors.value = 'Informe o resultado fictício.';
  if (values.unit.trim().length > RESULT_UNIT_MAX) errors.unit = `A unidade deve ter até ${RESULT_UNIT_MAX} caracteres.`;
  if (values.observation.trim().length > RESULT_OBSERVATION_MAX) errors.observation = `A observação deve ter até ${RESULT_OBSERVATION_MAX} caracteres.`;
  return errors;
}

function RegisteredResult({ result }: { result: AssessmentResult }) {
  return <dl className="visit-result-registered">
    <div><dt>Resultado</dt><dd><strong>{result.value}</strong>{result.unit && <span> {result.unit}</span>}</dd></div>
    {result.observation && <div><dt>Observação</dt><dd>{result.observation}</dd></div>}
    <div><dt>Registrado em</dt><dd><time dateTime={result.registeredAt}>{formatScheduledAt(result.registeredAt)}</time></dd></div>
  </dl>;
}

function ActivityResultForm({ scheduledVisitId, activity, onSubmit, onRegistered, onConflict, onBusyChange }: {
  scheduledVisitId: string;
  activity: VisitActivityResult;
  onSubmit: (input: RegisterResultInput, signal: AbortSignal) => Promise<AssessmentResult>;
  onRegistered: (result: AssessmentResult) => void;
  onConflict: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const prefix = useId();
  const [values, setValues] = useState<Values>({ value: '', unit: '', observation: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
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

  const id = (field: keyof Values) => `${prefix}-${field}`;
  const errorId = (field: keyof Values) => `${prefix}-${field}-error`;

  function update(field: keyof Values, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Evita envio duplicado: um clique duplo ou Enter repetido não gera um segundo POST.
    if (submitting.current) return;
    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length) {
      setFormError(null);
      const first = (['value', 'unit', 'observation'] as const).find((field) => fieldErrors[field]);
      if (first) window.setTimeout(() => document.getElementById(id(first))?.focus());
      return;
    }
    const input: RegisterResultInput = {
      activityId: activity.activityId,
      value: values.value.trim(),
      unit: values.unit.trim() || null,
      observation: values.observation.trim() || null,
    };
    const signal = lifecycle.current!.signal;
    submitting.current = true;
    setSaving(true);
    setFormError(null);
    onBusyChange(true);
    let registered: AssessmentResult | undefined;
    try {
      const response = await onSubmit(input, signal);
      if (signal.aborted) return;
      if (!isAssessmentResult(response, scheduledVisitId, activity.activityId)) throw new ScheduledVisitsApiError(RESULT_INVALID_RESPONSE);
      registered = response;
    } catch (reason: unknown) {
      if (signal.aborted) return;
      const error = reason instanceof ScheduledVisitsApiError ? reason : new ScheduledVisitsApiError(RESULT_UNEXPECTED_ERROR);
      // Os dados preenchidos continuam no formulário para correção ou nova tentativa.
      setFormError(error.message);
      setErrors(error.fieldErrors);
      if (error.code === 'RESULT_ALREADY_REGISTERED') onConflict();
    } finally {
      submitting.current = false;
      if (!signal.aborted) {
        setSaving(false);
        onBusyChange(false);
      }
    }
    if (registered) onRegistered(registered);
  }

  const describedBy = (field: keyof Values, ...extra: (string | false)[]) =>
    [...extra, errors[field] && errorId(field)].filter(Boolean).join(' ') || undefined;
  const fieldError = (field: keyof Values) => errors[field] ? <small id={errorId(field)} className="study-field-error">{errors[field]}</small> : null;

  return <form ref={formRef} className="visit-result-form" aria-label={`Resultado de ${activity.name}`} aria-busy={saving} noValidate onSubmit={submit}>
    <div className="study-field coord-field">
      <label htmlFor={id('value')}>Resultado fictício</label>
      <input id={id('value')} value={values.value} disabled={saving} placeholder="Ex.: 120/80"
        aria-invalid={Boolean(errors.value)} aria-describedby={describedBy('value')} onChange={(event) => update('value', event.target.value)} />
      {fieldError('value')}
    </div>
    <div className="study-field coord-field">
      <label htmlFor={id('unit')}>Unidade (opcional)</label>
      <input id={id('unit')} value={values.unit} disabled={saving} maxLength={RESULT_UNIT_MAX} placeholder="Ex.: mmHg"
        aria-invalid={Boolean(errors.unit)} aria-describedby={describedBy('unit')} onChange={(event) => update('unit', event.target.value)} />
      {fieldError('unit')}
    </div>
    <div className="study-field coord-field coord-field-wide">
      <label htmlFor={id('observation')}>Observação (opcional)</label>
      <textarea id={id('observation')} rows={2} value={values.observation} disabled={saving} maxLength={RESULT_OBSERVATION_MAX}
        aria-invalid={Boolean(errors.observation)} aria-describedby={describedBy('observation')} onChange={(event) => update('observation', event.target.value)} />
      {fieldError('observation')}
    </div>
    {saving && <p className="coord-help-copy coord-field-wide" role="status">Registrando resultado…</p>}
    {formError && <div role="alert" className="candidate-inclusion-error coord-field-wide">
      <TriangleAlert size={18} aria-hidden="true" />
      <div><h3>Não foi possível registrar o resultado</h3><p>{formError}</p></div>
    </div>}
    <div className="visit-result-actions coord-field-wide">
      <button type="submit" className="button button-primary coord-primary-button" disabled={saving}>Registrar resultado</button>
    </div>
  </form>;
}

/** Atividades previstas da visita (E05) e registro dos resultados fictícios (E06). */
export function VisitResultsPanel({ visit, loadResults, onRegister, readOnlyNotice, onBusyChange }: VisitResultsPanelProps) {
  const [state, setState] = useState<ResultsState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [success, setSuccess] = useState<string | null>(null);
  const busyCount = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((current) => current.status === 'ready' ? current : { status: 'loading' });
    loadResults(visit, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ status: 'ready', data }); })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: reason instanceof ScheduledVisitsApiError ? reason.message : RESULTS_LOAD_ERROR });
      });
    return () => controller.abort();
  }, [visit, loadResults, attempt]);

  const reload = useCallback(() => setAttempt((value) => value + 1), []);
  const trackBusy = useCallback((busy: boolean) => {
    busyCount.current = Math.max(0, busyCount.current + (busy ? 1 : -1));
    onBusyChange?.(busyCount.current > 0);
  }, [onBusyChange]);

  if (state.status === 'loading') return <p className="coord-help-copy" role="status">Carregando atividades da visita…</p>;
  if (state.status === 'error') return <div className="form-error visit-results-error" role="alert">
    <p>{state.message}</p>
    <button type="button" className="button button-outline coord-secondary-button" onClick={reload}>Tentar novamente</button>
  </div>;

  const { data } = state;
  const canRegister = Boolean(onRegister) && data.status === 'Realizada';
  const pending = data.activities.filter((activity) => !activity.result).length;

  return <section className="visit-results-panel" aria-label="Atividades e resultados">
    <header className="visit-results-heading">
      <h3>Atividades previstas</h3>
      {data.activities.length > 0 && <span>{data.activities.length - pending} de {data.activities.length} com resultado</span>}
    </header>
    {data.status !== 'Realizada' && <p className="coord-help-copy" role="status">Os resultados só podem ser registrados depois que a visita for marcada como Realizada.</p>}
    {data.status === 'Realizada' && !onRegister && readOnlyNotice && <p className="coord-help-copy">{readOnlyNotice}</p>}
    {success && <div className="notice" role="status"><span>{success}</span></div>}
    {data.activities.length === 0 ? <p className="coord-help-copy" role="status">Esta visita prevista não possui atividades cadastradas.</p>
      : <ol className="visit-results-list">
        {data.activities.map((activity) => <li key={activity.activityId} className="visit-result-item">
          <div className="visit-result-title">
            <strong>{activity.name}</strong><span className="visit-result-type">{activity.type}</span>
            {activity.result ? <span className="visit-result-badge"><CheckCircle2 size={13} aria-hidden="true" /> Registrado</span>
              : <span className="visit-result-badge visit-result-badge-pending">Sem resultado</span>}
          </div>
          {activity.description && <p className="visit-result-description">{activity.description}</p>}
          {activity.result ? <RegisteredResult result={activity.result} />
            : canRegister && onRegister && <ActivityResultForm scheduledVisitId={visit.id} activity={activity} onBusyChange={trackBusy} onConflict={reload}
              onSubmit={(input, signal) => onRegister(visit, input, signal)}
              onRegistered={(result) => {
                // A atividade só aparece como registrada depois da resposta da API.
                setState((current) => current.status === 'ready' ? { status: 'ready', data: { ...current.data, activities: current.data.activities.map((item) => item.activityId === result.activityId ? { ...item, result } : item) } } : current);
                setSuccess(`Resultado registrado com sucesso para “${activity.name}”.`);
              }} />}
        </li>)}
      </ol>}
  </section>;
}
