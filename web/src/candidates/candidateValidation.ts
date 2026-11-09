export interface CandidateStudyOption {
  id: string;
  title: string;
}

export interface CandidatePersonOption {
  id: string;
  name: string;
  email?: string | null;
}

export interface CandidateLink {
  id_estudo: string;
  id_usuario: string | null;
}

/** Só fornecer quando a consulta de pessoas e vínculos estiver autorizada. */
export interface CandidateAccountSelection {
  people: readonly CandidatePersonOption[];
  links: readonly CandidateLink[];
}

export interface CandidateFormValues {
  name: string;
  studyId: string;
  email: string;
  userId: string;
}

/** Dados da migração 008; não representa inclusão nem avaliação de elegibilidade. */
export interface CandidateInput {
  id_estudo: string;
  id_usuario: string | null;
  nome: string;
  email: string | null;
  status_recrutamento: 'Novo';
}

export type CandidateFieldErrors = Partial<Record<keyof CandidateFormValues, string>>;

export function validateCandidate(
  values: CandidateFormValues,
  studies: readonly CandidateStudyOption[],
  accounts?: CandidateAccountSelection,
): CandidateFieldErrors {
  const errors: CandidateFieldErrors = {};
  const name = values.name.trim();
  const email = values.email.trim();
  if (!name) errors.name = 'Informe o nome completo do candidato.';
  else if ([...name].length > 150) errors.name = 'O nome deve ter no máximo 150 caracteres.';
  if (!values.studyId || !studies.some((study) => study.id === values.studyId)) {
    errors.studyId = 'Selecione um estudo válido.';
  }
  if (email && ([...email].length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    errors.email = 'Informe um e-mail válido com até 254 caracteres.';
  }
  if (values.userId) {
    if (!accounts?.people.some((person) => person.id === values.userId)) {
      errors.userId = 'Selecione uma pessoa autorizada.';
    } else if (accounts.links.some((link) => link.id_usuario === values.userId && link.id_estudo === values.studyId)) {
      errors.userId = 'Esta pessoa já está vinculada como candidata a este estudo.';
    }
  }
  return errors;
}

export function toCandidateInput(values: CandidateFormValues): CandidateInput {
  return {
    id_estudo: values.studyId,
    id_usuario: values.userId || null,
    nome: values.name.trim(),
    email: values.email.trim() || null,
    status_recrutamento: 'Novo',
  };
}

/** Erros da integração, sem acoplar URLs ao formulário. */
export class CandidateSubmissionError extends Error {
  constructor(message: string, public readonly fieldErrors: CandidateFieldErrors = {}) {
    super(message);
  }
}
