import { describe, expect, it } from 'vitest';
import { toCandidateInput, validateCandidate, type CandidateFormValues } from './candidateValidation';

const studies = [{ id: 'study-1', title: 'Sono' }, { id: 'study-2', title: 'Atividade física' }];
const valid: CandidateFormValues = { name: '  Ana Silva  ', email: '', studyId: 'study-1', userId: '' };
const accounts = { people: [{ id: 'user-1', name: 'Ana Silva' }], links: [{ id_estudo: 'study-1', id_usuario: 'user-1' }] };

describe('validação de candidatos — task 3496', () => {
  it('rejeita formulário vazio e nome contendo apenas espaços', () => {
    expect(validateCandidate({ name: '', email: '', studyId: '', userId: '' }, studies)).toEqual({
      name: 'Informe o nome completo do candidato.', studyId: 'Selecione um estudo válido.',
    });
    expect(validateCandidate({ ...valid, name: ' \t ' }, studies).name).toBeTruthy();
  });

  it('exige que o estudo pertença às opções autorizadas', () => {
    expect(validateCandidate({ ...valid, studyId: '' }, studies).studyId).toBeTruthy();
    expect(validateCandidate({ ...valid, studyId: 'desconhecido' }, studies).studyId).toBeTruthy();
    expect(validateCandidate(valid, []).studyId).toBeTruthy();
  });

  it.each(['invalido', 'ana@', 'ana@example', 'ana@@example.com', 'ana silva@example.com'])('rejeita e-mail inválido: %s', (email) => {
    expect(validateCandidate({ ...valid, email }, studies).email).toBeTruthy();
  });

  it('respeita os limites reais de nome e e-mail sem inventar tamanho mínimo', () => {
    expect(validateCandidate({ ...valid, name: 'A' }, studies)).toEqual({});
    expect(validateCandidate({ ...valid, name: 'A'.repeat(150) }, studies)).toEqual({});
    expect(validateCandidate({ ...valid, name: 'A'.repeat(151) }, studies).name).toBeTruthy();
    expect(validateCandidate({ ...valid, email: `${'a'.repeat(242)}@example.com` }, studies)).toEqual({});
    expect(validateCandidate({ ...valid, email: `${'a'.repeat(243)}@example.com` }, studies).email).toBeTruthy();
  });

  it('aceita e-mail opcional e normaliza os dados sem incluir nem avaliar participante', () => {
    expect(validateCandidate(valid, studies)).toEqual({});
    expect(toCandidateInput({ ...valid, email: '  ' })).toEqual({
      id_estudo: 'study-1', id_usuario: null, nome: 'Ana Silva', email: null, status_recrutamento: 'Novo',
    });
    expect(toCandidateInput({ ...valid, email: ' ana@example.com ', userId: 'user-1' })).toMatchObject({
      email: 'ana@example.com', id_usuario: 'user-1',
    });
  });

  it('impede usuário não autorizado e vínculo duplicado, permitindo outros estudos e pessoas sem conta', () => {
    expect(validateCandidate({ ...valid, userId: 'user-1' }, studies).userId).toBeTruthy();
    expect(validateCandidate({ ...valid, userId: 'unknown' }, studies, accounts).userId).toBeTruthy();
    expect(validateCandidate({ ...valid, userId: 'user-1' }, studies, accounts).userId).toContain('já está vinculada');
    expect(validateCandidate({ ...valid, userId: 'user-1', studyId: 'study-2' }, studies, accounts)).toEqual({});
    expect(validateCandidate(valid, studies, accounts)).toEqual({});
  });
});
