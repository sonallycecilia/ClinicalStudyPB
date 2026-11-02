import { useRef, useState, type FormEvent } from 'react';
import {
  CandidateSubmissionError, toCandidateInput, validateCandidate,
  type CandidateAccountSelection, type CandidateFieldErrors, type CandidateFormValues,
  type CandidateInput, type CandidateStudyOption,
} from './candidateValidation';

/** Estado fornecido pela futura consulta autorizada, sem acoplar o formulário à API. */
export type CandidateStudiesState =
  | { status: 'loading' }
  | { status: 'ready'; options: readonly CandidateStudyOption[] }
  | { status: 'error' }
  | { status: 'unavailable'; message: string };

export interface CandidateFormProps {
  studies: CandidateStudiesState;
  accounts?: CandidateAccountSelection;
  /** Resolver somente após confirmação da persistência. Ausente enquanto a API não existir. */
  onSubmit?: (input: CandidateInput) => Promise<void>;
  onCancel: () => void;
}

export function CandidateForm({ studies, accounts, onSubmit, onCancel }: CandidateFormProps) {
  const [values, setValues] = useState<CandidateFormValues>({ name: '', email: '', studyId: '', userId: '' });
  const [errors, setErrors] = useState<CandidateFieldErrors>({});
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const submitting = useRef(false);
  const studyOptions = studies.status === 'ready' ? studies.options : [];
  const canSelectStudy = studyOptions.length > 0;
  const integrationMessage = 'O envio do cadastro estará disponível após a integração com o sistema.';
  const studyHint = studies.status === 'loading'
    ? 'Carregando estudos…'
    : studies.status === 'error'
      ? 'Não foi possível carregar os estudos. Tente novamente mais tarde.'
      : studies.status === 'unavailable'
        ? studies.message
        : canSelectStudy
          ? 'Selecione o estudo de interesse do candidato.'
          : 'Nenhum estudo disponível para associação.';
  const studyPlaceholder = studies.status === 'loading'
    ? 'Carregando estudos…'
    : studies.status === 'error'
      ? 'Falha ao carregar estudos'
      : studies.status === 'unavailable'
        ? 'Consulta indisponível'
        : canSelectStudy ? 'Selecione um estudo' : 'Nenhum estudo disponível';

  function validateField(field: keyof CandidateFormValues) {
    const validation = validateCandidate(values, studyOptions, accounts);
    setErrors((previous) => ({ ...previous, [field]: validation[field] }));
  }

  function update(field: keyof CandidateFormValues, value: string) {
    const next = { ...values, [field]: value };
    if (field === 'userId' && value) {
      const person = accounts?.people.find((item) => item.id === value);
      if (person) { next.name = person.name; next.email = person.email ?? ''; }
    }
    setValues(next);
    setFeedback('');
    // Atualiza erros já apresentados, incluindo o vínculo ao trocar de estudo.
    const currentErrors = validateCandidate(next, studyOptions, accounts);
    const affectedFields: (keyof CandidateFormValues)[] = field === 'userId'
      ? ['userId', 'name', 'email']
      : field === 'studyId' ? ['studyId', 'userId'] : [field];
    setErrors((previous) => {
      const nextErrors = { ...previous };
      for (const key of affectedFields) {
        if (key in previous) nextErrors[key] = currentErrors[key];
      }
      return nextErrors;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Também bloqueia submit por Enter ou disparado diretamente, além do botão nativo.
    if (!onSubmit || !canSelectStudy || submitting.current || saved) return;
    const validation = validateCandidate(values, studyOptions, accounts);
    setErrors(validation);
    setFeedback('');
    const firstInvalid = Object.keys(validation)[0];
    if (firstInvalid) {
      event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
      return;
    }
    submitting.current = true;
    setSaving(true);
    try {
      await onSubmit(toCandidateInput(values));
      setSaved(true);
      setFeedback('Candidato cadastrado com sucesso.');
    } catch (error) {
      if (error instanceof CandidateSubmissionError) setErrors(error.fieldErrors);
      setFeedback(error instanceof CandidateSubmissionError ? error.message : 'Não foi possível cadastrar o candidato. Tente novamente.');
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function fieldError(field: keyof CandidateFormValues) {
    return errors[field] ? <small id={`candidate-${field}-error`} className="study-field-error" role="alert">{errors[field]}</small> : null;
  }

  return <form className="study-form candidate-form" noValidate onSubmit={(event) => void submit(event)} aria-label="Cadastro de candidato" aria-busy={saving}>
    <fieldset disabled={saving || saved} className="candidate-fields">
      {accounts && <div className="study-field">
        <label htmlFor="candidate-userId">Pessoa cadastrada (opcional)</label>
        <select id="candidate-userId" name="userId" value={values.userId} onChange={(event) => update('userId', event.target.value)} onBlur={() => validateField('userId')} aria-invalid={Boolean(errors.userId)} aria-describedby={errors.userId ? 'candidate-userId-error' : undefined}>
          <option value="">Sem conta vinculada</option>
          {accounts.people.map((person) => <option key={person.id} value={person.id}>{person.name}{person.email ? ` — ${person.email}` : ''}</option>)}
        </select>
        {fieldError('userId')}
      </div>}
      <div className="study-field">
        <label htmlFor="candidate-name">Nome completo <b aria-hidden="true">*</b></label>
        <input id="candidate-name" name="name" autoComplete="name" required maxLength={150} value={values.name} onChange={(event) => update('name', event.target.value)} onBlur={() => validateField('name')} placeholder="Nome do candidato" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'candidate-name-error' : undefined} />
        {fieldError('name')}
      </div>
      <div className="study-field">
        <label htmlFor="candidate-studyId">Estudo <b aria-hidden="true">*</b></label>
        <select id="candidate-studyId" name="studyId" required value={canSelectStudy ? values.studyId : ''} disabled={!canSelectStudy} aria-busy={studies.status === 'loading'} onChange={(event) => update('studyId', event.target.value)} onBlur={() => validateField('studyId')} aria-invalid={Boolean(errors.studyId)} aria-describedby={`candidate-study-hint${errors.studyId ? ' candidate-studyId-error' : ''}`}>
          <option value="">{studyPlaceholder}</option>
          {studyOptions.map((study) => <option key={study.id} value={study.id}>{study.title}</option>)}
        </select>
        <small id="candidate-study-hint" className={`study-field-hint${studies.status === 'error' ? ' candidate-study-error' : ''}`} role={studies.status === 'error' ? 'alert' : 'status'}>{studyHint}</small>
        {fieldError('studyId')}
      </div>
      <div className="study-field">
        <label htmlFor="candidate-email">E-mail (opcional)</label>
        <input id="candidate-email" name="email" type="email" autoComplete="email" maxLength={254} value={values.email} onChange={(event) => update('email', event.target.value)} onBlur={() => validateField('email')} placeholder="nome@exemplo.com" aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'candidate-email-error' : undefined} />
        {fieldError('email')}
      </div>
    </fieldset>
    {feedback && <p className={saved ? 'candidate-notice' : 'form-error'} role={saved ? 'status' : 'alert'}>{feedback}</p>}
    {!onSubmit && <p id="candidate-integration-hint" className="candidate-integration-note" role="status">{integrationMessage}</p>}
    <div className="study-form-actions">
      <button type="button" className="button button-outline" disabled={saving} onClick={onCancel}>{saved ? 'Voltar à listagem' : 'Cancelar'}</button>
      <button type="submit" className="button button-primary" disabled={!onSubmit || !canSelectStudy || saving || saved} aria-describedby={!onSubmit ? 'candidate-integration-hint' : !canSelectStudy ? 'candidate-study-hint' : undefined}>{saving ? 'Cadastrando…' : 'Cadastrar candidato'}</button>
    </div>
  </form>;
}
