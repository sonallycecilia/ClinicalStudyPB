import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Download,
  FileText,
  MoreVertical,
  Plus,
  Search,
  X,
} from 'lucide-react';

type VisitStatus = 'Confirmada' | 'Aguardando' | 'Reagendamento' | 'Concluída';
type CandidateStatus = 'Pendente de avaliação' | 'Participante ativo' | 'Consentimento pendente' | 'Não elegível';
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

interface CandidateRow {
  id: number;
  name: string;
  initials: string;
  study: string;
  enrollmentDate: string;
  status: CandidateStatus;
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

const initialCandidates: CandidateRow[] = [
  { id: 1, name: 'Mariana Alves', initials: 'MA', study: 'Qualidade do sono', enrollmentDate: '20/10/2026', status: 'Pendente de avaliação' },
  { id: 2, name: 'Pedro Santos', initials: 'PS', study: 'Pressão arterial', enrollmentDate: '19/10/2026', status: 'Pendente de avaliação' },
  { id: 3, name: 'Bianca Oliveira', initials: 'BO', study: 'Qualidade do sono', enrollmentDate: '18/10/2026', status: 'Participante ativo' },
  { id: 4, name: 'Lucas Martins', initials: 'LM', study: 'Atividade física', enrollmentDate: '16/10/2026', status: 'Consentimento pendente' },
  { id: 5, name: 'Carla Mendes', initials: 'CM', study: 'Pressão arterial', enrollmentDate: '14/10/2026', status: 'Participante ativo' },
  { id: 6, name: 'João Pedro', initials: 'JP', study: 'Qualidade do sono', enrollmentDate: '12/10/2026', status: 'Não elegível' },
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

function StatusBadge({ status }: { status: VisitStatus | CandidateStatus | RequestStatus }) {
  const tone = status === 'Confirmada' || status === 'Participante ativo' || status === 'Aprovada'
    ? 'success'
    : status === 'Aguardando' || status === 'Pendente de avaliação' || status === 'Pendente'
      ? 'warning'
      : status === 'Reagendamento' || status === 'Consentimento pendente'
        ? 'purple'
        : status === 'Recusada'
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

function FilterSelect({ value, onChange, options, label }: { value: string; onChange: (value: string) => void; options: string[]; label: string }) {
  return <label className="study-filter coord-filter"><span className="sr-only">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={11} /></label>;
}

function PersonCell({ name, initials: badge }: { name: string; initials: string }) {
  return <div className="user-cell coord-person"><span className="avatar coord-avatar">{badge}</span><strong>{name}</strong></div>;
}

function MoreButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="icon-button coord-more-button" onClick={onClick} aria-label="Mais ações"><MoreVertical size={14} /></button>;
}

function EmptyRow({ columns, message }: { columns: number; message: string }) {
  return <tr><td colSpan={columns} className="coord-empty-row">{message}</td></tr>;
}

function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return <div className="modal-backdrop coord-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`user-modal coord-modal${wide ? ' coord-modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="coord-modal-title">
      <header className="coord-modal-header"><div><h2 id="coord-modal-title">{title}</h2>{description && <p>{description}</p>}</div><button type="button" className="icon-button coord-icon-button" onClick={onClose} aria-label="Fechar"><X size={17} /></button></header>
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

export function CoordinatorDashboardPage() {
  const [visits, setVisits] = useState(initialVisits);
  const [search, setSearch] = useState('');
  const [studyFilter, setStudyFilter] = useState('Todos os estudos');
  const [activeVisit, setActiveVisit] = useState<VisitRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newParticipant, setNewParticipant] = useState('');
  const [newStudy, setNewStudy] = useState('Qualidade do sono');
  const [newDateTime, setNewDateTime] = useState('2026-10-29T09:00');
  const navigate = useNavigate();
  const visibleVisits = visits.filter((visit) => visit.participant.toLowerCase().includes(search.toLowerCase()) && (studyFilter === 'Todos os estudos' || visit.study === studyFilter));

  function addVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const participant = newParticipant.trim();
    if (!participant) return;
    const date = new Date(newDateTime);
    const dateTime = `${date.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · ${newDateTime.slice(11, 16)}`;
    setVisits((current) => [...current, { id: Date.now(), participant, initials: initialsFormName(participant), study: newStudy, visit: 'Nova visita', dateTime, status: 'Aguardando' }]);
    setNewParticipant('');
    setShowNew(false);
  }

  function updateVisit(status: VisitStatus) {
    if (!activeVisit) return;
    setVisits((current) => current.map((visit) => visit.id === activeVisit.id ? { ...visit, status } : visit));
    setActiveVisit(null);
  }

  return <div className="coord-page coord-dashboard-page">
    <PageHeader title="Coordenar Estudos Clínicos" action="Novo registro" onAction={() => setShowNew(true)} />
    <div className="page-content-offset">
    <StatCards items={[{ title: 'Candidatos pendentes', value: '04', note: 'para avaliar' }, { title: 'Participantes ativos', value: '18' }, { title: 'Visitas esta semana', value: '12' }, { title: 'Reagendamentos', value: '03 pendentes' }]} />
    <section className="table-card coord-panel coord-upcoming-panel">
      <div className="study-list-heading coord-panel-heading"><h2>Próximas visitas</h2><div className="study-list-tools coord-table-tools"><SearchField value={search} onChange={setSearch} placeholder="Buscar participante..." /><FilterSelect value={studyFilter} onChange={setStudyFilter} label="Filtrar por estudo" options={['Todos os estudos', 'Qualidade do sono', 'Pressão arterial', 'Atividade física']} /></div></div>
      <div className="table-scroll coord-table-scroll"><table className="users-table coord-table coord-dashboard-table"><thead><tr><th>Participante</th><th>Estudo</th><th>Data / horário</th><th>Situação</th><th className="coord-th-actions">Ações</th></tr></thead><tbody>
        {visibleVisits.length ? visibleVisits.map((visit) => <tr key={visit.id}><td><PersonCell name={visit.participant} initials={visit.initials} /></td><td>{visit.study}</td><td>{visit.dateTime}</td><td><StatusBadge status={visit.status} /></td><td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => setActiveVisit(visit)}>Editar</button><MoreButton onClick={() => setActiveVisit(visit)} /></div></td></tr>) : <EmptyRow columns={5} message="Nenhuma visita encontrada para os filtros selecionados." />}
      </tbody></table></div>
    </section>
    <section className="table-card coord-panel coord-requests-preview"><h2>Solicitações de reagendamento</h2><div className="table-scroll coord-table-scroll"><table className="users-table coord-table"><tbody><tr><td><PersonCell name="Bianca Oliveira" initials="BO" /></td><td>Visita 03</td><td>26/10/2026 · 08:30</td><td><StatusBadge status="Pendente" /></td><td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => navigate('/coordenador/reagendamentos')}>Analisar</button><MoreButton onClick={() => navigate('/coordenador/reagendamentos')} /></div></td></tr></tbody></table></div></section>
    </div>
    {showNew && <Modal title="Novo registro de visita" description="Adicione uma visita à agenda do coordenador." onClose={() => setShowNew(false)}><form className="coord-form" onSubmit={addVisit}><Field label="Participante"><input required value={newParticipant} onChange={(event) => setNewParticipant(event.target.value)} placeholder="Nome do participante" /></Field><Field label="Estudo"><select value={newStudy} onChange={(event) => setNewStudy(event.target.value)}><option>Qualidade do sono</option><option>Pressão arterial</option><option>Atividade física</option></select></Field><Field label="Data e horário" wide><input required type="datetime-local" value={newDateTime} onChange={(event) => setNewDateTime(event.target.value)} /></Field><div className="modal-actions coord-modal-actions"><button type="button" className="button button-outline coord-secondary-button" onClick={() => setShowNew(false)}>Cancelar</button><button className="button button-primary coord-primary-button" type="submit"><Plus size={13} /> Registrar visita</button></div></form></Modal>}
    {activeVisit && <Modal title="Editar visita" description={`${activeVisit.participant} · ${activeVisit.study}`} onClose={() => setActiveVisit(null)}><div className="coord-detail-list"><div><span>Visita</span><strong>{activeVisit.visit}</strong></div><div><span>Data / horário</span><strong>{activeVisit.dateTime}</strong></div><div><span>Situação atual</span><StatusBadge status={activeVisit.status} /></div></div><p className="coord-help-copy">Atualize a situação da visita para refletir o acompanhamento.</p><div className="modal-actions coord-modal-actions coord-wrap-actions"><button type="button" className="button button-outline coord-secondary-button" onClick={() => updateVisit('Aguardando')}>Aguardando</button><button type="button" className="button button-outline coord-secondary-button" onClick={() => updateVisit('Reagendamento')}>Reagendar</button><button type="button" className="button button-primary coord-primary-button" onClick={() => updateVisit('Confirmada')}><Check size={13} /> Confirmar</button></div></Modal>}
  </div>;
}

export function CoordinatorCandidatesPage() {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos os status');
  const [activeCandidate, setActiveCandidate] = useState<CandidateRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [study, setStudy] = useState('Qualidade do sono');
  const visible = candidates.filter((candidate) => candidate.name.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'Todos os status' || candidate.status === statusFilter));

  function addCandidate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidateName = name.trim();
    if (!candidateName) return;
    setCandidates((current) => [...current, { id: Date.now(), name: candidateName, initials: initialsFormName(candidateName), study, enrollmentDate: new Date().toLocaleDateString('pt-BR'), status: 'Pendente de avaliação' }]);
    setName('');
    setShowNew(false);
  }

  function setCandidateStatus(status: CandidateStatus) {
    if (!activeCandidate) return;
    setCandidates((current) => current.map((candidate) => candidate.id === activeCandidate.id ? { ...candidate, status } : candidate));
    setActiveCandidate(null);
  }

  return <div className="coord-page coord-candidates-page">
    <PageHeader title="Candidatos e participantes" action="Novo candidato" onAction={() => setShowNew(true)} />
    <div className="page-content-offset">
    <StatCards items={[{ title: 'Candidatos para avaliar', value: String(candidates.filter((item) => item.status === 'Pendente de avaliação').length + 2).padStart(2, '0') }, { title: 'Participantes ativos', value: String(candidates.filter((item) => item.status === 'Participante ativo').length + 16).padStart(2, '0') }, { title: 'Inscrições este mês', value: '07' }]} />
    <section className="table-card coord-panel coord-list-panel">
      <div className="study-list-heading coord-panel-heading"><h2>Lista de candidatos e participantes</h2><div className="study-list-tools coord-table-tools"><SearchField value={search} onChange={setSearch} placeholder="Buscar por nome..." /><FilterSelect value={statusFilter} onChange={setStatusFilter} label="Filtrar por status" options={['Todos os status', 'Pendente de avaliação', 'Participante ativo', 'Consentimento pendente', 'Não elegível']} /></div></div>
      <div className="table-scroll coord-table-scroll"><table className="users-table coord-table coord-candidates-table"><thead><tr><th>Pessoa</th><th>Estudo de interesse</th><th>Data de inscrição</th><th>Status</th><th className="coord-th-actions">Ações</th></tr></thead><tbody>
        {visible.length ? visible.map((candidate) => <tr key={candidate.id}><td><PersonCell name={candidate.name} initials={candidate.initials} /></td><td>{candidate.study}</td><td>{candidate.enrollmentDate}</td><td><StatusBadge status={candidate.status} /></td><td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => setActiveCandidate(candidate)}>Abrir</button><MoreButton onClick={() => setActiveCandidate(candidate)} /></div></td></tr>) : <EmptyRow columns={5} message="Nenhum candidato encontrado." />}
      </tbody></table></div>
    </section>
    </div>
    {showNew && <Modal title="Novo candidato" description="Cadastre um candidato para acompanhar sua elegibilidade." onClose={() => setShowNew(false)}><form className="coord-form" onSubmit={addCandidate}><Field label="Nome completo" wide><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do candidato" /></Field><Field label="Estudo de interesse" wide><select value={study} onChange={(event) => setStudy(event.target.value)}><option>Qualidade do sono</option><option>Pressão arterial</option><option>Atividade física</option></select></Field><div className="modal-actions coord-modal-actions"><button type="button" className="button button-outline coord-secondary-button" onClick={() => setShowNew(false)}>Cancelar</button><button className="button button-primary coord-primary-button" type="submit"><Plus size={13} /> Cadastrar candidato</button></div></form></Modal>}
    {activeCandidate && <Modal title="Detalhes do candidato" description={activeCandidate.name} onClose={() => setActiveCandidate(null)}><div className="coord-detail-list"><div><span>Estudo de interesse</span><strong>{activeCandidate.study}</strong></div><div><span>Data de inscrição</span><strong>{activeCandidate.enrollmentDate}</strong></div><div><span>Status atual</span><StatusBadge status={activeCandidate.status} /></div></div><p className="coord-help-copy">Altere o status conforme o avanço do processo de elegibilidade e consentimento.</p><div className="modal-actions coord-modal-actions coord-wrap-actions"><button type="button" className="button button-outline coord-secondary-button" onClick={() => setCandidateStatus('Pendente de avaliação')}>Pendente</button><button type="button" className="button button-outline coord-secondary-button" onClick={() => setCandidateStatus('Consentimento pendente')}>Consentimento</button><button type="button" className="button button-primary coord-primary-button" onClick={() => setCandidateStatus('Participante ativo')}><Check size={13} /> Tornar ativo</button><button type="button" className="button coord-danger-button" onClick={() => setCandidateStatus('Não elegível')}>Não elegível</button></div></Modal>}
  </div>;
}

export function CoordinatorVisitsPage() {
  const [visits, setVisits] = useState<VisitRow[]>([
    { id: 11, participant: 'Bianca Oliveira', initials: 'BO', study: 'Qualidade do sono', visit: 'Visita 03', dateTime: '24/10/2026 · 09:00', status: 'Confirmada' },
    { id: 12, participant: 'Lucas Martins', initials: 'LM', study: 'Pressão arterial', visit: 'Avaliação inicial', dateTime: '24/10/2026 · 10:30', status: 'Aguardando' },
    { id: 13, participant: 'Carla Mendes', initials: 'CM', study: 'Atividade física', visit: 'Visita 02', dateTime: '25/10/2026 · 14:00', status: 'Confirmada' },
    { id: 14, participant: 'João Pedro', initials: 'JP', study: 'Qualidade do sono', visit: 'Visita 04', dateTime: '26/10/2026 · 08:30', status: 'Reagendamento' },
    { id: 15, participant: 'Mariana Alves', initials: 'MA', study: 'Pressão arterial', visit: 'Avaliação inicial', dateTime: '27/10/2026 · 11:00', status: 'Aguardando' },
    { id: 16, participant: 'Ana Maria', initials: 'AS', study: 'Atividade física', visit: 'Visita 05', dateTime: '28/10/2026 · 15:30', status: 'Concluída' },
  ]);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('Próximos 30 dias');
  const [active, setActive] = useState<VisitRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [participant, setParticipant] = useState('');
  const [study, setStudy] = useState('Qualidade do sono');
  const [dateTime, setDateTime] = useState('2026-10-29T09:00');
  const visible = visits.filter((visit) => visit.participant.toLowerCase().includes(search.toLowerCase()));

  function addVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const participantName = participant.trim();
    if (!participantName) return;
    const value = new Date(dateTime);
    const formatted = `${value.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} · ${dateTime.slice(11, 16)}`;
    setVisits((current) => [...current, { id: Date.now(), participant: participantName, initials: initialsFormName(participantName), study, visit: 'Nova visita', dateTime: formatted, status: 'Aguardando' }]);
    setParticipant('');
    setShowNew(false);
  }

  function update(status: VisitStatus) {
    if (!active) return;
    setVisits((current) => current.map((visit) => visit.id === active.id ? { ...visit, status } : visit));
    setActive(null);
  }

  return <div className="coord-page coord-visits-page">
    <PageHeader title="Visitas e avaliações" action="Agendar visita" onAction={() => setShowNew(true)} />
    <div className="page-content-offset">
    <StatCards items={[{ title: 'Visitas agendadas', value: '12', note: 'esta semana' }, { title: 'Aguardando confirmação', value: '03' }, { title: 'Avaliações concluídas', value: '26' }]} />
    <section className="table-card coord-panel coord-list-panel">
      <div className="study-list-heading coord-panel-heading"><h2>Agenda de visitas</h2><div className="study-list-tools coord-table-tools"><SearchField value={search} onChange={setSearch} placeholder="Buscar participante..." /><FilterSelect value={range} onChange={setRange} label="Período" options={['Próximos 30 dias', 'Esta semana', 'Todas as visitas']} /></div></div>
      <div className="table-scroll coord-table-scroll"><table className="users-table coord-table coord-visits-table"><thead><tr><th>Participante</th><th>Estudo</th><th>Visita</th><th>Data / horário</th><th>Situação</th><th className="coord-th-actions">Ações</th></tr></thead><tbody>
        {visible.length ? visible.map((visit) => <tr key={visit.id}><td><PersonCell name={visit.participant} initials={visit.initials} /></td><td>{visit.study}</td><td>{visit.visit}</td><td>{visit.dateTime}</td><td><StatusBadge status={visit.status} /></td><td><div className="coord-row-actions"><button type="button" className="coord-text-action" onClick={() => setActive(visit)}>Editar</button><MoreButton onClick={() => setActive(visit)} /></div></td></tr>) : <EmptyRow columns={6} message="Nenhuma visita encontrada." />}
      </tbody></table></div>
    </section>
    </div>
    {showNew && <Modal title="Agendar visita" description="Informe os dados básicos para criar um agendamento." onClose={() => setShowNew(false)}><form className="coord-form" onSubmit={addVisit}><Field label="Participante"><input required value={participant} onChange={(event) => setParticipant(event.target.value)} placeholder="Nome do participante" /></Field><Field label="Estudo"><select value={study} onChange={(event) => setStudy(event.target.value)}><option>Qualidade do sono</option><option>Pressão arterial</option><option>Atividade física</option></select></Field><Field label="Data e horário" wide><input required type="datetime-local" value={dateTime} onChange={(event) => setDateTime(event.target.value)} /></Field><div className="modal-actions coord-modal-actions"><button type="button" className="button button-outline coord-secondary-button" onClick={() => setShowNew(false)}>Cancelar</button><button className="button button-primary coord-primary-button" type="submit"><CalendarDays size={13} /> Agendar visita</button></div></form></Modal>}
    {active && <Modal title="Atualizar visita" description={`${active.participant} · ${active.visit}`} onClose={() => setActive(null)}><div className="coord-detail-list"><div><span>Estudo</span><strong>{active.study}</strong></div><div><span>Data / horário</span><strong>{active.dateTime}</strong></div><div><span>Situação</span><StatusBadge status={active.status} /></div></div><div className="modal-actions coord-modal-actions coord-wrap-actions"><button className="button button-outline coord-secondary-button" type="button" onClick={() => update('Aguardando')}>Aguardando</button><button className="button button-outline coord-secondary-button" type="button" onClick={() => update('Reagendamento')}>Reagendar</button><button className="button button-outline coord-secondary-button" type="button" onClick={() => update('Concluída')}>Concluir</button><button className="button button-primary coord-primary-button" type="button" onClick={() => update('Confirmada')}><Check size={13} /> Confirmar</button></div></Modal>}
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
    rows: string[][];
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
      description: 'Candidatos avaliados, incluídos e situação de consentimento.',
      rows: [
        ['Participante', 'Estudo de interesse', 'Data de inscrição', 'Status'],
        ...initialCandidates.map((candidate) => [
          candidate.name,
          candidate.study,
          candidate.enrollmentDate,
          candidate.status,
        ]),
      ],
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
              onClick={() =>
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
