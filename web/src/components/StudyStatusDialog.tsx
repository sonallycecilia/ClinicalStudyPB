import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { studiesApi } from '../studies/studiesApi';
import type { Study, StudyStatus } from '../studies/studiesApi';
import { STUDY_STATUS_CLASSES, STUDY_STATUS_LABELS, allowedStatusTransitions, isStudyStatus, studyStatusLabel } from '../studies/studyStatus';

/** Selo do estado do estudo; estados fora dos quatro oficiais aparecem como desconhecidos. */
export function StudyStatusBadge({ status }: { status: unknown }) {
  const className = isStudyStatus(status) ? STUDY_STATUS_CLASSES[status] : 'status-desconhecido';
  return <span className={`study-status ${className}`}><i />{studyStatusLabel(status)}</span>;
}

interface StudyStatusDialogProps {
  study: Study;
  onCancel: () => void;
  /** Recebe o estudo devolvido pela API após a confirmação de sucesso. */
  onChanged: (study: Study) => void;
}

/** Solicita a mudança de estado; o estado exibido só muda depois da resposta de sucesso da API. */
export function StudyStatusDialog({ study, onCancel, onChanged }: StudyStatusDialogProps) {
  const { request } = useAuth();
  const options = allowedStatusTransitions(study.status);
  const [nextStatus, setNextStatus] = useState<StudyStatus | ''>(options[0] ?? '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !submitting.current) onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  async function confirm() {
    if (submitting.current) return;
    if (!nextStatus || !options.includes(nextStatus)) {
      setError('Selecione um novo estado válido para o estudo.');
      return;
    }
    submitting.current = true;
    setIsSubmitting(true);
    setError('');
    try {
      onChanged(await studiesApi.transitionStatus(request, study.id, nextStatus));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível alterar o estado do estudo.');
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  const unavailableMessage = study.status === 'encerrado'
    ? 'Este estudo está encerrado e não pode mudar de estado.'
    : 'O estado atual deste estudo não é reconhecido. Atualize a página ou contate o responsável pelo sistema.';

  return (
    <div className="study-dialog-backdrop study-success-mode" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting.current) onCancel(); }}>
      <section className="study-success-card" role="dialog" aria-modal="true" aria-labelledby="study-status-title">
        <div className="study-success-icon"><RefreshCw size={30} strokeWidth={2.5} /></div>
        <h2 id="study-status-title">Alterar estado do estudo</h2>
        <p>Os estados avançam na ordem Planejamento, Recrutamento, Execução e Encerrado. A alteração não pode ser desfeita.</p>
        <div className="study-success-summary"><span>ESTUDO</span><strong>{study.title} • Código {study.code}</strong></div>
        <div className="study-status-change">
          <div className="study-field"><span>Estado atual</span><StudyStatusBadge status={study.status} /></div>
          {options.length > 0 && <label className="study-field">
            <span>Novo estado</span>
            <span className="study-select-wrap">
              <select value={nextStatus} onChange={(event) => { setNextStatus(event.target.value as StudyStatus); setError(''); }} disabled={isSubmitting}>
                {options.map((status) => <option key={status} value={status}>{STUDY_STATUS_LABELS[status]}</option>)}
              </select>
              <ChevronDown size={15} />
            </span>
          </label>}
        </div>
        {options.length === 0 && <p className="form-error" role="alert">{unavailableMessage}</p>}
        {options.length > 0 && nextStatus && <p>Confirma a mudança de <strong>{studyStatusLabel(study.status)}</strong> para <strong>{STUDY_STATUS_LABELS[nextStatus]}</strong>?</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="study-success-actions">
          <button className="button button-outline" type="button" onClick={onCancel} disabled={isSubmitting}>Cancelar</button>
          {options.length > 0 && <button className="button button-primary" type="button" onClick={() => void confirm()} disabled={isSubmitting}>{isSubmitting ? 'Alterando...' : 'Confirmar alteração'}</button>}
        </div>
      </section>
    </div>
  );
}
