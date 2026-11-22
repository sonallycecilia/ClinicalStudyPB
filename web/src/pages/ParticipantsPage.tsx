import { Link } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { isStudyWritable, useFollowUpStudies } from '../participants/followUpStudies';
import { ParticipantHistoryPanel } from '../participants/ParticipantHistoryPanel';
import { WithdrawalPanel } from '../participants/WithdrawalPanel';
import { ParticipantList } from '../participants/ParticipantList';
import { useParticipantSelection } from '../participants/useParticipantSelection';
import { useStudyParticipants } from '../participants/useStudyParticipants';

/** Participantes incluídos no estudo (RF12, RF15, RF16). Candidatos continuam em /coordenador/candidatos. */
export function ParticipantsPage() {
  const selection = useParticipantSelection();
  const studies = useFollowUpStudies();
  const [notice, setNotice] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);
  const options = studies.state.status === 'ready' ? studies.state.options : [];
  const studyId = options.some((study) => study.id === selection.studyId) ? selection.studyId : '';
  const studyTitle = options.find((study) => study.id === studyId)?.title ?? '';
  const writable = isStudyWritable(options.find((study) => study.id === studyId)?.status);
  const participants = useStudyParticipants(studyId || null);
  const selectedId = participants.state.status === 'ready'
    && participants.state.participants.some((item) => item.participationId === selection.participationId) ? selection.participationId : '';
  const selected = participants.state.status === 'ready' ? participants.state.participants.find((item) => item.participationId === selectedId) : undefined;
  const flowQuery = studyId && selectedId ? `?${new URLSearchParams({ studyId, participationId: selectedId })}` : '';
  const loading = studies.state.status === 'loading';

  return <div className="coord-page coord-participants-page">
    <header className="coord-page-heading"><h1>Participantes incluídos</h1></header>
    <div className="page-content-offset">
      <section className="table-card coord-panel coord-list-panel">
        <div className="study-list-heading coord-panel-heading"><h2>Participantes do estudo</h2>
          <div className="study-list-tools coord-table-tools">
            <label className="study-filter coord-filter"><span className="sr-only">Filtrar por estudo</span>
              <select value={studyId} disabled={options.length === 0} onChange={(event) => selection.selectStudy(event.target.value)}>
                <option value="">{loading ? 'Carregando estudos…' : studies.state.status === 'error' ? 'Falha ao carregar estudos' : options.length === 0 ? 'Nenhum estudo disponível' : 'Selecione o estudo'}</option>
                {options.map((study) => <option key={study.id} value={study.id}>{study.status === 'encerrado' ? `${study.title} (encerrado)` : study.title}</option>)}
              </select></label>
            <button type="button" className="icon-button coord-refresh-button" aria-label="Atualizar estudos" title="Atualizar estudos" aria-busy={loading} disabled={loading}
              onClick={() => { studies.reload(); participants.reload(); }}><RefreshCw size={16} aria-hidden="true" /></button>
          </div></div>
        {studies.state.status === 'error' && <p role="alert" className="coord-help-copy">Não foi possível carregar os estudos. Use o ícone de atualização para tentar novamente.</p>}
        {studies.state.status === 'ready' && options.length === 0 && <p role="status" className="coord-help-copy">Nenhum estudo disponível para consulta de participantes.</p>}
        <p className="coord-help-copy">Esta lista mostra apenas quem já foi incluído. Para avaliar ou incluir candidatos, use <Link to={`/coordenador/candidatos${studyId ? `?${new URLSearchParams({ studyId })}` : ''}`}>Candidatos e participantes</Link>.</p>
        <ParticipantList state={participants.state} studyTitle={studyTitle} selectedId={selectedId} onRetry={participants.reload}
          onSelect={(participant) => selection.selectParticipation(participant.participationId)} />
        {notice && <p role="status" className="notice">{notice}</p>}
        {selected && <>
          <WithdrawalPanel participant={selected} writable={writable} onWithdrawn={(updated) => {
            setNotice(`Retirada de ${updated.name} registrada com sucesso.`);
            setHistoryVersion((value) => value + 1);
            participants.reload();
          }} />
          <ParticipantHistoryPanel studyId={selected.studyId} participationId={selected.participationId} version={historyVersion} />
        </>}
        {selectedId && <nav className="participant-flow-links" aria-label="Fluxos de acompanhamento do participante selecionado">
          <Link className="button button-outline" to={`/coordenador/visitas${flowQuery}`}>Agendar visita</Link>
          <Link className="button button-outline" to={`/coordenador/reagendamentos${flowQuery}`}>Reagendamentos</Link>
        </nav>}
      </section>
    </div>
  </div>;
}
