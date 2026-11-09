import { describe, expect, it, vi } from 'vitest';
import { candidatesApi, ConsentUnavailableError, EligibilityUnavailableError } from './candidatesApi';

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
