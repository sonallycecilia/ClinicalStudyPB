import { useId, useRef, useState, type FormEvent } from 'react';
import {
  CandidateInclusionError, INCLUSION_UNAVAILABLE_MESSAGE, INVALID_INCLUSION_MESSAGE, isCandidateInclusion,
  type Candidate, type CandidateInclusion,
} from './candidatesApi';

export function CandidateInclusionForm({ candidate, onCancel, onInclude }: {
  candidate: Pick<Candidate, 'id' | 'name' | 'studyId' | 'studyTitle'>;
  onCancel: () => void;
  /** Injetar somente após autorização; deve retornar a resposta persistida da API. */
  onInclude?: (studyId: string, candidateId: string) => Promise<CandidateInclusion>;
}) {
  const noticeId = useId();
  const submitting = useRef(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<CandidateInclusion | null>(null);
  const [error, setError] = useState<CandidateInclusionError | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!onInclude || submitting.current || result) return;
    submitting.current = true;
    setSaving(true);
    setError(null);
    try {
      const response = await onInclude(candidate.studyId, candidate.id);
      if (!isCandidateInclusion(response, candidate.studyId, candidate.id)) throw new CandidateInclusionError(INVALID_INCLUSION_MESSAGE);
      setResult(response);
    } catch (reason: unknown) {
      setError(reason instanceof CandidateInclusionError ? reason
        : new CandidateInclusionError('Não foi possível confirmar a inclusão. Consulte os candidatos antes de tentar novamente.'));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return <form aria-label="Inclusão de participante" aria-busy={saving} onSubmit={submit}>
    <div className="coord-detail-list">
      <div><span>Candidato</span><strong>{candidate.name}</strong></div>
      <div><span>Estudo</span><strong>{candidate.studyTitle}</strong></div>
    </div>
    {!result && <>
      <p className="coord-help-copy">A inclusão depende de elegibilidade aprovada, consentimento simulado concedido e disponibilidade de vagas no estudo.</p>
      <p className="coord-help-copy">Confirma a inclusão deste candidato como participante?</p>
    </>}
    {!onInclude && <p id={noticeId} className="candidate-notice">{INCLUSION_UNAVAILABLE_MESSAGE}</p>}
    {saving && <p role="status">Incluindo participante…</p>}
    {error && <div role="alert" className="form-error">
      <p>{error.message}</p>
      {error.status === 400 && <p>Consulte a avaliação de elegibilidade, o consentimento simulado (o último registro deve estar concedido como Registrado, sem recusa ou revogação) e a situação e as vagas do estudo antes de tentar novamente.</p>}
    </div>}
    {result && <>
      <p role="status" className="candidate-notice">Candidato incluído como participante com sucesso</p>
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
