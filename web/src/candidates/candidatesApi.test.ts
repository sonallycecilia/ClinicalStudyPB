import { describe, expect, it, vi } from 'vitest';
import { candidatesApi, CANDIDATE_STATUSES, ConsentUnavailableError, EligibilityUnavailableError, CandidateInclusionError, INVALID_INCLUSION_MESSAGE } from './candidatesApi';
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
  it('bloqueia consulta e registro enquanto não houver autorização, sem enviar requisições', async () => {
    const request = vi.fn();
    await expect(candidatesApi.listEligibilityCriteria(request, 'study-1')).rejects.toBeInstanceOf(EligibilityUnavailableError);
    await expect(candidatesApi.getEligibilityAssessment(request, 'study-1', 'candidate-1')).rejects.toBeInstanceOf(EligibilityUnavailableError);
    await expect(candidatesApi.registerEligibilityAssessment(request, 'study-1', 'candidate-1', {
      evaluations: [{ criterionId: 'criterion-1', result: 'Atende' }],
    })).rejects.toBeInstanceOf(EligibilityUnavailableError);
    expect(request).not.toHaveBeenCalled();
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

  it('preserva motivos de recusa sem depender do texto completo e suporta mensagens do NestJS em lista', async () => {
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ statusCode: 400, error: 'Bad Request', message: ['Novo motivo fornecido pela API.', 'Consulte o estudo.'] }), { status: 400 }));
    await expect(candidatesApi.include(request, 'study-1', 'candidate-1')).rejects.toMatchObject({
      status: 400, message: 'Novo motivo fornecido pela API. Consulte o estudo.',
    });
  });
});

describe('contrato de consentimento para o Coordenador', () => {
  it('bloqueia consulta e registro sem requisições ou persistência simulada', async () => {
    const request = vi.fn();
    await expect(candidatesApi.getConsent(request, 'study-1', 'candidate-1')).rejects.toBeInstanceOf(ConsentUnavailableError);
    await expect(candidatesApi.registerConsent(request, 'study-1', 'candidate-1', {
      status: 'Registrado', termVersion: 'versao-teste',
    })).rejects.toBeInstanceOf(ConsentUnavailableError);
    expect(request).not.toHaveBeenCalled();
  });
});
