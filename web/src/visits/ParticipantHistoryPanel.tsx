import { useEffect, useId, useState, type ReactNode } from 'react';
import {
  formatScheduledAt, HISTORY_LOAD_ERROR, PARTICIPANTS_LOAD_ERROR, ScheduledVisitsApiError,
  type HistoricalVisit, type IncludedParticipant, type ParticipantHistory, type ScheduledVisitStatus,
} from './scheduledVisitsApi';

type Load<T> = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

export interface ParticipantHistoryPanelProps {
  studyId: string;
  /** E01 — todas as participações do estudo, inclusive retiradas e concluídas (D-09). */
  loadParticipants: (studyId: string, signal: AbortSignal) => Promise<readonly IncludedParticipant[]>;
  /** E07 — histórico de uma participação. */
  loadHistory: (studyId: string, participationId: string, signal: AbortSignal) => Promise<ParticipantHistory>;
  /** Selo da situação da visita, para seguir o visual da tela que usa o painel. */
  renderStatus?: (status: ScheduledVisitStatus) => ReactNode;
}

const UNAVAILABLE = 'Não disponível';
const formatDay = (day: string) => day.split('-').reverse().join('/');
const messageOf = (reason: unknown, fallback: string) => reason instanceof ScheduledVisitsApiError ? reason.message : fallback;

/** Explica por que a data de realização ou os resultados não existem, em vez de deixar o campo vazio. */
function realizationText(visit: HistoricalVisit) {
  if (visit.realizedAt) return <time dateTime={visit.realizedAt}>{formatScheduledAt(visit.realizedAt)}</time>;
  if (visit.status === 'Agendada') return <span className="history-unavailable">Ainda não realizada</span>;
  return <span className="history-unavailable">Não se aplica ({visit.status.toLocaleLowerCase()})</span>;
}

function resultsEmptyText(visit: HistoricalVisit) {
  if (visit.status === 'Realizada') return 'Nenhum resultado registrado para esta visita.';
  if (visit.status === 'Agendada') return 'Os resultados ficam disponíveis depois que a visita for realizada.';
  return `Sem resultados: a visita foi registrada como ${visit.status.toLocaleLowerCase()}.`;
}

function HistoryTimeline({ history, renderStatus }: { history: ParticipantHistory; renderStatus: (status: ScheduledVisitStatus) => ReactNode }) {
  const { participant, visits } = history;
  return <>
    <dl className="history-summary">
      <div><dt>Participante</dt><dd>{participant.name}</dd></div>
      <div><dt>Situação da participação</dt><dd>{participant.participationStatus}</dd></div>
      <div><dt>Incluído em</dt><dd><time dateTime={participant.includedAt}>{formatDay(participant.includedAt)}</time></dd></div>
      <div><dt>Retirada</dt><dd>{participant.withdrawnAt
        ? <><time dateTime={participant.withdrawnAt}>{formatDay(participant.withdrawnAt)}</time>{participant.withdrawalReason ? ` · ${participant.withdrawalReason}` : ''}</>
        : <span className="history-unavailable">Sem retirada registrada</span>}</dd></div>
    </dl>
    {visits.length === 0
      ? <p className="study-empty-state" role="status">Nenhuma visita registrada para este participante.</p>
      : <ol className="history-timeline" aria-label={`Histórico de visitas de ${participant.name}`}>
        {visits.map((visit) => <li key={visit.id} className="history-entry">
          <div className="history-entry-heading">
            <h4>Visita {visit.plannedVisitOrder} — {visit.plannedVisitName}</h4>
            {renderStatus(visit.status)}
          </div>
          <dl className="history-dates">
            <div><dt>Agendada para</dt><dd><time dateTime={visit.scheduledAt}>{formatScheduledAt(visit.scheduledAt)}</time></dd></div>
            <div><dt>Realizada em</dt><dd>{realizationText(visit)}</dd></div>
            <div><dt>Observação</dt><dd>{visit.observation || <span className="history-unavailable">{UNAVAILABLE}</span>}</dd></div>
          </dl>
          {visit.results.length === 0
            ? <p className="history-no-results">{resultsEmptyText(visit)}</p>
            : <table className="history-results">
              <caption className="sr-only">Resultados da visita {visit.plannedVisitName}</caption>
              <thead><tr><th scope="col">Atividade</th><th scope="col">Resultado</th><th scope="col">Observação</th><th scope="col">Registrado em</th></tr></thead>
              <tbody>{visit.results.map((result) => <tr key={result.id}>
                <td><strong>{result.activityName}</strong><small>{result.activityType}</small></td>
                <td>{result.value}{result.unit ? ` ${result.unit}` : ''}</td>
                <td>{result.observation || <span className="history-unavailable">{UNAVAILABLE}</span>}</td>
                <td><time dateTime={result.registeredAt}>{formatScheduledAt(result.registeredAt)}</time></td>
              </tr>)}</tbody>
            </table>}
        </li>)}
      </ol>}
  </>;
}

/** Histórico de visitas e avaliações por participante (RF15). */
export function ParticipantHistoryPanel({ studyId, loadParticipants, loadHistory, renderStatus = (status) => <strong>{status}</strong> }: ParticipantHistoryPanelProps) {
  const selectId = useId();
  const [participants, setParticipants] = useState<Load<readonly IncludedParticipant[]>>({ status: 'idle' });
  const [participationId, setParticipationId] = useState('');
  const [history, setHistory] = useState<Load<ParticipantHistory>>({ status: 'idle' });
  const [participantsAttempt, setParticipantsAttempt] = useState(0);
  const [historyAttempt, setHistoryAttempt] = useState(0);

  useEffect(() => {
    setParticipationId('');
    if (!studyId) { setParticipants({ status: 'idle' }); return; }
    const controller = new AbortController();
    setParticipants({ status: 'loading' });
    loadParticipants(studyId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setParticipants({ status: 'ready', data }); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setParticipants({ status: 'error', message: messageOf(reason, PARTICIPANTS_LOAD_ERROR) }); });
    return () => controller.abort();
  }, [studyId, loadParticipants, participantsAttempt]);

  useEffect(() => {
    if (!studyId || !participationId) { setHistory({ status: 'idle' }); return; }
    const controller = new AbortController();
    setHistory({ status: 'loading' });
    loadHistory(studyId, participationId, controller.signal)
      .then((data) => { if (!controller.signal.aborted) setHistory({ status: 'ready', data }); })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setHistory({ status: 'error', message: messageOf(reason, HISTORY_LOAD_ERROR) }); });
    return () => controller.abort();
  }, [studyId, participationId, loadHistory, historyAttempt]);

  const options = participants.status === 'ready' ? participants.data : [];
  const placeholder = participants.status === 'loading' ? 'Carregando participantes…'
    : participants.status === 'error' ? 'Participantes indisponíveis'
      : options.length === 0 ? 'Nenhum participante incluído' : 'Selecione o participante';

  return <div className="participant-history-panel">
    <div className="study-field coord-field history-select">
      <label htmlFor={selectId}>Participante</label>
      <select id={selectId} value={participationId} disabled={options.length === 0} aria-busy={participants.status === 'loading'}
        onChange={(event) => setParticipationId(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((item) => <option key={item.participationId} value={item.participationId}>
          {item.participationStatus === 'Ativo' ? item.name : `${item.name} (${item.participationStatus.toLocaleLowerCase()})`}
        </option>)}
      </select>
    </div>
    {participationId && <button type="button" className="button button-outline coord-secondary-button history-refresh" disabled={history.status === 'loading'}
      onClick={() => setHistoryAttempt((value) => value + 1)}>Atualizar histórico</button>}

    {!studyId && <p className="study-empty-state" role="status">Selecione um estudo para consultar o histórico.</p>}
    {participants.status === 'loading' && <p className="coord-help-copy" role="status">Carregando participantes…</p>}
    {participants.status === 'error' && <div className="form-error history-error" role="alert">
      <p>{participants.message}</p>
      <button type="button" className="button button-outline coord-secondary-button" onClick={() => setParticipantsAttempt((value) => value + 1)}>Tentar novamente</button>
    </div>}
    {participants.status === 'ready' && options.length === 0 && <p className="study-empty-state" role="status">Nenhum participante incluído neste estudo.</p>}
    {participants.status === 'ready' && options.length > 0 && !participationId && <p className="coord-help-copy">Selecione um participante para ver as visitas, as datas, as situações e os resultados registrados.</p>}

    {history.status === 'loading' && <p className="coord-help-copy" role="status">Carregando histórico…</p>}
    {history.status === 'error' && <div className="form-error history-error" role="alert">
      <p>{history.message}</p>
      <button type="button" className="button button-outline coord-secondary-button" onClick={() => setHistoryAttempt((value) => value + 1)}>Tentar novamente</button>
    </div>}
    {history.status === 'ready' && <HistoryTimeline history={history.data} renderStatus={renderStatus} />}
  </div>;
}
