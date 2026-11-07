import { beforeEach, describe, expect, it, vi } from 'vitest';
import { studiesApi } from './studiesApi';

const study = {
  id: 'd8d77e38-f240-4a1d-a17f-b0e918a548f3', code: 'EST-004', title: 'Sono e qualidade de vida',
  objective: 'Avaliar os padrões de sono em participantes fictícios.',
  researcherId: 'd8d77e38-f240-4a1d-a17f-b0e918a548f3', researcher: 'Marina Costa',
  startDate: '2026-10-24', endDate: '2026-12-10', participantLimit: 20,
  participantsLinked: 0, status: 'execução' as const,
  kind: 'Estudo observacional' as const, symbol: 'activity' as const,
};

const input = {
  title: study.title, objective: study.objective, startDate: study.startDate,
  endDate: study.endDate, participantLimit: 20, participantsLinked: 0,
};

const okResponse = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
const errorResponse = (status: number, message: string) => ({
  ok: false, status, json: async () => ({ message }),
}) as Response;

beforeEach(() => vi.restoreAllMocks());

describe('Studies API', () => {
  it('usa o cliente autenticado para listar os estudos do pesquisador', async () => {
    const request = vi.fn().mockResolvedValue(okResponse([study]));
    await expect(studiesApi.list(request)).resolves.toEqual([study]);
    expect(request).toHaveBeenCalledWith('/studies', expect.objectContaining({ signal: undefined }));
  });

  it('envia POST com o corpo correto e interpreta o estudo criado', async () => {
    const request = vi.fn().mockResolvedValue(okResponse(study));
    await expect(studiesApi.create(request, input)).resolves.toEqual(study);
    expect(request).toHaveBeenCalledWith('/studies', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }));
  });

  it('consulta as opções de recrutamento pela rota específica com cancelamento', async () => {
    const options = [{ id: study.id, title: study.title }];
    const request = vi.fn().mockResolvedValue(okResponse(options));
    const controller = new AbortController();
    await expect(studiesApi.listAvailableForRecruitment(request, controller.signal)).resolves.toEqual(options);
    expect(request).toHaveBeenCalledWith('/studies/disponiveis-recrutamento', { signal: controller.signal });
  });

  it('usa PATCH para atualizar um estudo existente', async () => {
    const request = vi.fn().mockResolvedValue(okResponse(study));
    await expect(studiesApi.update(request, study.id, input)).resolves.toEqual(study);
    expect(request).toHaveBeenCalledWith(`/studies/${study.id}`, expect.objectContaining({ method: 'PATCH' }));
  });

  it('altera o estado com PATCH /studies/:id/status e o corpo { status }', async () => {
    const updated = { ...study, status: 'encerrado' as const };
    const request = vi.fn().mockResolvedValue(okResponse(updated));
    await expect(studiesApi.transitionStatus(request, study.id, 'encerrado')).resolves.toEqual(updated);
    expect(request).toHaveBeenCalledWith(`/studies/${study.id}/status`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'encerrado' }),
    });
  });

  it.each([
    [400, 'Transição de "planejamento" para "execução" não permitida.'],
    [400, 'Estado de estudo desconhecido.'],
    [401, 'Token inválido ou expirado. Entre novamente.'],
    [403, 'Você não tem permissão para alterar este estudo.'],
    [404, 'Estudo não encontrado.'],
  ])('na alteração de estado, apresenta a mensagem do backend para HTTP %i', async (status, message) => {
    const request = vi.fn().mockResolvedValue(errorResponse(status, message));
    await expect(studiesApi.transitionStatus(request, study.id, 'recrutamento')).rejects.toThrow(message);
  });

  it('na alteração de estado, não expõe detalhes de erro do servidor nem de conexão', async () => {
    await expect(studiesApi.transitionStatus(vi.fn().mockResolvedValue(errorResponse(500, 'QueryFailedError')), study.id, 'recrutamento'))
      .rejects.toThrow('Ocorreu um erro inesperado no servidor.');
    await expect(studiesApi.transitionStatus(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')), study.id, 'recrutamento'))
      .rejects.toThrow('Não foi possível conectar à API de estudos.');
  });

  it('apresenta a mensagem de erro devolvida pela API', async () => {
    const request = vi.fn().mockResolvedValue(errorResponse(400, 'Data inválida.'));
    await expect(studiesApi.list(request)).rejects.toThrow('Data inválida.');
  });

  it('não expõe a mensagem técnica de erros do servidor', async () => {
    const request = vi.fn().mockResolvedValue(errorResponse(500, 'Internal server error'));
    await expect(studiesApi.create(request, input)).rejects.toThrow('Ocorreu um erro inesperado no servidor.');
  });

  it('traduz falha de conexão para uma mensagem compreensível', async () => {
    const request = vi.fn().mockRejectedValue(new Error('network error'));
    await expect(studiesApi.list(request)).rejects.toThrow('Não foi possível conectar à API de estudos.');
  });
});
