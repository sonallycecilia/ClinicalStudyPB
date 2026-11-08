import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import {
  CONSENT_UNAVAILABLE_MESSAGE, ConsentApiError, ConsentUnavailableError, isCandidateConsent,
  type Candidate, type CandidateConsent, type CandidateConsentStatus, type RegisterCandidateConsentInput,
} from './candidatesApi';
import type { CandidateConsentState } from './useCandidateConsent';

const STATUSES: readonly CandidateConsentStatus[] = ['Registrado', 'Recusado', 'Revogado'];
type Fields = { status: CandidateConsentStatus | ''; termVersion: string; observation: string };
type Errors = Partial<Record<keyof Fields, string>>;

function validate(fields: Fields): Errors {
  return {
    status: STATUSES.includes(fields.status as CandidateConsentStatus) ? undefined : 'Selecione o resultado do consentimento.',
    termVersion: !fields.termVersion.trim() ? 'Informe a versão do termo simulado.'
      : fields.termVersion.length > 50 ? 'A versão deve ter no máximo 50 caracteres.' : undefined,
    observation: fields.observation.length > 2000 ? 'A observação deve ter no máximo 2.000 caracteres.' : undefined,
  };
}

export function CandidateConsentForm({ candidate, state, onRetry, onCancel, onRegister, currentUser, onBusyChange }: {
  candidate: Pick<Candidate, 'id' | 'name' | 'studyId' | 'studyTitle'>;
  state: CandidateConsentState;
  onRetry: () => void;
  onCancel: () => void;
  /** Deve devolver somente a resposta persistida da API. */
  onRegister?: (input: RegisterCandidateConsentInput, signal?: AbortSignal) => Promise<CandidateConsent>;
  currentUser?: { id: string; name: string } | null;
  onBusyChange?: (busy: boolean) => void;
}) {
  const prefix = useId();
  const form = useRef<HTMLFormElement>(null);
  const submitting = useRef(false);
  const [draft, setFields] = useState<Fields | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<CandidateConsent | null>(null);
  const [success, setSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const lifecycle = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (state.status !== 'ready') return;
    setSaved(state.consent);
  }, [state]);
  const consent = saved ?? (state.status === 'ready' ? state.consent : null);
  const fields: Fields = draft ?? { status: consent?.status ?? '', termVersion: consent?.termVersion ?? '', observation: consent?.observation ?? '' };
  const canRegister = Boolean(onRegister) && state.status === 'ready';
  const registrarName = consent?.registrarId === currentUser?.id ? currentUser?.name : undefined;

  function update<K extends keyof Fields>(field: K, value: Fields[K]) {
    const next = { ...fields, [field]: value };
    setFields(next);
    if (errors[field]) setErrors((current) => ({ ...current, [field]: validate(next)[field] }));
    setChecked(false);
    setSuccess(false);
    setSaveError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || success || (onRegister && !canRegister)) return;
    const next = validate(fields);
    setErrors(next);
    setChecked(false);
    setSuccess(false);
    setSaveError('');
    if (Object.values(next).some(Boolean)) {
      if (next.status) form.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
      else document.getElementById(`${prefix}-${next.termVersion ? 'version' : 'observation'}`)?.focus();
      return;
    }
    if (!canRegister || !onRegister) {
      setChecked(true);
      return;
    }
    submitting.current = true;
    setSaving(true);
    onBusyChange?.(true);
    const signal = lifecycle.current!.signal;
    try {
      const response = await onRegister({
        status: fields.status as CandidateConsentStatus,
        termVersion: fields.termVersion.trim(),
        observation: fields.observation.trim() || null,
      }, signal);
      if (signal.aborted) return;
      if (!isCandidateConsent(response, candidate.studyId, candidate.id) || response.status === null) {
        throw new Error('Resposta de consentimento inválida.');
      }
      setSaved(response);
      setFields({ status: response.status, termVersion: response.termVersion!, observation: response.observation ?? '' });
      setSuccess(true);
    } catch (error: unknown) {
      if (!signal.aborted) setSaveError(error instanceof ConsentApiError || error instanceof ConsentUnavailableError ? error.message : 'Não foi possível registrar o consentimento simulado. Nenhum sucesso foi confirmado. Tente novamente.');
    } finally {
      submitting.current = false;
      if (!signal.aborted) {
        setSaving(false);
        onBusyChange?.(false);
      }
    }
  }

  return <form ref={form} className="candidate-consent-form" aria-label="Consentimento simulado" aria-busy={state.status === 'loading' || saving} noValidate onSubmit={submit}>
    <p className="candidate-notice"><strong>Simulação acadêmica:</strong> este registro é fictício e utilizado exclusivamente para fins educacionais. Não representa consentimento real nem substitui a assinatura de um termo de consentimento.</p>
    <div className="coord-detail-list">
      <div><span>Candidato</span><strong>{candidate.name}</strong></div>
      <div><span>Estudo</span><strong>{candidate.studyTitle}</strong></div>
      <div><span>Estado atual do consentimento simulado</span><strong>{consent ? consent.status ?? 'Não registrado' : 'Não consultado'}</strong></div>
      {consent?.termVersion && <div><span>Versão do último termo</span><strong>{consent.termVersion}</strong></div>}
      {consent?.registeredAt && <div><span>Data do último registro</span><strong><time dateTime={consent.registeredAt}>{new Date(consent.registeredAt).toLocaleString('pt-BR')}</time></strong></div>}
      {registrarName && <div><span>Responsável pelo último registro</span><strong>{registrarName}</strong></div>}
      {consent?.observation && <div><span>Observação do último registro</span><strong>{consent.observation}</strong></div>}
    </div>
    {state.status === 'loading' && <p role="status">Consultando consentimento simulado…</p>}
    {state.status === 'error' && <div><p className="form-error" role="alert">{state.message}</p><button type="button" className="button button-outline" onClick={onRetry}>Tentar novamente</button></div>}
    {(!onRegister || state.status === 'unavailable') && <p id={`${prefix}-unavailable`} className="candidate-notice">{state.status === 'unavailable' ? state.message : CONSENT_UNAVAILABLE_MESSAGE}</p>}
    <fieldset className="consent-fields" disabled={saving}>
      <legend>Registrar novo resultado</legend>
      <fieldset className="consent-options">
        <legend>Resultado do consentimento *</legend>
        {STATUSES.map((status) => <label key={status}>
          <input type="radio" name={`${prefix}-status`} value={status} required checked={fields.status === status} onChange={() => update('status', status)} aria-invalid={Boolean(errors.status)} aria-describedby={errors.status ? `${prefix}-status-error` : undefined} />
          <span>{status}</span>
        </label>)}
      </fieldset>
      {errors.status && <p id={`${prefix}-status-error`} className="study-field-error" role="alert">{errors.status}</p>}
      <label className="study-field" htmlFor={`${prefix}-version`}>Versão do termo simulado *</label>
      <input id={`${prefix}-version`} required maxLength={50} value={fields.termVersion} onChange={(event) => update('termVersion', event.target.value)} onBlur={() => setErrors((current) => ({ ...current, termVersion: validate(fields).termVersion }))} aria-invalid={Boolean(errors.termVersion)} aria-describedby={`${prefix}-version-help${errors.termVersion ? ` ${prefix}-version-error` : ''}`} />
      <small id={`${prefix}-version-help`}>Informe a versão definida para o estudo, com até 50 caracteres.</small>
      {errors.termVersion && <p id={`${prefix}-version-error`} className="study-field-error" role="alert">{errors.termVersion}</p>}
      <label className="study-field" htmlFor={`${prefix}-observation`}>Observações (opcional)</label>
      <textarea id={`${prefix}-observation`} maxLength={2000} rows={3} value={fields.observation} onChange={(event) => update('observation', event.target.value)} onBlur={() => setErrors((current) => ({ ...current, observation: validate(fields).observation }))} aria-invalid={Boolean(errors.observation)} aria-describedby={`${prefix}-count${errors.observation ? ` ${prefix}-observation-error` : ''}`} />
      <small id={`${prefix}-count`} className="consent-count" aria-live="polite">{fields.observation.length}/2.000 caracteres</small>
      {errors.observation && <p id={`${prefix}-observation-error`} className="study-field-error" role="alert">{errors.observation}</p>}
    </fieldset>
    {checked && <p role="status" className="candidate-notice">Preenchimento conferido. O consentimento não foi salvo.</p>}
    {saving && <p role="status">Registrando consentimento simulado…</p>}
    {success && <p role="status" className="candidate-notice">Consentimento simulado registrado com sucesso!</p>}
    {saveError && <p role="alert" className="form-error">{saveError}</p>}
    <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>Cancelar</button>
      {!onRegister && <button type="submit" className="button button-outline">Conferir preenchimento</button>}
      <button type="submit" className="button button-primary" disabled={!canRegister || saving || success} aria-describedby={!onRegister || state.status === 'unavailable' ? `${prefix}-unavailable` : undefined}>Registrar consentimento</button>
    </div>
  </form>;
}
