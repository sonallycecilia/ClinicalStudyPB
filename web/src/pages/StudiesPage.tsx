import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, ArrowLeft, CalendarDays, ChevronDown, CircleCheck,
  Eye, HeartPulse, MoreVertical, Moon, Pencil, Search, UsersRound,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { studiesApi } from '../studies/studiesApi';
import type { Study } from '../studies/studiesApi';

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

const EMPTY_FORM: StudyForm = {
  title: '', objective: '', researcher: '', startDate: '', endDate: '',
  participantLimit: '', participantsLinked: '',
};

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
  const { user, accessToken, demoMode } = useAuth();
  const [studies, setStudies] = useState<Study[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedId, setSelectedId] = useState<string>('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOrigin, setEditOrigin] = useState<ViewMode>('list');
  const [form, setForm] = useState<StudyForm>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState('');
  const studyStats = useMemo(() => ({
    total: studies.length,
    inProgress: studies.filter((item) => item.status === 'Em andamento').length,
    planned: studies.filter((item) => item.status === 'Planejado').length,
  }), [studies]);

  useEffect(() => {
    const controller = new AbortController();
    if (!accessToken || demoMode) {
      setStudies([]);
      setIsLoading(false);
      setLoadError('Entre usando a API para consultar e gerenciar estudos. O modo demonstração não salva estudos.');
      return () => controller.abort();
    }
    setIsLoading(true);
    setLoadError('');
    void studiesApi.list(accessToken, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setStudies(response);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setStudies([]);
          setLoadError(reason instanceof Error ? reason.message : 'Não foi possível carregar os estudos.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [accessToken, demoMode]);

  useEffect(() => {
    if (!dialogMode) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSaving) {
        setDialogMode(null);
        setFormError('');
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dialogMode, isSaving]);

  const selectedStudy = studies.find((study) => study.id === selectedId) ?? studies[0];
  const editingStudy = editingId ? studies.find((study) => study.id === editingId) : undefined;
  // A listagem /studies está restrita ao pesquisador autenticado.
  // O responsável vem do token, não de opções locais ou do formulário.
  const researcherOptions = useMemo(() => user?.role === 'Pesquisador' ? [user.name] : [], [user]);

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

  async function saveStudy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;
    setFormError('');
    if (!accessToken || demoMode) return setFormError('Entre pela API para salvar estudos.');
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

    const payload = {
      title: form.title.trim(), objective: form.objective.trim(),
      startDate: form.startDate, endDate: form.endDate,
      participantLimit, participantsLinked,
    };
    const isEdit = dialogMode === 'edit' && Boolean(editingStudy);
    setIsSaving(true);
    try {
      const saved = isEdit && editingStudy
        ? await studiesApi.update(accessToken, editingStudy.id, payload)
        : await studiesApi.create(accessToken, payload);
      setStudies((current) => isEdit
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setSelectedId(saved.id);
      setEditingId(null);
      setFormError('');
      if (isEdit) {
        setDialogMode(null);
        setViewMode(editOrigin);
      } else {
        setSuccessTitle(saved.title);
        setDialogMode('success');
        setViewMode('list');
        setSearch('');
        setStatusFilter('Todos');
      }
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Não foi possível salvar o estudo na API.');
    } finally {
      setIsSaving(false);
    }
  }

  async function startDetails(study: Study) {
    setOpenActionsFor(null);
    if (!accessToken || demoMode) {
      setLoadError('Entre pela API para consultar os detalhes.');
      return;
    }
    setIsLoadingDetail(true);
    setLoadError('');
    try {
      const detail = await studiesApi.detail(accessToken, study.id);
      setStudies((current) => current.map((item) => item.id === detail.id ? detail : item));
      setSelectedId(detail.id);
      setViewMode('detail');
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : 'Não foi possível consultar o estudo.');
    } finally {
      setIsLoadingDetail(false);
    }
  }

  function backToStudies() {
    setViewMode('list');
    setDialogMode(null);
    setOpenActionsFor(null);
  }

  function renderStudyForm(isEdit: boolean) {
    const isEditingCurrent = isEdit && Boolean(editingStudy);
    return (
      <div className="study-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) closeDialog(); }}>
        <section className="study-form-panel" role="dialog" aria-modal="true" aria-labelledby="study-form-title">
          <div className="study-form-heading">
            <h2 id="study-form-title">{isEdit ? 'Editar estudo' : 'Informações do estudo'}</h2>
            {isEditingCurrent && <span className={`study-status status-${(editingStudy?.status ?? 'Planejado').toLowerCase().replace(' ', '-')}`}><i />{editingStudy?.status}</span>}
          </div>
          <form className="study-form" onSubmit={(event) => void saveStudy(event)}>
            <Field label="Título do estudo" wide>
              <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Ex.: Estudo de acompanhamento da pressão arterial" required />
            </Field>
            <Field label="Objetivo" wide>
              <input value={form.objective} onChange={(event) => updateField('objective', event.target.value)} placeholder="Ex.: Acompanhar indicadores simulados durante o estudo" required />
            </Field>
            <Field label="Pesquisador responsável" wide>
              <span className="study-select-wrap"><select value={form.researcher} onChange={(event) => updateField('researcher', event.target.value)} disabled required><option value="">Selecione o pesquisador responsável</option>{researcherOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select><ChevronDown size={15} /></span>
            </Field>
            <div className="study-form-bottom-grid">
              <Field label="Data de início"><input type="date" value={form.startDate} onChange={(event) => updateField('startDate', event.target.value)} required /></Field>
              <Field label="Data de término"><input type="date" value={form.endDate} onChange={(event) => updateField('endDate', event.target.value)} required /></Field>
              <Field label="Limite de participantes"><input type="number" min="1" step="1" value={form.participantLimit} onChange={(event) => updateField('participantLimit', event.target.value)} placeholder="Ex.: 30" required /></Field>
              <Field label="Participantes já vinculados"><input type="number" min="0" step="1" value={form.participantsLinked} onChange={(event) => updateField('participantsLinked', event.target.value)} placeholder="Ex.: 18" required /></Field>
            </div>
            {formError && <p className="form-error study-form-error" role="alert">{formError}</p>}
            <div className="study-form-actions">
              {isEdit ? <button className="button button-outline" type="button" onClick={() => editingStudy && setForm(toForm(editingStudy))} disabled={isSaving}>Desfazer alterações</button> : <button className="button button-outline" type="button" onClick={closeDialog} disabled={isSaving}>Cancelar</button>}
              <button className="button button-primary" type="submit" disabled={isSaving}>{isSaving ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Cadastrar estudo'}</button>
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
      <section className="page-heading studies-heading"><h1>Estudos clínicos</h1><button className="button button-primary new-study-button" type="button" onClick={openCreate} disabled={isLoading || Boolean(loadError)}>+ Cadastrar estudo</button></section>
      <div className="page-content-offset">
        {loadError && <p role="alert" className="form-error">{loadError}</p>}
        {isLoading && <p role="status">Carregando estudos da API...</p>}
        {isLoadingDetail && <p role="status">Consultando detalhes...</p>}
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
                  <div className="study-card-menu-wrap"><button className="study-menu-trigger" type="button" aria-label={`Ações de ${study.title}`} aria-expanded={openActionsFor === study.id} onClick={() => setOpenActionsFor((current) => current === study.id ? null : study.id)}><MoreVertical size={17} /></button>{openActionsFor === study.id && <div className="study-action-menu"><button type="button" onClick={() => void startDetails(study)}><Eye size={14} />Ver detalhes</button><button type="button" onClick={() => openEdit(study)}><Pencil size={14} />Editar estudo</button></div>}</div>
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
            {!isLoading && !loadError && visibleStudies.length === 0 && <div className="study-empty-state">Nenhum estudo corresponde à busca.</div>}
          </div>
        </section>
      </div>
      {dialogMode === 'create' && renderStudyForm(false)}
      {dialogMode === 'edit' && renderStudyForm(true)}
      {dialogMode === 'success' && renderSuccessDialog()}
    </div>
  );
 }
