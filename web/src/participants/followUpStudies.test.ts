import { describe, expect, it, vi } from 'vitest';
import { isFollowUpStudy, isStudyWritable, listFollowUpStudies } from './followUpStudies';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
describe('estudos para acompanhamento do Coordenador', () => {
  it('consulta /studies/acompanhamento e devolve estudos em execução e encerrados', async () => {
    const rows = [{ id: 's1', title: 'Sono', status: 'execução' }, { id: 's2', title: 'Pressão', status: 'encerrado' }];
    const request = vi.fn().mockResolvedValue(json(rows));
    await expect(listFollowUpStudies(request)).resolves.toEqual(rows);
    expect(request).toHaveBeenCalledWith('/studies/acompanhamento', undefined);
  });
  it('recusa falha HTTP, corpo inválido e fase desconhecida', async () => {
    await expect(listFollowUpStudies(vi.fn().mockResolvedValue(json({}, 403)))).rejects.toThrow();
    await expect(listFollowUpStudies(vi.fn().mockResolvedValue(json({ a: 1 })))).rejects.toThrow();
    await expect(listFollowUpStudies(vi.fn().mockResolvedValue(json([{ id: 's1', title: 'x', status: 'planejamento' }])))).rejects.toThrow();
    expect(isFollowUpStudy({ id: 's1', title: 'x' })).toBe(false);
  });
  it('só libera alterações em recrutamento e execução', () => {
    expect(isStudyWritable('recrutamento')).toBe(true);
    expect(isStudyWritable('execução')).toBe(true);
    expect(isStudyWritable('encerrado')).toBe(false);
    expect(isStudyWritable(undefined)).toBe(false);
  });
});
