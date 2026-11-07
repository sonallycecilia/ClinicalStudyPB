import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StudyVisitsSection } from './StudyVisitsSection';
import { StudiesPage } from '../pages/StudiesPage';
import type { Study } from '../studies/studiesApi';
import type { PlannedVisit, VisitActivity } from '../studies/visitsApi';
import type { WebUser } from '../types';

const { mockUseAuth, mockRequest } = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockRequest: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

const researcher: WebUser = {
  id: 'researcher-id',
  name: 'Marina Costa',
  email: 'marina@example.test',
  phone: '83999990000',
  role: 'Pesquisador',
  status: 'Ativo',
  createdAt: '2026-10-01T12:00:00.000Z',
};

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

type Override = (path: string, init: RequestInit | undefined) => Response | null;

type LoseResponse = (path: string, body: Record<string, unknown>) => boolean;

/**
 * API em memória que grava visitas e atividades como o backend, com falhas injetáveis.
 * `loseResponse` simula a conexão caindo depois de o backend gravar.
 */
function routeApi(seed: { visits?: PlannedVisit[]; activities?: VisitActivity[] } = {}, override?: Override, loseResponse?: LoseResponse) {
  const visits = [...(seed.visits ?? [])];
  const activities = [...(seed.activities ?? [])];
  let nextId = 1;
  mockRequest.mockImplementation(async (path: string, init?: RequestInit) => {
    const custom = override?.(path, init);
    if (custom) return custom;
    const match = /^\/studies\/([^/]+)\/visits(?:\/([^/]+)\/activities)?$/.exec(path);
    if (!match) return jsonResponse({ message: 'Not Found' }, 404);
    const [, studyId, visitId] = match;
    const body = init?.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
    if (init?.method === 'POST' && visitId) {
      const created = { id: `activity-${nextId++}`, visitId, description: null, ...body } as VisitActivity;
      activities.push(created);
      if (loseResponse?.(path, body)) throw new TypeError('Failed to fetch');
      return jsonResponse(created, 201);
    }
    if (init?.method === 'POST') {
      const created = { id: `visit-${nextId++}`, studyId, ...body } as PlannedVisit;
      visits.push(created);
      if (loseResponse?.(path, body)) throw new TypeError('Failed to fetch');
      return jsonResponse(created, 201);
    }
    if (visitId) return jsonResponse(activities.filter((item) => item.visitId === visitId));
    return jsonResponse(visits.filter((item) => item.studyId === studyId).sort((a, b) => a.order - b.order));
  });
  return { visits, activities };
}

const baseline: PlannedVisit = { id: 'v1', studyId: 'study-one', name: 'Consulta inicial', order: 1, intervalDays: null, description: 'Realizada após a inclusão.' };
const followUp: PlannedVisit = { id: 'v2', studyId: 'study-one', name: 'Retorno', order: 2, intervalDays: 14, description: null };
const vitals: VisitActivity = { id: 'a1', visitId: 'v1', name: 'Coleta de sinais vitais', type: 'Exame', description: 'Aferir pressão arterial.' };

const posts = () => mockRequest.mock.calls
  .filter(([, init]) => init?.method === 'POST')
  .map(([path, init]) => [path, JSON.parse(String(init.body))]);

async function openForm() {
  fireEvent.click(await screen.findByRole('button', { name: '+ Cadastrar visita' }));
  return screen.getByRole('dialog', { name: 'Cadastrar visita prevista' });
}

function fill(scope: HTMLElement, label: RegExp, value: string) {
  fireEvent.change(within(scope).getByLabelText(label), { target: { value } });
}

function addActivity(dialog: HTMLElement, index: number, name: string, type: string) {
  fireEvent.click(within(dialog).getByRole('button', { name: '+ Adicionar atividade' }));
  const group = within(dialog).getByRole('group', { name: `Atividade ${index}` });
  fill(group, /Nome da atividade/, name);
  fill(group, /^Tipo/, type);
  return group;
}

beforeEach(() => {
  mockUseAuth.mockReturnValue({ user: researcher, accessToken: 'token', request: mockRequest });
});

afterEach(() => {
  cleanup();
  mockRequest.mockReset();
  vi.clearAllMocks();
});

describe('StudyVisitsSection — listagem', () => {
  it('exibe as visitas do estudo em ordem, com intervalo, descrição e atividades', async () => {
    routeApi({ visits: [followUp, baseline], activities: [vitals] });
    render(<StudyVisitsSection studyId="study-one" />);

    expect(screen.getByRole('status').textContent).toBe('Carregando visitas...');
    const first = await screen.findByRole('article', { name: /Visita 1 Consulta inicial/ });
    const second = screen.getByRole('article', { name: /Visita 2 Retorno/ });
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(first).getByText('Realizada após a inclusão.')).toBeTruthy();
    expect(within(first).getByText('Intervalo não informado')).toBeTruthy();
    expect(within(first).getByText('Coleta de sinais vitais')).toBeTruthy();
    expect(within(first).getByText('Exame')).toBeTruthy();
    expect(within(first).getByText('1 atividade')).toBeTruthy();
    expect(within(second).getByText('14 dias após a visita anterior')).toBeTruthy();
    expect(within(second).getByText('Nenhuma atividade cadastrada.')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-one/visits', expect.anything());
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-one/visits/v1/activities', expect.anything());
  });

  it('informa quando o estudo não possui visitas', async () => {
    routeApi();
    render(<StudyVisitsSection studyId="study-one" />);
    expect(await screen.findByText('Nenhuma visita prevista cadastrada para este estudo.')).toBeTruthy();
  });

  it('exibe o erro de carregamento e permite tentar novamente', async () => {
    let fail = true;
    routeApi({ visits: [baseline] }, () => fail ? jsonResponse({ message: 'Internal server error' }, 500) : null);
    render(<StudyVisitsSection studyId="study-one" />);

    expect((await screen.findByRole('alert')).textContent).toBe('Ocorreu um erro inesperado ao carregar as visitas. Tente novamente em alguns instantes.');
    expect(screen.getByRole('button', { name: '+ Cadastrar visita' })).toHaveProperty('disabled', true);
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('article', { name: /Consulta inicial/ })).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('não oferece nova tentativa quando o acesso é negado', async () => {
    routeApi({}, () => jsonResponse({ message: 'Somente o pesquisador proprietário pode consultar as visitas.' }, 403));
    render(<StudyVisitsSection studyId="study-one" />);

    expect((await screen.findByRole('alert')).textContent).toBe('Somente o pesquisador proprietário pode consultar as visitas.');
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
  });

  it('não mistura visitas ao trocar de estudo', async () => {
    routeApi({ visits: [baseline, { ...followUp, id: 'v9', studyId: 'study-two', name: 'Visita de outro estudo' }] });
    const { rerender } = render(<StudyVisitsSection key="study-one" studyId="study-one" />);
    expect(await screen.findByText('Consulta inicial')).toBeTruthy();

    rerender(<StudyVisitsSection key="study-two" studyId="study-two" />);

    expect(await screen.findByText('Visita de outro estudo')).toBeTruthy();
    expect(screen.queryByText('Consulta inicial')).toBeNull();
  });
});

describe('StudyVisitsSection — cadastro', () => {
  it('cadastra a visita com várias atividades no estudo correto e atualiza a lista', async () => {
    routeApi({ visits: [baseline] });
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    expect(within(dialog).getByLabelText(/^Ordem/)).toHaveProperty('value', '2');
    fill(dialog, /Nome da visita/, '  Retorno  ');
    fill(dialog, /Intervalo/, '14');
    fill(dialog, /Descrição da visita/, 'Primeiro retorno.');
    const blood = addActivity(dialog, 1, 'Coleta de sangue', 'Exame');
    fill(blood, /Descrição da atividade/, '  Tubo com EDTA.  ');
    addActivity(dialog, 2, 'Questionário de sono', 'Questionário');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect((await screen.findByText('Visita cadastrada com sucesso.'))).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(posts()).toEqual([
      ['/studies/study-one/visits', { name: 'Retorno', order: 2, intervalDays: 14, description: 'Primeiro retorno.' }],
      ['/studies/study-one/visits/visit-1/activities', { name: 'Coleta de sangue', type: 'Exame', description: 'Tubo com EDTA.' }],
      ['/studies/study-one/visits/visit-1/activities', { name: 'Questionário de sono', type: 'Questionário', description: null }],
    ]);
    const created = await screen.findByRole('article', { name: /Visita 2 Retorno/ });
    expect(within(created).getByText('Coleta de sangue')).toBeTruthy();
    expect(within(created).getByText('Tubo com EDTA.')).toBeTruthy();
    expect(within(created).getByText('Questionário de sono')).toBeTruthy();
  });

  it('permite cadastrar uma visita sem atividades e remover atividades adicionadas', async () => {
    routeApi();
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, '', '');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover atividade 1' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect(await screen.findByRole('article', { name: /Visita 1 Consulta inicial/ })).toBeTruthy();
    expect(posts()).toEqual([['/studies/study-one/visits', { name: 'Consulta inicial', order: 1, intervalDays: null, description: null }]]);
  });

  it('remove uma atividade do meio sem perder as demais nem manter os erros da removida', async () => {
    routeApi();
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    addActivity(dialog, 2, '', '');
    addActivity(dialog, 3, 'Questionário', 'Entrevista');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));
    expect(within(within(dialog).getByRole('group', { name: 'Atividade 2' })).getAllByRole('alert')).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remover atividade 2' }));

    expect(within(dialog).queryAllByRole('alert')).toEqual([]);
    expect(within(dialog).getByText('2 atividades')).toBeTruthy();
    expect(within(within(dialog).getByRole('group', { name: 'Atividade 1' })).getByLabelText(/Nome da atividade/)).toHaveProperty('value', 'Coleta');
    expect(within(within(dialog).getByRole('group', { name: 'Atividade 2' })).getByLabelText(/Nome da atividade/)).toHaveProperty('value', 'Questionário');
    expect(within(dialog).queryByRole('group', { name: 'Atividade 3' })).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));
    expect(await screen.findByText('Visita cadastrada com sucesso.')).toBeTruthy();
    expect(posts().map(([path, body]) => [path, body.name])).toEqual([
      ['/studies/study-one/visits', 'Consulta inicial'],
      ['/studies/study-one/visits/visit-1/activities', 'Coleta'],
      ['/studies/study-one/visits/visit-1/activities', 'Questionário'],
    ]);
  });

  it('valida campos obrigatórios, limites e ordem repetida sem chamar a API', async () => {
    routeApi({ visits: [baseline] });
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, '   ');
    fill(dialog, /^Ordem/, '1');
    fill(dialog, /Descrição da visita/, 'x'.repeat(2001));
    const activity = addActivity(dialog, 1, 'x'.repeat(151), '');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    const alerts = () => within(dialog).getAllByRole('alert').map((item) => item.textContent);
    expect(alerts()).toEqual([
      'Este campo é obrigatório.',
      'Já existe uma visita com essa ordem neste estudo.',
      'Informe no máximo 2000 caracteres.',
      'Informe no máximo 150 caracteres.',
      'Este campo é obrigatório.',
    ]);
    expect(within(activity).getByLabelText(/^Tipo/).getAttribute('aria-invalid')).toBe('true');

    fill(dialog, /^Ordem/, '0');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));
    expect(alerts()).toContain('Informe um número inteiro maior ou igual a 1.');
    expect(posts()).toEqual([]);
  });

  it.each([
    ['Ordem', '-1', 'Informe um número inteiro maior ou igual a 1.'],
    ['Ordem', '1.5', 'Informe um número inteiro maior ou igual a 1.'],
    ['Ordem', '2,5', 'Informe um número inteiro maior ou igual a 1.'],
    ['Ordem', 'abc', 'Informe um número inteiro maior ou igual a 1.'],
    ['Ordem', '   ', 'Este campo é obrigatório.'],
    ['Ordem', '2147483648', 'Informe um número de no máximo 2147483647.'],
    ['Intervalo', '-1', 'Informe um número inteiro maior ou igual a 0.'],
    ['Intervalo', '1.5', 'Informe um número inteiro maior ou igual a 0.'],
    ['Intervalo', '2147483648', 'Informe um número de no máximo 2147483647.'],
  ])('recusa %s com o valor "%s" sem alterar o que foi digitado', async (label, value, message) => {
    routeApi();
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, 'Consulta');
    fill(dialog, new RegExp(`^${label}`), value);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    const input = within(dialog).getByLabelText(new RegExp(`^${label}`));
    expect(within(dialog).getByRole('alert').textContent).toBe(message);
    expect(input).toHaveProperty('value', value);
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(posts()).toEqual([]);
  });

  it('aceita intervalo zero, valores nos limites e remove espaços das pontas antes de salvar', async () => {
    routeApi();
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, `  ${'n'.repeat(150)}  `);
    fill(dialog, /^Ordem/, ' 3 ');
    fill(dialog, /Intervalo/, '0');
    fill(dialog, /Descrição da visita/, `${'d'.repeat(2000)}   `);
    const activity = addActivity(dialog, 1, '  Coleta  ', ` ${'t'.repeat(50)} `);
    fill(activity, /Descrição da atividade/, '   ');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect(await screen.findByText('Visita cadastrada com sucesso.')).toBeTruthy();
    expect(posts()).toEqual([
      ['/studies/study-one/visits', { name: 'n'.repeat(150), order: 3, intervalDays: 0, description: 'd'.repeat(2000) }],
      ['/studies/study-one/visits/visit-1/activities', { name: 'Coleta', type: 't'.repeat(50), description: null }],
    ]);
  });

  it('recusa campos de atividade vazios, só com espaços ou acima dos limites', async () => {
    routeApi();
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, 'Consulta');
    const blank = addActivity(dialog, 1, '   ', '   ');
    const long = addActivity(dialog, 2, 'Coleta', 't'.repeat(51));
    fill(long, /Descrição da atividade/, 'd'.repeat(2001));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect(within(blank).getAllByRole('alert').map((item) => item.textContent)).toEqual(['Este campo é obrigatório.', 'Este campo é obrigatório.']);
    expect(within(long).getAllByRole('alert').map((item) => item.textContent)).toEqual(['Informe no máximo 50 caracteres.', 'Informe no máximo 2000 caracteres.']);
    expect(posts()).toEqual([]);
  });

  it('atualiza e remove as mensagens conforme os campos são corrigidos', async () => {
    routeApi({ visits: [baseline] });
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    const activity = addActivity(dialog, 1, '', '');

    fill(dialog, /^Ordem/, '');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));
    const orderError = () => within(dialog).getByLabelText(/^Ordem/).closest('label')?.querySelector('[role="alert"]')?.textContent;
    expect(orderError()).toBe('Este campo é obrigatório.');

    fill(dialog, /^Ordem/, '1.5');
    expect(orderError()).toBe('Informe um número inteiro maior ou igual a 1.');
    fill(dialog, /^Ordem/, '1');
    expect(orderError()).toBe('Já existe uma visita com essa ordem neste estudo.');
    fill(dialog, /^Ordem/, '2');
    expect(orderError()).toBeUndefined();
    expect(within(dialog).getByLabelText(/^Ordem/).getAttribute('aria-invalid')).toBe('false');

    fill(dialog, /Nome da visita/, '   ');
    expect(within(dialog).getByLabelText(/Nome da visita/).getAttribute('aria-invalid')).toBe('true');
    fill(dialog, /Nome da visita/, 'Retorno');
    fill(activity, /Nome da atividade/, 'Coleta');
    fill(activity, /^Tipo/, 'Exame');
    expect(within(dialog).queryAllByRole('alert')).toEqual([]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));
    expect(await screen.findByText('Visita cadastrada com sucesso.')).toBeTruthy();
  });

  it('não envia a visita duas vezes enquanto o cadastro está em andamento', async () => {
    let release: (response: Response) => void = () => undefined;
    routeApi();
    const routed = mockRequest.getMockImplementation()!;
    mockRequest.mockImplementation(async (path: string, init?: RequestInit) => init?.method === 'POST'
      ? await new Promise<Response>((resolve) => { release = resolve; })
      : routed(path, init));
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta');

    const form = dialog.querySelector('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(within(dialog).getByRole('button', { name: 'Salvando...' })).toHaveProperty('disabled', true);
    expect(within(dialog).getByRole('button', { name: 'Cancelar' })).toHaveProperty('disabled', true);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Salvando...' }));
    expect(posts()).toHaveLength(1);

    release(jsonResponse({ ...baseline, id: 'visit-x', name: 'Consulta' }, 201));
    expect(await screen.findByText('Visita cadastrada com sucesso.')).toBeTruthy();
    expect(posts()).toHaveLength(1);
  });

  it('traduz a recusa de validação da API e destaca o campo da visita, preservando os dados', async () => {
    routeApi({}, (_path, init) => init?.method === 'POST'
      ? jsonResponse({ statusCode: 400, message: ['name must be shorter than or equal to 150 characters'], error: 'Bad Request' }, 400)
      : null);
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    await within(dialog).findByText('Os dados da visita foram recusados pelo servidor. Revise os campos e tente novamente.');
    expect(within(dialog).getByText('O servidor recusou este valor. Revise o campo.')).toBeTruthy();
    expect(within(dialog).queryByText(/must be/)).toBeNull();
    expect(within(dialog).getByLabelText(/Nome da visita/).getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByLabelText(/Nome da visita/)).toHaveProperty('value', 'Consulta');
  });

  it('destaca a atividade recusada pela API depois de a visita ser gravada', async () => {
    routeApi({}, (path, init) => init?.method === 'POST' && path.endsWith('/activities') && String(init.body).includes('Questionário')
      ? jsonResponse({ statusCode: 400, message: ['type must be shorter than or equal to 50 characters'], error: 'Bad Request' }, 400)
      : null);
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    addActivity(dialog, 2, 'Questionário', 'Entrevista');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect(await within(dialog).findByText(/^A visita foi salva com 1 atividade, mas 1 atividade não foi salva\./)).toBeTruthy();
    const pending = within(dialog).getByRole('group', { name: 'Atividade 1' });
    expect(within(dialog).queryByRole('group', { name: 'Atividade 2' })).toBeNull();
    expect(within(pending).getByLabelText(/Nome da atividade/)).toHaveProperty('value', 'Questionário');
    expect(within(pending).getByLabelText(/^Tipo/).getAttribute('aria-invalid')).toBe('true');
    expect(within(pending).getByText('O servidor recusou este valor. Revise o campo.')).toBeTruthy();
  });

  it('mantém os dados preenchidos quando o backend recusa a visita', async () => {
    routeApi({}, (_path, init) => init?.method === 'POST' ? jsonResponse({ message: 'Já existe uma visita com essa ordem neste estudo.' }, 409) : null);
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    const alerts = await within(dialog).findAllByRole('alert');
    expect(alerts.map((item) => item.textContent)).toEqual(['Já existe uma visita com essa ordem neste estudo.', 'Já existe uma visita com essa ordem neste estudo.']);
    expect(within(dialog).getByLabelText(/^Ordem/).getAttribute('aria-invalid')).toBe('true');
    expect(within(dialog).getByLabelText(/Nome da visita/)).toHaveProperty('value', 'Consulta inicial');
    expect(within(dialog).getByLabelText(/Nome da atividade/)).toHaveProperty('value', 'Coleta');
    expect(within(dialog).getByRole('button', { name: 'Cadastrar visita' })).toHaveProperty('disabled', false);
    expect(posts()).toHaveLength(1);
  });

  it('após falha em uma atividade, tenta novamente somente as pendentes sem duplicar a visita', async () => {
    let failActivity = true;
    routeApi({}, (path, init) => {
      const body = init?.body ? String(init.body) : '';
      return failActivity && path.endsWith('/activities') && body.includes('Questionário') ? jsonResponse({}, 500) : null;
    });
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    addActivity(dialog, 2, 'Questionário', 'Entrevista');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect((await within(dialog).findByRole('alert')).textContent)
      .toBe('A visita foi salva com 1 atividade, mas 1 atividade não foi salva. Ocorreu um erro inesperado ao salvar a visita. Tente novamente em alguns instantes.');
    expect(within(dialog).getByLabelText(/Nome da visita/)).toHaveProperty('disabled', true);
    expect(within(dialog).getByLabelText(/Nome da atividade/)).toHaveProperty('value', 'Questionário');

    failActivity = false;
    mockRequest.mockClear();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Visita cadastrada com sucesso.')).toBeTruthy();
    expect(posts()).toEqual([['/studies/study-one/visits/visit-1/activities', { name: 'Questionário', type: 'Entrevista', description: null }]]);
    const created = await screen.findByRole('article', { name: /Consulta inicial/ });
    expect(within(created).getByText('2 atividades')).toBeTruthy();
  });

  it('ao fechar depois de um salvamento parcial, atualiza a lista com o que foi gravado', async () => {
    routeApi({}, (path, init) => init?.method === 'POST' && path.endsWith('/activities') ? jsonResponse({}, 500) : null);
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();

    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));
    await within(dialog).findByRole('alert');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fechar' }));

    expect(await screen.findByRole('article', { name: /Consulta inicial/ })).toBeTruthy();
    expect(screen.queryByText('Visita cadastrada com sucesso.')).toBeNull();
  });

  it('cancelar não envia dados', async () => {
    routeApi();
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(posts()).toEqual([]);
  });
});

describe('StudyVisitsSection — integração com a API', () => {
  it('exibe cada atividade na visita à qual pertence', async () => {
    routeApi({
      visits: [baseline, followUp],
      activities: [vitals, { id: 'a2', visitId: 'v2', name: 'Questionário de sono', type: 'Questionário', description: null }],
    });
    render(<StudyVisitsSection studyId="study-one" />);

    const first = await screen.findByRole('list', { name: 'Atividades de Consulta inicial' });
    const second = screen.getByRole('list', { name: 'Atividades de Retorno' });
    expect(within(first).getAllByRole('listitem').map((item) => item.querySelector('strong')?.textContent)).toEqual(['Coleta de sinais vitais']);
    expect(within(second).getAllByRole('listitem').map((item) => item.querySelector('strong')?.textContent)).toEqual(['Questionário de sono']);
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-one/visits/v2/activities', expect.anything());
  });

  it('interrompe o carregamento ao sair da tela', async () => {
    mockRequest.mockImplementation(() => new Promise<Response>(() => undefined));
    const { unmount } = render(<StudyVisitsSection studyId="study-one" />);
    const signal = mockRequest.mock.calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    unmount();

    expect(signal.aborted).toBe(true);
  });

  it('não envia a visita de novo quando a conexão cai depois de o backend gravá-la', async () => {
    let lose = true;
    const store = routeApi({}, undefined, (path) => lose && path.endsWith('/visits'));
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
    expect(within(dialog).getByLabelText(/Nome da visita/)).toHaveProperty('value', 'Consulta inicial');
    lose = false;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect(await screen.findByText('Visita cadastrada com sucesso.')).toBeTruthy();
    expect(store.visits).toHaveLength(1);
    expect(store.activities.map((item) => [item.visitId, item.name])).toEqual([['visit-1', 'Coleta']]);
    expect(within(await screen.findByRole('article', { name: /Consulta inicial/ })).getByText('Coleta')).toBeTruthy();
  });

  it('não duplica a atividade quando a conexão cai depois de o backend gravá-la', async () => {
    let lose = true;
    const store = routeApi({}, undefined, (path, body) => lose && path.endsWith('/activities') && body.name === 'Coleta');
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    addActivity(dialog, 2, 'Questionário', 'Entrevista');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    await within(dialog).findByText(/^A visita foi salva, mas 2 atividades não foram salvas\./);
    lose = false;
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByText('Visita cadastrada com sucesso.')).toBeTruthy();
    expect(store.activities.map((item) => item.name)).toEqual(['Coleta', 'Questionário']);
    expect(within(await screen.findByRole('article', { name: /Consulta inicial/ })).getByText('2 atividades')).toBeTruthy();
  });

  it('ao fechar após uma falha de conexão, recarrega a lista com o que o backend gravou', async () => {
    routeApi({}, undefined, (path) => path.endsWith('/visits'));
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta inicial');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));
    await within(dialog).findByRole('alert');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));

    expect(await screen.findByRole('article', { name: /Consulta inicial/ })).toBeTruthy();
  });

  it.each([
    [401, { message: 'Sessão inválida.' }, 'Sessão inválida.'],
    [403, { message: 'Somente o pesquisador proprietário pode cadastrar visitas.' }, 'Somente o pesquisador proprietário pode cadastrar visitas.'],
    [404, { message: 'Cannot POST' }, 'Estudo ou visita não encontrada. Volte à lista de estudos e tente novamente.'],
    [500, { message: 'Internal server error' }, 'Ocorreu um erro inesperado ao salvar a visita. Tente novamente em alguns instantes.'],
  ])('exibe uma mensagem compreensível quando o cadastro responde HTTP %i', async (status, body, message) => {
    routeApi({}, (_path, init) => init?.method === 'POST' ? jsonResponse(body, status) : null);
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta inicial');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(message);
    expect(within(dialog).getByLabelText(/Nome da visita/)).toHaveProperty('value', 'Consulta inicial');
  });
});

describe('StudyVisitsSection — estudo encerrado', () => {
  it('em modo somente leitura, mantém a listagem e não oferece o cadastro', async () => {
    routeApi({ visits: [baseline], activities: [vitals] });
    render(<StudyVisitsSection studyId="study-one" readOnly />);

    const visit = await screen.findByRole('article', { name: /Visita 1 Consulta inicial/ });
    expect(within(visit).getByText('Coleta de sinais vitais')).toBeTruthy();
    expect(screen.getByText('Estudo encerrado: as visitas podem ser consultadas, mas não é possível cadastrar novas.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Cadastrar visita' })).toBeNull();
  });

  it('exibe a recusa do backend quando o estudo é encerrado durante o cadastro, preservando os dados', async () => {
    routeApi({}, (_path, init) => init?.method === 'POST'
      ? jsonResponse({ statusCode: 400, message: 'Não é possível alterar um estudo encerrado.', error: 'Bad Request' }, 400)
      : null);
    render(<StudyVisitsSection studyId="study-one" />);
    const dialog = await openForm();
    fill(dialog, /Nome da visita/, 'Consulta inicial');
    addActivity(dialog, 1, 'Coleta', 'Exame');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar visita' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe('Não é possível alterar um estudo encerrado.');
    expect(within(dialog).getAllByRole('alert')).toHaveLength(1);
    expect(within(dialog).getByLabelText(/Nome da visita/)).toHaveProperty('value', 'Consulta inicial');
    expect(within(dialog).getByLabelText(/Nome da atividade/)).toHaveProperty('value', 'Coleta');
  });
});

describe('StudyVisitsSection — detalhes do estudo', () => {
  const study: Study = {
    id: 'study-one', code: 'EST-001', title: 'Qualidade do sono', objective: 'Avaliar padrões de sono.',
    researcherId: researcher.id, researcher: researcher.name, startDate: '2026-10-01', endDate: '2026-12-31',
    participantLimit: 20, participantsLinked: 5, status: 'execução', kind: 'Estudo observacional', symbol: 'moon',
  };

  async function openDetails(status: Study['status']) {
    const current = { ...study, status };
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/studies') return jsonResponse([current]);
      if (path === '/studies/study-one') return jsonResponse(current);
      if (path === '/studies/study-one/visits') return jsonResponse([baseline]);
      return jsonResponse([]);
    });
    render(<StudiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: `Ações de ${study.title}` }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    return await screen.findByRole('article', { name: /Visita 1 Consulta inicial/ });
  }

  it('oferece o cadastro de visitas em estudo não encerrado', async () => {
    await openDetails('execução');
    expect(screen.getByRole('button', { name: '+ Cadastrar visita' })).toBeTruthy();
  });

  it('lista as visitas, mas não oferece o cadastro, em estudo encerrado', async () => {
    await openDetails('encerrado');
    expect(screen.queryByRole('button', { name: '+ Cadastrar visita' })).toBeNull();
    expect(screen.getByText('Estudo encerrado: as visitas podem ser consultadas, mas não é possível cadastrar novas.')).toBeTruthy();
  });

  it('ao encerrar o estudo pela API nos detalhes, mantém as visitas e deixa de oferecer o cadastro', async () => {
    await openDetails('execução');
    const routed = mockRequest.getMockImplementation()!;
    mockRequest.mockImplementation(async (path: string, init?: RequestInit) => path === '/studies/study-one/status'
      ? jsonResponse({ ...study, status: JSON.parse(String(init?.body)).status })
      : routed(path, init));

    fireEvent.click(screen.getByRole('button', { name: /Alterar estado/ }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Alterar estado do estudo' })).getByRole('button', { name: 'Confirmar alteração' }));

    expect(await screen.findByText('Estado do estudo "Qualidade do sono" alterado para Encerrado.')).toBeTruthy();
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-one/status', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'encerrado' }) }));
    const hero = screen.getByRole('heading', { level: 1, name: study.title }).closest('header')!;
    expect(within(hero).getByText('Encerrado').classList.contains('status-encerrado')).toBe(true);
    expect(screen.getByRole('article', { name: /Visita 1 Consulta inicial/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '+ Cadastrar visita' })).toBeNull();
    expect(screen.getByText('Estudo encerrado: as visitas podem ser consultadas, mas não é possível cadastrar novas.')).toBeTruthy();
  });

  it('ao trocar de estudo nos detalhes, mostra o estado e as visitas somente do estudo aberto', async () => {
    const other: Study = { ...study, id: 'study-two', code: 'EST-002', title: 'Atividade física', status: 'planejamento' };
    const otherVisit: PlannedVisit = { ...baseline, id: 'v9', studyId: 'study-two', name: 'Avaliação física' };
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/studies') return jsonResponse([study, other]);
      if (path === '/studies/study-one') return jsonResponse(study);
      if (path === '/studies/study-two') return jsonResponse(other);
      if (path === '/studies/study-one/visits') return jsonResponse([baseline]);
      if (path === '/studies/study-two/visits') return jsonResponse([otherVisit]);
      return jsonResponse([]);
    });
    render(<StudiesPage />);
    const heroOf = (title: string) => screen.getByRole('heading', { level: 1, name: title }).closest('header')!;

    fireEvent.click(await screen.findByRole('button', { name: `Ações de ${study.title}` }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    expect(await screen.findByRole('article', { name: /Visita 1 Consulta inicial/ })).toBeTruthy();
    expect(within(heroOf(study.title)).getByText('Execução')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Voltar aos estudos' }));
    fireEvent.click(await screen.findByRole('button', { name: `Ações de ${other.title}` }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));

    expect(await screen.findByRole('article', { name: /Visita 1 Avaliação física/ })).toBeTruthy();
    expect(screen.queryByRole('article', { name: /Consulta inicial/ })).toBeNull();
    expect(within(heroOf(other.title)).getByText('Planejamento')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Cadastrar visita' })).toBeTruthy();
  });
});
