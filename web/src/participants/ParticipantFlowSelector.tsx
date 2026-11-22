import { useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { isStudyWritable, useFollowUpStudies, type FollowUpStudyStatus } from './followUpStudies';
import { useParticipantSelection } from './useParticipantSelection';
import { useStudyParticipants } from './useStudyParticipants';
import type { Participant } from './participantsApi';
import { formatIncludedAt } from './ParticipantSummary';

export interface ParticipantFlowContext {
  studyId: string;
  studyTitle: string;
  studyStatus: FollowUpStudyStatus | undefined;
  /** Falso em estudos encerrados: agendamento e retirada ficam somente leitura. */
  writable: boolean;
  participant: Participant | null;
}

/**
 * Seleção de estudo + participante para as telas de agendamento, histórico e retirada.
 * O contexto sai da URL; participationId só é aceito se pertencer ao estudo carregado,
 * garantindo que o identificador enviado à API corresponda à participação escolhida.
 */
export function useParticipantFlow() {
  const selection = useParticipantSelection();
  const studies = useFollowUpStudies();
  const options = studies.state.status === 'ready' ? studies.state.options : [];
  const studyId = options.some((study) => study.id === selection.studyId) ? selection.studyId : '';
  const participants = useStudyParticipants(studyId || null);
  const list = participants.state.status === 'ready' ? participants.state.participants : [];
  const participant = list.find((item) => item.participationId === selection.participationId) ?? null;
  const { clearParticipation } = selection;

  useEffect(() => {
    if (participants.state.status === 'ready' && selection.participationId && !participant) clearParticipation();
  }, [participants.state.status, selection.participationId, participant, clearParticipation]);

  const selectedStudy = options.find((study) => study.id === studyId);
  const context: ParticipantFlowContext = { studyId, studyTitle: selectedStudy?.title ?? '', studyStatus: selectedStudy?.status, writable: isStudyWritable(selectedStudy?.status), participant };
  return { selection, studies, options, participants, list, context };
}

export function ParticipantFlowSelector({ flow }: { flow: ReturnType<typeof useParticipantFlow> }) {
  const { selection, studies, options, participants, list, context } = flow;
  const loadingStudies = studies.state.status === 'loading';
  const placeholder = loadingStudies ? 'Carregando estudos…' : studies.state.status === 'error' ? 'Falha ao carregar estudos'
    : options.length === 0 ? 'Nenhum estudo disponível' : 'Selecione o estudo';

  return <section className="participant-flow-selector" aria-label="Estudo e participante selecionados">
    <label className="study-field coord-field"><span>Estudo</span>
      <select value={context.studyId} disabled={options.length === 0} onChange={(event) => selection.selectStudy(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((study) => <option key={study.id} value={study.id}>{study.title}</option>)}
      </select></label>
    <label className="study-field coord-field"><span>Participante incluído</span>
      <select value={context.participant?.participationId ?? ''} disabled={!context.studyId || participants.state.status !== 'ready' || list.length === 0}
        onChange={(event) => selection.selectParticipation(event.target.value)}>
        <option value="">{!context.studyId ? 'Selecione um estudo primeiro' : participants.state.status === 'loading' ? 'Carregando participantes…'
          : participants.state.status === 'error' ? 'Falha ao carregar participantes' : list.length === 0 ? 'Nenhum participante incluído' : 'Selecione o participante'}</option>
        {list.map((item) => <option key={item.participationId} value={item.participationId}>{item.name} · incluído em {formatIncludedAt(item.includedAt)}</option>)}
      </select></label>
    <button type="button" className="icon-button coord-refresh-button" aria-label="Atualizar estudos e participantes" title="Atualizar"
      onClick={() => { studies.reload(); participants.reload(); }}><RefreshCw size={16} aria-hidden="true" /></button>
    {studies.state.status === 'error' && <p role="alert" className="form-error">Não foi possível carregar os estudos. Use o ícone de atualização para tentar novamente.</p>}
    {participants.state.status === 'error' && <p role="alert" className="form-error">{participants.state.message}</p>}
  </section>;
}
