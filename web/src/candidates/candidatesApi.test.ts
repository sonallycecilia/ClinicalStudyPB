import { describe, expect, it, vi } from 'vitest';
import { candidatesApi, CANDIDATE_STATUSES, ConsentApiError, EligibilityApiError, CandidateInclusionError, INVALID_INCLUSION_MESSAGE } from './candidatesApi';
import { toCandidateInput, CandidateSubmissionError } from './candidateValidation';

const candidate = { id: 'candidate-1', studyId: 'study/1', name: 'Ana Silva', email: null, status: 'Novo', registeredAt: '2026-11-07 14:03:00.123+00' };
const candidateInput = toCandidateInput({ name: '  Ana Silva  ', email: '', studyId: 'study/1', userId: '' });

describe('RF08 — comunicação de candidatos', () => {
  it.each(['', ' ana@example.com '])('adapta cadastro ao contrato HTTP com e-mail opcional %j', async (email) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(candidate), { status: 201 }));
    await candidatesApi.create(request, { ...candidateInput, email });
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('/studies/study%2F1/candidates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ana Silva', ...(email ? { email: 'ana@example.com' } : {}) }),
    });
  });

  it('consulta usando o ID, repassa cancelamento e adapta os seis status sem inferir consentimento', async () => {
    const signal = new AbortController().signal;
    const rows = CANDIDATE_STATUSES.map((status, index) => ({ ...candidate, id: String(index), status }));
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify([...rows, { ...candidate, studyId: 'other' }])));
    const result = await candidatesApi.listByStudy(request, 'study/1', signal);
    expect(request).toHaveBeenCalledWith('/studies/study%2F1/candidates', { signal });
    expect(result).toEqual(rows.map((row) => ({
      id: row.id, studyId: row.studyId, name: row.name, studyTitle: '', status: row.status, enrollmentDate: row.registeredAt,
    })));
  });

  it('aceita estudo sem candidatos', async () => {
    const request = vi.fn().mockResolvedValue(new Response('[]'));
    await expect(candidatesApi.listByStudy(request, 'study-1')).resolves.toEqual([]);
  });

  it.each([null, {}, [{ ...candidate, status: 'Consentimento pendente' }], [{ ...candidate, registeredAt: null }], [{ ...candidate, email: 10 }]])('rejeita listagem fora do contrato: %j', async (body) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(candidatesApi.listByStudy(request, 'study/1')).rejects.toThrow('listagem de candidatos inválida');
  });

  it.each([
    [400, 'O estudo está encerrado.'],
    [401, 'Sua sessão expirou ou é inválida. Entre novamente para continuar.'],
    [403, 'Você não tem permissão para cadastrar ou consultar candidatos neste estudo.'],
    [404, 'Estudo não encontrado. Atualize os estudos disponíveis.'],
    [409, 'O cadastro foi recusado por conflito. Consulte a listagem antes de tentar novamente.'],
    [500, 'Não foi possível concluir a solicitação. Tente novamente.'],
  ])('trata HTTP %s no GET e no POST', async (status, message) => {
    const request = vi.fn().mockImplementation(async () => new Response(JSON.stringify({ message: 'O estudo está encerrado.' }), { status: Number(status) }));
    await expect(candidatesApi.listByStudy(request, 'study/1')).rejects.toMatchObject({ status, message });
    await expect(candidatesApi.create(request, candidateInput)).rejects.toThrow(message as string);
  });

  it('apresenta validação NestJS e traduz erro de cadastro para o formulário', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: ['name should not be empty', 'email must be an email'] }), { status: 400 }));
    await expect(candidatesApi.create(request, candidateInput)).rejects.toBeInstanceOf(CandidateSubmissionError);
    request.mockResolvedValue(new Response(JSON.stringify({ message: ['Confira o nome.', 'Confira o e-mail.'] }), { status: 400 }));
    await expect(candidatesApi.create(request, candidateInput)).rejects.toThrow('Confira o nome. Confira o e-mail.');
  });

  it('trata falha de rede nas duas operações', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'));
    await expect(candidatesApi.listByStudy(request, 'study/1')).rejects.toThrow('Não foi possível comunicar');
    await expect(candidatesApi.create(request, candidateInput)).rejects.toThrow('Não foi possível comunicar');
  });

  it('trata corpo não JSON em falhas HTTP', async () => {
    const request = vi.fn().mockImplementation(async () => new Response('Bad gateway', { status: 502 }));
    await expect(candidatesApi.listByStudy(request, 'study/1')).rejects.toThrow('Não foi possível concluir');
    await expect(candidatesApi.create(request, candidateInput)).rejects.toThrow('Não foi possível concluir');
  });
});

describe('contrato de elegibilidade para o Coordenador', () => {
  const assessment = { studyId: 'study/1', candidateId: 'candidate/1', status: 'Elegível', evaluations: [{
    id: 'evaluation-1', criterionId: 'criterion-1', criterionType: 'Inclusão', criterionDescription: 'Idade',
    result: 'Atende', observation: null, evaluatorId: 'coordinator-1', evaluatedAt: '2026-11-08 12:00:00.123+00',
  }] };
  it('delega critérios ao adaptador existente e repassa o cancelamento', async () => {
    const request = vi.fn().mockResolvedValue(new Response('[]'));
    const signal = new AbortController().signal;
    await expect(candidatesApi.listEligibilityCriteria(request, 'study/1', signal)).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith('/studies/study%2F1/criteria', { signal });
  });
  it('consulta avaliações pelos IDs e envia somente evaluations no POST', async () => {
    const request = vi.fn().mockImplementation(async () => new Response(JSON.stringify(assessment)));
    const signal = new AbortController().signal;
    await expect(candidatesApi.getEligibilityAssessment(request, 'study/1', 'candidate/1', signal)).resolves.toEqual(assessment);
    expect(request).toHaveBeenLastCalledWith('/studies/study%2F1/candidates/candidate%2F1/eligibility-assessments', { signal });
    await expect(candidatesApi.registerEligibilityAssessment(request, 'study/1', 'candidate/1', {
      evaluations: [{ criterionId: 'criterion-1', result: 'Atende', observation: 'Observação' }], status: 'Inelegível',
    } as never, signal)).resolves.toEqual(assessment);
    expect(request).toHaveBeenLastCalledWith('/studies/study%2F1/candidates/candidate%2F1/eligibility-assessments', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
      body: JSON.stringify({ evaluations: [{ criterionId: 'criterion-1', result: 'Atende', observation: 'Observação' }] }),
    });
  });
  it.each([null, {}, { ...assessment, candidateId: 'other' }, { ...assessment, studyId: 'other' },
    { ...assessment, status: 'unknown' }, { ...assessment, evaluations: [null] },
    { ...assessment, evaluations: [{ ...assessment.evaluations[0], result: 'Sim' }] },
    { ...assessment, evaluations: [assessment.evaluations[0], assessment.evaluations[0]] },
    { ...assessment, evaluations: [{ ...assessment.evaluations[0], evaluatedAt: 'invalid' }] },
  ])('rejeita resposta inválida ou de outro candidato: %j', async (body) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(candidatesApi.getEligibilityAssessment(request, 'study/1', 'candidate/1')).rejects.toBeInstanceOf(EligibilityApiError);
  });
  it('recusa sucesso incompleto, sem confirmar o registro', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...assessment, evaluations: [] })));
    await expect(candidatesApi.registerEligibilityAssessment(request, 'study/1', 'candidate/1', {
      evaluations: [{ criterionId: 'criterion-1', result: 'Atende' }],
    })).rejects.toThrow('avaliação incompleta');
  });
  it.each([400, 401, 403, 404, 503])('preserva HTTP %s no erro', async (status) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: ['Dados recusados.'] }), { status }));
    await expect(candidatesApi.getEligibilityAssessment(request, 'study/1', 'candidate/1')).rejects.toMatchObject({ status });
  });
  it('trata conexão e JSON inválido', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response('invalid'));
    await expect(candidatesApi.getEligibilityAssessment(request, 's', 'c')).rejects.toThrow('comunicar');
    await expect(candidatesApi.getEligibilityAssessment(request, 's', 'c')).rejects.toThrow('avaliação inválida');
  });
});

describe('contrato de inclusão (para integração após autorização)', () => {
  const inclusion = {
    participationId: 'participation-1', candidateId: 'candidate-1', studyId: 'study-1',
    includedAt: '2026-11-07', participationStatus: 'Ativo', participantsLinked: 3, participantLimit: 5,
  };

  it('envia POST sem corpo para os IDs informados e devolve os campos reais', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(inclusion), { status: 201 }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).resolves.toEqual(inclusion);
    expect(request).toHaveBeenCalledExactlyOnceWith('/studies/study-1/candidates/candidate-1/include', { method: 'POST' });
  });

  it('codifica os IDs na rota', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...inclusion, studyId: 'study/1', candidateId: 'candidate/1' }), { status: 201 }));
    await candidatesApi.include(request, 'study/1', 'candidate/1');
    expect(request).toHaveBeenCalledWith('/studies/study%2F1/candidates/candidate%2F1/include', { method: 'POST' });
  });

  it.each([
    null, {}, { ...inclusion, participationId: '' }, { ...inclusion, candidateId: 'other' },
    { ...inclusion, studyId: 'other' }, { ...inclusion, includedAt: '2026-02-30' },
    { ...inclusion, includedAt: 'invalid' }, { ...inclusion, participationStatus: 'Inativo' },
    { ...inclusion, participantsLinked: '3' }, { ...inclusion, participantsLinked: 6 },
    { ...inclusion, participantsLinked: 0 }, { ...inclusion, participantLimit: 3.5 },
  ])('recusa uma resposta de sucesso inválida: %j', async (body) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 201 }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).rejects.toThrow(INVALID_INCLUSION_MESSAGE);
  });

  it.each([201, 400, 503])('trata corpo que não é JSON no HTTP %s', async (status) => {
    const request = vi.fn().mockResolvedValue(new Response('invalid JSON', { status }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).rejects.toBeInstanceOf(CandidateInclusionError);
  });

  it('não deduz motivos a partir de mensagens antigas em lista sem código estruturado', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: ['Novo motivo fornecido pela API.', 'Consulte o estudo.'] }), { status: 400 }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).rejects.toMatchObject({
      status: 400, message: 'Não foi possível concluir a inclusão. Tente novamente.',
    });
  });

  it.each([
    ['CANDIDATE_INELIGIBLE', 'O candidato não atende aos critérios de elegibilidade do estudo.'],
    ['ELIGIBILITY_PENDING', 'A avaliação de elegibilidade do candidato ainda não foi concluída.'],
    ['CONSENT_MISSING', 'O consentimento simulado do candidato ainda não foi registrado.'],
    ['CONSENT_NOT_GRANTED', 'O candidato não possui consentimento válido para participar.'],
    ['STUDY_FULL', 'O estudo não possui vagas disponíveis.'],
    ['CANDIDATE_ALREADY_INCLUDED', 'Este candidato já foi incluído no estudo.'],
  ])('identifica %s pelo code e pelo HTTP real, independentemente do texto', async (code, message) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code, message: 'Texto pode mudar.', statusCode: 500 }), { status: 400 }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).rejects.toMatchObject({ status: 400, code, message });
  });

  it.each([undefined, null, 400, 'UNKNOWN_CODE', 'INCLUSION_REQUIREMENTS_NOT_MET', '__proto__', 'constructor'])('usa fallback para código ausente, inválido ou desconhecido: %s', async (code) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code, message: 'Limite de vagas atingido: não há vagas disponíveis neste estudo.' }), { status: 400 }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).rejects.toMatchObject({ status: 400, message: 'Não foi possível concluir a inclusão. Tente novamente.' });
  });

  it.each([
    [401, 'Sua sessão expirou ou não está autorizada. Entre novamente para continuar.'],
    [403, 'Você não tem permissão para realizar esta inclusão.'],
    [404, 'Estudo ou candidato não encontrado.'],
    [500, 'Não foi possível concluir a inclusão. Tente novamente.'],
  ])('preserva HTTP %s sem interpretar code de domínio fora do HTTP 400', async (status, message) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'CONSENT_MISSING', message: 'Detalhes internos.' }), { status }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).rejects.toMatchObject({ status, message });
  });
});

describe('contrato de consentimento para o Coordenador', () => {
  const unrecorded = { studyId: 'study/1', candidateId: 'candidate/1', status: null, termVersion: null, registeredAt: null, registrarId: null, observation: null };
  const consent = { ...unrecorded, status: 'Registrado', termVersion: 'v1', registeredAt: '2026-11-08 15:00:00.123+00', registrarId: 'coordinator-1' };
  it.each([null, 'Registrado', 'Recusado', 'Revogado'])('consulta %s pelos IDs e repassa o cancelamento', async (status) => {
    const body = status === null ? unrecorded : { ...consent, status };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    const signal = new AbortController().signal;
    await expect(candidatesApi.getConsent(request, 'study/1', 'candidate/1', signal)).resolves.toEqual(body);
    expect(request).toHaveBeenCalledWith('/studies/study%2F1/candidates/candidate%2F1/consents', { signal });
  });
  it.each(['Registrado', 'Recusado', 'Revogado'] as const)('envia exatamente o contrato de %s e valida a confirmação', async (status) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...consent, status }), { status: 201 }));
    await candidatesApi.registerConsent(request, 'study/1', 'candidate/1', { status, termVersion: 'v1', observation: 'Nota' });
    expect(request).toHaveBeenCalledExactlyOnceWith('/studies/study%2F1/candidates/candidate%2F1/consents', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: undefined,
      body: JSON.stringify({ status, termVersion: 'v1', observation: 'Nota' }),
    });
  });
  it.each([null, {}, { ...consent, studyId: 'other' }, { ...consent, candidateId: 'other' },
    { ...consent, status: 'Aceito' }, { ...consent, registeredAt: 'invalid' }, { ...consent, termVersion: '' },
    { ...consent, registrarId: null }, { ...unrecorded, observation: 'incoerente' },
  ])('rejeita resposta inválida ou pertencente a outro candidato: %j', async (body) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify(body)));
    await expect(candidatesApi.getConsent(request, 'study/1', 'candidate/1')).rejects.toBeInstanceOf(ConsentApiError);
  });
  it('não confirma POST com estado nulo ou JSON inválido', async () => {
    const request = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(unrecorded))).mockResolvedValueOnce(new Response('invalid'));
    await expect(candidatesApi.registerConsent(request, 'study/1', 'candidate/1', { status: 'Registrado', termVersion: 'v1' })).rejects.toThrow('consentimento inválido');
    await expect(candidatesApi.getConsent(request, 'study/1', 'candidate/1')).rejects.toThrow('consentimento inválido');
  });
  it.each([400, 401, 403, 404, 503])('trata HTTP %s sem sucesso', async (status) => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: ['Dados recusados.'] }), { status }));
    await expect(candidatesApi.getConsent(request, 'study/1', 'candidate/1')).rejects.toMatchObject({ status });
  });
  it('trata falhas de conexão e preserva a mensagem de validação do backend', async () => {
    const request = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(new Response(JSON.stringify({ message: ['Versão inválida.'] }), { status: 400 }));
    await expect(candidatesApi.getConsent(request, 's', 'c')).rejects.toThrow('comunicar');
    await expect(candidatesApi.getConsent(request, 's', 'c')).rejects.toThrow('Versão inválida.');
  });
});
