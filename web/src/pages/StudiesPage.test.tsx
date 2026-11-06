import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { StudiesPage } from './StudiesPage';
import type { Study } from '../studies/studiesApi';
import type { WebUser } from '../types';

const { mockList, mockDetail, mockCreate, mockUpdate, mockTransition, mockUseAuth, mockRequest } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockDetail: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockTransition: vi.fn(),
  mockUseAuth: vi.fn(),
  mockRequest: vi.fn(),
}));

vi.mock('../auth/AuthContext', () => ({
  useAuth: mockUseAuth,
}));

vi.mock('../studies/studiesApi', () => ({
  studiesApi: {
    list: mockList,
    detail: mockDetail,
    create: mockCreate,
    update: mockUpdate,
    transitionStatus: mockTransition,
  },
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

const studies: Study[] = [
  {
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
  },
  {
    id: 'study-two',
    code: 'EST-002',
    title: 'Atividade física',
    objective: 'Acompanhar a atividade física de participantes fictícios.',
    researcherId: researcher.id,
    researcher: researcher.name,
    startDate: '2027-01-01',
    endDate: '2027-06-30',
    participantLimit: 12,
    participantsLinked: 0,
    status: 'planejamento',
    kind: 'Estudo longitudinal',
    symbol: 'activity',
  },
];

function renderStudies() {
  return render(<StudiesPage />);
}

beforeEach(() => {
  mockList.mockReset();
  mockDetail.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockTransition.mockReset();
  mockRequest.mockReset();
  mockList.mockResolvedValue(studies);
  mockUseAuth.mockReturnValue({
    user: researcher,
    accessToken: 'token',
    request: mockRequest,
  });
});

afterEach(() => cleanup());

describe('StudiesPage', () => {
  it('carrega e apresenta estudos e permite pesquisa e filtro por status', async () => {
    renderStudies();

    expect(await screen.findByRole('heading', { name: 'Qualidade do sono' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Atividade física' })).toBeTruthy();
    expect(mockList).toHaveBeenCalledWith(mockRequest, expect.any(AbortSignal));

    fireEvent.change(screen.getByPlaceholderText('Buscar estudo...'), {
      target: { value: 'sono' },
    });
    expect(screen.getByRole('heading', { name: 'Qualidade do sono' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Atividade física' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Filtrar estudos'), {
      target: { value: 'encerrado' },
    });
    expect(screen.getByText('Nenhum estudo corresponde à busca.')).toBeTruthy();
  });

  it('apresenta erro ao carregar estudos e impede abrir o formulário', async () => {
    mockList.mockRejectedValue(new Error('API indisponível'));
    renderStudies();

    expect((await screen.findByRole('alert')).textContent).toContain('API indisponível');
    expect((screen.getByRole('button', { name: /Cadastrar estudo/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('não oferece edição para estudos encerrados', async () => {
    const closedStudy = { ...studies[0]!, status: 'encerrado' as const };
    mockList.mockResolvedValue([closedStudy]);
    mockDetail.mockResolvedValue(closedStudy);
    renderStudies();
    expect(await screen.findByRole('heading', { name: 'Qualidade do sono' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Ações de Qualidade do sono' }));
    expect(screen.queryByRole('button', { name: 'Editar estudo' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    expect(await screen.findByRole('heading', { name: 'Qualidade do sono' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Editar estudo' })).toBeNull();
  });

  it('informa quando não há usuário autenticado e não chama a API', async () => {
    mockUseAuth.mockReturnValue({ user: null, accessToken: null, request: mockRequest });
    renderStudies();

    expect((await screen.findByRole('alert')).textContent).toContain('Entre para consultar e gerenciar estudos.');
    expect(mockList).not.toHaveBeenCalled();
  });

  it('valida título antes de enviar o cadastro', async () => {
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar estudo/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(screen.getByLabelText(/Título do estudo/), { target: { value: 'AB' } });
    fireEvent.submit(dialog.querySelector('form')!);

    expect((await screen.findByRole('alert')).textContent).toContain('O título deve ter pelo menos 3 caracteres.');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('cadastra estudo válido e apresenta confirmação e cartão atualizado', async () => {
    const created = {
      ...studies[0]!,
      id: 'study-new',
      code: 'EST-003',
      title: 'Novo estudo clínico',
    };
    mockCreate.mockResolvedValue(created);
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar estudo/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(screen.getByLabelText(/Título do estudo/), { target: { value: created.title } });
    fireEvent.change(screen.getByLabelText(/Objetivo/), { target: { value: created.objective } });
    fireEvent.change(screen.getByLabelText(/Data de início/), { target: { value: created.startDate } });
    fireEvent.change(screen.getByLabelText(/Data de término/), { target: { value: created.endDate } });
    fireEvent.change(screen.getByLabelText(/Limite de participantes/), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Participantes já vinculados/), { target: { value: '5' } });
    fireEvent.submit(dialog.querySelector('form')!);

    expect(await screen.findByRole('heading', { name: 'Estudo cadastrado com sucesso!' })).toBeTruthy();
    expect(mockCreate).toHaveBeenCalledWith(mockRequest, {
      title: created.title,
      objective: created.objective,
      startDate: created.startDate,
      endDate: created.endDate,
      participantLimit: 20,
      participantsLinked: 5,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ver estudos' }));
    expect(screen.getByRole('heading', { name: created.title })).toBeTruthy();
  });

  it('mostra erro de API quando o cadastro falha', async () => {
    mockCreate.mockRejectedValue(new Error('Título duplicado.'));
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });
    fireEvent.click(screen.getByRole('button', { name: /Cadastrar estudo/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(screen.getByLabelText(/Título do estudo/), { target: { value: 'Estudo novo' } });
    fireEvent.change(screen.getByLabelText(/Objetivo/), { target: { value: 'Objetivo de teste válido.' } });
    fireEvent.change(screen.getByLabelText(/Data de início/), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText(/Data de término/), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText(/Limite de participantes/), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Participantes já vinculados/), { target: { value: '0' } });
    fireEvent.submit(dialog.querySelector('form')!);

    expect((await screen.findByRole('alert')).textContent).toContain('Título duplicado.');
  });

  it('carrega detalhes e permite cancelar edição sem enviar alteração', async () => {
    mockDetail.mockResolvedValue(studies[0]);
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Qualidade do sono' }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));

    expect(await screen.findByRole('heading', { name: 'Informações do estudo' })).toBeTruthy();
    expect(mockDetail).toHaveBeenCalledWith(mockRequest, 'study-one');
    fireEvent.click(screen.getByRole('button', { name: /Editar estudo/ }));
    fireEvent.change(screen.getByLabelText(/Título do estudo/), { target: { value: 'Título não salvo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer alterações' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Qualidade do sono' })).toBeTruthy());
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('salva edição de estudo e atualiza o cartão da lista', async () => {
    const updated = { ...studies[0]!, title: 'Qualidade do sono atualizada' };
    mockUpdate.mockResolvedValue(updated);
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Qualidade do sono' }));
    fireEvent.click(screen.getByRole('button', { name: /Editar estudo/ }));
    fireEvent.change(screen.getByLabelText(/Título do estudo/), { target: { value: updated.title } });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    expect(await screen.findByRole('heading', { name: updated.title })).toBeTruthy();
    expect(mockUpdate).toHaveBeenCalledWith(mockRequest, 'study-one', {
      title: updated.title,
      objective: studies[0]!.objective,
      startDate: studies[0]!.startDate,
      endDate: studies[0]!.endDate,
      participantLimit: studies[0]!.participantLimit,
      participantsLinked: studies[0]!.participantsLinked,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('StudiesPage — estados do estudo', () => {
  const allStatuses: Study[] = (['planejamento', 'recrutamento', 'execução', 'encerrado'] as const).map((status, index) => ({
    ...studies[0]!, id: `study-${status}`, code: `EST-01${index}`, title: `Estudo ${index + 1}`, status,
  }));

  function card(title: string): HTMLElement {
    return screen.getByRole('heading', { name: title }).closest('article')!;
  }

  async function openStatusDialog(title: string) {
    await screen.findByRole('heading', { name: title });
    fireEvent.click(screen.getByRole('button', { name: `Ações de ${title}` }));
    fireEvent.click(screen.getByRole('button', { name: /Alterar estado/ }));
    return screen.getByRole('dialog', { name: 'Alterar estado do estudo' });
  }

  it('apresenta os quatro estados oficiais carregados da API, em português e com identificação visual própria', async () => {
    mockList.mockResolvedValue(allStatuses);
    renderStudies();
    await screen.findByRole('heading', { name: 'Estudo 1' });

    const expected = [['Estudo 1', 'Planejamento', 'status-planejamento'], ['Estudo 2', 'Recrutamento', 'status-recrutamento'],
      ['Estudo 3', 'Execução', 'status-execucao'], ['Estudo 4', 'Encerrado', 'status-encerrado']];
    for (const [title, label, className] of expected) {
      const badge = within(card(title!)).getByText(label!);
      expect(badge.classList.contains('study-status')).toBe(true);
      expect(badge.classList.contains(className!)).toBe(true);
    }
    const filterOptions = Array.from((screen.getByLabelText('Filtrar estudos') as HTMLSelectElement).options).map((option) => [option.value, option.text]);
    expect(filterOptions).toEqual([['Todos', 'Todos'], ['planejamento', 'Planejamento'], ['recrutamento', 'Recrutamento'], ['execução', 'Execução'], ['encerrado', 'Encerrado']]);
  });

  it('apresenta o estado nos detalhes do estudo carregados da API', async () => {
    mockDetail.mockResolvedValue({ ...studies[1]!, status: 'recrutamento' });
    renderStudies();
    await screen.findByRole('heading', { name: 'Atividade física' });
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Atividade física' }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));

    const hero = (await screen.findByRole('heading', { level: 1, name: 'Atividade física' })).closest('header')!;
    expect(within(hero).getByText('Recrutamento').classList.contains('status-recrutamento')).toBe(true);
    expect(mockDetail).toHaveBeenCalledWith(mockRequest, 'study-two');
  });

  it.each([
    ['planejamento', 'Recrutamento', 'recrutamento'],
    ['recrutamento', 'Execução', 'execução'],
    ['execução', 'Encerrado', 'encerrado'],
  ] as const)('para estudo em %s, oferece somente a transição para %s', async (status, label, value) => {
    mockList.mockResolvedValue([{ ...studies[0]!, status }]);
    renderStudies();
    const dialog = await openStatusDialog('Qualidade do sono');

    const options = Array.from(within(dialog).getByLabelText('Novo estado').querySelectorAll('option'));
    expect(options.map((option) => [option.value, option.textContent])).toEqual([[value, label]]);
    expect(within(dialog).getByText(/Qualidade do sono • Código EST-001/)).toBeTruthy();
  });

  it('não oferece alteração de estado para estudo encerrado', async () => {
    const closed = { ...studies[0]!, status: 'encerrado' as const };
    mockList.mockResolvedValue([closed]);
    mockDetail.mockResolvedValue(closed);
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Qualidade do sono' }));
    expect(screen.queryByRole('button', { name: /Alterar estado/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    await screen.findByRole('heading', { name: 'Informações do estudo' });
    expect(screen.queryByRole('button', { name: /Alterar estado/ })).toBeNull();
  });

  it('identifica estado desconhecido devolvido pela API e não oferece transições', async () => {
    mockList.mockResolvedValue([{ ...studies[0]!, status: 'arquivado' as unknown as Study['status'] }]);
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });

    const badge = within(card('Qualidade do sono')).getByText('Estado desconhecido');
    expect(badge.classList.contains('status-desconhecido')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Qualidade do sono' }));
    expect(screen.queryByRole('button', { name: /Alterar estado/ })).toBeNull();
  });

  it('pede confirmação, envia pelo endpoint de estado e atualiza a interface somente com a resposta da API', async () => {
    let resolve!: (study: Study) => void;
    mockTransition.mockReturnValue(new Promise<Study>((done) => { resolve = done; }));
    renderStudies();
    const dialog = await openStatusDialog('Atividade física');

    expect(within(dialog).getByText(/Confirma a mudança de/).textContent).toBe('Confirma a mudança de Planejamento para Recrutamento?');
    expect(mockTransition).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar alteração' }));

    expect(mockTransition).toHaveBeenCalledWith(mockRequest, 'study-two', 'recrutamento');
    expect((within(dialog).getByRole('button', { name: 'Alterando...' }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(card('Atividade física')).getByText('Planejamento')).toBeTruthy();

    resolve({ ...studies[1]!, status: 'recrutamento' });
    expect((await screen.findByRole('status')).textContent).toContain('Estado do estudo "Atividade física" alterado para Recrutamento.');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(card('Atividade física')).getByText('Recrutamento').classList.contains('status-recrutamento')).toBe(true);
  });

  it('altera o estado a partir dos detalhes do estudo', async () => {
    mockDetail.mockResolvedValue(studies[0]);
    mockTransition.mockResolvedValue({ ...studies[0]!, status: 'encerrado' });
    renderStudies();
    await screen.findByRole('heading', { name: 'Qualidade do sono' });
    fireEvent.click(screen.getByRole('button', { name: 'Ações de Qualidade do sono' }));
    fireEvent.click(screen.getByRole('button', { name: /Ver detalhes/ }));
    fireEvent.click(await screen.findByRole('button', { name: /Alterar estado/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirmar alteração' }));

    expect((await screen.findByRole('status')).textContent).toContain('alterado para Encerrado.');
    expect(mockTransition).toHaveBeenCalledWith(mockRequest, 'study-one', 'encerrado');
    const hero = screen.getByRole('heading', { level: 1, name: 'Qualidade do sono' }).closest('header')!;
    expect(within(hero).getByText('Encerrado')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Alterar estado/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Editar estudo/ })).toBeNull();
  });

  it('impede solicitações duplicadas enquanto a alteração está em andamento', async () => {
    mockTransition.mockReturnValue(new Promise<Study>(() => undefined));
    renderStudies();
    const dialog = await openStatusDialog('Atividade física');
    const confirm = within(dialog).getByRole('button', { name: 'Confirmar alteração' });

    fireEvent.click(confirm);
    fireEvent.click(confirm);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Alterando...' }));
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(mockTransition).toHaveBeenCalledTimes(1);
    expect((within(dialog).getByRole('button', { name: 'Cancelar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it.each([
    ['transição inválida', 'Transição de "planejamento" para "recrutamento" não permitida.'],
    ['estudo encerrado', 'Não é possível alterar um estudo encerrado.'],
    ['usuário sem permissão', 'Você não tem permissão para alterar este estudo.'],
    ['estudo inexistente', 'Estudo não encontrado.'],
    ['sessão expirada', 'Token inválido ou expirado. Entre novamente.'],
    ['falha de conexão', 'Não foi possível conectar à API de estudos. Verifique se o backend está ligado.'],
    ['erro do servidor', 'Ocorreu um erro inesperado no servidor. Tente novamente em alguns instantes.'],
  ])('em caso de %s, apresenta o erro e preserva o estado anterior', async (_case, message) => {
    mockTransition.mockRejectedValue(new Error(message));
    renderStudies();
    const dialog = await openStatusDialog('Atividade física');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirmar alteração' }));

    expect((await within(dialog).findByRole('alert')).textContent).toBe(message);
    expect((within(dialog).getByRole('button', { name: 'Confirmar alteração' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(card('Atividade física')).getByText('Planejamento')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('cancela sem enviar a alteração', async () => {
    renderStudies();
    const dialog = await openStatusDialog('Atividade física');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockTransition).not.toHaveBeenCalled();
  });

  it('sem usuário autenticado, não carrega estudos nem oferece alteração de estado', async () => {
    mockUseAuth.mockReturnValue({ user: null, accessToken: null, request: mockRequest });
    renderStudies();
    await screen.findByRole('alert');
    expect(screen.queryByRole('button', { name: /Alterar estado/ })).toBeNull();
    expect(mockTransition).not.toHaveBeenCalled();
  });
});
