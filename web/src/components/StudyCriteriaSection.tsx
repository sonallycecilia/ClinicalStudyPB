import { useEffect, useRef, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ListChecks } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { CriteriaApiError, UNEXPECTED_LOAD_ERROR, criteriaApi } from '../studies/criteriaApi';
import type { CriterionDraft, CriterionType, EligibilityCriterion } from '../studies/criteriaApi';

const MAX_DESCRIPTION_LENGTH = 2000;
const CRITERION_TYPES: CriterionType[] = ['Inclusão', 'Exclusão'];

// Mesma regra de descrição aplicada pelo backend em CriteriaService.
function descriptionError(description: string): string {
  if (description.length === 0) return 'Este campo é obrigatório.';
  const { length } = description.trim();
  if (length === 0) return 'Informe uma descrição válida para o critério.';
  if (length > MAX_DESCRIPTION_LENGTH) return `O critério deve possuir no máximo ${MAX_DESCRIPTION_LENGTH} caracteres.`;
  return '';
}

function typeKey(type: CriterionType): string {
  return type === 'Inclusão' ? 'inclusion' : 'exclusion';
}

function countLabel(count: number): string {
  return `${count} ${count === 1 ? 'critério' : 'critérios'}`;
}

interface CriteriaEditorGroupProps {
  type: CriterionType;
  drafts: CriterionDraft[];
  disabled: boolean;
  onAdd: (type: CriterionType, description: string) => void;
  onUpdate: (id: string, description: string) => void;
  onRemove: (id: string) => void;
  onPendingChange: (type: CriterionType, isPending: boolean) => void;
}

function CriteriaEditorGroup({ type, drafts, disabled, onAdd, onUpdate, onRemove, onPendingChange }: CriteriaEditorGroupProps) {
  const [draft, setDraft] = useState('');
  const [draftError, setDraftError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [editError, setEditError] = useState('');
  const typeLabel = type.toLocaleLowerCase('pt-BR');
  const headingId = `study-form-criteria-${typeKey(type)}`;
  const hasPendingText = draft.trim().length > 0 || editingId !== null;

  useEffect(() => {
    onPendingChange(type, hasPendingText);
  }, [hasPendingText, onPendingChange, type]);

  function addDraft() {
    const error = descriptionError(draft);
    if (error) return setDraftError(error);
    onAdd(type, draft.trim());
    setDraft('');
  }

  // Depois da primeira tentativa inválida, a mensagem acompanha o que é digitado.
  function changeDraft(value: string) {
    setDraft(value);
    if (draftError) setDraftError(descriptionError(value));
  }

  function changeEditDraft(value: string) {
    setEditDraft(value);
    if (editError) setEditError(descriptionError(value));
  }

  function startEdit(criterion: CriterionDraft) {
    setEditingId(criterion.id);
    setEditDraft(criterion.description);
    setEditError('');
  }

  function saveEdit(id: string) {
    const error = descriptionError(editDraft);
    if (error) return setEditError(error);
    onUpdate(id, editDraft.trim());
    setEditingId(null);
  }

  return (
    <article className="study-criteria-group" aria-labelledby={headingId}>
      <div className="study-criteria-group-heading">
        <h4 id={headingId}>Critérios de {typeLabel}</h4>
        <span className="study-status status-planejamento">{countLabel(drafts.length)}</span>
      </div>
      {drafts.length === 0
        ? <div className="study-empty-state">Nenhum critério de {typeLabel} adicionado.</div>
        : <ul className="study-criteria-list">
          {drafts.map((criterion) => <li className="study-criteria-item" key={criterion.id}>
            {editingId === criterion.id
              ? <div className="study-criteria-form">
                <label className="study-field">
                  <span>Editar critério de {typeLabel} <b>*</b></span>
                  <textarea value={editDraft} onChange={(event) => changeEditDraft(event.target.value)} aria-invalid={Boolean(editError)} required />
                  {editError && <small role="alert" className="study-field-error">{editError}</small>}
                </label>
                <div className="study-form-actions">
                  <button className="button button-outline" type="button" disabled={disabled} onClick={() => setEditingId(null)}>Cancelar edição</button>
                  <button className="button button-primary" type="button" disabled={disabled} onClick={() => saveEdit(criterion.id)}>Salvar critério</button>
                </div>
              </div>
              : <div className="study-criteria-read">
                <p>{criterion.description}</p>
                <div className="row-actions">
                  <button type="button" className="text-action edit-action" disabled={disabled} aria-label={`Editar critério: ${criterion.description}`} onClick={() => startEdit(criterion)}>Editar</button>
                  <button type="button" className="text-action delete-action" disabled={disabled} aria-label={`Remover critério: ${criterion.description}`} onClick={() => onRemove(criterion.id)}>Remover</button>
                </div>
              </div>}
          </li>)}
        </ul>}
      <div className="study-criteria-form">
        <label className="study-field">
          <span>Novo critério de {typeLabel}</span>
          <textarea value={draft} onChange={(event) => changeDraft(event.target.value)} placeholder={type === 'Inclusão' ? 'Ex.: Ter entre 18 e 65 anos' : 'Ex.: Estar participando de outro estudo clínico'} aria-invalid={Boolean(draftError)} />
          <small className="study-field-hint">{type === 'Inclusão' ? 'Requisitos que os participantes devem atender.' : 'Condições que impedem a participação.'} Máximo de {MAX_DESCRIPTION_LENGTH} caracteres.</small>
          {draftError && <small role="alert" className="study-field-error">{draftError}</small>}
        </label>
        <div className="study-form-actions">
          <button className="button button-primary" type="button" disabled={disabled} onClick={addDraft}>+ Adicionar critério</button>
        </div>
      </div>
    </article>
  );
}

interface StudyCriteriaEditorProps {
  drafts: CriterionDraft[];
  onChange: Dispatch<SetStateAction<CriterionDraft[]>>;
  /** Informa quando uma categoria tem texto digitado que ainda não virou critério. */
  onPendingChange: (type: CriterionType, isPending: boolean) => void;
  disabled?: boolean;
  /** Na edição, os critérios existentes são carregados antes de liberar o preenchimento. */
  loading?: boolean;
  loadError?: CriteriaApiError | null;
  onRetryLoad?: () => void;
}

/** Seção dos formulários de estudo; os critérios só são enviados à API ao confirmar o formulário. */
export function StudyCriteriaEditor({ drafts, onChange, onPendingChange, disabled = false, loading = false, loadError = null, onRetryLoad }: StudyCriteriaEditorProps) {
  const nextLocalId = useRef(1);

  function addCriterion(type: CriterionType, description: string) {
    const id = `draft-${nextLocalId.current++}`;
    onChange((current) => [...current, { id, type, description }]);
  }

  function updateCriterion(id: string, description: string) {
    onChange((current) => current.map((item) => item.id === id ? { ...item, description } : item));
  }

  function removeCriterion(id: string) {
    onChange((current) => current.filter((item) => item.id !== id));
  }

  return (
    <section className="study-form-criteria" aria-labelledby="study-form-criteria-title">
      <h3 id="study-form-criteria-title">Critérios de inclusão e exclusão</h3>
      <p className="study-criteria-description">Opcional. Adicione, edite ou remova os critérios; as alterações só são salvas ao confirmar o formulário.</p>
      {loadError && <div className="study-criteria-load-error">
        <p role="alert" className="form-error">{loadError.message} As demais informações do estudo podem ser salvas normalmente.</p>
        {loadError.retryable && <button className="button button-outline" type="button" disabled={disabled} onClick={onRetryLoad}>Tentar novamente</button>}
      </div>}
      {loading && <p role="status" className="study-empty-state">Carregando critérios...</p>}
      {!loading && !loadError && <div className="study-criteria-grid">
        {CRITERION_TYPES.map((type) => <CriteriaEditorGroup
          key={type}
          type={type}
          drafts={drafts.filter((item) => item.type === type)}
          disabled={disabled}
          onAdd={addCriterion}
          onUpdate={updateCriterion}
          onRemove={removeCriterion}
          onPendingChange={onPendingChange}
        />)}
      </div>}
    </section>
  );
}

function CriteriaGroup({ type, criteria }: { type: CriterionType; criteria: EligibilityCriterion[] }) {
  const typeLabel = type.toLocaleLowerCase('pt-BR');
  const headingId = `study-criteria-${typeKey(type)}`;

  return (
    <article className="study-criteria-group" aria-labelledby={headingId}>
      <div className="study-criteria-group-heading">
        <h3 id={headingId}>Critérios de {typeLabel}</h3>
        <span className="study-status status-planejamento">{countLabel(criteria.length)}</span>
      </div>
      {criteria.length === 0
        ? <div className="study-empty-state">Nenhum critério de {typeLabel} cadastrado.</div>
        : <ul className="study-criteria-list">
          {criteria.map((criterion) => <li className="study-criteria-item" key={criterion.id}>
            <div className="study-criteria-read">
              <p>{criterion.description}</p>
            </div>
          </li>)}
        </ul>}
    </article>
  );
}

function useStudyCriteria(studyId: string) {
  const { request } = useAuth();
  const [criteria, setCriteria] = useState<EligibilityCriterion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<CriteriaApiError | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    void criteriaApi.list(request, studyId, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setCriteria(response);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setCriteria([]);
          setLoadError(reason instanceof CriteriaApiError ? reason : new CriteriaApiError(UNEXPECTED_LOAD_ERROR, true));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [request, studyId, loadAttempt]);

  return { criteria, isLoading, loadError, retry: () => setLoadAttempt((attempt) => attempt + 1) };
}

/** Resumo dos critérios vigentes no cartão do estudo; a API consulta os critérios de um estudo por vez. */
export function StudyCriteriaSummary({ studyId, studyTitle }: { studyId: string; studyTitle: string }) {
  const { criteria, isLoading, loadError, retry } = useStudyCriteria(studyId);
  const active = criteria.filter((item) => item.active);
  const count = (type: CriterionType) => active.filter((item) => item.type === type).length;

  return (
    <div className="study-meta-line">
      <ListChecks size={14} />
      <div>
        <span>Critérios</span>
        {isLoading && <strong>Carregando...</strong>}
        {loadError && <strong title={loadError.message}>Não foi possível carregar</strong>}
        {loadError?.retryable && <button type="button" className="text-action edit-action" aria-label={`Tentar carregar os critérios de ${studyTitle}`} onClick={retry}>Tentar novamente</button>}
        {!isLoading && !loadError && <strong>{active.length === 0 ? 'Nenhum critério cadastrado' : `${count('Inclusão')} de inclusão • ${count('Exclusão')} de exclusão`}</strong>}
      </div>
    </div>
  );
}

/** Critérios vigentes, exibidos nos detalhes do estudo; remover um critério o desativa na API. */
export function StudyCriteriaSection({ studyId }: { studyId: string }) {
  const { criteria, isLoading, loadError, retry } = useStudyCriteria(studyId);
  const inactiveCount = criteria.filter((item) => !item.active).length;

  return (
    <section className="study-detail-section study-criteria-section" aria-labelledby="study-criteria-title">
      <h2 id="study-criteria-title">Critérios do Estudo</h2>
      {inactiveCount > 0 && <p className="study-criteria-description">{inactiveCount === 1 ? '1 critério desativado não é exibido.' : `${inactiveCount} critérios desativados não são exibidos.`}</p>}
      {loadError && <div className="study-criteria-load-error">
        <p role="alert" className="form-error">{loadError.message}</p>
        {loadError.retryable && <button className="button button-outline" type="button" onClick={retry}>Tentar novamente</button>}
      </div>}
      {isLoading && <p role="status" className="study-empty-state">Carregando critérios...</p>}
      {!isLoading && !loadError && <div className="study-criteria-grid">
        {CRITERION_TYPES.map((type) => <CriteriaGroup key={type} type={type} criteria={criteria.filter((item) => item.type === type && item.active)} />)}
      </div>}
    </section>
  );
}
