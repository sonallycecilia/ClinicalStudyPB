import { beforeEach, describe, expect, it, vi } from 'vitest';
import { studiesApi } from './studiesApi';

const study = {
  id: 'd8d77e38-f240-4a1d-a17f-b0e918a548f3', code: 'EST-004', title: 'Sono e qualidade de vida',
  objective: 'Avaliar os padrões de sono em participantes fictícios.',
  researcherId: 'd8d77e38-f240-4a1d-a17f-b0e918a548f3', researcher: 'Marina Costa',
  startDate: '2026-10-24', endDate: '2026-12-10', participantLimit: 20,
  participantsLinked: 0, status: 'Em andamento' as const,
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

  it('usa PATCH para atualizar um estudo existente', async () => {
    const request = vi.fn().mockResolvedValue(okResponse(study));
    await expect(studiesApi.update(request, study.id, input)).resolves.toEqual(study);
    expect(request).toHaveBeenCalledWith(`/studies/${study.id}`, expect.objectContaining({ method: 'PATCH' }));
  });

  it('apresenta a mensagem de erro devolvida pela API', async () => {
    const request = vi.fn().mockResolvedValue(errorResponse(400, 'Data inválida.'));
    await expect(studiesApi.list(request)).rejects.toThrow('Data inválida.');
  });

  it('traduz falha de conexão para uma mensagem compreensível', async () => {
    const request = vi.fn().mockRejectedValue(new Error('network error'));
    await expect(studiesApi.list(request)).rejects.toThrow('Não foi possível conectar à API de estudos.');
  });
});
