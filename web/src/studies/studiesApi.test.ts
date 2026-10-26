import { beforeEach, describe, expect, it, vi } from 'vitest';
import { studiesApi } from './studiesApi';

const study = {
  id: 'study-4', code: 'EST-004', title: 'Sono e qualidade de vida',
  objective: 'Avaliar os padrões de sono em participantes fictícios.',
  researcherId: 'usr-researcher', researcher: 'Marina Costa',
  startDate: '2026-10-24', endDate: '2026-12-10', participantLimit: 20,
  participantsLinked: 0, status: 'Em andamento' as const,
  kind: 'Estudo observacional' as const, symbol: 'activity' as const,
};

beforeEach(() => vi.unstubAllGlobals());

describe('Studies API', () => {
  it('envia o token na listagem e devolve registros do backend', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => [study] });
    vi.stubGlobal('fetch', mock);
    await expect(studiesApi.list('meu-token')).resolves.toEqual([study]);
    expect(mock).toHaveBeenCalledWith('http://localhost:3000/studies',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer meu-token' }) }));
  });

  it('envia POST e interpreta o registro criado', async () => {
    const mock = vi.fn().mockResolvedValue({ ok: true, json: async () => study });
    vi.stubGlobal('fetch', mock);
    const input = {
      title: study.title, objective: study.objective, startDate: study.startDate,
      endDate: study.endDate, participantLimit: 20, participantsLinked: 0,
    };
    await expect(studiesApi.create('token', input)).resolves.toEqual(study);
    expect(mock).toHaveBeenCalledWith('http://localhost:3000/studies',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
  });

  it('apresenta a mensagem de erro da API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 400, json: async () => ({ message: 'Data inválida.' }),
    }));
    await expect(studiesApi.list('token')).rejects.toThrow('Data inválida.');
  });
});
