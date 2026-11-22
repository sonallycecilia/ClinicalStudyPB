import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { CandidateForm } from '../candidates/CandidateForm';
import { CandidateEligibilityForm } from '../candidates/CandidateEligibilityForm';
import { CandidateConsentForm } from '../candidates/CandidateConsentForm';
import { CandidateSummary } from '../candidates/CandidateSummary';
import { CandidateInclusionForm } from '../candidates/CandidateInclusionForm';
import { useCandidateConsent } from '../candidates/useCandidateConsent';
import { useCandidateEligibilityCriteria } from '../candidates/useCandidateEligibilityCriteria';
import { useRecruitmentStudies } from '../candidates/useRecruitmentStudies';
import { candidatesApi, CANDIDATE_STATUSES, type Candidate, type CandidateConsent, type CandidateEligibilityAssessment, type CandidateInclusion, type CandidateStatus } from '../candidates/candidatesApi';
import { useAuth } from '../auth/AuthContext';
import { useStudyCandidates, type StudyCandidatesState } from '../candidates/useStudyCandidates';
import { useCandidateListStudies } from '../candidates/useCandidateListStudies';
import { visitsApi } from '../studies/visitsApi';
import { ScheduleVisitForm } from '../visits/ScheduleVisitForm';
import { formatScheduledAt, SCHEDULED_VISIT_STATUSES, scheduledVisitsApi, type ScheduledVisit, type ScheduledVisitStatus } from '../visits/scheduledVisitsApi';
import { useScheduledVisits } from '../visits/useScheduledVisits';
import { VisitStatusForm } from '../visits/VisitStatusForm';
import { VisitResultsPanel } from '../visits/VisitResultsPanel';
import { ParticipantHistoryPanel } from '../visits/ParticipantHistoryPanel';
import {
  Check,
  ChevronDown,
  Download,
  FileText,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';

type VisitStatus = 'Confirmada' | 'Aguardando' | 'Reagendamento' | 'Concluída';
type RequestStatus = 'Pendente' | 'Aprovada' | 'Recusada';

interface VisitRow {
  id: number;
  participant: string;
  initials: string;
  study: string;
  visit: string;
  dateTime: string;
  status: VisitStatus;
}

interface RequestRow {
  id: number;
  participant: string;
  initials: string;
  studyVisit: string;
  requestedDate: string;
  reason: string;
  status: RequestStatus;
}

const initialVisits: VisitRow[] = [
  { id: 1, participant: 'Bianca Oliveira', initials: 'BO', study: 'Qualidade do sono', visit: 'Visita 03', dateTime: '24/10/2026 · 09:00', status: 'Confirmada' },
  { id: 2, participant: 'Rafael Lima', initials: 'RL', study: 'Pressão arterial', visit: 'Avaliação inicial', dateTime: '24/10/2026 · 10:30', status: 'Aguardando' },
  { id: 3, participant: 'Ana Maria', initials: 'AS', study: 'Atividade física', visit: 'Visita 02', dateTime: '25/10/2026 · 14:00', status: 'Confirmada' },
  { id: 4, participant: 'Bianca Oliveira', initials: 'BO', study: 'Qualidade do sono', visit: 'Visita 03', dateTime: '26/10/2026 · 08:30', status: 'Reagendamento' },
];

const initialRequests: RequestRow[] = [
  { id: 1, participant: 'Bianca Oliveira', initials: 'BO', studyVisit: 'Qualidade do sono · Visita 03', requestedDate: '26/10/2026 · 08:30', reason: 'Conflito de horário', status: 'Pendente' },
  { id: 2, participant: 'João Pedro', initials: 'JP', studyVisit: 'Qualidade do sono · Visita 04', requestedDate: '27/10/2026 · 09:00', reason: 'Indisponibilidade', status: 'Pendente' },
  { id: 3, participant: 'Lucas Martins', initials: 'LM', studyVisit: 'Pressão arterial · Avaliação inicial', requestedDate: '28/10/2026 · 10:30', reason: 'Solicitação do participante', status: 'Pendente' },
  { id: 4, participant: 'Carla Mendes', initials: 'CM', studyVisit: 'Atividade física · Visita 02', requestedDate: '25/10/2026 · 14:00', reason: 'Ajuste de agenda', status: 'Aprovada' },
  { id: 5, participant: 'Ana Maria', initials: 'AS', studyVisit: 'Atividade física · Visita 05', requestedDate: '22/10/2026 · 15:30', reason: 'Compromisso pessoal', status: 'Recusada' },
  { id: 6, participant: 'Mariana Alves', initials: 'MA', studyVisit: 'Pressão arterial · Visita 01', requestedDate: '21/10/2026 · 11:00', reason: 'Indisponibilidade', status: 'Aprovada' },
];

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toLocaleUpperCase() ?? '').join('');
}

function StatusBadge({ status }: { status: VisitStatus | CandidateStatus | RequestStatus | ScheduledVisitStatus }) {
  const tone = status === 'Confirmada' || status === 'Incluído' || status === 'Elegível' || status === 'Aprovada' || status === 'Realizada'
    ? 'success'
    : status === 'Aguardando' || status === 'Novo' || status === 'Em avaliação' || status === 'Pendente' || status === 'Agendada'
      ? 'warning'
      : status === 'Reagendamento'
        ? 'purple'
        : status === 'Recusada' || status === 'Inelegível' || status === 'Ausente'
          ? 'danger'
          : 'muted';
  return <span className={`status-pill coord-status coord-status-${tone}`}><span />{status}</span>;
}

function PageHeader({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="coord-page-heading">
      <h1>{title}</h1>
      <button type="button" className="button button-primary coord-primary-button" onClick={onAction}><Plus size={13} /> {action}</button>
    </div>
  );
}

function StatCards({ items }: { items: { title: string; value: string; note?: string }[] }) {
  return <section className={`coord-stat-grid coord-stat-grid-${items.length}`} aria-label="Indicadores">{items.map((item) => (
    <article className="study-stat-card coord-stat-card" key={item.title}><span>{item.title}</span><div><strong>{item.value}</strong>{item.note && <small>{item.note}</small>}</div></article>
  ))}</section>;
}

function SearchField({ value, onChange, placeholder = 'Buscar por nome...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) {
  return <label className="study-search coord-search"><Search size={12} /><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function FilterSelect({ value, onChange, options, label, disabled = false, describedBy }: { value: string; onChange: (value: string) => void; options: (string | { value: string; label: string })[]; label: string; disabled?: boolean; describedBy?: string }) {
  return <label className={`study-filter coord-filter${disabled ? ' coord-filter-disabled' : ''}`}><span className="sr-only">{label}</span><select value={value} disabled={disabled} aria-describedby={describedBy} onChange={(event) => onChange(event.target.value)}>{options.map((option) => typeof option === 'string'
    ? <option key={option}>{option}</option>
    : <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown size={11} /></label>;
}

function PersonCell({ name, initials: badge }: { name: string; initials: string }) {
  return <div className="user-cell coord-person"><span className="avatar coord-avatar">{badge}</span><strong>{name}</strong></div>;
}

function MoreButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="icon-button coord-more-button" onClick={onClick} aria-label="Mais ações"><MoreVertical size={14} /></button>;
}

function EmptyRow({ columns, message }: { columns: number; message: ReactNode }) {
  return <tr><td colSpan={columns} className="coord-empty-row">{message}</td></tr>;
}

function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLButtonElement>('button[aria-label="Fechar"]')?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
      } else if (event.key === 'Tab' && dialog) {
        const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]'))
          .filter((element) => !element.matches(':disabled') && element.tabIndex >= 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    }

    dialog?.addEventListener('keydown', handleKeyDown);
    return () => {
      dialog?.removeEventListener('keydown', handleKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [title]);

  return <div className="modal-backdrop coord-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className={`user-modal coord-modal${wide ? ' coord-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className="coord-modal-header"><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="icon-button coord-icon-button" onClick={onClose} aria-label="Fechar"><X size={17} /></button></header>
      {children}
    </section>
  </div>;
}

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`study-field coord-field${wide ? ' coord-field-wide' : ''}`}><span>{label}</span>{children}</label>;
}

function initialsFormName(value: string) {
  return value.trim() ? initials(value) : '??';
}

function CandidateRegistrationModal({ onClose, onCreated }: { onClose: () => void; onCreated: (studyId: string) => void }) {
  const studies = useRecruitmentStudies();
  const { request } = useAuth();
  const submitting = useRef(false);
  const close = () => { if (!submitting.current) onClose(); };

  return <Modal title="Cadastrar candidato" description="Informe os dados do candidato e selecione o estudo de interesse." onClose={close}>
    <CandidateForm studies={studies} onCancel={close} onSubmit={async (input) => {
      // Impede fechar e reabrir outro formulário enquanto o cadastro está em andamento.
      submitting.current = true;
      try {
        await candidatesApi.create(request, input);
        onCreated(input.id_estudo);
      } finally {
        submitting.current = false;
      }
    }} />
  </Modal>;
}

function CandidateEligibilitySection({ candidate, onBack, onRegistered, onSaved, onBusyChange }: { candidate: Candidate; onBack: () => void; onRegistered: (assessment: CandidateEligibilityAssessment) => void; onSaved: (assessment: CandidateEligibilityAssessment) => void; onBusyChange: (busy: boolean) => void }) {
  const criteria = useCandidateEligibilityCriteria(candidate.studyId, candidate.id);
  return <CandidateEligibilityForm key={`${candidate.studyId}:${candidate.id}`} candidate={candidate} state={criteria.state} onRetry={criteria.reload} onCancel={onBack} onRegistered={onRegistered} onSaved={onSaved} onBusyChange={onBusyChange} />;
}

function CandidateConsentSection({ candidate, onBack, onBusyChange, onRegistered }: { candidate: Candidate; onBack: () => void; onBusyChange: (busy: boolean) => void; onRegistered: (consent: CandidateConsent) => void }) {
  const { request, user } = useAuth();
  const consent = useCandidateConsent(candidate.studyId, candidate.id);
  return <CandidateConsentForm key={`${candidate.studyId}:${candidate.id}`} candidate={candidate} state={consent.state} onRetry={consent.reload} onCancel={onBack} currentUser={user} onBusyChange={onBusyChange} onRegistered={onRegistered} onRegister={(input, signal) => candidatesApi.registerConsent(request, candidate.studyId, candidate.id, input, signal)} />;
}

function CandidateDetailsModal({ candidate, onClose, onRegistered, onIncluded }: { candidate: Candidate; onClose: () => void; onRegistered: (assessment: CandidateEligibilityAssessment) => void; onIncluded: (inclusion: CandidateInclusion) => void }) {
  const { request } = useAuth();
  const [view, setView] = useState<'details' | 'eligibility' | 'consent' | 'inclusion'>('details');
  const [consentSuccess, setConsentSuccess] = useState<CandidateConsent | null>(null);
  const [eligibilitySuccess, setEligibilitySuccess] = useState<CandidateEligibilityAssessment | null>(null);
  const [inclusionSuccess, setInclusionSuccess] = useState<CandidateInclusion | null>(null);
  const submitting = useRef(false);
  const evaluating = view === 'eligibility';
  useEffect(() => {
    if (!consentSuccess) return;
    const timer = window.setTimeout(() => setConsentSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [consentSuccess]);
  useEffect(() => {
    if (!eligibilitySuccess) return;
    const timer = window.setTimeout(() => setEligibilitySuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [eligibilitySuccess]);
  useEffect(() => {
    if (!inclusionSuccess) return;
    const timer = window.setTimeout(() => setInclusionSuccess(null), 6000);
    return () => window.clearTimeout(timer);
  }, [inclusionSuccess]);
  return <Modal title={evaluating ? 'Avaliar elegibilidade' : view === 'consent' ? 'Registrar consentimento' : view === 'inclusion' ? 'Incluir participante' : 'Detalhes do candidato'} onClose={() => { if (!submitting.current) onClose(); }} wide={view !== 'details'}>
    {view === 'details' && consentSuccess && <div className="notice" role="status"><span>Consentimento simulado registrado com sucesso!</span><button type="button" className="icon-button" aria-label="Fechar confirmação de consentimento" onClick={() => setConsentSuccess(null)}><X size={16} aria-hidden="true" /></button></div>}
    {view === 'details' && eligibilitySuccess && <div className="notice" role="status"><span>Avaliação registrada com sucesso!</span><button type="button" className="icon-button" aria-label="Fechar confirmação de avaliação" onClick={() => setEligibilitySuccess(null)}><X size={16} aria-hidden="true" /></button></div>}
    {view === 'details' && inclusionSuccess && <div className="notice" role="status"><span>Participante incluído com sucesso!</span><button type="button" className="icon-button" aria-label="Fechar confirmação de inclusão" onClick={() => setInclusionSuccess(null)}><X size={16} aria-hidden="true" /></button></div>}
    {(view === 'details' || evaluating) && <CandidateSummary candidate={candidate} status={<StatusBadge status={candidate.status} />} enrollmentDate={view === 'details' ? candidate.enrollmentDate : undefined} />}
    {evaluating ? <CandidateEligibilitySection candidate={candidate} onBack={() => setView('details')} onRegistered={onRegistered} onSaved={(assessment) => { setEligibilitySuccess(assessment); setView('details'); }} onBusyChange={(busy) => { submitting.current = busy; }} /> : view === 'consent' ? <CandidateConsentSection candidate={candidate} onBack={() => setView('details')} onBusyChange={(busy) => { submitting.current = busy; }} onRegistered={(consent) => { setConsentSuccess(consent); setView('details'); }} /> : view === 'inclusion' ? <CandidateInclusionForm candidate={candidate} onCancel={() => setView('details')} onBusyChange={(busy) => { submitting.current = busy; }} onInclude={(studyId, candidateId, signal) => candidatesApi.include(request, studyId, candidateId, signal)} onIncluded={(inclusion) => { onIncluded(inclusion); setInclusionSuccess(inclusion); setView('details'); }} /> : <div className="modal-actions coord-modal-actions">
      <button type="button" className="button button-primary" onClick={() => setView('eligibility')}>Avaliar elegibilidade</button>
      <button type="button" className="button button-outline" onClick={() => setView('consent')}>Registrar consentimento</button>
      <button type="button" className="button button-outline coord-inclusion-action" disabled={candidate.status === 'Incluído'} onClick={() => setView('inclusion')}>Incluir participante</button>
    </div>}
  </Modal>;
}

export function CoordinatorDashboardPage() {
  const [visits, setVisits] = useState(initialVisits);
  const [search, setSearch] = useState('');
  const [studyFilter, setStudyFilter] = useState('Todos os estudos');
  const [activeVisit, setActiveVisit] = useState<VisitRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [lastScheduled, setLastScheduled] = useState<ScheduledVisit | null>(null);
  const closeSchedule = useCallback(() => setShowNew(false), []);
  const navigate = useNavigate();
  const visibleVisits = visits.filter((visit) => visit.participant.toLowerCase().includes(search.toLowerCase()) && (studyFilter === 'Todos os estudos' || visit.study === studyFilter));

  function updateVisit(status: VisitStatus) {
    if (!activeVisit) return;
    setVisits((current) => current.map((visit) => visit.id === activeVisit.id ? { ...visit, status } : visit));
    setActiveVisit(null);
  }

  return <div className="coord-page coord-dashboard-page">
    <PageHeader title="Coordenar Estudos Clínicos" action="Novo registro" onAction={() => { setLastScheduled(null); setShowNew(true); }} />
    {lastScheduled && <ScheduledVisitNotice visit={lastScheduled} onClose={() => setLastScheduled(null)} />}
    <div className="page-content-offset">
    <StatCards items={[{ title: 'Candidatos pendentes', value: '—', note: 'Consulta indisponível' }, { title: 'Participantes ativos', value: '18' }, { title: 'Visitas esta semana', value: '12' }, { title: 'Reagendamentos', value: '03 pendentes' }]} />
    <section className="table-card coord-panel coord-upcoming-panel">
      <div className="study-list-heading coord-panel-heading"><h2>Próximas visitas</h2><div className="study-list-tools coord-table-tools"><SearchField value={search} onChange={setSearch} placeholder="Buscar participante..." /><FilterSelect value={studyFilter} onChange={setStudyFilter} label="Filtrar por estudo" options={['Todos os estudos', 'Qualidade do sono', 'Pressão arterial', 'Atividade física']} /></div></div>
      <div className="table-scroll coord-table-scroll"><table className="users-table coord-table coord-dashboard-table"><thead><tr><th>Participante</th><th>Estudo</th><th>Data / horário</th><th>Situação</th><th className="coord-th-actions">Ações</th></tr></thead><tbody>
        {visibleVisits.length ? visibleVisits.map((visit) => <tr key={visit.id}><td><PersonCell name={visit.participant} initials={visit.initials} /></td><td>{visit.study}</td><td>{visit.dateTime}</td><td><StatusBadge status={visit.status} /></td><td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => setActiveVisit(visit)}>Editar</button><MoreButton onClick={() => setActiveVisit(visit)} /></div></td></tr>) : <EmptyRow columns={5} message="Nenhuma visita encontrada para os filtros selecionados." />}
      </tbody></table></div>
    </section>
    <section className="table-card coord-panel coord-requests-preview"><h2>Solicitações de reagendamento</h2><div className="table-scroll coord-table-scroll"><table className="users-table coord-table"><tbody><tr><td><PersonCell name="Bianca Oliveira" initials="BO" /></td><td>Visita 03</td><td>26/10/2026 · 08:30</td><td><StatusBadge status="Pendente" /></td><td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => navigate('/coordenador/reagendamentos')}>Analisar</button><MoreButton onClick={() => navigate('/coordenador/reagendamentos')} /></div></td></tr></tbody></table></div></section>
    </div>
    {showNew && <ScheduleVisitModal onClose={closeSchedule} onScheduled={(visit) => { setShowNew(false); setLastScheduled(visit); }} />}
    {activeVisit && <Modal title="Editar visita" description={`${activeVisit.participant} · ${activeVisit.study}`} onClose={() => setActiveVisit(null)}><div className="coord-detail-list"><div><span>Visita</span><strong>{activeVisit.visit}</strong></div><div><span>Data / horário</span><strong>{activeVisit.dateTime}</strong></div><div><span>Situação atual</span><StatusBadge status={activeVisit.status} /></div></div><p className="coord-help-copy">Atualize a situação da visita para refletir o acompanhamento.</p><div className="modal-actions coord-modal-actions coord-wrap-actions"><button type="button" className="button button-outline coord-secondary-button" onClick={() => updateVisit('Aguardando')}>Aguardando</button><button type="button" className="button button-outline coord-secondary-button" onClick={() => updateVisit('Reagendamento')}>Reagendar</button><button type="button" className="button button-primary coord-primary-button" onClick={() => updateVisit('Confirmada')}><Check size={13} /> Confirmar</button></div></Modal>}
  </div>;
}

function candidateDate(value: string) {
  // Preserva a data de calendário enviada pelo servidor, inclusive em timestamps do PostgreSQL.
  return value.slice(0, 10).split('-').reverse().join('/');
}

function CandidatesTable({ state, search, statusFilter, onOpen, onRetry, allStudies }: {
  state: StudyCandidatesState;
  search: string;
  statusFilter: string;
  onOpen: (candidate: Candidate) => void;
  onRetry: () => void;
  allStudies: boolean;
}) {
  const visible = state.status === 'ready' ? state.candidates.filter((candidate) =>
    candidate.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (statusFilter === 'Todos os status' || candidate.status === statusFilter)) : [];
  let feedback: ReactNode;
  if (state.status === 'loading') feedback = <span role="status">Consultando candidatos…</span>;
  else if (state.status === 'error') feedback = <div role="alert"><p>{state.message}</p><button type="button" className="button button-outline coord-secondary-button" onClick={onRetry}>Tentar novamente</button></div>;
  else if (state.status === 'idle') feedback = <span role="status">Aguardando a consulta dos estudos autorizados.</span>;
  else feedback = <span role="status">{state.failures?.length ? 'Nenhum candidato encontrado nos estudos consultados com sucesso. A lista está incompleta.' : state.candidates.length === 0
    ? allStudies ? 'Nenhum candidato cadastrado nos estudos autorizados.' : 'O estudo selecionado não possui candidatos cadastrados.'
    : 'Nenhum candidato encontrado para os filtros selecionados.'}</span>;

  return <div className="table-scroll coord-table-scroll"><table className="users-table coord-table coord-candidates-table" aria-label="Candidatos do estudo" aria-busy={state.status === 'loading'}><thead><tr><th>Pessoa</th><th>Estudo de interesse</th><th>Data de inscrição</th><th>Status</th><th className="coord-candidate-actions">Ações</th></tr></thead><tbody>
    {visible.length ? visible.map((candidate) => <tr key={`${candidate.studyId}:${candidate.id}`}><td><PersonCell name={candidate.name} initials={initials(candidate.name)} /></td><td>{candidate.studyTitle}</td><td>{candidateDate(candidate.enrollmentDate)}</td><td><StatusBadge status={candidate.status} /></td><td className="coord-candidate-actions"><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => onOpen(candidate)}>Detalhes</button></div></td></tr>) : <EmptyRow columns={5} message={feedback} />}
  </tbody></table></div>;
}

export function CoordinatorCandidatesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [showNew, setShowNew] = useState(false);
  const closeRegistration = useCallback(() => setShowNew(false), []);
  const [search, setSearch] = useState('');
  const selectedStudyId = params.get('studyId') ?? '';
  const [notice, setNotice] = useState(Boolean(location.state?.candidateCreated));
  const [statusFilter, setStatusFilter] = useState('Todos os status');
  const [activeCandidate, setActiveCandidate] = useState<Candidate | null>(null);
  const studies = useCandidateListStudies();
  const options = studies.state.status === 'ready' ? studies.state.options : [];
  const studyId = options.some((study) => study.id === selectedStudyId) ? selectedStudyId : '';
  const candidates = useStudyCandidates(studies.state.status === 'ready' ? studyId ? [studyId] : options.map((study) => study.id) : null);
  const setStudyId = (id: string) => setParams((current) => {
    const next = new URLSearchParams(current);
    if (id) next.set('studyId', id);
    else next.delete('studyId');
    return next;
  });
  useEffect(() => {
    if (studies.state.status === 'ready' && selectedStudyId && !options.some((study) => study.id === selectedStudyId)) {
      setParams((current) => { const next = new URLSearchParams(current); next.delete('studyId'); return next; }, { replace: true });
    }
  }, [studies.state, options, selectedStudyId, setParams]);
  useEffect(() => {
    setActiveCandidate(null);
  }, [selectedStudyId]);
  useEffect(() => {
    if (location.state?.candidateCreated) navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location, navigate]);
  const tableState: StudyCandidatesState = candidates.state.status === 'ready'
    ? { ...candidates.state, candidates: candidates.state.candidates.map((candidate) => ({
      ...candidate, studyTitle: options.find((study) => study.id === candidate.studyId)?.title ?? '',
    })) } : studies.state.status === 'loading' ? { status: 'loading' } : candidates.state;
  const studiesLoading = studies.state.status === 'loading';
  const studyPlaceholder = studies.state.status === 'loading' ? 'Carregando estudos…'
    : studies.state.status === 'error' ? 'Falha ao carregar estudos'
      : options.length === 0 ? 'Nenhum estudo disponível' : 'Todos os estudos';

  return <div className="coord-page coord-candidates-page">
    <PageHeader title="Candidatos e participantes" action="Novo candidato" onAction={() => setShowNew(true)} />
    {notice && <div role="status" className="notice">Candidato cadastrado com sucesso!<button type="button" aria-label="Fechar notificação" onClick={() => setNotice(false)}><X size={15} /></button></div>}
    {showNew && <CandidateRegistrationModal onClose={closeRegistration} onCreated={() => {
      setShowNew(false);
      setNotice(true);
      candidates.reload();
    }} />}
    <div className="page-content-offset">
    <section className="table-card coord-panel coord-list-panel">
      <div className="study-list-heading coord-panel-heading"><h2>Lista de candidatos e participantes</h2><div className="study-list-tools coord-table-tools"><SearchField value={search} onChange={setSearch} placeholder="Buscar por nome..." /><FilterSelect value={studyId} onChange={(id) => { setStudyId(id); setActiveCandidate(null); }} label="Filtrar por estudo" disabled={options.length === 0} describedBy={options.length === 0 ? 'candidate-list-study-help candidate-list-study-feedback' : 'candidate-list-study-help'} options={[
        { value: '', label: studyPlaceholder },
        ...options.map((study) => ({ value: study.id, label: options.some((other) => other.id !== study.id && other.title === study.title) ? `${study.title} (${study.id})` : study.title })),
      ]} /><FilterSelect value={statusFilter} onChange={setStatusFilter} label="Filtrar por status" options={['Todos os status', ...CANDIDATE_STATUSES]} />
        <button type="button" className="icon-button coord-refresh-button" aria-label="Atualizar estudos" title="Atualizar estudos" aria-busy={studiesLoading} disabled={studiesLoading} onClick={studies.reload}><RefreshCw className="coord-refresh-icon" size={16} aria-hidden="true" /></button>
      </div></div>
      <p id="candidate-list-study-help" className="coord-help-copy">A seleção exibe apenas estudos em recrutamento. A consulta dos estudos nas demais fases ainda não está disponível para o coordenador.</p>
      {studiesLoading && <p id="candidate-list-study-feedback" role="status" className="coord-help-copy">Carregando estudos…</p>}
      {studies.state.status === 'error' && <p id="candidate-list-study-feedback" role="alert" className="coord-help-copy">Não foi possível carregar os estudos. Use o ícone de atualização para tentar novamente.</p>}
      {studies.state.status === 'ready' && options.length === 0 && <p id="candidate-list-study-feedback" role="status" className="coord-help-copy">Nenhum estudo em recrutamento disponível para seleção. Não foi possível consultar candidatos.</p>}
      {tableState.status === 'ready' && Boolean(tableState.failures?.length) && <div role="alert" className="form-error">
        <p>A lista está incompleta. Não foi possível consultar os candidatos de: {tableState.failures!.map((failure) => options.find((study) => study.id === failure.studyId)?.title ?? failure.studyId).join(', ')}.</p>
        {[...new Set(tableState.failures!.map(({ message }) => message))].map((message) => <p key={message}>{message}</p>)}
        <button type="button" className="button button-outline" onClick={candidates.reload}>Tentar novamente</button>
      </div>}
      <CandidatesTable state={tableState} search={search} statusFilter={statusFilter} onOpen={setActiveCandidate} onRetry={candidates.reload} allStudies={!studyId} />
    </section>
    </div>
    {activeCandidate && <CandidateDetailsModal key={`${activeCandidate.studyId}:${activeCandidate.id}`} candidate={activeCandidate} onClose={() => setActiveCandidate(null)} onRegistered={(assessment) => {
      setActiveCandidate((current) => current?.id === assessment.candidateId && current.studyId === assessment.studyId ? { ...current, status: assessment.status } : current);
      candidates.reload();
    }} onIncluded={(inclusion) => {
      setActiveCandidate((current) => current?.id === inclusion.candidateId && current.studyId === inclusion.studyId ? { ...current, status: 'Incluído' } : current);
      candidates.reload();
    }} />}
  </div>;
}

const SCHEDULE_STUDY_HINT = 'São exibidos apenas estudos em recrutamento. A consulta dos estudos em execução ainda não está disponível para o coordenador.';

function ScheduleVisitModal({ onClose, onScheduled }: { onClose: () => void; onScheduled: (visit: ScheduledVisit) => void }) {
  const studies = useRecruitmentStudies();
  const { request } = useAuth();
  const busy = useRef(false);
  const close = () => { if (!busy.current) onClose(); };
  const loadParticipants = useCallback((studyId: string, signal: AbortSignal) => scheduledVisitsApi.listActiveParticipants(request, studyId, signal), [request]);
  const loadPlannedVisits = useCallback((studyId: string, signal: AbortSignal) => visitsApi.list(request, studyId, signal), [request]);

  return <Modal title="Agendar visita" description="Selecione o participante incluído, a visita prevista e a data do agendamento." onClose={close} wide>
    <ScheduleVisitForm studies={studies} studyHint={SCHEDULE_STUDY_HINT}
      loadParticipants={loadParticipants} loadPlannedVisits={loadPlannedVisits}
      onSchedule={(studyId, input, signal) => scheduledVisitsApi.schedule(request, studyId, input, signal)}
      onScheduled={onScheduled} onCancel={close} onBusyChange={(value) => { busy.current = value; }} />
  </Modal>;
}

function ScheduledVisitNotice({ visit, onClose }: { visit: ScheduledVisit; onClose: () => void }) {
  return <div role="status" className="notice">
    <span>Visita agendada com sucesso! {visit.participantName} · {visit.plannedVisitName} · {formatScheduledAt(visit.scheduledAt)}</span>
    <button type="button" aria-label="Fechar confirmação de agendamento" onClick={onClose}><X size={15} aria-hidden="true" /></button>
  </div>;
}

function VisitStatusModal({ visit, onClose, onUpdated, onStale }: { visit: ScheduledVisit; onClose: () => void; onUpdated: (visit: ScheduledVisit) => void; onStale: () => void }) {
  const { request } = useAuth();
  const busy = useRef(false);
  const close = () => { if (!busy.current) onClose(); };
  const loadResults = useCallback((current: ScheduledVisit, signal: AbortSignal) => scheduledVisitsApi.getResults(request, current, signal), [request]);
  return <Modal title={visit.status === 'Agendada' ? 'Atualizar situação da visita' : 'Detalhes da visita'} description={`${visit.participantName} · ${visit.plannedVisitName}`} onClose={close} wide>
    <VisitStatusForm visit={visit} renderStatus={(status) => <StatusBadge status={status} />}
      onUpdate={(current, input, signal) => scheduledVisitsApi.updateStatus(request, current, input, signal)}
      onUpdated={onUpdated} onStale={onStale} onCancel={close} onBusyChange={(value) => { busy.current = value; }} />
    {/* O Coordenador consulta os resultados (E05); o registro (E06) é exclusivo do Pesquisador proprietário (D-04). */}
    {visit.status !== 'Agendada' && <VisitResultsPanel visit={visit} loadResults={loadResults}
      readOnlyNotice="O registro dos resultados é feito pelo Pesquisador responsável pelo estudo." />}
  </Modal>;
}

const ALL_VISIT_STATUSES = 'Todas as situações';

export function CoordinatorVisitsPage() {
  const [params, setParams] = useSearchParams();
  const studies = useRecruitmentStudies();
  const options = studies.status === 'ready' ? studies.options : [];
  const requestedStudyId = params.get('studyId') ?? '';
  const studyId = options.some((study) => study.id === requestedStudyId) ? requestedStudyId : options[0]?.id ?? '';
  const agenda = useScheduledVisits(studyId);
  const { request } = useAuth();
  const loadAllParticipants = useCallback((id: string, signal: AbortSignal) => scheduledVisitsApi.listParticipants(request, id, signal), [request]);
  const loadHistory = useCallback((id: string, participationId: string, signal: AbortSignal) => scheduledVisitsApi.getHistory(request, id, participationId, signal), [request]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(ALL_VISIT_STATUSES);
  // A visita aberta fica guardada à parte: recarregar a agenda não fecha o formulário nem apaga o erro exibido.
  const [active, setActive] = useState<ScheduledVisit | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeSchedule = useCallback(() => setShowNew(false), []);
  const visits = agenda.state.status === 'ready' ? agenda.state.visits : [];
  const visible = visits.filter((visit) => visit.participantName.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    && (statusFilter === ALL_VISIT_STATUSES || visit.status === statusFilter));
  const count = (status: ScheduledVisitStatus) => agenda.state.status === 'ready' ? String(visits.filter((visit) => visit.status === status).length).padStart(2, '0') : '—';

  function selectStudy(id: string) {
    setActive(null);
    setParams((current) => { const next = new URLSearchParams(current); next.set('studyId', id); return next; }, { replace: true });
  }

  let feedback: ReactNode;
  if (studies.status === 'loading') feedback = <span role="status">Carregando estudos…</span>;
  else if (studies.status === 'error') feedback = <span role="alert">Não foi possível carregar os estudos. Recarregue a página para tentar novamente.</span>;
  else if (!studyId) feedback = <span role="status">Nenhum estudo em recrutamento disponível para consultar a agenda.</span>;
  else if (agenda.state.status === 'loading') feedback = <span role="status">Consultando visitas agendadas…</span>;
  else if (agenda.state.status === 'error') feedback = <div role="alert"><p>{agenda.state.message}</p><button type="button" className="button button-outline coord-secondary-button" onClick={agenda.reload}>Tentar novamente</button></div>;
  else feedback = <span role="status">{visits.length ? 'Nenhuma visita encontrada para os filtros selecionados.' : 'Nenhuma visita agendada neste estudo.'}</span>;

  return <div className="coord-page coord-visits-page">
    <PageHeader title="Visitas e avaliações" action="Agendar visita" onAction={() => { setNotice(null); setShowNew(true); }} />
    {notice && <div role="status" className="notice"><span>{notice}</span><button type="button" aria-label="Fechar notificação" onClick={() => setNotice(null)}><X size={15} aria-hidden="true" /></button></div>}
    <div className="page-content-offset">
    <StatCards items={[{ title: 'Visitas agendadas', value: count('Agendada') }, { title: 'Visitas realizadas', value: count('Realizada') }, { title: 'Ausências e cancelamentos', value: agenda.state.status === 'ready' ? String(visits.filter((visit) => visit.status === 'Ausente' || visit.status === 'Cancelada').length).padStart(2, '0') : '—' }]} />
    <section className="table-card coord-panel coord-list-panel">
      <div className="study-list-heading coord-panel-heading"><h2>Agenda de visitas</h2><div className="study-list-tools coord-table-tools">
        <SearchField value={search} onChange={setSearch} placeholder="Buscar participante..." />
        <FilterSelect value={studyId} onChange={selectStudy} label="Filtrar por estudo" disabled={options.length === 0} describedBy="visits-study-help" options={options.length
          ? options.map((study) => ({ value: study.id, label: options.some((other) => other.id !== study.id && other.title === study.title) ? `${study.title} (${study.id})` : study.title }))
          : [{ value: '', label: studies.status === 'loading' ? 'Carregando estudos…' : 'Nenhum estudo disponível' }]} />
        <FilterSelect value={statusFilter} onChange={setStatusFilter} label="Filtrar por situação" options={[ALL_VISIT_STATUSES, ...SCHEDULED_VISIT_STATUSES]} />
        <button type="button" className="icon-button coord-refresh-button" aria-label="Atualizar agenda" title="Atualizar agenda" disabled={!studyId || agenda.state.status === 'loading'} onClick={agenda.reload}><RefreshCw className="coord-refresh-icon" size={16} aria-hidden="true" /></button>
      </div></div>
      <p id="visits-study-help" className="coord-help-copy">{SCHEDULE_STUDY_HINT}</p>
      <div className="table-scroll coord-table-scroll"><table className="users-table coord-table coord-visits-table" aria-label="Agenda de visitas" aria-busy={agenda.state.status === 'loading'}><thead><tr><th>Participante</th><th>Visita prevista</th><th>Data / horário</th><th>Situação</th><th className="coord-th-actions">Ações</th></tr></thead><tbody>
        {visible.length ? visible.map((visit) => <tr key={visit.id}>
          <td><PersonCell name={visit.participantName} initials={initials(visit.participantName)} /></td>
          <td>{`${visit.plannedVisitOrder}. ${visit.plannedVisitName}`}</td>
          <td><time dateTime={visit.scheduledAt}>{formatScheduledAt(visit.scheduledAt)}</time></td>
          <td><StatusBadge status={visit.status} /></td>
          <td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => setActive(visit)}>{visit.status === 'Agendada' ? 'Atualizar situação' : 'Detalhes'}</button></div></td>
        </tr>) : <EmptyRow columns={5} message={feedback} />}
      </tbody></table></div>
    </section>
    <section className="table-card coord-panel coord-list-panel coord-history-panel" aria-labelledby="coord-history-title">
      <div className="study-list-heading coord-panel-heading"><h2 id="coord-history-title">Histórico por participante</h2></div>
      <p className="coord-help-copy">Visitas, datas, situações e resultados registrados do participante no estudo selecionado acima, em ordem cronológica.</p>
      <ParticipantHistoryPanel studyId={studyId} loadParticipants={loadAllParticipants} loadHistory={loadHistory} renderStatus={(status) => <StatusBadge status={status} />} />
    </section>
    </div>
    {showNew && <ScheduleVisitModal onClose={closeSchedule} onScheduled={(visit) => {
      setShowNew(false);
      setNotice(`Visita agendada com sucesso! ${visit.participantName} · ${visit.plannedVisitName} · ${formatScheduledAt(visit.scheduledAt)}`);
      // Mostra o estudo do novo agendamento, já com a agenda consultada de novo na API.
      if (visit.studyId === studyId) agenda.reload(); else selectStudy(visit.studyId);
    }} />}
    {active && <VisitStatusModal key={active.id} visit={active} onClose={() => setActive(null)} onStale={agenda.reload} onUpdated={(visit) => {
      agenda.replace(visit);
      setActive(null);
      setNotice(`Situação atualizada para “${visit.status}”: ${visit.participantName} · ${visit.plannedVisitName}.`);
    }} />}
  </div>;
}

export function CoordinatorReschedulesPage() {
  const [requests, setRequests] = useState(initialRequests);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todas as situações');
  const [active, setActive] = useState<RequestRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [participant, setParticipant] = useState('');
  const [studyVisit, setStudyVisit] = useState('Qualidade do sono · Visita 03');
  const [requestedDate, setRequestedDate] = useState('2026-10-29T09:00');
  const [reason, setReason] = useState('Indisponibilidade');
  const visible = requests.filter((request) => request.participant.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'Todas as situações' || request.status === statusFilter));

  function addRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = participant.trim();
    if (!name) return;
    const date = new Date(requestedDate);
    const dateLabel = `${date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · ${requestedDate.slice(11, 16)}`;
    setRequests((current) => [{ id: Date.now(), participant: name, initials: initialsFormName(name), studyVisit, requestedDate: dateLabel, reason, status: 'Pendente' }, ...current]);
    setParticipant('');
    setShowNew(false);
  }

  function setRequestStatus(status: RequestStatus) {
    if (!active) return;
    setRequests((current) => current.map((request) => request.id === active.id ? { ...request, status } : request));
    setActive(null);
  }

  const pending = requests.filter((item) => item.status === 'Pendente').length;
  const approved = requests.filter((item) => item.status === 'Aprovada').length;
  const rejected = requests.filter((item) => item.status === 'Recusada').length;

  return <div className="coord-page coord-reschedules-page">
    <PageHeader title="Reagendamentos" action="Registrar solicitação" onAction={() => setShowNew(true)} />
    <div className="page-content-offset">
    <StatCards items={[{ title: 'Solicitações pendentes', value: String(pending).padStart(2, '0') }, { title: 'Aprovadas este mês', value: String(approved + 6).padStart(2, '0') }, { title: 'Recusadas este mês', value: String(rejected).padStart(2, '0') }]} />
    <section className="table-card coord-panel coord-list-panel">
      <div className="study-list-heading coord-panel-heading"><h2>Solicitações de reagendamento</h2><div className="study-list-tools coord-table-tools"><SearchField value={search} onChange={setSearch} placeholder="Buscar participante..." /><FilterSelect value={statusFilter} onChange={setStatusFilter} label="Filtrar situação" options={['Todas as situações', 'Pendente', 'Aprovada', 'Recusada']} /></div></div>
      <div className="table-scroll coord-table-scroll"><table className="users-table coord-table coord-reschedules-table"><thead><tr><th>Participante</th><th>Estudo / visita</th><th>Data solicitada</th><th>Motivo</th><th>Situação</th><th className="coord-th-actions">Ações</th></tr></thead><tbody>
        {visible.length ? visible.map((request) => <tr key={request.id}><td><PersonCell name={request.participant} initials={request.initials} /></td><td>{request.studyVisit}</td><td>{request.requestedDate}</td><td>{request.reason}</td><td><StatusBadge status={request.status} /></td><td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => setActive(request)}>Analisar</button><MoreButton onClick={() => setActive(request)} /></div></td></tr>) : <EmptyRow columns={6} message="Nenhuma solicitação encontrada." />}
      </tbody></table></div>
    </section>
    </div>
    {showNew && <Modal title="Registrar solicitação" description="Registre uma solicitação de reagendamento para análise." onClose={() => setShowNew(false)}><form className="coord-form" onSubmit={addRequest}><Field label="Participante" wide><input required value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="Nome do participante" /></Field><Field label="Estudo / visita" wide><select value={studyVisit} onChange={(event) => setStudyVisit(event.target.value)}><option>Qualidade do sono · Visita 03</option><option>Qualidade do sono · Visita 04</option><option>Pressão arterial · Avaliação inicial</option><option>Atividade física · Visita 02</option></select></Field><Field label="Nova data e horário" wide><input type="datetime-local" required value={requestedDate} onChange={(event) => setRequestedDate(event.target.value)} /></Field><Field label="Motivo" wide><select value={reason} onChange={(event) => setReason(event.target.value)}><option>Indisponibilidade</option><option>Conflito de horário</option><option>Solicitação do participante</option><option>Ajuste de agenda</option><option>Compromisso pessoal</option></select></Field><div className="modal-actions coord-modal-actions"><button type="button" className="button button-outline coord-secondary-button" onClick={() => setShowNew(false)}>Cancelar</button><button className="button button-primary coord-primary-button" type="submit"><Plus size={13} /> Registrar solicitação</button></div></form></Modal>}
    {active && <Modal title="Analisar reagendamento" description={`${active.participant} · ${active.studyVisit}`} onClose={() => setActive(null)}><div className="coord-detail-list"><div><span>Data solicitada</span><strong>{active.requestedDate}</strong></div><div><span>Motivo</span><strong>{active.reason}</strong></div><div><span>Situação atual</span><StatusBadge status={active.status} /></div></div><p className="coord-help-copy">A decisão será refletida na situação desta solicitação.</p><div className="modal-actions coord-modal-actions coord-wrap-actions"><button type="button" className="button coord-danger-button" onClick={() => setRequestStatus('Recusada')}>Recusar</button><button type="button" className="button button-primary coord-primary-button" onClick={() => setRequestStatus('Aprovada')}><Check size={13} /> Aprovar solicitação</button></div></Modal>}
  </div>;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';')).join('\r\n');
  const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function CoordinatorReportsPage() {
  const studies = useMemo(
    () => [
      { name: 'Qualidade do sono', progress: 60 },
      { name: 'Pressão arterial', progress: 44 },
      { name: 'Atividade física', progress: 25 },
    ],
    [],
  );

  const reportRows: {
    title: string;
    description: string;
    rows: string[][] | null;
  }[] = [
    {
      title: 'Resumo dos estudos',
      description: 'Indicadores gerais, status e progresso dos estudos.',
      rows: [
        ['Estudo', 'Progresso'],
        ['Qualidade do sono', '60%'],
        ['Pressão arterial', '44%'],
        ['Atividade física', '25%'],
      ],
    },
    {
      title: 'Histórico de visitas',
      description: 'Visitas realizadas, pendentes, canceladas e reagendadas.',
      rows: [
        ['Participante', 'Estudo', 'Data', 'Situação'],
        ...initialVisits.map((visit) => [
          visit.participant,
          visit.study,
          visit.dateTime,
          visit.status,
        ]),
      ],
    },
    {
      title: 'Participantes e elegibilidade',
      description: 'Relatório indisponível enquanto a consulta de candidatos não estiver integrada.',
      rows: null,
    },
  ];

  function exportAll() {
    downloadCsv('clinicalstudypb-relatorio-coordenador.csv', [
      ['Relatório', 'Valor'],
      ['Estudos acompanhados', '03'],
      ['Participantes vinculados', '18'],
      ['Visitas concluídas', '26'],
      [],
      ['Estudo', 'Progresso'],
      ...studies.map((study) => [study.name, `${study.progress}%`]),
    ]);
  }

  const reportSlugs = [
    'resumo-estudos',
    'historico-visitas',
    'participantes-elegibilidade',
  ];

  return (
    <div className="coord-page coord-reports-page">
      <div className="coord-page-heading">
        <h1>Relatórios</h1>
        <button
          type="button"
          className="button button-primary coord-primary-button"
          onClick={exportAll}
        >
          <Download size={13} /> Exportar relatório
        </button>
      </div>

      <StatCards
        items={[
          { title: 'Estudos acompanhados', value: '03' },
          { title: 'Participantes vinculados', value: '18' },
          { title: 'Visitas concluídas', value: '26' },
        ]}
      />

      <div className="coord-report-summary-grid">
        <section className="table-card coord-panel coord-progress-panel">
          <h2>Acompanhamento dos estudos</h2>
          <p className="coord-panel-subtitle">
            Progresso das atividades por estudo
          </p>

          <div className="coord-progress-list">
            {studies.map((study) => (
              <div className="coord-progress-item" key={study.name}>
                <div>
                  <strong>{study.name}</strong>
                  <b>{study.progress}%</b>
                </div>
                <div className="study-progress-track coord-progress-track">
                  <span style={{ width: `${study.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="table-card coord-panel coord-participants-panel">
          <h2>Resumo de participantes</h2>
          <div className="coord-summary-row">
            <span>Ativos</span>
            <strong>18</strong>
          </div>
          <div className="coord-summary-row">
            <span>Em triagem</span>
            <strong>04</strong>
          </div>
          <div className="coord-summary-row">
            <span>Concluíram participação</span>
            <strong>06</strong>
          </div>
          <div className="coord-summary-row">
            <span>Retiradas registradas</span>
            <strong>01</strong>
          </div>
        </section>
      </div>

      <section className="table-card coord-panel coord-available-reports">
        <h2>Relatórios disponíveis</h2>
        <p className="coord-panel-subtitle">
          Selecione um tipo de relatório para consultar ou exportar os dados.
        </p>

        {reportRows.map((report, index) => (
          <div className="coord-report-row" key={report.title}>
            <div>
              <strong>{report.title}</strong>
              <span>{report.description}</span>
            </div>
            <button
              type="button"
              className="button button-outline coord-secondary-button"
              disabled={report.rows === null}
              onClick={() =>
                report.rows &&
                downloadCsv(
                  `clinicalstudypb-${reportSlugs[index]}.csv`,
                  report.rows,
                )
              }
            >
              <FileText size={12} /> Gerar
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
