import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudiesPage } from './StudiesPage';
import type { Study } from '../studies/studiesApi';
import type { WebUser } from '../types';

const { mockList, mockDetail, mockCreate, mockUpdate, mockUseAuth, mockRequest } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockDetail: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
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
    status: 'Em andamento',
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
    status: 'Planejado',
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
      target: { value: 'Encerrado' },
    });
    expect(screen.getByText('Nenhum estudo corresponde à busca.')).toBeTruthy();
  });

  it('apresenta erro ao carregar estudos e impede abrir o formulário', async () => {
    mockList.mockRejectedValue(new Error('API indisponível'));
    renderStudies();

    expect((await screen.findByRole('alert')).textContent).toContain('API indisponível');
    expect((screen.getByRole('button', { name: /Cadastrar estudo/ }) as HTMLButtonElement).disabled).toBe(true);
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
