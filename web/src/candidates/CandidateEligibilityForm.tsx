import { useRef, useState, type FormEvent } from 'react';
import type { CriterionType } from '../studies/criteriaApi';
import { ELIGIBILITY_UNAVAILABLE_MESSAGE, type EligibilityCriterionResult } from './candidatesApi';
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

/** Apenas preenchimento e conferência local. O registro aguarda autorização e integração. */
export function CandidateEligibilityForm({ state, onRetry, onCancel }: {
  state: CandidateEligibilityCriteriaState;
  onRetry: () => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [errors, setErrors] = useState<Record<string, FieldErrors>>({});
  const [checked, setChecked] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const criteria = state.status === 'ready' ? state.criteria.filter((criterion) => criterion.active) : [];
  const getAnswer = (id: string): Answer => answers[id] ?? { result: '', observation: '' };

  function update<K extends keyof Answer>(id: string, field: K, value: Answer[K]) {
    const next = { ...getAnswer(id), [field]: value };
    setAnswers((current) => ({ ...current, [id]: next }));
    if (errors[id]) setErrors((current) => ({ ...current, [id]: validate(next) }));
    setChecked(false);
  }

  function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.status !== 'ready' || criteria.length === 0) return;
    const next = Object.fromEntries(criteria.map(({ id }) => [id, validate(getAnswer(id))]));
    setErrors(next);
    const invalid = criteria.some(({ id }) => next[id].result || next[id].observation);
    setChecked(!invalid);
    if (invalid) {
      const first = criteria.find(({ id }) => next[id].result || next[id].observation)!;
      const field = next[first.id].result ? `eligibility-${first.id}-Atende` : `eligibility-${first.id}-observation`;
      document.getElementById(field)?.focus();
    }
  }

  function clear() {
    setAnswers({});
    setErrors({});
    setChecked(false);
    form.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
  }

  return <form ref={form} className="candidate-eligibility-form" aria-label="Avaliação de elegibilidade" aria-busy={state.status === 'loading'} noValidate onSubmit={check}>
    <p id="eligibility-unavailable" className="candidate-notice">{state.status === 'unavailable' ? state.message : ELIGIBILITY_UNAVAILABLE_MESSAGE}</p>
    {state.status === 'loading' && <p role="status">Carregando critérios…</p>}
    {state.status === 'unavailable' && <p role="status">Consulta de critérios indisponível para o Coordenador.</p>}
    {state.status === 'error' && <div className="study-criteria-load-error"><p className="form-error" role="alert">{state.message}</p>{state.retryable && <button type="button" className="button button-outline" onClick={onRetry}>Tentar novamente</button>}</div>}
    {state.status === 'ready' && criteria.length === 0 && <p role="status">Este estudo não possui critérios ativos para avaliação.</p>}
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
          return <fieldset key={criterion.id} className="eligibility-criterion">
            <legend>{criterion.description}</legend>
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
    <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-outline" onClick={onCancel}>Voltar aos detalhes</button>
      {criteria.length > 0 && <>
        <button type="button" className="button button-outline" onClick={clear}>Limpar preenchimento</button>
        <button type="submit" className="button button-outline">Conferir preenchimento</button>
      </>}
      <button type="button" className="button button-primary" disabled aria-describedby="eligibility-unavailable">Registrar avaliação</button>
    </div>
  </form>;
}
