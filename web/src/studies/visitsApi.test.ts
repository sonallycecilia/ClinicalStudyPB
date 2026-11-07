import { describe, expect, it, vi } from 'vitest';
import { VisitsApiError, listVisitsWithActivities, savePlannedVisit, visitsApi } from './visitsApi';
import type { PlannedVisit, VisitActivity } from './visitsApi';

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

const visit: PlannedVisit = { id: 'visit-1', studyId: 'study-one', name: 'Consulta inicial', order: 1, intervalDays: null, description: null };
const activity = (id: string, name: string): VisitActivity => ({ id, visitId: visit.id, name, type: 'Exame', description: null });
const postBodies = (request: ReturnType<typeof vi.fn>) => request.mock.calls
  .filter(([, init]) => init?.method === 'POST')
  .map(([path, init]) => [path, JSON.parse(String(init.body))]);

describe('visitsApi', () => {
  it('lista as visitas do estudo e as atividades de cada visita', async () => {
    const request = vi.fn(async (path: string) => jsonResponse(path.endsWith('/activities') ? [activity('a1', 'Coleta')] : [visit]));

    const result = await listVisitsWithActivities(request, 'study-one');

    expect(request.mock.calls.map(([path]) => path)).toEqual([
      '/studies/study-one/visits',
      '/studies/study-one/visits/visit-1/activities',
    ]);
    expect(result).toEqual([{ ...visit, activities: [activity('a1', 'Coleta')] }]);
  });

  it('codifica os identificadores no caminho', async () => {
    const request = vi.fn(async (_path: string) => jsonResponse([]));
    await visitsApi.list(request, 'a/b');
    expect(request.mock.calls[0]?.[0]).toBe('/studies/a%2Fb/visits');
  });

  it('envia somente os campos aceitos pelo backend', async () => {
    const request = vi.fn(async () => jsonResponse({ ...visit }, 201));
    await visitsApi.create(request, 'study-one', { name: 'Consulta', order: 2, intervalDays: 14, description: null, extra: true } as never);
    await visitsApi.createActivity(request, 'study-one', 'visit-1', { name: 'Coleta', type: 'Exame', description: 'Aferir', key: 'local' } as never);

    expect(postBodies(request)).toEqual([
      ['/studies/study-one/visits', { name: 'Consulta', order: 2, intervalDays: 14, description: null }],
      ['/studies/study-one/visits/visit-1/activities', { name: 'Coleta', type: 'Exame', description: 'Aferir' }],
    ]);
  });

  it.each([
    [400, { message: ['name should not be empty'] }, 'Os dados da visita foram recusados pelo servidor. Revise os campos e tente novamente.', false],
    [400, { message: 'Validation failed (uuid is expected)' }, 'Os dados da visita foram recusados pelo servidor. Revise os campos e tente novamente.', false],
    [403, { message: 'Somente o pesquisador proprietário.' }, 'Somente o pesquisador proprietário.', false],
    [404, { message: 'Cannot POST /x' }, 'Estudo ou visita não encontrada. Volte à lista de estudos e tente novamente.', false],
    [409, { message: 'Já existe uma visita com essa ordem neste estudo.' }, 'Já existe uma visita com essa ordem neste estudo.', false],
    [500, { message: 'Internal server error' }, 'Ocorreu um erro inesperado ao salvar a visita. Tente novamente em alguns instantes.', true],
  ])('traduz HTTP %i em mensagem para o usuário', async (status, body, message, retryable) => {
    const request = vi.fn(async () => jsonResponse(body, status));
    const error = await visitsApi.create(request, 'study-one', visit).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(VisitsApiError);
    expect(error).toMatchObject({ message, retryable });
  });

  it('aponta os campos recusados pelo ValidationPipe sem exibir o texto técnico em inglês', async () => {
    const request = vi.fn(async () => jsonResponse({
      statusCode: 400,
      message: ['name must be shorter than or equal to 150 characters', 'order must not be less than 1', 'property extra should not exist'],
      error: 'Bad Request',
    }, 400));
    const error = await visitsApi.create(request, 'study-one', visit).catch((reason: unknown) => reason) as VisitsApiError;

    expect(error.message).not.toMatch(/must|should/);
    expect(error.fieldErrors).toEqual({
      name: 'O servidor recusou este valor. Revise o campo.',
      order: 'O servidor recusou este valor. Revise o campo.',
      extra: 'O servidor recusou este valor. Revise o campo.',
    });
  });

  it.each([
    ['da visita', (request: ReturnType<typeof vi.fn>) => visitsApi.create(request, 'study-one', visit)],
    ['da atividade', (request: ReturnType<typeof vi.fn>) => visitsApi.createActivity(request, 'study-one', 'visit-1', { name: 'Coleta', type: 'Exame', description: null })],
  ])('exibe a regra de negócio do backend no cadastro %s em estudo encerrado, sem apontar campos', async (_label, create) => {
    const request = vi.fn(async (_path: string) => jsonResponse({ statusCode: 400, message: 'Não é possível alterar um estudo encerrado.', error: 'Bad Request' }, 400));
    const error = await create(request).catch((reason: unknown) => reason) as VisitsApiError;

    expect(error).toBeInstanceOf(VisitsApiError);
    expect(error).toMatchObject({ message: 'Não é possível alterar um estudo encerrado.', retryable: false, fieldErrors: {} });
  });

  it('associa o conflito 409 ao campo de ordem', async () => {
    const request = vi.fn(async () => jsonResponse({ message: 'Já existe uma visita com essa ordem neste estudo.' }, 409));
    const error = await visitsApi.create(request, 'study-one', visit).catch((reason: unknown) => reason) as VisitsApiError;
    expect(error.fieldErrors).toEqual({ order: 'Já existe uma visita com essa ordem neste estudo.' });
  });

  it('informa falha de conexão como erro que pode ser repetido', async () => {
    const request = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(visitsApi.list(request, 'study-one')).rejects.toMatchObject({
      message: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
      retryable: true,
    });
  });

  it('recusa uma listagem em formato inesperado', async () => {
    const request = vi.fn(async () => jsonResponse({ items: [] }));
    await expect(visitsApi.list(request, 'study-one')).rejects.toMatchObject({ retryable: true });
  });
});

describe('savePlannedVisit', () => {
  const input = { name: 'Consulta', order: 1, intervalDays: null, description: null };
  const first = { name: 'Coleta', type: 'Exame', description: '' };
  const second = { name: 'Questionário', type: 'Entrevista', description: '' };

  it('cria a visita e depois cada atividade vinculada a ela', async () => {
    const request = vi.fn(async (path: string) => jsonResponse(path.endsWith('/activities') ? activity('a', 'x') : visit, 201));

    const result = await savePlannedVisit(request, 'study-one', input, [first, second]);

    expect(result).toEqual({ visitId: 'visit-1', pendingActivities: [], createdActivityIds: ['a', 'a'], error: null });
    expect(postBodies(request).map(([path]) => path)).toEqual([
      '/studies/study-one/visits',
      '/studies/study-one/visits/visit-1/activities',
      '/studies/study-one/visits/visit-1/activities',
    ]);
  });

  it('devolve as atividades pendentes e, na nova tentativa, não recria a visita', async () => {
    let activityCalls = 0;
    const request = vi.fn(async (path: string) => {
      if (!path.endsWith('/activities')) return jsonResponse(visit, 201);
      activityCalls += 1;
      return activityCalls === 2 ? jsonResponse({}, 500) : jsonResponse(activity('a', 'x'), 201);
    });

    const failed = await savePlannedVisit(request, 'study-one', input, [first, second]);
    expect(failed.visitId).toBe('visit-1');
    expect(failed.pendingActivities).toEqual([second]);
    expect(failed.error?.retryable).toBe(true);

    request.mockClear();
    const retried = await savePlannedVisit(request, 'study-one', input, failed.pendingActivities, failed.visitId);
    expect(retried.error).toBeNull();
    expect(postBodies(request)).toEqual([['/studies/study-one/visits/visit-1/activities', { ...second, description: null }]]);
  });

  it('não envia atividades quando a visita é recusada', async () => {
    const request = vi.fn(async () => jsonResponse({ message: 'Já existe uma visita com essa ordem neste estudo.' }, 409));

    const result = await savePlannedVisit(request, 'study-one', input, [first]);

    expect(result.visitId).toBeNull();
    expect(result.pendingActivities).toEqual([first]);
    expect(result.error?.message).toBe('Já existe uma visita com essa ordem neste estudo.');
    expect(request).toHaveBeenCalledTimes(1);
  });

  describe('nova tentativa após falha de resultado incerto', () => {
    /** API em memória em que a resposta de uma gravação pode se perder depois de o backend gravar. */
    function lossyApi(loseResponseOf: (path: string, body: Record<string, unknown>) => boolean) {
      const visits: PlannedVisit[] = [];
      const activities: VisitActivity[] = [];
      let nextId = 1;
      const request = vi.fn(async (path: string, init?: RequestInit) => {
        const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
        const visitId = /\/visits\/([^/]+)\/activities$/.exec(path)?.[1];
        if (init?.method === 'POST') {
          const created = visitId
            ? { id: `activity-${nextId++}`, visitId, ...body } as VisitActivity
            : { id: `visit-${nextId++}`, studyId: 'study-one', ...body } as PlannedVisit;
          (visitId ? activities : visits).push(created as never);
          if (loseResponseOf(path, body)) throw new TypeError('Failed to fetch');
          return jsonResponse(created, 201);
        }
        return jsonResponse(visitId ? activities.filter((item) => item.visitId === visitId) : visits);
      });
      return { request, visits, activities };
    }

    it('reaproveita a visita gravada antes da perda da resposta, sem reenviá-la nem receber 409', async () => {
      let lose = true;
      const api = lossyApi((path) => lose && path.endsWith('/visits'));
      const failed = await savePlannedVisit(api.request, 'study-one', input, [first]);
      expect(failed).toMatchObject({ visitId: null, pendingActivities: [first], error: { retryable: true } });

      lose = false;
      const retried = await savePlannedVisit(api.request, 'study-one', input, failed.pendingActivities, failed.visitId, failed.createdActivityIds);

      expect(retried).toMatchObject({ visitId: 'visit-1', pendingActivities: [], error: null });
      expect(api.visits).toHaveLength(1);
      expect(api.activities.map((item) => [item.visitId, item.name])).toEqual([['visit-1', 'Coleta']]);
    });

    it('não duplica a atividade gravada antes da perda da resposta', async () => {
      let lose = true;
      const api = lossyApi((path, body) => lose && path.endsWith('/activities') && body.name === 'Questionário');
      const failed = await savePlannedVisit(api.request, 'study-one', input, [first, second]);
      expect(failed).toMatchObject({ visitId: 'visit-1', pendingActivities: [second], createdActivityIds: ['activity-2'] });

      lose = false;
      const retried = await savePlannedVisit(api.request, 'study-one', input, failed.pendingActivities, failed.visitId, failed.createdActivityIds);

      expect(retried).toMatchObject({ pendingActivities: [], createdActivityIds: [], error: null });
      expect(api.activities.map((item) => item.name)).toEqual(['Coleta', 'Questionário']);
    });

    it('preserva atividades repetidas de propósito: as criadas nesta sessão não contam como a pendente', async () => {
      const api = lossyApi(() => false);
      const original = api.request.getMockImplementation()!;
      let attempt = 0;
      api.request.mockImplementation(async (path: string, init?: RequestInit) => {
        if (init?.method === 'POST' && path.endsWith('/activities') && ++attempt === 2) return jsonResponse({}, 500);
        return original(path, init);
      });
      // A primeira "Coleta" é gravada; a segunda, idêntica, falha sem ser gravada.
      const failed = await savePlannedVisit(api.request, 'study-one', input, [first, { ...first }]);
      expect(failed.pendingActivities).toHaveLength(1);

      const retried = await savePlannedVisit(api.request, 'study-one', input, failed.pendingActivities, failed.visitId, failed.createdActivityIds);

      expect(retried.error).toBeNull();
      expect(api.activities.map((item) => item.name)).toEqual(['Coleta', 'Coleta']);
    });

    it('não reaproveita uma visita com a mesma ordem e dados diferentes', async () => {
      const api = lossyApi(() => false);
      api.visits.push({ ...visit, id: 'other', name: 'Outra visita' });
      const original = api.request.getMockImplementation()!;
      api.request.mockImplementation(async (path: string, init?: RequestInit) => init?.method === 'POST' && path.endsWith('/visits')
        ? jsonResponse({ message: 'Já existe uma visita com essa ordem neste estudo.' }, 409)
        : original(path, init));

      const retried = await savePlannedVisit(api.request, 'study-one', input, [first], null, []);

      expect(retried).toMatchObject({ visitId: null, error: { message: 'Já existe uma visita com essa ordem neste estudo.' } });
      expect(api.activities).toEqual([]);
    });

    it('sem nova tentativa incerta, não faz consultas extras antes de gravar', async () => {
      const api = lossyApi(() => false);
      await savePlannedVisit(api.request, 'study-one', input, [first]);
      expect(api.request.mock.calls.map(([, init]) => init?.method)).toEqual(['POST', 'POST']);
    });
  });
});
