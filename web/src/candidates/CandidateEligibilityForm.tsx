import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthContext';
import type { CriterionType } from '../studies/criteriaApi';
import { candidatesApi, EligibilityApiError, type Candidate, type CandidateEligibilityAssessment, type EligibilityCriterionResult } from './candidatesApi';
import type { CandidateEligibilityCriteriaState } from './useCandidateEligibilityCriteria';

const RESULTS: readonly EligibilityCriterionResult[] = ['Atende', 'Não atende', 'Pendente'];
const TYPES: readonly CriterionType[] = ['Inclusão', 'Exclusão'];
const MAX_OBSERVATION_LENGTH = 2000;
type Answer = { result: EligibilityCriterionResult | ''; observation: string };
type FieldErrors = { result?: string; observation?: string };

function validate(answer: Answer): FieldErrors {
  return {
    result: answer.result && RESULTS.includes(answer.result) ? undefined : 'Selecione um resultado para este critério.',
    observation: answer.observation.length > MAX_OBSERVATION_LENGTH ? 'A observação deve ter no máximo 2.000 caracteres.' : undefined,
  };
}

export function CandidateEligibilityForm({ state, candidate, onRetry, onCancel, onRegistered, onBusyChange }: {
  state: CandidateEligibilityCriteriaState;
  candidate: Candidate;
  onRetry: () => void;
  onCancel: () => void;
  onRegistered: (assessment: CandidateEligibilityAssessment) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const { request } = useAuth();
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [errors, setErrors] = useState<Record<string, FieldErrors>>({});
  const [checked, setChecked] = useState(false);
  const [saved, setSaved] = useState<CandidateEligibilityAssessment | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const submission = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (state.status !== 'ready') return;
    setSaved(state.assessment);
    // Ao atualizar os critérios após uma recusa, preserva o preenchimento dos IDs ainda ativos.
    setAnswers((current) => Object.fromEntries(state.criteria.map(({ id }) => {
      const evaluation = state.assessment.evaluations.find((item) => item.criterionId === id);
      return [id, current[id] ?? { result: evaluation?.result ?? '', observation: evaluation?.observation ?? '' }];
    })));
  }, [state]);
  const form = useRef<HTMLFormElement>(null);
  const criteria = state.status === 'ready' ? state.criteria.filter((criterion) => criterion.active) : [];
  const assessment = saved ?? (state.status === 'ready' ? state.assessment : null);
  const getAnswer = (id: string): Answer => {
    const evaluation = assessment?.evaluations.find((item) => item.criterionId === id);
    return answers[id] ?? { result: evaluation?.result ?? '', observation: evaluation?.observation ?? '' };
  };
  const included = assessment?.status === 'Incluído';

  function update<K extends keyof Answer>(id: string, field: K, value: Answer[K]) {
    const next = { ...getAnswer(id), [field]: value };
    setAnswers((current) => ({ ...current, [id]: next }));
    if (errors[id]) setErrors((current) => ({ ...current, [id]: validate(next) }));
    setChecked(false);
    setConfirmed(false);
  }

  function check(): boolean {
    if (state.status !== 'ready' || criteria.length === 0 || submission.current) return false;
    const next = Object.fromEntries(criteria.map(({ id }) => [id, validate(getAnswer(id))]));
    setErrors(next);
    const invalid = criteria.some(({ id }) => next[id].result || next[id].observation);
    setChecked(!invalid);
    if (invalid) {
      const first = criteria.find(({ id }) => next[id].result || next[id].observation)!;
      const field = next[first.id].result ? `eligibility-${first.id}-Atende` : `eligibility-${first.id}-observation`;
      document.getElementById(field)?.focus();
    }
    return !invalid;
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.current || included || confirmed || !check()) return;
    submission.current = true;
    setSubmitting(true);
    onBusyChange(true);
    setSaveError(null);
    setChecked(false);
    const signal = lifecycle.current!.signal;
    try {
      const result = await candidatesApi.registerEligibilityAssessment(request, candidate.studyId, candidate.id, {
        evaluations: criteria.map(({ id }) => ({ criterionId: id, result: getAnswer(id).result as EligibilityCriterionResult, observation: getAnswer(id).observation })),
      }, signal);
      if (signal.aborted) return;
      setSaved(result);
      setAnswers(Object.fromEntries(result.evaluations.map((item) => [item.criterionId, { result: item.result, observation: item.observation ?? '' }])));
      setErrors({});
      setConfirmed(true);
      onRegistered(result);
    } catch (error) {
      if (!signal.aborted) setSaveError(error instanceof EligibilityApiError ? error.message : 'Não foi possível registrar a avaliação. Consulte os dados e tente novamente.');
    } finally {
      submission.current = false;
      if (!signal.aborted) {
        setSubmitting(false);
        onBusyChange(false);
      }
    }
  }

  function clear() {
    setAnswers(Object.fromEntries(criteria.map(({ id }) => [id, { result: '', observation: '' }])));
    setErrors({});
    setChecked(false);
    setConfirmed(false);
    form.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
  }

  return <form ref={form} className="candidate-eligibility-form" aria-label="Avaliação de elegibilidade" aria-busy={state.status === 'loading' || submitting} noValidate onSubmit={register}>
    {state.status === 'loading' && <p role="status">Carregando critérios…</p>}
    {state.status === 'error' && <div className="study-criteria-load-error"><p className="form-error" role="alert">{state.message}</p>{state.retryable && <button type="button" className="button button-outline" onClick={onRetry}>Tentar novamente</button>}</div>}
    {state.status === 'ready' && criteria.length === 0 && <p role="status">Este estudo não possui critérios ativos para avaliação.</p>}
    {state.status === 'ready' && assessment && <>
      <p>Elegibilidade atual: <strong>{assessment.status}</strong></p>
      {assessment.evaluations.length === 0 && <p role="status">Nenhuma avaliação registrada para este candidato.</p>}
      {included && <p role="status">O candidato já foi incluído neste estudo e não pode ser reavaliado.</p>}
    </>}
    {criteria.length > 0 && <>
      <p className="eligibility-help">Selecione um resultado para cada critério. Use Pendente quando ainda não houver conclusão. As observações são opcionais e aceitam até 2.000 caracteres por critério.</p>
      {TYPES.map((type) => <section className="eligibility-group" key={type} aria-label={`Critérios de ${type.toLocaleLowerCase()}`}>
        <h3>Critérios de {type.toLocaleLowerCase()}</h3>
        <p className="eligibility-help">{type === 'Inclusão' ? 'Atende é favorável à elegibilidade; Não atende é desfavorável.' : 'Atende indica um impedimento à participação; Não atende é favorável à elegibilidade.'}</p>
        {criteria.filter((criterion) => criterion.type === type).length === 0 && <p>Nenhum critério de {type.toLocaleLowerCase()} ativo.</p>}
        {criteria.filter((criterion) => criterion.type === type).map((criterion) => {
          const answer = getAnswer(criterion.id);
          const error = errors[criterion.id];
          const prefix = `eligibility-${criterion.id}`;
          const evaluation = assessment?.evaluations.find((item) => item.criterionId === criterion.id);
          return <fieldset key={criterion.id} className="eligibility-criterion" disabled={submitting || included}>
            <legend>{criterion.description}</legend>
            <small>ID do critério: {criterion.id}</small>
            {evaluation && <p>Última avaliação: <time dateTime={evaluation.evaluatedAt}>{new Date(evaluation.evaluatedAt).toLocaleString('pt-BR')}</time> · Responsável: {evaluation.evaluatorId}</p>}
            <div className="eligibility-options">
              {RESULTS.map((result) => <label key={result}>
                <input type="radio" id={`${prefix}-${result}`} name={`${prefix}-result`} value={result} required checked={answer.result === result} onChange={() => update(criterion.id, 'result', result)} aria-invalid={Boolean(error?.result)} aria-describedby={error?.result ? `${prefix}-result-error` : undefined} />
                <span>{result}</span>
              </label>)}
            </div>
            {error?.result && <p id={`${prefix}-result-error`} className="study-field-error" role="alert">{error.result}</p>}
            <label className="study-field" htmlFor={`${prefix}-observation`}>Observações (opcional)</label>
            <textarea id={`${prefix}-observation`} value={answer.observation} maxLength={MAX_OBSERVATION_LENGTH} rows={3} onChange={(event) => update(criterion.id, 'observation', event.target.value)} onBlur={() => setErrors((current) => ({ ...current, [criterion.id]: { ...current[criterion.id], observation: validate(answer).observation } }))} aria-invalid={Boolean(error?.observation)} aria-describedby={`${prefix}-count${error?.observation ? ` ${prefix}-observation-error` : ''}`} />
            <small id={`${prefix}-count`}>{answer.observation.length}/2.000 caracteres</small>
            {error?.observation && <p id={`${prefix}-observation-error`} className="study-field-error" role="alert">{error.observation}</p>}
          </fieldset>;
        })}
      </section>)}
    </>}
    {checked && <p role="status" className="candidate-notice">Preenchimento conferido. A avaliação ainda não foi salva.</p>}
    {confirmed && <p role="status" className="candidate-notice">Avaliação registrada com sucesso. Resultado: {assessment?.status}.</p>}
    {saveError && <div role="alert"><p className="form-error">{saveError}</p><button type="button" className="button button-outline" onClick={() => { setSaveError(null); setConfirmed(false); onRetry(); }}>Atualizar critérios e avaliações</button></div>}
    <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-outline" disabled={submitting} onClick={onCancel}>Voltar aos detalhes</button>
      {criteria.length > 0 && <>
        <button type="button" className="button button-outline" disabled={submitting || included} onClick={clear}>Limpar preenchimento</button>
        <button type="button" className="button button-outline" disabled={submitting || included} onClick={check}>Conferir preenchimento</button>
      </>}
      <button type="submit" className="button button-primary" disabled={state.status !== 'ready' || criteria.length === 0 || submitting || included || confirmed}>{submitting ? 'Registrando…' : 'Registrar avaliação'}</button>
    </div>
  </form>;
}
