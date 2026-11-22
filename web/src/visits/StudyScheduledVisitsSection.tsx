import { useCallback, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { VisitResultsPanel } from './VisitResultsPanel';
import { formatScheduledAt, scheduledVisitsApi, type ScheduledVisit, type ScheduledVisitStatus } from './scheduledVisitsApi';
import { useScheduledVisits } from './useScheduledVisits';

const STATUS_TONE: Record<ScheduledVisitStatus, string> = {
  Agendada: 'warning', Realizada: 'success', Ausente: 'danger', Cancelada: 'muted',
};

export function ScheduledVisitStatusBadge({ status }: { status: ScheduledVisitStatus }) {
  return <span className={`status-pill coord-status coord-status-${STATUS_TONE[status]}`}><span />{status}</span>;
}

/**
 * Visitas agendadas do estudo próprio do Pesquisador (E03), com as atividades previstas
 * e o registro dos resultados fictícios (E05/E06). RF14 é exclusivo do Pesquisador proprietário (D-04).
 */
export function StudyScheduledVisitsSection({ studyId, readOnly = false }: { studyId: string; readOnly?: boolean }) {
  const { request } = useAuth();
  const agenda = useScheduledVisits(studyId);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const busy = useRef(false);
  const loadResults = useCallback((visit: ScheduledVisit, signal: AbortSignal) => scheduledVisitsApi.getResults(request, visit, signal), [request]);
  const register = useCallback((visit: ScheduledVisit, input: Parameters<typeof scheduledVisitsApi.registerResult>[2], signal: AbortSignal) =>
    scheduledVisitsApi.registerResult(request, visit, input, signal), [request]);
  const visits = agenda.state.status === 'ready' ? agenda.state.visits : [];

  function toggle(id: string) {
    // Não fecha o painel enquanto um resultado está sendo enviado.
    if (busy.current) return;
    setExpandedId((current) => current === id ? null : id);
  }

  return <section className="study-detail-section study-criteria-section study-scheduled-visits-section" aria-labelledby="study-scheduled-visits-title">
    <div className="study-visits-heading">
      <h2 id="study-scheduled-visits-title">Visitas agendadas</h2>
      <button type="button" className="button button-outline" disabled={agenda.state.status === 'loading'} onClick={() => { if (!busy.current) { setExpandedId(null); agenda.reload(); } }}>
        <RefreshCw size={14} aria-hidden="true" /> Atualizar
      </button>
    </div>
    <p className="study-criteria-description">{readOnly
      ? 'Estudo encerrado: as visitas e os resultados podem ser consultados, mas não é possível registrar novos resultados.'
      : 'Visitas agendadas dos participantes. Nas visitas realizadas, registre o resultado fictício de cada atividade prevista.'}</p>
    {agenda.state.status === 'loading' && <p role="status" className="study-empty-state">Carregando visitas agendadas...</p>}
    {agenda.state.status === 'error' && <div className="study-criteria-load-error">
      <p role="alert" className="form-error">{agenda.state.message}</p>
      <button className="button button-outline" type="button" onClick={agenda.reload}>Tentar novamente</button>
    </div>}
    {agenda.state.status === 'ready' && visits.length === 0 && <div className="study-empty-state">Nenhuma visita agendada para este estudo.</div>}
    {visits.length > 0 && <ol className="study-visits-list">
      {visits.map((visit) => {
        const expanded = expandedId === visit.id;
        const panelId = `scheduled-visit-results-${visit.id}`;
        return <li key={visit.id}>
          <article className="study-criteria-group" aria-labelledby={`scheduled-visit-${visit.id}`}>
            <div className="study-criteria-group-heading">
              <h3 id={`scheduled-visit-${visit.id}`}>{visit.participantName} <span className="study-visit-order">· Visita {visit.plannedVisitOrder} — {visit.plannedVisitName}</span></h3>
              <ScheduledVisitStatusBadge status={visit.status} />
            </div>
            <p className="study-visit-interval">Agendada para <time dateTime={visit.scheduledAt}>{formatScheduledAt(visit.scheduledAt)}</time>
              {visit.realizedAt && <> · realizada em <time dateTime={visit.realizedAt}>{formatScheduledAt(visit.realizedAt)}</time></>}</p>
            <button type="button" className="button button-outline scheduled-visit-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(visit.id)}>
              {expanded ? 'Ocultar atividades' : visit.status === 'Realizada' && !readOnly ? 'Registrar resultados' : 'Ver atividades'}
            </button>
            {expanded && <div id={panelId}>
              <VisitResultsPanel visit={visit} loadResults={loadResults} onRegister={readOnly ? undefined : register}
                onBusyChange={(value) => { busy.current = value; }} />
            </div>}
          </article>
        </li>;
      })}
    </ol>}
  </section>;
}
