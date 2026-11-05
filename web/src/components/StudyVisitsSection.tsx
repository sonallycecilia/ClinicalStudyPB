import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { CalendarClock, X } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ORDER_CONFLICT, UNEXPECTED_VISITS_LOAD_ERROR, VisitsApiError, listVisitsWithActivities, savePlannedVisit } from '../studies/visitsApi';
import type { PlannedVisitInput, PlannedVisitWithActivities, VisitActivityInput } from '../studies/visitsApi';

// Mesmos limites do CreatePlannedVisitRequestDto e do CreateVisitActivityRequestDto no backend.
const MAX_NAME_LENGTH = 150;
const MAX_TYPE_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 2000;
// ordem e intervalo_dias são colunas INTEGER no PostgreSQL; acima disso o banco recusa o valor.
const MAX_INTEGER = 2147483647;
const REQUIRED = 'Este campo é obrigatório.';

interface VisitForm {
  name: string;
  order: string;
  intervalDays: string;
  description: string;
}

/** Atividade preenchida no formulário; `key` existe somente na interface e não é enviada à API. */
interface ActivityDraft extends VisitActivityInput {
  key: string;
  description: string;
}

type FieldErrors = Record<string, string>;
type ActivityField = 'name' | 'type' | 'description';

// Textos são comparados sem os espaços das pontas, como o @Transform do backend; só espaços conta como vazio.
function textError(value: string, maxLength: number, required: boolean): string {
  const { length } = value.trim();
  if (length === 0) return required ? REQUIRED : '';
  return length > maxLength ? `Informe no máximo ${maxLength} caracteres.` : '';
}

// Equivale a @IsInt() + @Min(min): recusa decimais, negativos abaixo do mínimo e textos.
function integerError(value: string, min: number, required: boolean): string {
  const text = value.trim();
  if (text === '') return required ? REQUIRED : '';
  if (!/^-?\d+$/.test(text) || Number(text) < min) return `Informe um número inteiro maior ou igual a ${min}.`;
  return Number(text) > MAX_INTEGER ? `Informe um número de no máximo ${MAX_INTEGER}.` : '';
}

function visitFieldError(field: keyof VisitForm, form: VisitForm, usedOrders: number[]): string {
  switch (field) {
    case 'name': return textError(form.name, MAX_NAME_LENGTH, true);
    case 'order': return integerError(form.order, 1, true)
      || (usedOrders.includes(Number(form.order)) ? ORDER_CONFLICT : '');
    case 'intervalDays': return integerError(form.intervalDays, 0, false);
    case 'description': return textError(form.description, MAX_DESCRIPTION_LENGTH, false);
  }
}

function activityFieldError(field: ActivityField, activity: ActivityDraft): string {
  if (field === 'description') return textError(activity.description, MAX_DESCRIPTION_LENGTH, false);
  return field === 'name' ? textError(activity.name, MAX_NAME_LENGTH, true) : textError(activity.type, MAX_TYPE_LENGTH, true);
}

const VISIT_FIELDS: (keyof VisitForm)[] = ['name', 'order', 'intervalDays', 'description'];
const ACTIVITY_FIELDS: ActivityField[] = ['name', 'type', 'description'];
const activityErrorKey = (key: string, field: string) => `${key}-${field}`;

function withoutEmpty(entries: [string, string][]): FieldErrors {
  return Object.fromEntries(entries.filter(([, message]) => message));
}

function validateVisit(form: VisitForm, usedOrders: number[]): FieldErrors {
  return withoutEmpty(VISIT_FIELDS.map((field) => [field, visitFieldError(field, form, usedOrders)]));
}

function validateActivities(activities: ActivityDraft[]): FieldErrors {
  return withoutEmpty(activities.flatMap((activity) =>
    ACTIVITY_FIELDS.map((field): [string, string] => [activityErrorKey(activity.key, field), activityFieldError(field, activity)])));
}

function toVisitInput(form: VisitForm): PlannedVisitInput {
  return {
    name: form.name.trim(),
    order: Number(form.order.trim()),
    intervalDays: form.intervalDays.trim() === '' ? null : Number(form.intervalDays.trim()),
    description: form.description.trim() || null,
  };
}

function toActivityInput(activity: ActivityDraft): ActivityDraft {
  return { ...activity, name: activity.name.trim(), type: activity.type.trim(), description: activity.description.trim() };
}

function intervalLabel(intervalDays: number | null): string {
  if (intervalDays === null) return 'Intervalo não informado';
  if (intervalDays === 0) return 'No mesmo dia da visita anterior';
  return `${intervalDays} ${intervalDays === 1 ? 'dia' : 'dias'} após a visita anterior`;
}

function activitiesLabel(count: number): string {
  return `${count} ${count === 1 ? 'atividade' : 'atividades'}`;
}

function VisitField({ label, required = false, error, hint, children }: { label: string; required?: boolean; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="study-field">
      <span>{label}{required && <> <b>*</b></>}</span>
      {children}
      {hint && <small className="study-field-hint">{hint}</small>}
      {error && <small role="alert" className="study-field-error">{error}</small>}
    </label>
  );
}

interface VisitFormDialogProps {
  studyId: string;
  usedOrders: number[];
  knownTypes: string[];
  /** `saved` indica se algo foi gravado, para atualizar a listagem. */
  onClose: (saved: boolean) => void;
  onSaved: () => void;
}

function VisitFormDialog({ studyId, usedOrders, knownTypes, onClose, onSaved }: VisitFormDialogProps) {
  const { request } = useAuth();
  const nextKey = useRef(1);
  const [form, setForm] = useState<VisitForm>({ name: '', order: String(Math.max(0, ...usedOrders) + 1), intervalDays: '', description: '' });
  const [activities, setActivities] = useState<ActivityDraft[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<VisitsApiError | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Depois de gravada, a visita não é enviada de novo: uma nova tentativa envia só as atividades pendentes.
  const [createdVisitId, setCreatedVisitId] = useState<string | null>(null);
  const [savedActivitiesCount, setSavedActivitiesCount] = useState(0);
  // Atividades criadas neste formulário; usadas para conferir na API o que uma falha incerta pode ter gravado.
  const [createdActivityIds, setCreatedActivityIds] = useState<string[]>([]);
  // Bloqueia um segundo envio antes mesmo de o botão ser desativado na próxima renderização.
  const savingRef = useRef(false);
  const visitLocked = isSaving || createdVisitId !== null;

  // Depois que um campo foi apontado como inválido, a mensagem acompanha o que é digitado.
  function revalidate(key: string, message: string) {
    setErrors((current) => {
      if (!(key in current)) return current;
      const rest = Object.fromEntries(Object.entries(current).filter(([field]) => field !== key));
      return message ? { ...rest, [key]: message } : rest;
    });
  }

  function updateForm<K extends keyof VisitForm>(key: K, value: VisitForm[K]) {
    const next = { ...form, [key]: value };
    setForm(next);
    revalidate(key, visitFieldError(key, next, usedOrders));
  }

  function addActivity() {
    setActivities((current) => [...current, { key: `activity-${nextKey.current++}`, name: '', type: '', description: '' }]);
  }

  function updateActivity(activity: ActivityDraft, field: ActivityField, value: string) {
    const next = { ...activity, [field]: value };
    setActivities((current) => current.map((item) => item.key === activity.key ? next : item));
    revalidate(activityErrorKey(activity.key, field), activityFieldError(field, next));
  }

  function removeActivity(key: string) {
    setActivities((current) => current.filter((item) => item.key !== key));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith(`${key}-`))));
  }

  /** Converte os campos recusados pela API (nomes do contrato) nas chaves de erro do formulário. */
  function serverFieldErrors(error: VisitsApiError, failedActivityKey: string | undefined): FieldErrors {
    const entries = Object.entries(error.fieldErrors);
    if (failedActivityKey) return Object.fromEntries(entries.map(([field, message]) => [activityErrorKey(failedActivityKey, field), message]));
    return Object.fromEntries(entries.filter(([field]) => (VISIT_FIELDS as string[]).includes(field)));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    const validation = { ...(createdVisitId ? {} : validateVisit(form, usedOrders)), ...validateActivities(activities) };
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    savingRef.current = true;
    setIsSaving(true);
    setSubmitError(null);
    const pending = activities.map(toActivityInput);
    // Depois de falha de conexão ou 5xx, o backend pode ter gravado antes de a resposta se perder.
    const knownIds = submitError?.retryable ? createdActivityIds : undefined;
    const result = await savePlannedVisit(request, studyId, toVisitInput(form), pending, createdVisitId, knownIds);
    savingRef.current = false;
    setIsSaving(false);
    if (!result.error) return onSaved();

    // Mantém no formulário somente o que ainda não foi gravado, preservando o texto digitado.
    // Com a visita gravada, a falha é da primeira atividade pendente, pois elas são enviadas em ordem.
    const pendingKeys = new Set(result.pendingActivities.map((item) => item.key));
    setSavedActivitiesCount((count) => count + pending.length - result.pendingActivities.length);
    setActivities((current) => current.filter((item) => pendingKeys.has(item.key)));
    setCreatedVisitId(result.visitId);
    setCreatedActivityIds((current) => [...current, ...result.createdActivityIds]);
    setSubmitError(result.error);
    setErrors(serverFieldErrors(result.error, result.visitId ? result.pendingActivities[0]?.key : undefined));
  }

  function close() {
    // Uma falha incerta também pode ter gravado a visita: a listagem é consultada de novo.
    if (!isSaving) onClose(createdVisitId !== null || Boolean(submitError?.retryable));
  }

  const partialMessage = createdVisitId && `A visita foi salva${savedActivitiesCount > 0 ? ` com ${activitiesLabel(savedActivitiesCount)}` : ''}, mas ${activities.length === 1 ? '1 atividade não foi salva' : `${activities.length} atividades não foram salvas`}.`;

  return (
    <div className="study-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="study-form-panel study-visit-form-panel" role="dialog" aria-modal="true" aria-labelledby="study-visit-form-title">
        <div className="study-form-heading">
          <h2 id="study-visit-form-title">Cadastrar visita prevista</h2>
        </div>
        <form className="study-form" noValidate onSubmit={(event) => void submit(event)}>
          <div className="study-visit-fields">
            <VisitField label="Nome da visita" required error={errors.name} hint={`Máximo de ${MAX_NAME_LENGTH} caracteres.`}>
              <input value={form.name} onChange={(event) => updateForm('name', event.target.value)} placeholder="Ex.: Consulta inicial" aria-invalid={Boolean(errors.name)} disabled={visitLocked} required />
            </VisitField>
            <VisitField label="Ordem" required error={errors.order} hint="Posição da visita no estudo.">
              <input type="text" inputMode="numeric" value={form.order} onChange={(event) => updateForm('order', event.target.value)} aria-invalid={Boolean(errors.order)} disabled={visitLocked} required />
            </VisitField>
            <VisitField label="Intervalo (dias)" error={errors.intervalDays} hint="Opcional. Dias após a visita anterior.">
              <input type="text" inputMode="numeric" value={form.intervalDays} onChange={(event) => updateForm('intervalDays', event.target.value)} placeholder="Ex.: 14" aria-invalid={Boolean(errors.intervalDays)} disabled={visitLocked} />
            </VisitField>
          </div>
          <VisitField label="Descrição da visita" error={errors.description} hint={`Opcional. Máximo de ${MAX_DESCRIPTION_LENGTH} caracteres.`}>
            <textarea className="study-visit-textarea" value={form.description} onChange={(event) => updateForm('description', event.target.value)} placeholder="Ex.: Realizada após a inclusão do participante." aria-invalid={Boolean(errors.description)} disabled={visitLocked} />
          </VisitField>

          <section className="study-visit-activities" aria-labelledby="study-visit-activities-title">
            <div className="study-criteria-group-heading">
              <h3 id="study-visit-activities-title">Atividades da visita</h3>
              <span className="study-status status-planejamento">{activitiesLabel(activities.length)}</span>
            </div>
            {activities.length === 0 && <div className="study-empty-state">Nenhuma atividade adicionada. As atividades são opcionais.</div>}
            {activities.map((activity, index) => <fieldset className="study-visit-activity-fieldset" key={activity.key} aria-label={`Atividade ${index + 1}`}>
              <div className="study-visit-activity-heading">
                <h4>Atividade {index + 1}</h4>
                <button type="button" className="text-action delete-action" disabled={isSaving} aria-label={`Remover atividade ${index + 1}`} onClick={() => removeActivity(activity.key)}>Remover</button>
              </div>
              <div className="study-visit-activity-fields">
                <VisitField label="Nome da atividade" required error={errors[`${activity.key}-name`]}>
                  <input value={activity.name} onChange={(event) => updateActivity(activity, 'name', event.target.value)} placeholder="Ex.: Coleta de sinais vitais" aria-invalid={Boolean(errors[`${activity.key}-name`])} disabled={isSaving} required />
                </VisitField>
                <VisitField label="Tipo" required error={errors[`${activity.key}-type`]} hint={`Máximo de ${MAX_TYPE_LENGTH} caracteres.`}>
                  <input list="study-visit-activity-types" value={activity.type} onChange={(event) => updateActivity(activity, 'type', event.target.value)} placeholder="Ex.: Exame" aria-invalid={Boolean(errors[`${activity.key}-type`])} disabled={isSaving} required />
                </VisitField>
              </div>
              <VisitField label="Descrição da atividade" error={errors[`${activity.key}-description`]} hint={`Opcional. Máximo de ${MAX_DESCRIPTION_LENGTH} caracteres.`}>
                <textarea className="study-visit-textarea" value={activity.description} onChange={(event) => updateActivity(activity, 'description', event.target.value)} placeholder="Ex.: Aferir pressão arterial e frequência cardíaca." aria-invalid={Boolean(errors[`${activity.key}-description`])} disabled={isSaving} />
              </VisitField>
            </fieldset>)}
            {/* Sugere tipos já usados no estudo; a API aceita qualquer texto. */}
            <datalist id="study-visit-activity-types">{knownTypes.map((type) => <option key={type} value={type} />)}</datalist>
            <div className="study-form-actions study-visit-add-activity">
              <button className="button button-outline" type="button" disabled={isSaving} onClick={addActivity}>+ Adicionar atividade</button>
            </div>
          </section>

          {submitError && <div className="study-criteria-load-error">
            <p role="alert" className="form-error">{partialMessage ? `${partialMessage} ${submitError.message}` : submitError.message}</p>
          </div>}
          <div className="study-form-actions">
            <button className="button button-outline" type="button" onClick={close} disabled={isSaving}>{createdVisitId ? 'Fechar' : 'Cancelar'}</button>
            <button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : createdVisitId ? 'Tentar novamente' : 'Cadastrar visita'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

function useStudyVisits(studyId: string) {
  const { request } = useAuth();
  const [visits, setVisits] = useState<PlannedVisitWithActivities[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<VisitsApiError | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    void listVisitsWithActivities(request, studyId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setVisits(response);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setVisits([]);
          setLoadError(reason instanceof VisitsApiError ? reason : new VisitsApiError(UNEXPECTED_VISITS_LOAD_ERROR, true));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [request, studyId, loadAttempt]);

  return { visits, isLoading, loadError, reload: () => setLoadAttempt((attempt) => attempt + 1) };
}

/** Visitas previstas do estudo, com suas atividades; em estudo encerrado (`readOnly`) o backend recusa novos cadastros. */
export function StudyVisitsSection({ studyId, readOnly = false }: { studyId: string; readOnly?: boolean }) {
  const { visits, isLoading, loadError, reload } = useStudyVisits(studyId);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const knownTypes = [...new Set(visits.flatMap((visit) => visit.activities.map((activity) => activity.type)))];

  function closeForm(saved: boolean) {
    setIsFormOpen(false);
    if (saved) reload();
  }

  function finishSave() {
    setIsFormOpen(false);
    setNotice('Visita cadastrada com sucesso.');
    reload();
  }

  return (
    <section className="study-detail-section study-criteria-section study-visits-section" aria-labelledby="study-visits-title">
      <div className="study-visits-heading">
        <h2 id="study-visits-title">Visitas previstas</h2>
        {!readOnly && <button className="button button-primary" type="button" disabled={isLoading || Boolean(loadError)} onClick={() => { setNotice(''); setIsFormOpen(true); }}>+ Cadastrar visita</button>}
      </div>
      <p className="study-criteria-description">{readOnly ? 'Estudo encerrado: as visitas podem ser consultadas, mas não é possível cadastrar novas.' : 'Visitas do protocolo em ordem de execução, com as atividades realizadas em cada uma.'}</p>
      {notice && <div className="notice" role="status"><span>{notice}</span><button type="button" aria-label="Fechar aviso" onClick={() => setNotice('')}><X size={15} /></button></div>}
      {loadError && <div className="study-criteria-load-error">
        <p role="alert" className="form-error">{loadError.message}</p>
        {loadError.retryable && <button className="button button-outline" type="button" onClick={reload}>Tentar novamente</button>}
      </div>}
      {isLoading && <p role="status" className="study-empty-state">Carregando visitas...</p>}
      {!isLoading && !loadError && visits.length === 0 && <div className="study-empty-state">Nenhuma visita prevista cadastrada para este estudo.</div>}
      {!isLoading && !loadError && visits.length > 0 && <ol className="study-visits-list">
        {visits.map((visit) => <li key={visit.id}>
          <article className="study-criteria-group" aria-labelledby={`study-visit-${visit.id}`}>
            <div className="study-criteria-group-heading">
              <h3 id={`study-visit-${visit.id}`}><span className="study-visit-order">Visita {visit.order}</span> {visit.name}</h3>
              <span className="study-status status-planejamento">{activitiesLabel(visit.activities.length)}</span>
            </div>
            <p className="study-visit-interval"><CalendarClock size={13} /> {intervalLabel(visit.intervalDays)}</p>
            {visit.description && <p className="study-visit-description">{visit.description}</p>}
            {visit.activities.length === 0
              ? <div className="study-empty-state">Nenhuma atividade cadastrada.</div>
              : <ul className="study-criteria-list" aria-label={`Atividades de ${visit.name}`}>
                {visit.activities.map((activity) => <li className="study-criteria-item" key={activity.id}>
                  <div className="study-visit-activity">
                    <strong>{activity.name}</strong>
                    <span className="study-visit-activity-type">{activity.type}</span>
                  </div>
                  {activity.description && <p className="study-visit-description">{activity.description}</p>}
                </li>)}
              </ul>}
          </article>
        </li>)}
      </ol>}
      {isFormOpen && <VisitFormDialog
        studyId={studyId}
        usedOrders={visits.map((visit) => visit.order)}
        knownTypes={knownTypes}
        onClose={closeForm}
        onSaved={finishSave}
      />}
    </section>
  );
}
