import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StudyCriteriaEditor, StudyCriteriaSection } from './StudyCriteriaSection';
import { StudiesPage } from '../pages/StudiesPage';
import type { CriterionDraft, EligibilityCriterion } from '../studies/criteriaApi';
import type { Study } from '../studies/studiesApi';
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

const study: Study = {
  id: 'study-one',
  code: 'EST-001',
  title: 'Qualidade do sono',
  objective: 'Avaliar padrões de sono em participantes fictícios.',
  researcherId: researcher.id,
  researcher: researcher.name,
  startDate: '2026-10-01',
  endDate: '2026-12-31',
  participantLimit: 20,
  participantsLinked: 5,
  status: 'execução',
  kind: 'Estudo observacional',
  symbol: 'moon',
};

const criteria: EligibilityCriterion[] = [
  { id: 'c1', studyId: study.id, type: 'Exclusão', description: 'Possuir insônia diagnosticada', active: true },
  { id: 'c2', studyId: study.id, type: 'Inclusão', description: 'Ter mais de 18 anos', active: true },
  { id: 'c3', studyId: study.id, type: 'Inclusão', description: 'Residir na Paraíba', active: false },
];

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as Response;
}

async function group(name: string): Promise<HTMLElement> {
  return await screen.findByRole('article', { name });
}

beforeEach(() => {
  mockRequest.mockImplementation(async () => jsonResponse(criteria));
  mockUseAuth.mockReturnValue({ user: researcher, accessToken: 'token', request: mockRequest });
});

afterEach(() => {
  cleanup();
  mockRequest.mockReset();
  vi.clearAllMocks();
});

describe('StudyCriteriaSection', () => {
  it('exibe os critérios cadastrados organizados por categoria', async () => {
    render(<StudyCriteriaSection studyId={study.id} />);

    const inclusion = await group('Critérios de inclusão');
    const exclusion = await group('Critérios de exclusão');
    expect(mockRequest.mock.calls[0]?.[0]).toBe('/studies/study-one/criteria');
    expect(within(inclusion).getByText('Ter mais de 18 anos')).toBeTruthy();
    expect(within(exclusion).getByText('Possuir insônia diagnosticada')).toBeTruthy();
    expect(within(exclusion).queryByText('Ter mais de 18 anos')).toBeNull();
  });

  it('não exibe critérios inativos, pois remover um critério o desativa na API', async () => {
    render(<StudyCriteriaSection studyId={study.id} />);

    const inclusion = await group('Critérios de inclusão');
    expect(within(inclusion).queryByText('Residir na Paraíba')).toBeNull();
    expect(within(inclusion).getByText('1 critério')).toBeTruthy();
  });

  it('é somente leitura: o cadastro de critérios fica no formulário do estudo', async () => {
    render(<StudyCriteriaSection studyId={study.id} />);
    await group('Critérios de inclusão');

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0]?.[1]?.method).toBeUndefined();
  });

  it('não mistura critérios ao trocar de estudo', async () => {
    mockRequest.mockImplementation(async (path: string) => jsonResponse(path.includes('study-two')
      ? [{ id: 'c9', studyId: 'study-two', type: 'Inclusão', description: 'Praticar atividade física', active: true }]
      : criteria));
    const { rerender } = render(<StudyCriteriaSection key="study-one" studyId="study-one" />);
    expect(await screen.findByText('Ter mais de 18 anos')).toBeTruthy();

    rerender(<StudyCriteriaSection key="study-two" studyId="study-two" />);

    expect(await screen.findByText('Praticar atividade física')).toBeTruthy();
    expect(screen.queryByText('Ter mais de 18 anos')).toBeNull();
    expect(screen.queryByText('Possuir insônia diagnosticada')).toBeNull();
  });

  it('informa categorias sem critérios', async () => {
    mockRequest.mockResolvedValueOnce(jsonResponse([]));
    render(<StudyCriteriaSection studyId={study.id} />);

    expect(await screen.findByText('Nenhum critério de inclusão cadastrado.')).toBeTruthy();
    expect(screen.getByText('Nenhum critério de exclusão cadastrado.')).toBeTruthy();
  });

  describe('erros da API ao carregar', () => {
    const retryButton = () => screen.queryByRole('button', { name: 'Tentar novamente' });

    it.each([
      [400, { statusCode: 400, message: 'Validation failed (uuid is expected)', error: 'Bad Request' }, 'Não foi possível identificar o estudo. Volte à lista de estudos e tente novamente.'],
      [401, { statusCode: 401, message: 'Token inválido ou expirado. Entre novamente.', error: 'Unauthorized' }, 'Token inválido ou expirado. Entre novamente.'],
      [401, null, 'Sua sessão expirou. Entre novamente para continuar.'],
      [403, { statusCode: 403, message: 'Você não tem permissão para acessar este estudo.', error: 'Forbidden' }, 'Você não tem permissão para acessar este estudo.'],
      [403, null, 'Você não tem permissão para acessar os critérios deste estudo.'],
      [403, { statusCode: 403, message: ['Primeira regra.', 'Segunda regra.'], error: 'Forbidden' }, 'Primeira regra. Segunda regra.'],
      [404, { statusCode: 404, message: 'Cannot GET /studies/x/criteria', error: 'Not Found' }, 'Estudo não encontrado. Volte à lista de estudos e tente novamente.'],
    ])('apresenta mensagem final para HTTP %i, sem oferecer nova tentativa (%#)', async (status, body, message) => {
      mockRequest.mockResolvedValueOnce(jsonResponse(body, status));
      render(<StudyCriteriaSection studyId={study.id} />);

      expect((await screen.findByRole('alert')).textContent).toBe(message);
      expect(retryButton()).toBeNull();
      expect(screen.queryByRole('article')).toBeNull();
    });

    it.each([
      [500, { statusCode: 500, message: 'Internal server error' }],
      [503, null],
      [429, { statusCode: 429, message: 'ThrottlerException: Too Many Requests' }],
    ])('não expõe detalhes técnicos em HTTP %i e permite tentar novamente', async (status, body) => {
      mockRequest.mockResolvedValueOnce(jsonResponse(body, status));
      render(<StudyCriteriaSection studyId={study.id} />);

      expect((await screen.findByRole('alert')).textContent).toBe('Ocorreu um erro inesperado ao carregar os critérios. Tente novamente em alguns instantes.');
      expect(retryButton()).toBeTruthy();
    });

    it('trata corpo de erro que não é JSON', async () => {
      mockRequest.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new SyntaxError('Unexpected token <'); } } as unknown as Response);
      render(<StudyCriteriaSection studyId={study.id} />);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('erro inesperado');
      expect(alert.textContent).not.toContain('Unexpected token');
    });

    it.each([
      ['JSON inválido', { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }],
      ['corpo que não é lista', { ok: true, status: 200, json: async () => ({ items: [] }) }],
    ])('trata resposta de sucesso com %s', async (_name, response) => {
      mockRequest.mockResolvedValueOnce(response as unknown as Response);
      render(<StudyCriteriaSection studyId={study.id} />);

      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('erro inesperado');
      expect(alert.textContent).not.toContain('Unexpected token');
      expect(retryButton()).toBeTruthy();
    });

    it('trata falha de conexão', async () => {
      mockRequest.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      render(<StudyCriteriaSection studyId={study.id} />);

      expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
      expect(retryButton()).toBeTruthy();
    });

    it('carrega os critérios ao tentar novamente depois de uma falha', async () => {
      mockRequest.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      render(<StudyCriteriaSection studyId={study.id} />);
      await screen.findByRole('alert');

      fireEvent.click(retryButton()!);

      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByRole('status').textContent).toContain('Carregando critérios');
      expect(within(await group('Critérios de inclusão')).getByText('Ter mais de 18 anos')).toBeTruthy();
      expect(screen.queryByRole('alert')).toBeNull();
      expect(retryButton()).toBeNull();
      expect(mockRequest).toHaveBeenCalledTimes(2);
    });

    it('volta a informar o erro quando a nova tentativa também falha', async () => {
      mockRequest.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      mockRequest.mockResolvedValueOnce(jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500));
      render(<StudyCriteriaSection studyId={study.id} />);
      await screen.findByRole('alert');

      fireEvent.click(retryButton()!);

      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('erro inesperado'));
      expect(retryButton()).toBeTruthy();
    });
  });
});

describe('StudyCriteriaEditor', () => {
  const initialDrafts: CriterionDraft[] = [
    { id: 'd1', type: 'Inclusão', description: 'Ter mais de 18 anos' },
    { id: 'd2', type: 'Inclusão', description: 'Residir na Paraíba' },
    { id: 'd3', type: 'Exclusão', description: 'Possuir insônia diagnosticada' },
  ];
  const onPendingChange = vi.fn();

  function Harness({ disabled = false }: { disabled?: boolean }) {
    const [drafts, setDrafts] = useState(initialDrafts);
    return <StudyCriteriaEditor drafts={drafts} onChange={setDrafts} onPendingChange={onPendingChange} disabled={disabled} />;
  }

  async function newCriterionForm() {
    render(<Harness />);
    const inclusion = await group('Critérios de inclusão');
    return {
      inclusion,
      field: within(inclusion).getByRole('textbox', { name: /Novo critério de inclusão/ }),
      submit: () => fireEvent.click(within(inclusion).getByRole('button', { name: '+ Adicionar critério' })),
    };
  }

  async function editForm() {
    render(<Harness />);
    const inclusion = await group('Critérios de inclusão');
    fireEvent.click(within(inclusion).getByRole('button', { name: 'Editar critério: Ter mais de 18 anos' }));
    return {
      inclusion,
      field: within(inclusion).getByRole('textbox', { name: /Editar critério/ }),
      save: () => fireEvent.click(within(inclusion).getByRole('button', { name: 'Salvar critério' })),
    };
  }

  it('adiciona mais de um critério na categoria correta, sem chamar a API', async () => {
    render(<Harness />);
    const exclusion = await group('Critérios de exclusão');
    const field = within(exclusion).getByRole('textbox', { name: /Novo critério de exclusão/ });

    for (const description of ['Estar gestante', 'Usar medicação contínua']) {
      fireEvent.change(field, { target: { value: `  ${description}  ` } });
      fireEvent.click(within(exclusion).getByRole('button', { name: '+ Adicionar critério' }));
      expect(within(exclusion).getByText(description)).toBeTruthy();
    }

    expect((field as HTMLTextAreaElement).value).toBe('');
    expect(within(exclusion).getByText('3 critérios')).toBeTruthy();
    expect(within(await group('Critérios de inclusão')).queryByText('Estar gestante')).toBeNull();
    expect(mockRequest).not.toHaveBeenCalled();
  });

  it('edita, cancela a edição e remove critérios', async () => {
    render(<Harness />);
    const inclusion = await group('Critérios de inclusão');

    fireEvent.click(within(inclusion).getByRole('button', { name: 'Editar critério: Ter mais de 18 anos' }));
    fireEvent.change(within(inclusion).getByRole('textbox', { name: /Editar critério/ }), { target: { value: 'Descartar' } });
    fireEvent.click(within(inclusion).getByRole('button', { name: 'Cancelar edição' }));
    expect(within(inclusion).getByText('Ter mais de 18 anos')).toBeTruthy();

    fireEvent.click(within(inclusion).getByRole('button', { name: 'Editar critério: Ter mais de 18 anos' }));
    fireEvent.change(within(inclusion).getByRole('textbox', { name: /Editar critério/ }), { target: { value: 'Ter mais de 21 anos' } });
    fireEvent.click(within(inclusion).getByRole('button', { name: 'Salvar critério' }));
    expect(within(inclusion).getByText('Ter mais de 21 anos')).toBeTruthy();
    expect(within(inclusion).queryByText('Ter mais de 18 anos')).toBeNull();

    fireEvent.click(within(inclusion).getByRole('button', { name: 'Remover critério: Ter mais de 21 anos' }));
    expect(within(inclusion).queryByText('Ter mais de 21 anos')).toBeNull();
    expect(within(inclusion).getByText('1 critério')).toBeTruthy();
  });

  it('informa quando há texto ainda não adicionado, ignorando apenas espaços', async () => {
    const { field } = await newCriterionForm();
    const lastPending = () => onPendingChange.mock.calls.filter(([type]) => type === 'Inclusão').at(-1)?.[1];

    expect(lastPending()).toBe(false);
    fireEvent.change(field, { target: { value: '   ' } });
    expect(lastPending()).toBe(false);
    fireEvent.change(field, { target: { value: 'Texto' } });
    expect(lastPending()).toBe(true);
    fireEvent.change(field, { target: { value: '' } });
    expect(lastPending()).toBe(false);
  });

  it('bloqueia os controles enquanto o cadastro é enviado', async () => {
    render(<Harness disabled />);
    const inclusion = await group('Critérios de inclusão');

    expect((within(inclusion).getByRole('button', { name: '+ Adicionar critério' }) as HTMLButtonElement).disabled).toBe(true);
    expect((within(inclusion).getByRole('button', { name: 'Remover critério: Ter mais de 18 anos' }) as HTMLButtonElement).disabled).toBe(true);
  });

  describe('validação do novo critério', () => {
    it('rejeita critério vazio', async () => {
      const { inclusion, field, submit } = await newCriterionForm();

      expect(within(inclusion).queryByRole('alert')).toBeNull();
      submit();

      expect(within(inclusion).getByRole('alert').textContent).toBe('Este campo é obrigatório.');
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(within(inclusion).getByText('2 critérios')).toBeTruthy();
    });

    it('rejeita critério contendo apenas espaços', async () => {
      const { inclusion, field, submit } = await newCriterionForm();

      fireEvent.change(field, { target: { value: '   ' } });
      submit();

      expect(within(inclusion).getByRole('alert').textContent).toBe('Informe uma descrição válida para o critério.');
      expect(within(inclusion).getByText('2 critérios')).toBeTruthy();
    });

    it('rejeita critério com mais de 2000 caracteres', async () => {
      const { inclusion, field, submit } = await newCriterionForm();

      fireEvent.change(field, { target: { value: 'a'.repeat(2001) } });
      submit();

      expect(within(inclusion).getByRole('alert').textContent).toBe('O critério deve possuir no máximo 2000 caracteres.');
      expect(within(inclusion).getByText('2 critérios')).toBeTruthy();
    });

    it('aceita critério com exatamente 2000 caracteres', async () => {
      const { inclusion, field, submit } = await newCriterionForm();

      fireEvent.change(field, { target: { value: 'a'.repeat(2000) } });
      submit();

      expect(within(inclusion).queryByRole('alert')).toBeNull();
      expect(within(inclusion).getByText('a'.repeat(2000))).toBeTruthy();
    });

    it('não conta os espaços das pontas no limite de 2000 caracteres', async () => {
      const { inclusion, field, submit } = await newCriterionForm();

      fireEvent.change(field, { target: { value: `  ${'a'.repeat(2000)}  ` } });
      submit();

      expect(within(inclusion).queryByRole('alert')).toBeNull();
      expect(within(inclusion).getByText('a'.repeat(2000))).toBeTruthy();
    });

    it('não valida antes da primeira tentativa de envio', async () => {
      const { inclusion, field } = await newCriterionForm();

      fireEvent.change(field, { target: { value: 'a'.repeat(2001) } });

      expect(within(inclusion).queryByRole('alert')).toBeNull();
    });

    it('atualiza a mensagem ao digitar e a remove quando o campo é corrigido', async () => {
      const { inclusion, field, submit } = await newCriterionForm();

      submit();
      fireEvent.change(field, { target: { value: '  ' } });
      expect(within(inclusion).getByRole('alert').textContent).toBe('Informe uma descrição válida para o critério.');
      fireEvent.change(field, { target: { value: 'a'.repeat(2001) } });
      expect(within(inclusion).getByRole('alert').textContent).toBe('O critério deve possuir no máximo 2000 caracteres.');
      fireEvent.change(field, { target: { value: 'Ter diagnóstico confirmado' } });
      expect(within(inclusion).queryByRole('alert')).toBeNull();
      expect(field.getAttribute('aria-invalid')).toBe('false');

      submit();
      expect(within(inclusion).getByText('Ter diagnóstico confirmado')).toBeTruthy();
      expect(within(inclusion).getByText('3 critérios')).toBeTruthy();
    });

    it('valida cada categoria de forma independente', async () => {
      const { inclusion, submit } = await newCriterionForm();

      submit();

      expect(within(inclusion).getByRole('alert')).toBeTruthy();
      expect(within(await group('Critérios de exclusão')).queryByRole('alert')).toBeNull();
    });
  });

  describe('validação da edição', () => {
    it.each([
      ['', 'Este campo é obrigatório.'],
      ['   ', 'Informe uma descrição válida para o critério.'],
      ['a'.repeat(2001), 'O critério deve possuir no máximo 2000 caracteres.'],
    ])('mantém a edição aberta para a descrição inválida %#', async (value, message) => {
      const { inclusion, field, save } = await editForm();

      fireEvent.change(field, { target: { value } });
      save();

      expect(within(inclusion).getByRole('alert').textContent).toBe(message);
      expect(within(inclusion).getByRole('textbox', { name: /Editar critério/ })).toBeTruthy();
    });

    it('remove a mensagem ao corrigir e salva a descrição válida', async () => {
      const { inclusion, field, save } = await editForm();

      fireEvent.change(field, { target: { value: '' } });
      save();
      fireEvent.change(field, { target: { value: 'Ter mais de 21 anos' } });
      expect(within(inclusion).queryByRole('alert')).toBeNull();

      save();
      expect(within(inclusion).getByText('Ter mais de 21 anos')).toBeTruthy();
      expect(within(inclusion).queryByRole('textbox', { name: /Editar critério/ })).toBeNull();
    });

    it('descarta o erro e o texto inválido ao cancelar', async () => {
      const { inclusion, field, save } = await editForm();

      fireEvent.change(field, { target: { value: '' } });
      save();
      fireEvent.click(within(inclusion).getByRole('button', { name: 'Cancelar edição' }));
      expect(within(inclusion).getByText('Ter mais de 18 anos')).toBeTruthy();

      fireEvent.click(within(inclusion).getByRole('button', { name: 'Editar critério: Ter mais de 18 anos' }));
      expect(within(inclusion).queryByRole('alert')).toBeNull();
    });
  });
});

describe('cadastro de estudo com critérios', () => {
  const created: Study = { ...study, id: 'study-new', code: 'EST-002', title: 'Novo estudo clínico' };
  const criteriaPath = '/studies/study-new/criteria';
  type Handler = (body: { type: string; description: string }, attempt: number) => Response | Promise<Response>;

  const callsTo = (path: string, method: string) => mockRequest.mock.calls.filter(([url, init]) => url === path && (init?.method ?? 'GET') === method);
  const criterionBodies = () => callsTo(criteriaPath, 'POST').map(([, init]) => JSON.parse(String(init.body)));

  const savedResponse = (body: { type: string; description: string }, id = 'saved') => jsonResponse({ id, studyId: created.id, active: true, ...body }, 201);

  function routeApi(options: { onCriterion?: Handler; onList?: () => Response | Promise<Response>; onCreateStudy?: () => Response | Promise<Response> } = {}) {
    let attempt = 0;
    mockRequest.mockImplementation(async (path: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (path === '/studies' && method === 'POST') return options.onCreateStudy ? options.onCreateStudy() : jsonResponse(created, 201);
      if (path === '/studies') return jsonResponse([study]);
      if (path === criteriaPath && method === 'POST') {
        const body = JSON.parse(String(init?.body));
        attempt += 1;
        return options.onCriterion ? options.onCriterion(body, attempt) : savedResponse(body, `saved-${attempt}`);
      }
      if (path === criteriaPath) return options.onList ? options.onList() : jsonResponse([]);
      if (path === `/studies/${created.id}`) return jsonResponse(created);
      if (path === `/studies/${study.id}`) return jsonResponse(study);
      if (path === `/studies/${study.id}/criteria`) return jsonResponse(criteria);
      throw new Error(`Requisição inesperada: ${method} ${path}`);
    });
  }

  async function openForm(): Promise<HTMLElement> {
    render(<StudiesPage />);
    await screen.findByRole('heading', { name: study.title });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar estudo/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText(/Título do estudo/), { target: { value: created.title } });
    fireEvent.change(within(dialog).getByLabelText(/Objetivo/), { target: { value: created.objective } });
    fireEvent.change(within(dialog).getByLabelText(/Data de início/), { target: { value: created.startDate } });
    fireEvent.change(within(dialog).getByLabelText(/Data de término/), { target: { value: created.endDate } });
    fireEvent.change(within(dialog).getByLabelText(/Limite de participantes/), { target: { value: '20' } });
    fireEvent.change(within(dialog).getByLabelText(/Participantes já vinculados/), { target: { value: '5' } });
    return dialog;
  }

  function addCriterion(dialog: HTMLElement, groupName: string, description: string) {
    const area = within(dialog).getByRole('article', { name: groupName });
    fireEvent.change(within(area).getByRole('textbox', { name: /Novo critério/ }), { target: { value: description } });
    fireEvent.click(within(area).getByRole('button', { name: '+ Adicionar critério' }));
  }

  const submit = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Cadastrar estudo' }));

  async function fillAndSubmitThreeCriteria() {
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    addCriterion(dialog, 'Critérios de inclusão', 'Residir na Paraíba');
    addCriterion(dialog, 'Critérios de exclusão', 'Estar gestante');
    submit(dialog);
  }

  it('apresenta os critérios no próprio formulário de cadastro, sem formulários aninhados', async () => {
    routeApi();
    const dialog = await openForm();

    expect(within(dialog).getByRole('region', { name: 'Critérios de inclusão e exclusão' })).toBeTruthy();
    expect(within(dialog).getByRole('article', { name: 'Critérios de inclusão' })).toBeTruthy();
    expect(within(dialog).getByRole('article', { name: 'Critérios de exclusão' })).toBeTruthy();
    expect(dialog.querySelectorAll('form')).toHaveLength(1);
  });

  it('atualiza o resumo do cartão do novo estudo sem recarregar a página', async () => {
    const saved: unknown[] = [];
    routeApi({
      onCriterion: (body, attempt) => {
        const row = { id: `saved-${attempt}`, studyId: created.id, active: true, ...body };
        saved.push(row);
        return jsonResponse(row, 201);
      },
      onList: () => jsonResponse(saved),
    });
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    addCriterion(dialog, 'Critérios de exclusão', 'Estar gestante');
    submit(dialog);
    await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' });
    fireEvent.click(screen.getByRole('button', { name: 'Ver estudos' }));

    const card = screen.getByRole('heading', { name: created.title }).closest('article') as HTMLElement;
    expect(await within(card).findByText('1 de inclusão • 1 de exclusão')).toBeTruthy();
  });

  it('cria o estudo e depois os critérios no studyId retornado, enviando apenas os campos da API', async () => {
    routeApi();
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', '  Ter mais de 18 anos  ');
    addCriterion(dialog, 'Critérios de exclusão', 'Estar gestante');
    submit(dialog);

    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeTruthy();
    expect(screen.getByText(/2 critérios foram salvos\./)).toBeTruthy();
    expect(criterionBodies()).toEqual([
      { type: 'Inclusão', description: 'Ter mais de 18 anos' },
      { type: 'Exclusão', description: 'Estar gestante' },
    ]);
    const paths = mockRequest.mock.calls.map(([path, init]) => `${init?.method ?? 'GET'} ${path}`);
    expect(paths.indexOf('POST /studies')).toBeLessThan(paths.indexOf(`POST ${criteriaPath}`));
    expect(callsTo('/studies', 'POST')).toHaveLength(1);
  });

  it('cadastra estudo sem critérios sem chamar a API de critérios', async () => {
    routeApi();
    submit(await openForm());

    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeTruthy();
    expect(screen.queryByText(/foram salvos|foi salvo/)).toBeNull();
    expect(callsTo(criteriaPath, 'POST')).toHaveLength(0);
  });

  it('não envia nada enquanto houver critério digitado e não adicionado', async () => {
    routeApi();
    const dialog = await openForm();
    const inclusion = within(dialog).getByRole('article', { name: 'Critérios de inclusão' });
    const field = within(inclusion).getByRole('textbox', { name: /Novo critério/ });
    fireEvent.change(field, { target: { value: 'Ter mais de 18 anos' } });
    submit(dialog);

    expect(within(dialog).getByRole('alert').textContent).toContain('Há um critério em preenchimento');
    expect(callsTo('/studies', 'POST')).toHaveLength(0);

    fireEvent.click(within(inclusion).getByRole('button', { name: '+ Adicionar critério' }));
    expect(within(dialog).queryByRole('alert')).toBeNull();
    submit(dialog);

    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeTruthy();
    expect(criterionBodies()).toEqual([{ type: 'Inclusão', description: 'Ter mais de 18 anos' }]);
  });

  it('não envia nada enquanto houver edição de critério aberta', async () => {
    routeApi();
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de exclusão', 'Estar gestante');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Editar critério: Estar gestante' }));
    submit(dialog);

    expect(within(dialog).getByRole('alert').textContent).toContain('Há um critério em preenchimento');
    expect(callsTo('/studies', 'POST')).toHaveLength(0);
  });

  it('preserva as validações dos demais campos e leva o foco ao campo inválido', async () => {
    routeApi();
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    const title = within(dialog).getByLabelText(/Título do estudo/);
    fireEvent.change(title, { target: { value: 'AB' } });
    submit(dialog);

    expect((await within(dialog).findByRole('alert')).textContent).toContain('O título deve ter pelo menos 3 caracteres.');
    expect(document.activeElement).toBe(title);
    expect(callsTo('/studies', 'POST')).toHaveLength(0);
  });

  it('mantém os critérios no formulário e não envia nenhum quando o cadastro do estudo falha', async () => {
    let fails = true;
    routeApi({
      onCreateStudy: () => {
        if (fails) { fails = false; return jsonResponse({ statusCode: 400, message: 'Dados inválidos do estudo.' }, 400); }
        return jsonResponse(created, 201);
      },
    });
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    submit(dialog);

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Dados inválidos do estudo.');
    expect(within(dialog).getByText('Ter mais de 18 anos')).toBeTruthy();
    expect(callsTo(criteriaPath, 'POST')).toHaveLength(0);

    submit(dialog);
    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeTruthy();
    expect(callsTo(criteriaPath, 'POST')).toHaveLength(1);
  });

  it('em falha parcial, não confirma sucesso e reenvia somente os pendentes, sem criar outro estudo', async () => {
    let failing = true;
    routeApi({
      onCriterion: (body, attempt) => {
        if (failing && attempt === 2) { failing = false; return jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500); }
        return savedResponse(body, `saved-${attempt}`);
      },
      onList: () => jsonResponse([{ id: 'saved-1', studyId: created.id, type: 'Inclusão', description: 'Ter mais de 18 anos', active: true }]),
    });
    await fillAndSubmitThreeCriteria();

    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado, mas faltam critérios' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeNull();
    expect(screen.getByText(/1 de 3 critérios foram salvos/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Ocorreu um erro inesperado ao salvar os critérios. Tente novamente em alguns instantes.');
    const pendingList = within(screen.getByRole('list', { name: 'Critérios não salvos' }));
    expect(pendingList.getByText('Residir na Paraíba')).toBeTruthy();
    expect(pendingList.getByText('Estar gestante')).toBeTruthy();
    expect(pendingList.queryByText('Ter mais de 18 anos')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeTruthy();
    expect(screen.getByText(/3 critérios foram salvos\./)).toBeTruthy();
    expect(callsTo('/studies', 'POST')).toHaveLength(1);
    expect(criterionBodies().map((body) => body.description)).toEqual([
      'Ter mais de 18 anos', 'Residir na Paraíba', 'Residir na Paraíba', 'Estar gestante',
    ]);
  });

  it('não duplica critério gravado pelo backend cuja resposta se perdeu na conexão', async () => {
    const stored: EligibilityCriterion[] = [];
    let dropped = false;
    routeApi({
      onCriterion: (body, attempt) => {
        stored.push({ id: `saved-${attempt}`, studyId: created.id, active: true, ...body } as EligibilityCriterion);
        if (!dropped) { dropped = true; throw new TypeError('Failed to fetch'); }
        return savedResponse(body, `saved-${attempt}`);
      },
      onList: () => jsonResponse(stored),
    });
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    addCriterion(dialog, 'Critérios de exclusão', 'Estar gestante');
    submit(dialog);

    expect((await screen.findByRole('alert')).textContent).toBe('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeTruthy();
    expect(stored.map((item) => item.description)).toEqual(['Ter mais de 18 anos', 'Estar gestante']);
    expect(callsTo('/studies', 'POST')).toHaveLength(1);
  });

  it('não envia critérios na nova tentativa se não puder confirmar o que já foi salvo', async () => {
    routeApi({
      onCriterion: () => jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500),
      onList: () => jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500),
    });
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    submit(dialog);
    await screen.findByRole('heading', { name: 'Estudo cadastrado, mas faltam critérios' });

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('ao carregar os critérios'));
    expect(screen.getByRole('heading', { name: 'Estudo cadastrado, mas faltam critérios' })).toBeTruthy();
    expect(callsTo(criteriaPath, 'POST')).toHaveLength(1);
  });

  it.each([
    [403, { statusCode: 403, message: 'Você não tem permissão para alterar este estudo.' }, 'Você não tem permissão para alterar este estudo.'],
    [400, { statusCode: 400, message: 'A descrição deve ter entre 1 e 2000 caracteres.' }, 'A descrição deve ter entre 1 e 2000 caracteres.'],
    [404, { statusCode: 404, message: 'Cannot POST /studies' }, 'Estudo não encontrado. Volte à lista de estudos e tente novamente.'],
  ])('para HTTP %i ao salvar, informa o erro e não oferece nova tentativa', async (status, body, message) => {
    routeApi({ onCriterion: () => jsonResponse(body, status) });
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    addCriterion(dialog, 'Critérios de inclusão', 'Residir na Paraíba');
    submit(dialog);

    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    expect(callsTo(criteriaPath, 'POST')).toHaveLength(1);
  });

  it('exige decisão explícita na recuperação e disponibiliza o estudo já criado', async () => {
    routeApi({ onCriterion: () => jsonResponse({ statusCode: 500 }, 500) });
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    submit(dialog);
    await screen.findByRole('heading', { name: 'Estudo cadastrado, mas faltam critérios' });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Estudo cadastrado, mas faltam critérios' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem estes critérios' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: created.title })).toBeTruthy();
    expect(await screen.findByText('Nenhum critério cadastrado')).toBeTruthy();
  });

  it('começa um novo cadastro sem os critérios do anterior', async () => {
    routeApi();
    const dialog = await openForm();
    addCriterion(dialog, 'Critérios de inclusão', 'Ter mais de 18 anos');
    submit(dialog);
    await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' });

    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar outro' }));

    expect(screen.getByText('Nenhum critério de inclusão adicionado.')).toBeTruthy();
  });

  it('exibe nos detalhes os critérios do estudo selecionado, sem edição', async () => {
    routeApi();
    render(<StudiesPage />);

    fireEvent.click(await screen.findByRole('button', { name: `Ações de ${study.title}` }));
    expect(screen.queryByRole('heading', { name: 'Critérios do Estudo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));

    expect(await screen.findByRole('heading', { name: 'Critérios do Estudo' })).toBeTruthy();
    const inclusion = await group('Critérios de inclusão');
    expect(mockRequest).toHaveBeenCalledWith('/studies/study-one/criteria', expect.anything());
    expect(within(inclusion).getByText('Ter mais de 18 anos')).toBeTruthy();
    expect(within(inclusion).queryByRole('button')).toBeNull();
    expect(screen.queryByRole('button', { name: '+ Adicionar critério' })).toBeNull();
  });
});

describe('edição de estudo com critérios', () => {
  const otherStudy: Study = { ...study, id: 'study-two', code: 'EST-002', title: 'Atividade física' };
  const studyPath = `/studies/${study.id}`;
  const criteriaPath = `${studyPath}/criteria`;
  const callsWithMethod = (method: string) => mockRequest.mock.calls.filter(([, init]) => init?.method === method);
  const criterionWrites = () => mockRequest.mock.calls
    .filter(([path, init]) => String(path).startsWith(criteriaPath) && init?.method)
    .map(([path, init]) => [init.method, String(path).replace(criteriaPath, ''), JSON.parse(String(init.body))]);
  const studyUpdates = () => callsWithMethod('PATCH').filter(([path]) => path === studyPath);
  const reads = (path: string) => mockRequest.mock.calls.filter(([url, init]) => url === path && !init?.method);

  type Handler = (path: string, init: RequestInit, body: Record<string, unknown>) => Response | Promise<Response> | null;

  /** API em memória que aplica as gravações, como o backend. */
  function routeApi(options: { onWrite?: Handler; onCriteriaList?: () => Response | null; onStudyUpdate?: () => Response | null } = {}) {
    const rows = criteria.map((item) => ({ ...item }));
    mockRequest.mockImplementation(async (path: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const body = init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : {};
      if (path === '/studies') return jsonResponse([study, otherStudy]);
      if (path === studyPath && method === 'PATCH') return options.onStudyUpdate?.() ?? jsonResponse({ ...study, ...body });
      if (path === studyPath) return jsonResponse(study);
      if (path === `/studies/${otherStudy.id}`) return jsonResponse(otherStudy);
      if (path === `/studies/${otherStudy.id}/criteria`) return jsonResponse([{ id: 'c9', studyId: otherStudy.id, type: 'Inclusão', description: 'Praticar atividade física', active: true }]);
      if (path === criteriaPath && method === 'GET') return options.onCriteriaList?.() ?? jsonResponse(rows);
      if (String(path).startsWith(criteriaPath)) {
        const handled = await options.onWrite?.(path, init, body);
        if (handled) return handled;
        if (method === 'POST') {
          const row = { id: `new-${rows.length}`, studyId: study.id, active: true, ...body } as EligibilityCriterion;
          rows.push(row);
          return jsonResponse(row, 201);
        }
        const row = rows.find((item) => path.endsWith(`/${item.id}`));
        if (row) Object.assign(row, body);
        return jsonResponse(row);
      }
      if (path.startsWith(`${studyPath}/visits`)) return jsonResponse([]);
      throw new Error(`Requisição inesperada: ${method} ${path}`);
    });
    return rows;
  }

  async function openEditFromList(title = study.title): Promise<HTMLElement> {
    render(<StudiesPage />);
    await screen.findByRole('heading', { name: title });
    fireEvent.click(screen.getByRole('button', { name: `Ações de ${title}` }));
    fireEvent.click(screen.getByRole('button', { name: /Editar estudo/ }));
    return screen.getByRole('dialog');
  }

  async function openEditFromDetails(): Promise<HTMLElement> {
    render(<StudiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: `Ações de ${study.title}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));
    await screen.findByText('Ter mais de 18 anos');
    fireEvent.click(screen.getByRole('button', { name: /Editar estudo/ }));
    return screen.getByRole('dialog');
  }

  const area = (dialog: HTMLElement, name: string) => within(dialog).findByRole('article', { name });
  const save = (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole('button', { name: 'Salvar alterações' }));

  function addCriterion(group: HTMLElement, description: string) {
    fireEvent.change(within(group).getByRole('textbox', { name: /Novo critério/ }), { target: { value: description } });
    fireEvent.click(within(group).getByRole('button', { name: '+ Adicionar critério' }));
  }

  function editCriterion(group: HTMLElement, current: string, description: string) {
    fireEvent.click(within(group).getByRole('button', { name: `Editar critério: ${current}` }));
    fireEvent.change(within(group).getByRole('textbox', { name: /Editar critério/ }), { target: { value: description } });
    fireEvent.click(within(group).getByRole('button', { name: 'Salvar critério' }));
  }

  it('carrega os critérios vigentes do estudo nas respectivas categorias, sem os inativos', async () => {
    routeApi();
    const dialog = await openEditFromList();

    const inclusion = await area(dialog, 'Critérios de inclusão');
    const exclusion = await area(dialog, 'Critérios de exclusão');
    expect(within(inclusion).getByText('Ter mais de 18 anos')).toBeTruthy();
    expect(within(inclusion).queryByText('Residir na Paraíba')).toBeNull();
    expect(within(exclusion).getByText('Possuir insônia diagnosticada')).toBeTruthy();
    expect(dialog.querySelectorAll('form')).toHaveLength(1);
  });

  it('carrega somente os critérios do estudo aberto', async () => {
    routeApi();
    const dialog = await openEditFromList(otherStudy.title);

    const inclusion = await area(dialog, 'Critérios de inclusão');
    expect(within(inclusion).getByText('Praticar atividade física')).toBeTruthy();
    expect(within(inclusion).queryByText('Ter mais de 18 anos')).toBeNull();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer alterações' }));

    fireEvent.click(screen.getByRole('button', { name: `Ações de ${study.title}` }));
    fireEvent.click(screen.getByRole('button', { name: /Editar estudo/ }));
    const next = await area(screen.getByRole('dialog'), 'Critérios de inclusão');
    expect(within(next).getByText('Ter mais de 18 anos')).toBeTruthy();
    expect(within(next).queryByText('Praticar atividade física')).toBeNull();
  });

  it('não grava critérios quando nada mudou neles', async () => {
    routeApi();
    const dialog = await openEditFromList();
    await area(dialog, 'Critérios de inclusão');
    save(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(studyUpdates()).toHaveLength(1);
    expect(criterionWrites()).toEqual([]);
  });

  it('persiste inclusão, edição e remoção pela API existente, depois de salvar o estudo', async () => {
    const rows = routeApi();
    const dialog = await openEditFromList();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    const exclusion = await area(dialog, 'Critérios de exclusão');
    addCriterion(inclusion, 'Residir em João Pessoa');
    editCriterion(inclusion, 'Ter mais de 18 anos', '  Ter mais de 21 anos  ');
    fireEvent.click(within(exclusion).getByRole('button', { name: 'Remover critério: Possuir insônia diagnosticada' }));
    expect(criterionWrites()).toEqual([]);
    save(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(criterionWrites()).toEqual([
      ['PATCH', '/c1', { active: false }],
      ['PATCH', '/c2', { description: 'Ter mais de 21 anos' }],
      ['POST', '', { type: 'Inclusão', description: 'Residir em João Pessoa' }],
    ]);
    const order = mockRequest.mock.calls.filter(([, init]) => init?.method).map(([path]) => path);
    expect(order[0]).toBe(studyPath);
    expect(rows.find((row) => row.id === 'c1')?.active).toBe(false);
    expect(rows.find((row) => row.id === 'c2')?.description).toBe('Ter mais de 21 anos');
  });

  it('não grava um critério editado e depois removido como edição', async () => {
    routeApi();
    const dialog = await openEditFromList();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    editCriterion(inclusion, 'Ter mais de 18 anos', 'Texto temporário');
    fireEvent.click(within(inclusion).getByRole('button', { name: 'Remover critério: Texto temporário' }));
    addCriterion(inclusion, 'Rascunho descartado');
    fireEvent.click(within(inclusion).getByRole('button', { name: 'Remover critério: Rascunho descartado' }));
    save(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(criterionWrites()).toEqual([['PATCH', '/c2', { active: false }]]);
  });

  it('atualiza os critérios nos detalhes depois de salvar', async () => {
    routeApi();
    const dialog = await openEditFromDetails();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    const exclusion = await area(dialog, 'Critérios de exclusão');
    editCriterion(inclusion, 'Ter mais de 18 anos', 'Ter mais de 21 anos');
    fireEvent.click(within(exclusion).getByRole('button', { name: 'Remover critério: Possuir insônia diagnosticada' }));
    addCriterion(exclusion, 'Estar gestante');
    save(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('Ter mais de 21 anos')).toBeTruthy();
    expect(screen.getByText('Estar gestante')).toBeTruthy();
    expect(screen.queryByText('Ter mais de 18 anos')).toBeNull();
    expect(screen.queryByText('Possuir insônia diagnosticada')).toBeNull();
  });

  it('descarta as alterações sem gravar ao desfazer', async () => {
    routeApi();
    const dialog = await openEditFromDetails();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    fireEvent.click(within(inclusion).getByRole('button', { name: 'Remover critério: Ter mais de 18 anos' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Desfazer alterações' }));

    expect(criterionWrites()).toEqual([]);
    expect(screen.getByText('Ter mais de 18 anos')).toBeTruthy();
  });

  it('aplica as validações na edição e bloqueia o envio com texto não adicionado', async () => {
    routeApi();
    const dialog = await openEditFromList();
    const inclusion = await area(dialog, 'Critérios de inclusão');

    fireEvent.click(within(inclusion).getByRole('button', { name: 'Editar critério: Ter mais de 18 anos' }));
    const field = within(inclusion).getByRole('textbox', { name: /Editar critério/ });
    fireEvent.change(field, { target: { value: '   ' } });
    fireEvent.click(within(inclusion).getByRole('button', { name: 'Salvar critério' }));
    expect(within(inclusion).getByRole('alert').textContent).toBe('Informe uma descrição válida para o critério.');

    save(dialog);
    expect(within(dialog).getAllByRole('alert').at(-1)?.textContent).toContain('Há um critério em preenchimento');
    expect(studyUpdates()).toHaveLength(0);

    fireEvent.click(within(inclusion).getByRole('button', { name: 'Cancelar edição' }));
    fireEvent.change(within(inclusion).getByRole('textbox', { name: /Novo critério/ }), { target: { value: 'Não adicionado' } });
    save(dialog);
    expect(within(dialog).getByRole('alert').textContent).toContain('Há um critério em preenchimento');
    expect(studyUpdates()).toHaveLength(0);
  });

  it('com falha ao carregar, salva somente o estudo e permite tentar novamente', async () => {
    let fails = false;
    routeApi({ onCriteriaList: () => { if (!fails) return null; fails = false; return jsonResponse({ statusCode: 500 }, 500); } });
    render(<StudiesPage />);
    await screen.findByText('1 de inclusão • 1 de exclusão');
    fails = true;
    fireEvent.click(screen.getByRole('button', { name: `Ações de ${study.title}` }));
    fireEvent.click(screen.getByRole('button', { name: /Editar estudo/ }));
    const dialog = screen.getByRole('dialog');

    const alert = await within(dialog).findByRole('alert');
    expect(alert.textContent).toContain('As demais informações do estudo podem ser salvas normalmente.');
    expect(within(dialog).queryByRole('article')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Tentar novamente' }));
    const inclusion = await area(dialog, 'Critérios de inclusão');
    expect(within(inclusion).getByText('Ter mais de 18 anos')).toBeTruthy();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('não remove critérios quando eles não foram carregados', async () => {
    routeApi({ onCriteriaList: () => jsonResponse({ statusCode: 403, message: 'Sem acesso.' }, 403) });
    const dialog = await openEditFromList();
    await within(dialog).findByRole('alert');
    expect(within(dialog).queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    save(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(studyUpdates()).toHaveLength(1);
    expect(criterionWrites()).toEqual([]);
  });

  it('mantém as alterações no formulário e não grava critérios quando salvar o estudo falha', async () => {
    routeApi({ onStudyUpdate: () => jsonResponse({ statusCode: 400, message: 'Dados inválidos do estudo.' }, 400) });
    const dialog = await openEditFromList();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    addCriterion(inclusion, 'Residir em João Pessoa');
    save(dialog);

    expect((await within(dialog).findByRole('alert')).textContent).toContain('Dados inválidos do estudo.');
    expect(within(inclusion).getByText('Residir em João Pessoa')).toBeTruthy();
    expect(criterionWrites()).toEqual([]);
  });

  it('em falha parcial, reenvia somente o pendente sem salvar o estudo de novo', async () => {
    let fails = true;
    const rows = routeApi({
      onWrite: (path, init) => {
        if (fails && path.endsWith('/c2') && init.method === 'PATCH') { fails = false; return jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500); }
        return null;
      },
    });
    const dialog = await openEditFromDetails();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    const exclusion = await area(dialog, 'Critérios de exclusão');
    fireEvent.click(within(exclusion).getByRole('button', { name: 'Remover critério: Possuir insônia diagnosticada' }));
    editCriterion(inclusion, 'Ter mais de 18 anos', 'Ter mais de 21 anos');
    addCriterion(inclusion, 'Residir em João Pessoa');
    save(dialog);

    expect(await screen.findByRole('heading', { name: 'Estudo salvo, mas faltam alterações nos critérios' })).toBeTruthy();
    expect(screen.getByText(/1 de 3 alterações nos critérios foram salvas/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).not.toContain('Internal server error');
    const list = within(screen.getByRole('list', { name: 'Alterações não salvas' }));
    expect(list.getByText('Editar • Inclusão')).toBeTruthy();
    expect(list.getByText('Adicionar • Inclusão')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: 'Estudo salvo, mas faltam alterações nos critérios' })).toBeTruthy();

    mockRequest.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(studyUpdates()).toHaveLength(0);
    expect(criterionWrites()).toEqual([
      ['PATCH', '/c2', { description: 'Ter mais de 21 anos' }],
      ['POST', '', { type: 'Inclusão', description: 'Residir em João Pessoa' }],
    ]);
    expect(rows.filter((row) => row.description === 'Residir em João Pessoa')).toHaveLength(1);
    expect(await screen.findByText('Ter mais de 21 anos')).toBeTruthy();
  });

  it('não duplica inclusão gravada pelo backend cuja resposta se perdeu', async () => {
    let dropped = false;
    const rows = routeApi({
      onWrite: (_path, init, body) => {
        if (init.method !== 'POST' || dropped) return null;
        dropped = true;
        rows.push({ id: 'lost', studyId: study.id, active: true, ...body } as EligibilityCriterion);
        throw new TypeError('Failed to fetch');
      },
    });
    const dialog = await openEditFromList();
    addCriterion(await area(dialog, 'Critérios de inclusão'), 'Residir em João Pessoa');
    save(dialog);

    await screen.findByRole('heading', { name: 'Estudo salvo, mas faltam alterações nos critérios' });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(rows.filter((row) => row.description === 'Residir em João Pessoa')).toHaveLength(1);
    expect(callsWithMethod('POST')).toHaveLength(1);
  });

  it('na nova tentativa, não confunde inclusão nova com critério igual já existente', async () => {
    let fails = true;
    const rows = routeApi({
      onWrite: (_path, init) => {
        if (init.method === 'POST' && fails) { fails = false; return jsonResponse({ statusCode: 500 }, 500); }
        return null;
      },
    });
    const dialog = await openEditFromList();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    addCriterion(inclusion, 'Ter mais de 18 anos');
    save(dialog);

    await screen.findByRole('heading', { name: 'Estudo salvo, mas faltam alterações nos critérios' });
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(rows.filter((row) => row.description === 'Ter mais de 18 anos')).toHaveLength(2);
  });

  it('resume nos cartões somente os critérios vigentes de cada estudo', async () => {
    routeApi();
    render(<StudiesPage />);

    const card = async (title: string) => (await screen.findByRole('heading', { name: title })).closest('article') as HTMLElement;
    expect(await within(await card(study.title)).findByText('1 de inclusão • 1 de exclusão')).toBeTruthy();
    expect(await within(await card(otherStudy.title)).findByText('1 de inclusão • 0 de exclusão')).toBeTruthy();
  });

  it('informa falha no cartão, sem bloquear a página, e permite tentar novamente', async () => {
    let fails = true;
    routeApi({ onCriteriaList: () => { if (!fails) return null; fails = false; return jsonResponse({ statusCode: 500, message: 'Internal server error' }, 500); } });
    render(<StudiesPage />);

    expect(await screen.findByText('Não foi possível carregar')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Internal server error/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: `Tentar carregar os critérios de ${study.title}` }));

    expect(await screen.findByText('1 de inclusão • 1 de exclusão')).toBeTruthy();
    expect(screen.queryByText('Não foi possível carregar')).toBeNull();
  });

  it('não oferece nova tentativa no cartão quando o acesso é negado', async () => {
    routeApi({ onCriteriaList: () => jsonResponse({ statusCode: 403, message: 'Sem acesso.' }, 403) });
    render(<StudiesPage />);

    expect((await screen.findByText('Não foi possível carregar')).getAttribute('title')).toBe('Sem acesso.');
    expect(screen.queryByRole('button', { name: `Tentar carregar os critérios de ${study.title}` })).toBeNull();
  });

  it('confirma o sucesso e atualiza o cartão sem recarregar a página', async () => {
    routeApi();
    const dialog = await openEditFromList();
    addCriterion(await area(dialog, 'Critérios de exclusão'), 'Estar gestante');
    save(dialog);

    expect((await screen.findByRole('status')).textContent).toContain('Estudo e critérios atualizados com sucesso.');
    expect(await screen.findByText('1 de inclusão • 2 de exclusão')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('confirma o sucesso sem citar critérios quando só o estudo mudou', async () => {
    routeApi();
    const dialog = await openEditFromList();
    await area(dialog, 'Critérios de inclusão');
    save(dialog);

    expect((await screen.findByRole('status')).textContent).toBe('Estudo atualizado com sucesso.');
  });

  it('informa nos detalhes quantos critérios desativados não são exibidos', async () => {
    routeApi();
    render(<StudiesPage />);
    fireEvent.click(await screen.findByRole('button', { name: `Ações de ${study.title}` }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver detalhes' }));

    expect(await screen.findByText('1 critério desativado não é exibido.')).toBeTruthy();
    expect(screen.queryByText('Residir na Paraíba')).toBeNull();
  });

  it('ao continuar sem as alterações pendentes, volta aos detalhes com o que foi salvo', async () => {
    routeApi({
      onWrite: (path) => path.endsWith('/c2') ? jsonResponse({ statusCode: 404, message: 'Critério não encontrado neste estudo.' }, 404) : null,
    });
    const dialog = await openEditFromDetails();
    const inclusion = await area(dialog, 'Critérios de inclusão');
    const exclusion = await area(dialog, 'Critérios de exclusão');
    fireEvent.click(within(exclusion).getByRole('button', { name: 'Remover critério: Possuir insônia diagnosticada' }));
    editCriterion(inclusion, 'Ter mais de 18 anos', 'Ter mais de 21 anos');
    save(dialog);

    expect((await screen.findByRole('alert')).textContent).toBe('Critério não encontrado neste estudo. Ele pode ter sido alterado em outra sessão.');
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continuar sem estas alterações' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Critérios do Estudo' })).toBeTruthy();
    expect(await screen.findByText('Ter mais de 18 anos')).toBeTruthy();
    expect(screen.queryByText('Possuir insônia diagnosticada')).toBeNull();
    expect(reads(criteriaPath).length).toBeGreaterThan(1);
  });
});
