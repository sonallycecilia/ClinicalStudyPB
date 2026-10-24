import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, ArrowLeft, CalendarDays, ChevronDown, CircleCheck,
  Eye, HeartPulse, MoreVertical, Moon, Pencil, Search, UsersRound,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { listLocalUsers } from '../auth/localUsers';

type StudyStatus = 'Em andamento' | 'Planejado';
type StudyKind = 'Estudo observacional' | 'Estudo longitudinal';

interface Study {
  id: string;
  code: string;
  title: string;
  objective: string;
  researcher: string;
  startDate: string;
  endDate: string;
  participantLimit: number;
  participantsLinked: number;
  status: StudyStatus;
  kind: StudyKind;
  symbol: 'moon' | 'heart' | 'activity';
}

interface StudyForm {
  title: string;
  objective: string;
  researcher: string;
  startDate: string;
  endDate: string;
  participantLimit: string;
  participantsLinked: string;
}

type ViewMode = 'list' | 'detail';
type DialogMode = 'create' | 'edit' | 'success' | null;

const STUDIES_STORAGE_KEY = 'clinicalstudy.demo-studies';
const STUDY_STATS_STORAGE_KEY = 'clinicalstudy.demo-study-stats';
const EMPTY_FORM: StudyForm = {
  title: '', objective: '', researcher: '', startDate: '', endDate: '',
  participantLimit: '', participantsLinked: '',
};

const INITIAL_STUDIES: Study[] = [
  {
    id: 'study-1', code: 'EST-001', title: 'Qualidade do sono',
    objective: 'Investigar padrões de sono e acompanhar indicadores da qualidade do sono dos participantes.',
    researcher: 'Marina Costa', startDate: '2026-04-01', endDate: '2026-11-28',
    participantLimit: 30, participantsLinked: 18, status: 'Em andamento',
    kind: 'Estudo observacional', symbol: 'moon',
  },
  {
    id: 'study-2', code: 'EST-002', title: 'Acomp. da pressão arterial',
    objective: 'Acompanhar indicadores de pressão arterial e observar alterações ao longo do período do estudo.',
    researcher: 'Marina Costa', startDate: '2026-05-06', endDate: '2026-12-30',
    participantLimit: 25, participantsLinked: 11, status: 'Em andamento',
    kind: 'Estudo longitudinal', symbol: 'heart',
  },
  {
    id: 'study-3', code: 'EST-003', title: 'Hábitos de atividade física',
    objective: 'Avaliar hábitos de atividade física e acompanhar padrões de atividade ao longo do período.',
    researcher: 'Marina Costa', startDate: '2027-01-11', endDate: '2027-06-30',
    participantLimit: 20, participantsLinked: 0, status: 'Planejado',
    kind: 'Estudo observacional', symbol: 'activity',
  },
 ];

function loadStudies(): Study[] {
  try {
    const raw = localStorage.getItem(STUDIES_STORAGE_KEY);
    if (!raw) return INITIAL_STUDIES;
    const parsed = JSON.parse(raw) as Study[];
    return Array.isArray(parsed) ? parsed : INITIAL_STUDIES;
  } catch {
    return INITIAL_STUDIES;
  }
 }

function loadStudyStats(): { total: number; inProgress: number; planned: number } {
  try {
    const raw = localStorage.getItem(STUDY_STATS_STORAGE_KEY);
    if (!raw) return { total: 5, inProgress: 2, planned: 1 };
    const value = JSON.parse(raw) as { total?: number; inProgress?: number; planned?: number };
    return { total: value.total ?? 5, inProgress: value.inProgress ?? 2, planned: value.planned ?? 1 };
  } catch {
    return { total: 5, inProgress: 2, planned: 1 };
  }
}

function todayISO(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
 }

function statusFromStartDate(startDate: string): StudyStatus {
  return startDate && startDate > todayISO() ? 'Planejado' : 'Em andamento';
 }

function toForm(study: Study): StudyForm {
  return {
    title: study.title,
    objective: study.objective,
    researcher: study.researcher,
    startDate: study.startDate,
    endDate: study.endDate,
    participantLimit: String(study.participantLimit),
    participantsLinked: String(study.participantsLinked),
  };
 }

function dateBR(value: string): string {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
 }

function dateRange(study: Study): string {
  const [, startMonth, startDay] = study.startDate.split('-');
  const [, endMonth, endDay] = study.endDate.split('-');
  const year = study.endDate.slice(0, 4);
  return `${startDay}/${startMonth} – ${endDay}/${endMonth}/${year}`;
 }

function progressFor(study: Study): number {
  return study.participantLimit > 0
    ? Math.min(100, Math.round((study.participantsLinked / study.participantLimit) * 100))
    : 0;
 }

function studyIcon(symbol: Study['symbol'], size = 18): ReactNode {
  const common = { size, strokeWidth: 2 };
  if (symbol === 'moon') return <Moon {...common} />;
  if (symbol === 'heart') return <HeartPulse {...common} />;
  return <Activity {...common} />;
 }

function Field({ label, children, wide = false }: { label: string; children: ReactNode; wide?: boolean }) {
  return <label className={`study-field${wide ? ' study-field-wide' : ''}`}><span>{label} <b>*</b></span>{children}</label>;
 }

export function StudiesPage() {
  const { user } = useAuth();
  const [studies, setStudies] = useState<Study[]>(loadStudies);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedId, setSelectedId] = useState<string>('study-1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrigin, setEditOrigin] = useState<ViewMode>('list');
  const [form, setForm] = useState<StudyForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState('');
  const [studyStats, setStudyStats] = useState(loadStudyStats);

  useEffect(() => {
    try {
      localStorage.setItem(STUDIES_STORAGE_KEY, JSON.stringify(studies));
      localStorage.setItem(STUDY_STATS_STORAGE_KEY, JSON.stringify(studyStats));
    } catch { /* armazenamento local é opcional no protótipo */ }
  }, [studies, studyStats]);

  useEffect(() => {
    if (!dialogMode) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setDialogMode(null);
        setFormError('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogMode]);

  const selectedStudy = studies.find((study) => study.id === selectedId) ?? studies[0];
  const editingStudy = editingId ? studies.find((study) => study.id === editingId) : undefined;
  const researcherOptions = useMemo(() => {
    const fromLocalAccounts = listLocalUsers()
      .filter((entry) => entry.role === 'Pesquisador' && entry.status === 'Ativo')
      .map((entry) => entry.name);
    if (user?.role === 'Pesquisador') fromLocalAccounts.unshift(user.name);
    return Array.from(new Set(fromLocalAccounts.length ? fromLocalAccounts : ['Marina Costa']));
  }, [user]);

  const visibleStudies = useMemo(() => studies.filter((study) => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const matchesText = !term || study.title.toLocaleLowerCase('pt-BR').includes(term)
      || study.researcher.toLocaleLowerCase('pt-BR').includes(term)
      || study.code.toLocaleLowerCase('pt-BR').includes(term);
    const matchesStatus = statusFilter === 'Todos' || study.status === statusFilter;
    return matchesText && matchesStatus;
  }), [studies, search, statusFilter]);

  function updateField<K extends keyof StudyForm>(key: K, value: StudyForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, researcher: researcherOptions[0] ?? user?.name ?? '' });
    setFormError('');
    setSuccessTitle('');
    setDialogMode('create');
    setOpenActionsFor(null);
  }

  function openEdit(study: Study) {
    setEditOrigin(viewMode);
    setEditingId(study.id);
    setForm(toForm(study));
    setFormError('');
    setDialogMode('edit');
    setOpenActionsFor(null);
  }

  function closeDialog() {
    setDialogMode(null);
    setFormError('');
  }

  function saveStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const participantLimit = Number(form.participantLimit);
    const participantsLinked = Number(form.participantsLinked);
    if (form.title.trim().length < 3) return setFormError('Informe um título para o estudo.');
    if (form.objective.trim().length < 8) return setFormError('Descreva o objetivo do estudo.');
    if (!form.researcher) return setFormError('Selecione o pesquisador responsável.');
    if (!form.startDate || !form.endDate) return setFormError('Informe as datas de início e término.');
    if (form.endDate < form.startDate) return setFormError('A data de término deve ser igual ou posterior à data de início.');
    if (!Number.isInteger(participantLimit) || participantLimit < 1) return setFormError('O limite de participantes deve ser pelo menos 1.');
    if (!Number.isInteger(participantsLinked) || participantsLinked < 0) return setFormError('Informe uma quantidade válida de participantes vinculados.');
    if (participantsLinked > participantLimit) return setFormError('Os participantes vinculados não podem ultrapassar o limite definido.');

    const newStatus = statusFromStartDate(form.startDate);
    if (dialogMode === 'edit' && editingStudy) {
      const updated: Study = {
        ...editingStudy,
        title: form.title.trim(), objective: form.objective.trim(), researcher: form.researcher,
        startDate: form.startDate, endDate: form.endDate,
        participantLimit, participantsLinked, status: newStatus,
      };
      setStudies((current) => current.map((study) => study.id === updated.id ? updated : study));
      if (editingStudy.status !== newStatus) {
        setStudyStats((current) => ({
          ...current,
          inProgress: Math.max(0, current.inProgress + (newStatus === 'Em andamento' ? 1 : -1)),
          planned: Math.max(0, current.planned + (newStatus === 'Planejado' ? 1 : -1)),
        }));
      }
      setSelectedId(updated.id);
      setSuccessTitle(updated.title);
      setDialogMode(null);
      setViewMode(editOrigin);
      setFormError('');
      return;
    }

    const nextNumber = Math.max(0, ...studies.map((study) => Number(study.code.replace(/\D/g, '')) || 0)) + 1;
    const created: Study = {
      id: `study-${Date.now()}`, code: `EST-${String(nextNumber).padStart(3, '0')}`,
      title: form.title.trim(), objective: form.objective.trim(), researcher: form.researcher,
      startDate: form.startDate, endDate: form.endDate, participantLimit,
      participantsLinked, status: newStatus, kind: 'Estudo observacional', symbol: 'activity',
    };
    setStudies((current) => [...current, created]);
    setStudyStats((current) => ({
      total: current.total + 1,
      inProgress: current.inProgress + (newStatus === 'Em andamento' ? 1 : 0),
      planned: current.planned + (newStatus === 'Planejado' ? 1 : 0),
    }));
    setSuccessTitle(created.title);
    setDialogMode('success');
    setViewMode('list');
    setSearch('');
    setStatusFilter('Todos');
  }

  function startDetails(study: Study) {
    setSelectedId(study.id);
    setViewMode('detail');
    setOpenActionsFor(null);
  }

  function backToStudies() {
    setViewMode('list');
    setDialogMode(null);
    setOpenActionsFor(null);
  }

  function renderStudyForm(isEdit: boolean) {
    const isEditingCurrent = isEdit && Boolean(editingStudy);
    return (
      <div className="study-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
        <section className="study-form-panel" role="dialog" aria-modal="true" aria-labelledby="study-form-title">
          <div className="study-form-heading">
            <h2 id="study-form-title">{isEdit ? 'Editar estudo' : 'Informações do estudo'}</h2>
            {isEditingCurrent && <span className={`study-status status-${(editingStudy?.status ?? 'Planejado').toLowerCase().replace(' ', '-')}`}><i />{editingStudy?.status}</span>}
          </div>
          <form className="study-form" onSubmit={saveStudy}>
            <Field label="Título do estudo" wide>
              <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ex.: Estudo de acompanhamento da pressão arterial" required />
            </Field>
            <Field label="Objetivo" wide>
              <input value={form.objective} onChange={(event) => updateField('objective', event.target.value)} placeholder="Ex.: Acompanhar indicadores simulados durante o estudo" required />
            </Field>
            <Field label="Pesquisador responsável" wide>
              <span className="study-select-wrap"><select value={form.researcher} onChange={(event) => updateField('researcher', event.target.value)} required><option value="">Selecione o pesquisador responsável</option>{researcherOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={15} /></span>
            </Field>
            <div className="study-form-bottom-grid">
              <Field label="Data de início"><input type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} required /></Field>
              <Field label="Data de término"><input type="date" value={form.endDate} onChange={(event) => updateField('endDate', event.target.value)} required /></Field>
              <Field label="Limite de participantes"><input type="number" min="1" step="1" value={form.participantLimit} onChange={(event) => updateField('participantLimit', event.target.value)} placeholder="Ex.: 30" required /></Field>
              <Field label="Participantes já vinculados"><input type="number" min="0" step="1" value={form.participantsLinked} onChange={(event) => updateField('participantsLinked', event.target.value)} placeholder="Ex.: 18" required /></Field>
            </div>
            {formError && <p className="form-error study-form-error" role="alert">{formError}</p>}
            <div className="study-form-actions">
              {isEdit ? <button className="button button-outline" type="button" onClick={() => editingStudy && setForm(toForm(editingStudy))}>Desfazer alterações</button> : <button className="button button-outline" type="button" onClick={closeDialog}>Cancelar</button>}
              <button className="button button-primary" type="submit">{isEdit ? 'Salvar alterações' : 'Cadastrar estudo'}</button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  function renderSuccessDialog() {
    return (
      <div className="study-dialog-backdrop study-success-mode" role="presentation">
        <section className="study-success-card" role="dialog" aria-modal="true" aria-labelledby="study-success-title">
          <div className="study-success-icon"><CircleCheck size={33} strokeWidth={2.5} /></div>
          <h2 id="study-success-title">Estudo cadastrado com sucesso!</h2>
          <p>Os dados iniciais do protocolo foram registrados.</p>
          <div className="study-success-summary"><span>TÍTULO DO ESTUDO</span><strong>{successTitle}</strong></div>
          <div className="study-success-actions">
            <button className="button button-outline" type="button" onClick={openCreate}>Cadastrar outro</button>
            <button className="button button-primary" type="button" onClick={backToStudies}>Ver estudos</button>
          </div>
        </section>
      </div>
    );
  }

  if (viewMode === 'detail' && selectedStudy) {
    const progress = progressFor(selectedStudy);
    return (
      <div className="page-wrap studies-page study-detail-page">
        <div className="study-breadcrumb"><button type="button" onClick={backToStudies}>Estudos clínicos</button><span>/</span><span>Detalhes do estudo</span></div>
        <section className="study-detail-hero">
          <div><h1>{selectedStudy.title}</h1><p>{selectedStudy.kind} <span>•</span> Código {selectedStudy.code}</p></div>
          <div className="study-detail-hero-actions"><span className={`study-status status-${selectedStudy.status.toLowerCase().replace(' ', '-')}`}><i />{selectedStudy.status}</span><button className="button button-primary" type="button" onClick={() => openEdit(selectedStudy)}><Pencil size={14} /> Editar estudo</button></div>
        </section>
        <div className="study-detail-grid page-content-offset">
          <div className="study-detail-main-column">
            <section className="study-detail-card study-information-card">
              <h2>Informações do estudo</h2>
              <div className="study-detail-info-grid">
                <div><span>Pesquisador responsável</span><strong>{selectedStudy.researcher}</strong></div>
                <div><span>Início do estudo</span><strong>{dateBR(selectedStudy.startDate)}</strong></div>
                <div><span>Previsão de término</span><strong>{dateBR(selectedStudy.endDate)}</strong></div>
                <div><span>Tipo de estudo</span><strong>{selectedStudy.kind === 'Estudo longitudinal' ? 'Longitudinal' : 'Observacional'}</strong></div>
              </div>
            </section>
            <section className="study-detail-card study-objective-card"><h2>Objetivo do estudo</h2><p>{selectedStudy.objective}</p></section>
            <section className="study-detail-card study-about-card"><h2>Sobre o acompanhamento</h2><p>Este painel reúne as informações gerais do estudo. Critérios de elegibilidade e visitas previstas serão definidos nas próximas etapas.</p></section>
          </div>
          <aside className="study-detail-side-column">
            <section className="study-detail-card study-summary-card">
              <h2>Resumo do estudo</h2>
              <div className="study-summary-participants"><span>Participantes vinculados</span><div><strong>{selectedStudy.participantsLinked}</strong><span>de {selectedStudy.participantLimit} previstos</span></div></div>
              <div className="study-summary-progress"><div><span>Ocupação das vagas</span><strong>{progress}%</strong></div><div className="study-progress-track"><span style={{ width: `${progress}%` }} /></div></div>
              <div className="study-summary-remaining"><span>Vagas restantes</span><strong>{Math.max(0, selectedStudy.participantLimit - selectedStudy.participantsLinked)}</strong></div>
            </section>
            <section className="study-detail-card study-actions-card"><h2>Ações</h2><button type="button" onClick={backToStudies}><ArrowLeft size={14} /> Voltar aos estudos</button><p>Visualização somente leitura</p></section>
          </aside>
        </div>
        {dialogMode === 'edit' && renderStudyForm(true)}
      </div>
    );
  }

  return (
    <div className="page-wrap studies-page">
      <section className="page-heading studies-heading"><h1>Estudos clínicos</h1><button className="button button-primary new-study-button" type="button" onClick={openCreate}>+ Cadastrar estudo</button></section>
      <div className="page-content-offset">
        <section className="study-stat-grid" aria-label="Resumo dos estudos">
          <article className="study-stat-card"><p>Estudos cadastrados</p><strong>{String(studyStats.total).padStart(2, '0')}</strong></article>
          <article className="study-stat-card"><p>Em andamento</p><strong>{String(studyStats.inProgress).padStart(2, '0')}</strong></article>
          <article className="study-stat-card"><p>Planejados</p><strong>{String(studyStats.planned).padStart(2, '0')}</strong></article>
        </section>
        <section className="study-list-panel">
          <div className="study-list-heading"><h2>Meus estudos</h2><div className="study-list-tools"><label className="study-search"><Search size={15} /><span className="sr-only">Buscar estudo</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar estudo..." /></label><label className="study-filter"><span className="sr-only">Filtrar estudos</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option><option>Em andamento</option><option>Planejado</option></select><ChevronDown size={13} /></label></div></div>
          <div className="study-cards-grid">
            {visibleStudies.map((study) => {
              const progress = progressFor(study);
              return <article className="study-card" key={study.id}>
                <div className="study-card-top">
                  <div className="study-card-symbol">{studyIcon(study.symbol, 18)}</div>
                  <div className="study-card-title"><h3>{study.title}</h3><p>{study.kind}</p></div>
                  <div className="study-card-menu-wrap"><button className="study-menu-trigger" type="button" aria-label={`Ações de ${study.title}`} aria-expanded={openActionsFor === study.id} onClick={() => setOpenActionsFor((current) => current === study.id ? null : study.id)}><MoreVertical size={17} /></button>{openActionsFor === study.id && <div className="study-action-menu"><button type="button" onClick={() => startDetails(study)}><Eye size={14} />Ver detalhes</button><button type="button" onClick={() => openEdit(study)}><Pencil size={14} />Editar estudo</button></div>}</div>
                  <span className={`study-status status-${study.status.toLowerCase().replace(' ', '-')}`}><i />{study.status}</span>
                </div>
                <div className="study-card-body">
                  <div className="study-meta-line"><CalendarDays size={14} /><div><span>Período</span><strong>{dateRange(study)}</strong></div></div>
                  <div className="study-meta-line"><UsersRound size={14} /><div><span>Participantes</span><strong>{study.participantsLinked} de {study.participantLimit} participantes</strong></div></div>
                  <div className="study-progress-label"><span>Progresso</span><strong>{progress}%</strong></div>
                  <div className="study-progress-track"><span style={{ width: `${progress}%` }} /></div>
                </div>
              </article>;
            })}
            {visibleStudies.length === 0 && <div className="study-empty-state">Nenhum estudo corresponde à busca.</div>}
          </div>
        </section>
      </div>
      {dialogMode === 'create' && renderStudyForm(false)}
      {dialogMode === 'edit' && renderStudyForm(true)}
      {dialogMode === 'success' && renderSuccessDialog()}
    </div>
  );
 }
