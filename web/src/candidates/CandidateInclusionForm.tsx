import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { TriangleAlert } from 'lucide-react';
import {
  CandidateInclusionError, INCLUSION_ERROR_MESSAGE, INCLUSION_UNAVAILABLE_MESSAGE, INVALID_INCLUSION_MESSAGE, isCandidateInclusion,
  type Candidate, type CandidateInclusion,
} from './candidatesApi';
import { CandidateSummary } from './CandidateSummary';

export function CandidateInclusionForm({ candidate, onCancel, onInclude, onIncluded, onBusyChange }: {
  candidate: Pick<Candidate, 'id' | 'name' | 'studyId' | 'studyTitle'>;
  onCancel: () => void;
  /** Deve retornar a resposta persistida da API. */
  onInclude?: (studyId: string, candidateId: string, signal?: AbortSignal) => Promise<CandidateInclusion>;
  onIncluded?: (inclusion: CandidateInclusion) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const noticeId = useId();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CandidateInclusion | null>(null);
  const [error, setError] = useState<CandidateInclusionError | null>(null);
  const lifecycle = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    return () => controller.abort();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onInclude || submitting.current || result) return;
    submitting.current = true;
    setSaving(true);
    onBusyChange?.(true);
    setError(null);
    const signal = lifecycle.current!.signal;
    let included: CandidateInclusion | undefined;
    try {
      const response = await onInclude(candidate.studyId, candidate.id, signal);
      if (signal.aborted) return;
      if (!isCandidateInclusion(response, candidate.studyId, candidate.id)) throw new CandidateInclusionError(INVALID_INCLUSION_MESSAGE);
      setResult(response);
      included = response;
    } catch (reason: unknown) {
      if (!signal.aborted) setError(reason instanceof CandidateInclusionError ? reason
        : new CandidateInclusionError(INCLUSION_ERROR_MESSAGE));
    } finally {
      submitting.current = false;
      if (!signal.aborted) {
        setSaving(false);
        onBusyChange?.(false);
      }
    }
    if (included && !signal.aborted) onIncluded?.(included);
  }

  return <form className="candidate-inclusion-form" aria-label="Inclusão de participante" aria-busy={saving} onSubmit={submit}>
    <CandidateSummary candidate={candidate} />
    {!onInclude && <p id={noticeId} className="candidate-notice">{INCLUSION_UNAVAILABLE_MESSAGE}</p>}
    {saving && <p role="status">Incluindo participante…</p>}
    {error && <div role="alert" className="candidate-inclusion-error">
      <TriangleAlert size={18} aria-hidden="true" />
      <div><h3>Não foi possível incluir o participante</h3><p>{error.message}</p></div>
    </div>}
    {result && <>
      <p role="status" className="candidate-notice">Participante incluído com sucesso!</p>
      <div className="coord-detail-list">
        <div><span>Data de inclusão</span><strong><time dateTime={result.includedAt}>{result.includedAt.split('-').reverse().join('/')}</time></strong></div>
        <div><span>Estado da participação</span><strong>{result.participationStatus}</strong></div>
        <div><span>Participantes vinculados / limite do estudo</span><strong>{result.participantsLinked} / {result.participantLimit}</strong></div>
      </div>
    </>}
    <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>{result ? 'Voltar aos detalhes' : 'Cancelar'}</button>
      {!result && <button type="submit" className="button button-primary" disabled={!onInclude || saving} aria-describedby={!onInclude ? noticeId : undefined}>Confirmar inclusão</button>}
    </div>
  </form>;
}
