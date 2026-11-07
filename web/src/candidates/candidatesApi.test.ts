import { describe, expect, it, vi } from 'vitest';
import { candidatesApi, ConsentUnavailableError, EligibilityUnavailableError, CandidateInclusionError, INVALID_INCLUSION_MESSAGE } from './candidatesApi';

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
