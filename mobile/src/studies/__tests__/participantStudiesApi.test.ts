import { describe, expect, it, jest } from '@jest/globals';
import { participantStudiesService } from '../participantStudiesApi';
import { studies } from '../../../tests/fixtures/studies';

describe('Consulta de estudos do participante', () => {
  it('consulta apenas E09 sem parâmetros e preserva os dados de participação e study', async () => {
    const client = { get: jest.fn<() => Promise<unknown>>().mockResolvedValue(studies) };
    await expect(participantStudiesService.listForAuthenticatedParticipant(client)).resolves.toEqual(studies);
    expect(client.get.mock.calls).toEqual([['/me/studies']]);
  });

  it('aceita 200 [] como lista vazia', async () => {
    await expect(participantStudiesService.listForAuthenticatedParticipant({ get: async () => [] })).resolves.toEqual([]);
  });

  it.each([null, {}, { data: studies }, [studies[0].study], [{ ...studies[0], study: null }],
    [{ ...studies[0], participationStatus: 'Inválido' }], [{ ...studies[0], includedAt: 'inválida' }]])('recusa resposta fora de E09: %j', async data => {
    await expect(participantStudiesService.listForAuthenticatedParticipant({ get: async () => data })).rejects.toThrow('formato inválido');
  });

  it('preserva participações retiradas e concluídas', async () => {
    const data = ['Retirado', 'Concluído'].map(participationStatus => ({ ...studies[0], participationStatus }));
    await expect(participantStudiesService.listForAuthenticatedParticipant({ get: async () => data })).resolves.toEqual(data);
  });
});
